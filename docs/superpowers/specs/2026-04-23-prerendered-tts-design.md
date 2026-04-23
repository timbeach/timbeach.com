# Pre-rendered TTS — design

**Date:** 2026-04-23
**Status:** approved, awaiting implementation plan
**Replaces:** `2026-04-21-wasm-tts-design.md` (in-browser Kokoro via Web Speech + WASM)

## Context

The Web Speech API and in-browser Kokoro (WASM) experiment shipped on the `ui-redesign` branch but failed on two fronts:
- **Web Speech on Linux Brave** — requires system `speech-dispatcher + espeak-ng`; without them, the voices list is empty and the read-aloud feature is dead for a non-trivial slice of Linux users.
- **Kokoro in-browser** — even moved to a Web Worker, synthesis on mid-range laptops is real-time-factor ≥1 on longer paragraphs, producing multi-second gaps between paragraphs and "page unresponsive" warnings before the worker refactor.

Paragraph-level highlighting is the accepted UX — per-word karaoke isn't required — which makes a pre-render path strictly better than any live-synth path: timings are exact by construction, playback starts instantly, and every reader gets the same experience regardless of OS or CPU.

## Decisions

| Dimension | Choice |
|---|---|
| Highlight granularity | Paragraph |
| TTS engine | Kokoro (local, Python via `kokoro-onnx`) |
| Voice strategy | Per-article, default `bm_lewis`, any Kokoro voice ID accepted |
| Native Web Speech fallback | **Dropped.** Uniform pre-rendered for every reader. |
| Audio format | Opus mono VBR, 64 kbps, `--application voip`, `.ogg` container |
| Concatenation | Single `.ogg` per article + `.timings.json` sidecar (not per-paragraph files) |
| Render trigger | Step in `publish-article` skill + standalone `render_article.py <slug>` |
| Backfill | One-time batch over existing articles with default voice |

RTF ~0.6× measured on the author's Aegix box for a 15s sample. A typical 5-min article renders in ~3 min.

## System overview

```
publish path (author's laptop):
  articles/<slug>.md
    │
    ▼
  tools/render_article.py  ──(uses)──▶  tools/models/*.onnx + voices-v1.0.bin
    │
    ├─ parse md → paragraphs (h2/h3/h4/p/li, strip code/img)
    ├─ for each para: kokoro.create(text, voice) → Float32 WAV
    ├─ concat WAVs, track cumulative start/end per paragraph
    ├─ ffmpeg → Opus 64k mono → audio/<slug>.ogg
    ├─ write audio/<slug>.timings.json
    └─ update articles/articles.json entry with audio/timings/voice/duration

read path (reader's browser):
  articles.json entry has `audio` → show TTS bar
  fetch timings.json; attach <audio src=audio/<slug>.ogg preload=none>
  on timeupdate: find paragraph by start/end, apply .tts-reading
  on paragraph click: audio.currentTime = timings[idx].start
```

## On-disk layout

New top-level `audio/` directory (rsynced to prod via existing `deploy.sh`; no exclusion needed):

```
audio/
  how-to-config-obsidian.ogg          ~0.5 MB for 5-min article
  how-to-config-obsidian.timings.json ~300 B
  ...
tools/
  render_article.py                    checked in
  requirements.txt                     checked in
  download-models.sh                   checked in — fetches ONNX + voices
  venv/                                gitignored
  models/                              gitignored (kokoro-v1.0.onnx + voices-v1.0.bin)
```

### `timings.json` schema

```json
{
  "voice": "bm_lewis",
  "duration": 187.3,
  "paragraphs": [
    { "idx": 0, "start": 0.0, "end": 4.2, "text": "How to Configure Obsidian" },
    { "idx": 1, "start": 4.2, "end": 8.7, "text": "Step 1: Ask Claude" }
  ]
}
```

The `text` field exists so the client can sanity-check `timings[idx].text === paraDomElement.textContent`. If the article was edited without re-rendering, the check fails and the TTS bar hides itself rather than highlighting the wrong paragraph.

### `articles.json` entry — added fields

```json
"how-to-config-obsidian.md": {
  "title": "How to Configure Obsidian",
  "date": "2026-04-21",
  "tags": ["obsidian", "claude-code"],
  "emoji": "🗒️",
  "audio": "audio/how-to-config-obsidian.ogg",
  "timings": "audio/how-to-config-obsidian.timings.json",
  "voice": "bm_lewis",
  "duration": 187.3
}
```

Absence of `audio` → no TTS bar for that article. Clean graceful-degradation.

## Render tool — `tools/render_article.py`

Single Python script, one job: markdown → audio + timings + articles.json update.

### CLI

```
tools/render_article.py <slug> [--voice bm_lewis] [--force]
tools/render_article.py --all   [--voice bm_lewis] [--force]
```

- `<slug>` — article slug matching `articles/<slug>.md`.
- `--all` — iterate every entry in `articles.json` (used for backfill).
- `--voice` — any Kokoro voice ID. Default `bm_lewis`.
- `--force` — re-render even if output is newer than source.

### Paragraph extraction — must match client

The client at `index.html:3904-3917` does:
```js
container.querySelectorAll('h2, h3, h4, p, li');   // selection
clone.querySelectorAll('code, img').forEach(c => c.remove());  // stripping
clone.textContent.trim();                           // text
```

The Python renderer uses a standard markdown library (`markdown-it-py` chosen — commonmark-compliant, has tree output) to produce HTML, then applies the same selection/stripping rules. For the site's simple markdown (headings, paragraphs, inline code, bold/italic, lists, tables, images) this produces an identical paragraph count in identical order.

If a future article uses markdown that the custom client-side parser treats differently from `markdown-it-py`, the `text` field mismatch check in the client surfaces it immediately.

### Pipeline steps

1. **Parse** `articles/<slug>.md` → HTML via `markdown-it-py` → DOM tree.
2. **Extract** h2/h3/h4/p/li in document order; inside each, drop `<code>` and `<img>` descendants; take plain text; filter empty.
3. **Render** each paragraph: `kokoro.create(text, voice=VOICE, lang="en-gb" if voice.startswith("b") else "en-us")` → Float32 samples at 24 kHz. Inferred lang follows the Kokoro prefix convention (`a*` = American, `b*` = British).
4. **Concat** samples in order; track cumulative `(start_sec, end_sec)` per paragraph.
5. **Write WAV** to a tempfile (concatenated).
6. **Encode**: `ffmpeg -nostdin -y -i <tmp.wav> -c:a libopus -b:a 64k -ac 1 -application voip -vbr on audio/<slug>.ogg`
7. **Write** `audio/<slug>.timings.json` from the tracked offsets + per-paragraph text.
8. **Update** `articles/articles.json`: set `audio`, `timings`, `voice`, `duration` on this slug's entry.
9. **Idempotency**: at start, if `audio/<slug>.ogg` mtime > `articles/<slug>.md` mtime AND `articles.json[slug].voice == --voice` AND `--force` absent, skip with a "skip: up to date" message.

### Output

Single final commit artifact pattern (authored per publish):
- `audio/<slug>.ogg` (new)
- `audio/<slug>.timings.json` (new)
- `articles/articles.json` (modified)

### Environment

```
tools/requirements.txt  → kokoro-onnx, soundfile, markdown-it-py
tools/download-models.sh → fetches kokoro-v1.0.onnx + voices-v1.0.bin from thewh1teagle/kokoro-onnx release into tools/models/
```

One-time setup for a fresh clone:
```
cd tools
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./download-models.sh
```

`ffmpeg` is a system dep — the script checks at startup and errors with an install hint.

## Skill integration — new step 4.5 in `publish-article`

After step 4 (write markdown + articles.json), before step 5 (local preview):

```
### 4.5 Render audio

Ask the user: "Which voice for the read-aloud? (default bm_lewis)"

Run:
  cd ~/code/PROJECTS/VULTR_0/sites/timbeach.com
  tools/venv/bin/python tools/render_article.py <slug> --voice <voice>

Report: audio duration, .ogg size, path. On failure: show error, pause
for the user to decide whether to fix or skip; if skipped, proceed
without populating the audio field.
```

Step 5 (local preview) then naturally includes the TTS bar for the new article.

Standalone re-render (without the full publish flow):
```
tools/venv/bin/python tools/render_article.py <slug> --voice af_nicole --force
```

## Client rewrite

### Deletions

- `const nativeEngine = { ... }` (entire object)
- `const kokoroEngine = { ... }` (entire object)
- `tts-worker.js` (entire file)
- `<button class="tts-hq" id="ttsHqBtn">` + all `.tts-hq*` CSS
- Voice `<select>` dropdown + its load/change handlers
- `ttsLoadVoices`, `ttsApplyEngineState`, `loadKokoro`, `ttsOnKokoroReady`, `ttsRevertToNative`
- Look-ahead queue (`tts.queue`, `ttsSynth`, `tts._pendingResumeIdx`, inflight map)
- `onvoiceschanged` registration
- `.tts-btn:disabled` / `.tts-speed-slider:disabled` visual feedback rules (no longer disable-able in the reduced flow)

Estimated ~600 lines removed; ~80 lines added.

### Retentions

- TTS bar markup (`#ttsBar`, play/pause/stop buttons, progress bar, speed slider, close)
- `.tts-reading` CSS (paragraph glow)
- Paragraph-click-to-seek behavior
- Speed slider behavior (now just `audio.playbackRate = rate`)
- `ttsCollectParagraphs` (now used only for DOM → index matching, not for splitting)

### New flow

```js
async function ttsOpen(articleSlug) {
  const meta = articlesJson[articleSlug + '.md'];
  if (!meta?.audio) return;  // graceful: no bar

  const timings = await fetch(meta.timings).then(r => r.json());

  // Sanity check — refuse to play if DOM ≠ timings
  const paras = ttsCollectParagraphs();
  if (paras.length !== timings.paragraphs.length ||
      paras[0].textContent.trim() !== timings.paragraphs[0].text) {
    console.warn('[tts] article differs from timings — hiding bar');
    return;
  }

  const audio = new Audio(meta.audio);
  audio.preload = 'none';
  audio.playbackRate = tts.rate;

  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    const idx = timings.paragraphs.findIndex(p => t >= p.start && t < p.end);
    if (idx !== -1 && idx !== tts.currentIndex) {
      paras.forEach(p => p.classList.remove('tts-reading'));
      paras[idx].classList.add('tts-reading');
      paras[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      tts.currentIndex = idx;
    }
  });

  // Paragraph click → seek
  paras.forEach((para, idx) => {
    para.addEventListener('click', () => {
      audio.currentTime = timings.paragraphs[idx].start;
      audio.play();
    });
  });

  // ... play/pause/stop/close wiring ...
}
```

Scrubbable, seekable, stoppable — all via native `<audio>` semantics. No engine state machine, no re-entrancy guards, no look-ahead, no abort controllers.

## Backfill

`tools/render_article.py --all` — iterates every entry in `articles.json`, renders each with the default voice (`bm_lewis`), skips the ones already up-to-date (same idempotency as the single-slug path).

```
tools/venv/bin/python tools/render_article.py --all
```

Run once. Commit the resulting `audio/` tree. Individual articles can be re-rendered later with a different voice via the per-slug form.

Estimated one-time cost: 15–30 minutes of CPU on the author's laptop for the current 14-article corpus.

## Error handling

| Failure | Behavior |
|---|---|
| Kokoro synth fails on a paragraph | Script exits non-zero; no partial files written; message `paragraph N failed: <reason>` |
| `ffmpeg` not installed | Startup check; error with `pacman -S ffmpeg` hint |
| Markdown has zero renderable paragraphs | Skip; warn; no audio for that article |
| Network fetch of `.ogg` fails client-side | `audio.onerror` handler hides the bar; console warning |
| Network fetch of `.timings.json` fails | Bar hidden before audio element is even created |
| Article edited after render | Client's `timings[idx].text !== paras[idx].textContent` check fires; bar hides; console warning nudges re-rendering |
| `articles.json` lacks `audio` field | Bar simply doesn't appear — graceful for articles never rendered |

## Testing

- **Render tool**:
  - Run on `how-to-config-obsidian.md`; assert `.ogg` + `.timings.json` exist, duration > 0, paragraph count matches markdown.
  - Run twice without `--force`; second run prints "skip: up to date".
  - Run with `--force`; second run re-renders.
  - Run with unknown voice → clear error from Kokoro, no partial files.
- **Client**:
  - Open article with audio → bar appears, play works, highlight advances, click-to-seek works, speed slider works, close stops.
  - Open article without audio (e.g. an older article pre-backfill) → no bar.
  - Edit a paragraph in an article post-render, reload → bar hides itself, console warning visible.
  - Open on a Linux browser with no speech-dispatcher — confirm the bar still works (this was the original bug).
- **Pipeline end-to-end**: publish a new dummy article via the skill with the 4.5 step wired in; confirm audio renders, preview shows the bar, deploy copies `audio/` to prod.

## Out of scope (explicit)

- Pause-and-resume state persistence across page loads.
- Per-reader voice preference (voice is baked in at publish time).
- Word-level karaoke highlighting (paragraph-level is accepted).
- Transcripts (markdown is already the transcript).
- Mobile-specific UX tweaks beyond what the existing TTS bar already does.
- Cleanup of the old WASM/worker code on the `ui-redesign` branch is part of this implementation, not a separate effort.
