# TTS Pipeline — Architecture Reference

Read this when changing the render tool, the client TTS code, the publish-article skill's render step, or the validate gate. For day-to-day operational tasks (rendering an article, picking a voice, debugging a stale render), see the **TTS Pipeline** section in `CLAUDE.md`.

## Overview

```
publish-time (author's laptop):
  articles/<slug>.md
        │
        ▼
  tools/render_article.py  ──(uses)──▶  tools/models/{kokoro-v1.0.onnx, voices-v1.0.bin}
        │
        ├─ parse markdown via markdown-it-py + bs4 → paragraph list
        ├─ for each paragraph: kokoro.create(text, voice) → float32 PCM @ 24 kHz
        ├─ concat samples; track cumulative (start_sec, end_sec) per paragraph
        ├─ ffmpeg → Opus 64 kbps mono → audio/<slug>.ogg
        ├─ write audio/<slug>.timings.json
        └─ update articles/articles.json with audio/timings/voice/duration

read-time (reader's browser):
  load articles.json; entry has `audio` → render the read-aloud button
  on click: fetch timings.json, sanity-check vs DOM, attach <audio>
  on timeupdate: scan timings, apply .tts-reading to current paragraph
  on paragraph click: audio.currentTime = timings[idx].start; audio.play()
```

## File Layout

```
articles/
  *.md                            article markdown
  articles.json                   metadata registry
audio/
  <slug>.ogg                      Opus 64k mono — typically 0.5 MB per 5 min
  <slug>.timings.json             {voice, duration, paragraphs:[{idx,start,end,text}]}
tools/
  render_article.py               CLI + library (one Python file, ~290 lines)
  test_render_article.py          26 pytest tests (TDD-driven)
  requirements.txt                kokoro-onnx, soundfile, markdown-it-py, beautifulsoup4, pytest
  download-models.sh              one-shot downloader; idempotent
  venv/                           gitignored
  models/                         gitignored (kokoro-v1.0.onnx ~310 MB + voices-v1.0.bin ~27 MB)
docs/superpowers/
  specs/2026-04-23-prerendered-tts-design.md
  plans/2026-04-23-prerendered-tts.md
```

## Render Tool — `tools/render_article.py`

A single Python file with five pure functions and an orchestrator + CLI:

| Function | Responsibility |
|---|---|
| `extract_paragraphs(md_text)` | Markdown → list of paragraph strings, matching the client's `h2/h3/h4/p/li` selector and `code/img` stripping. Uses `markdown-it-py` (with `enable("table")` so tables don't become pipe-text paragraphs) + BeautifulSoup. |
| `render_paragraphs(paras, voice, synth)` | Synthesizes each paragraph via the injected `synth` callable, concatenates float32 samples, returns cumulative `(start_sec, end_sec, text)` timings. `synth` injection lets tests mock Kokoro entirely. |
| `_synth_with_fallback(text, voice, synth)` | Wraps a single synth call. On phoneme-overflow errors, splits on sentence boundaries (`.!?`) and recurses. Re-raises with a clearer message if a sentence still doesn't fit. |
| `encode_opus(samples, sr, out_path)` | Writes a tempfile WAV via `soundfile`, then `ffmpeg -c:a libopus -b:a 64k -ac 1 -application voip -vbr on` → `.ogg`. Cleans up the WAV in a `finally`. |
| `write_timings_json(path, voice, duration, timings)` | Writes the sidecar JSON with 2-space indent + trailing newline. |
| `update_articles_json(path, filename, ...)` | In-place merge of audio/timings/voice/duration onto an existing entry. Raises `KeyError` for unknown slugs. |
| `validate_article(slug)` | Compares paragraph count + first-paragraph text between the current markdown and the committed timings. Returns `(ok, msg)`. |
| `render_article(slug, voice, force, kokoro)` | Orchestrates the above. Idempotency check (mtime + voice match). |
| `main(argv)` | argparse: `<slug> | --all | --validate`, `--voice`, `--force`. Lazy-loads Kokoro so `--help` is fast. |

### Idempotency

```py
if not force and ogg_path.exists() and timings_path.exists():
    if ogg_path.stat().st_mtime > md_path.stat().st_mtime:
        if articles_json[slug]["voice"] == voice:
            return False  # skip
```

The mtime check catches "I edited the markdown, need to re-render." The voice-match check catches "I want to switch this article from `bm_lewis` to `af_nicole`."

### `--all` failure handling

The batch loop **continues past individual failures** (collects errors, returns non-zero only if any). Without this, one bad article would skip every article that comes after it alphabetically.

## Client — `index.html`

The TTS-related code in `index.html` is ~130 lines, replacing the ~600 lines of WASM/native engine plumbing the design originally tried. The state is:

```js
const tts = {
  bar, playBtn, playIcon, stopBtn, progress, label, statusText,
  speedSlider, speedLabel, closeBtn,    // DOM refs
  audio: null,        // HTMLAudioElement
  timings: null,      // {voice, duration, paragraphs: [...]}
  paragraphs: [],     // DOM elements (h3/h4/p/li, filtered non-empty)
  currentIndex: -1,
  rate: 1.0,
};
```

### `ttsOpen(articleFilename)`

1. Look up `articles[articleFilename]`; bail if no `audio`/`timings` paths.
2. Fetch the timings sidecar.
3. Collect DOM paragraphs via `ttsCollectParagraphs()` (selector `h3, h4, p, li`, filter empty via `ttsGetText()`).
4. Sanity check: `paras.length === timings.paragraphs.length` AND first paragraph's text matches. If not, hide the bar.
5. Tear down any previous session.
6. Create `<audio>`, set `preload='none'`, attach `timeupdate`/`ended`/`error` listeners.
7. Wire paragraph-click-to-seek (with a `data-ttsWired` flag, cleared in `ttsClose`).
8. Show the bar (`tts.bar.classList.add('visible')`).
9. **Auto-play** — the read-aloud click was the user gesture, so browser autoplay policy allows it.

### `ttsOnTimeUpdate`

Linear scan over `timings.paragraphs` to find the current one; applies `.tts-reading` to the matching DOM element. Linear is fine — articles top out around 200 paragraphs, `timeupdate` fires ~4 Hz.

### Stop button (skip-to-start)

Despite its label evolution, the button rewinds `audio.currentTime = 0`. The icon (`|◄`) and `title` attribute now spell that out: `Rewind to start — click play again to hear the article from the top`. Status line on click reads `back to the top — press play to start over`. The play/pause button is the normal "I'm done" affordance — `currentTime` retained.

## Heading-Selector Asymmetry — The Coupling You Need to Remember

The client's `parseMarkdown` is a custom, non-CommonMark regex pipeline. Two divergences matter:

### Heading levels are offset

```js
.replace(/^# (.+)$/gm, '<h2>$1</h2>')
.replace(/^## (.+)$/gm, '<h3>$1</h3>')
.replace(/^### (.+)$/gm, '<h4>$1</h4>');
```

So on the client, `# Title` becomes `<h2>` (not `<h1>`), and the article title is structurally indistinguishable from a level-2 heading.

Python (`markdown-it-py`) follows CommonMark: `# Title` → `<h1>`, `##` → `<h2>`, `###` → `<h3>`.

Python's selector is `h2, h3, h4, p, li`. The client's selector is `h3, h4, p, li`. They produce identical paragraph counts because:

- `# Title` → client `<h2>` (not selected) and Python `<h1>` (not selected). **Skipped on both sides.**
- `## Section` → client `<h3>` and Python `<h2>`. **Read on both sides.**
- `### Sub` → client `<h4>` and Python `<h3>`. **Read on both sides.**
- `#### Subsub` → client doesn't match this regex; falls through to paragraph wrapping → `<p>...</p>` (read). Python → `<h4>` (read). **Read on both sides.**

If you ever change the client's heading regexes (e.g., bring them into CommonMark alignment with `# → <h1>`), update `extract_paragraphs`'s selector to `h1, h2, h3, h4, p, li` simultaneously. Or remove the offset entirely and use `h2, h3, h4, p, li` on both. The two selectors must stay synchronized.

### Per-line `<p>` wrapping

The client's paragraph step is:
```js
.replace(/\n\n/g, '</p><p>')
.replace(/^(.+)$/gm, '<p>$1</p>');
```

The second line wraps **every non-blank line** in its own `<p>`. This means a verse-style article with single-`\n` line separators visually renders as a stack of separate paragraphs — but Python (CommonMark) merges those single-newline lines into one paragraph.

For paragraph count + DOM parity, **articles must use `\n\n` between every line you want to be its own paragraph.** If you write `\n`-separated verse style, Python and client will disagree (Python sees one paragraph, client sees N), and the runtime sanity check will hide the bar.

The current corpus all uses `\n\n` separators because we discovered this constraint when shipping `jungian-dream-notes`.

## Sanity Check vs True Validation

The client checks `paras.length === timings.paragraphs.length` and `paras[0].textContent === timings[0].text`. This catches:

- ✅ **Article edited after render** (paragraph count or first-text differs)
- ✅ **Wrong timings file served** (different article's text in slot 0)
- ❌ **Mid-article edits that preserve count + first-paragraph** (silently ships)

The server-side `--validate` does the same thing in Python, against the markdown on disk.

Neither check catches **client/server parser divergence**: both could agree on paragraph count derived from their own parse, but disagree about what the parse means structurally. The two known divergences (heading levels, per-line wrapping) are documented above. A third divergence — should one ever appear — would manifest as "validate passes locally and on deploy, but the runtime sanity check still hides the bar in the browser."

The robust fix for that scenario is to extract `parseMarkdown` into a shared `.js` file and run it from `tools/render_article.py` via Node + jsdom, comparing the client's actual parse against Python's. We didn't do this because for the current article corpus, both known divergences are documented and avoidable, and a third divergence has not materialized in practice.

## Deploy Gate

`deploy.sh` runs the full `--validate` over every entry in `articles.json` before invoking `rsync`. With `set -e` at the top of the script, a failed validate aborts the rsync — stale audio cannot reach prod. The local-only gitignored `deploy.sh` lives outside version control because it contains the rsync target host.

The script also passes `--exclude tools/` and `--exclude audition/` to rsync so the venv (~340 MB) and ONNX models (~340 MB) never go to the VPS. Only `audio/` and the article assets ship.

## Test Coverage

`tools/test_render_article.py` has 26 pytest tests across:

- `extract_paragraphs`: 8 cases (simple, h-skip, code/img stripping, fenced blocks, lists, bold/italic, empty, tables-skipped)
- `render_paragraphs`: 4 cases (concat, single, empty, variable lengths) + 3 cases for the sentence-split fallback
- `write_timings_json` + `update_articles_json`: 5 cases (shape, field merge, KeyError, formatting preservation)
- `encode_opus`: 1 ffprobe-verified smoke test
- `validate_article`: 5 cases (OK, count mismatch, first-text mismatch, missing markdown, missing timings)

Run with:
```sh
cd tools
./venv/bin/pytest test_render_article.py -v
```

## Voice Choice

The default `bm_lewis` (British male, mature) was picked from a 19-voice audition during the original brainstorm. The audition page at `audition/audition.html` is no longer in the repo, but the same render script can rebuild it: feed any voice ID into `tools/render_article.py {slug} --voice <id> --force`. Voice IDs are in the Kokoro v1.0 catalog; prefixes `bf_`/`bm_` route to `en-gb`, `af_`/`am_` to `en-us`.

## Real-Time Factor

On the author's mid-range laptop (no GPU, q8 ONNX), Kokoro renders at RTF ~0.6× — a 5-minute article takes ~3 minutes to render. A `--all` backfill of the current 15-article corpus is ~30 minutes of wall time. RTF is invariant across `--force` re-renders since the model and decode path don't change.
