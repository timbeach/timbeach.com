# Pre-rendered TTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-browser Kokoro WASM TTS with a publish-time render pipeline that produces one Opus audio file + timings sidecar per article; gut the client TTS code down to ~80 lines driven by `<audio>.timeupdate`.

**Architecture:** A Python script (`tools/render_article.py`) turns each `articles/<slug>.md` into `audio/<slug>.ogg` + `audio/<slug>.timings.json`, updating `articles/articles.json` with audio metadata. The client fetches the timings sidecar, attaches a native `<audio>` element, and highlights paragraphs by mapping `currentTime` to precomputed paragraph offsets.

**Tech Stack:** Python 3 + `kokoro-onnx`, `soundfile`, `markdown-it-py`, `beautifulsoup4`, `pytest`; `ffmpeg` (libopus); vanilla JS (HTMLAudioElement).

**Branch:** `ui-redesign` (no separate worktree — the branch will delete its own WASM commits' artifacts as it adds the new system).

**Spec:** `docs/superpowers/specs/2026-04-23-prerendered-tts-design.md`

---

## Task 1: Tools environment setup

**Files:**
- Create: `tools/requirements.txt`
- Create: `tools/download-models.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Create `tools/requirements.txt`**

```
kokoro-onnx>=0.4
soundfile>=0.12
markdown-it-py>=3.0
beautifulsoup4>=4.12
pytest>=8.0
```

- [ ] **Step 2: Create `tools/download-models.sh`**

```sh
#!/bin/sh
# Downloads Kokoro ONNX weights + voice embeddings into tools/models/.
# Idempotent: skips files that already exist.
set -e
DIR="$(dirname "$0")/models"
mkdir -p "$DIR"
cd "$DIR"

BASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

if [ ! -f kokoro-v1.0.onnx ]; then
  echo "→ kokoro-v1.0.onnx (~310 MB)"
  wget -q --show-progress "$BASE/kokoro-v1.0.onnx"
fi

if [ ! -f voices-v1.0.bin ]; then
  echo "→ voices-v1.0.bin (~27 MB)"
  wget -q --show-progress "$BASE/voices-v1.0.bin"
fi

echo "done."
```

Then make it executable:

```
chmod +x tools/download-models.sh
```

- [ ] **Step 3: Update `.gitignore`**

Append these lines (preserving existing entries):

```
tools/venv/
tools/models/
```

- [ ] **Step 4: Create venv + install deps + download models**

```
cd /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com
python3 -m venv tools/venv
tools/venv/bin/pip install --upgrade pip
tools/venv/bin/pip install -r tools/requirements.txt
tools/download-models.sh
```

Verify:

```
tools/venv/bin/python -c "import kokoro_onnx, soundfile, markdown_it, bs4; print('ok')"
ls -lh tools/models/
```

Expected: `ok`; two files, `kokoro-v1.0.onnx` (~311 MB) and `voices-v1.0.bin` (~27 MB).

- [ ] **Step 5: Commit**

```
git add tools/requirements.txt tools/download-models.sh .gitignore
git commit -m "Add tools/ scaffolding for TTS pre-render pipeline"
```

---

## Task 2: Paragraph extraction (TDD)

**Files:**
- Create: `tools/render_article.py` (paragraph-extraction function only)
- Create: `tools/test_render_article.py`

The function must match the client's rules in `index.html:3904-3917`:
1. Select `h2, h3, h4, p, li` in document order from the rendered HTML.
2. Inside each match, remove all `<code>` and `<img>` descendants.
3. Use `.get_text()` on the remainder, strip leading/trailing whitespace.
4. Filter out results that are empty after stripping.

- [ ] **Step 1: Write failing tests**

Create `tools/test_render_article.py`:

```python
from render_article import extract_paragraphs


def test_simple_paragraphs():
    md = "Hello world.\n\nSecond paragraph."
    assert extract_paragraphs(md) == ["Hello world.", "Second paragraph."]


def test_skips_h1_keeps_h2_h3_h4():
    md = "# Title\n\n## Section\n\nBody.\n\n### Sub\n\nMore.\n\n#### Deep\n\nEnd."
    assert extract_paragraphs(md) == ["Section", "Body.", "Sub", "More.", "Deep", "End."]


def test_strips_inline_code():
    md = "Run `foo` now."
    # matches client: removing <code> leaves adjacent spaces; textContent has two spaces.
    assert extract_paragraphs(md) == ["Run  now."]


def test_strips_images():
    md = "Before ![alt](x.png) after."
    assert extract_paragraphs(md) == ["Before  after."]


def test_skips_fenced_code_blocks():
    md = "```\nsome code\n```\n\nReal paragraph."
    assert extract_paragraphs(md) == ["Real paragraph."]


def test_list_items():
    md = "Intro\n\n- one\n- two\n- three\n\nOutro"
    assert extract_paragraphs(md) == ["Intro", "one", "two", "three", "Outro"]


def test_bold_italic_preserved():
    md = "This is **bold** and *italic*."
    assert extract_paragraphs(md) == ["This is bold and italic."]


def test_empty_and_title_only():
    assert extract_paragraphs("") == []
    assert extract_paragraphs("# Only a title") == []
```

- [ ] **Step 2: Run tests — expect failure**

```
cd tools
./venv/bin/pytest test_render_article.py -v
```

Expected: `ImportError` or `ModuleNotFoundError: No module named 'render_article'`.

- [ ] **Step 3: Create `tools/render_article.py` with the function**

```python
"""Pre-render an article's audio + paragraph timings for timbeach.com."""
from __future__ import annotations

from markdown_it import MarkdownIt
from bs4 import BeautifulSoup


# Must match client selector at index.html:3908
PARAGRAPH_SELECTOR = "h2, h3, h4, p, li"


def extract_paragraphs(md_text: str) -> list[str]:
    """Parse markdown, extract readable paragraphs matching client rules."""
    md = MarkdownIt("commonmark", {"html": False, "linkify": False})
    html = md.render(md_text)
    soup = BeautifulSoup(html, "html.parser")

    paragraphs: list[str] = []
    for el in soup.select(PARAGRAPH_SELECTOR):
        # Strip <code> and <img> descendants (client: clone.querySelectorAll('code, img').forEach(c => c.remove()))
        for tag in el.select("code, img"):
            tag.decompose()
        text = el.get_text().strip()
        if text:
            paragraphs.append(text)
    return paragraphs
```

- [ ] **Step 4: Run tests — expect pass**

```
cd tools
./venv/bin/pytest test_render_article.py -v
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```
git add tools/render_article.py tools/test_render_article.py
git commit -m "Add paragraph extractor matching client rules (TDD)"
```

---

## Task 3: Audio synthesis + concatenation (TDD)

**Files:**
- Modify: `tools/render_article.py` (add `render_paragraphs`)
- Modify: `tools/test_render_article.py` (add tests)

Function signature:
```python
def render_paragraphs(
    paragraphs: list[str],
    voice: str,
    synth: Callable[[str, str], tuple[np.ndarray, int]],
) -> tuple[np.ndarray, int, list[dict]]:
    """Synthesize each paragraph, concatenate, return (samples, sample_rate, timings)."""
```

`timings` is a list of `{"idx": int, "start": float, "end": float, "text": str}`.

`synth` is injected so tests can pass a fake synth without loading Kokoro (which is ~10s to init and several seconds per paragraph).

- [ ] **Step 1: Write failing tests**

Append to `tools/test_render_article.py`:

```python
import numpy as np
from render_article import render_paragraphs


def _fake_synth_factory(sr=24000, seconds_per_para=1.0):
    """Returns a fake synth that produces silence of fixed duration."""
    n_samples = int(sr * seconds_per_para)
    def synth(text, voice):
        return np.zeros(n_samples, dtype=np.float32), sr
    return synth


def test_concat_two_paragraphs_tracks_offsets():
    synth = _fake_synth_factory(sr=24000, seconds_per_para=1.0)
    samples, sr, timings = render_paragraphs(
        ["First paragraph.", "Second paragraph."],
        voice="bm_lewis",
        synth=synth,
    )
    assert sr == 24000
    assert len(samples) == 48000   # 2 seconds total
    assert len(timings) == 2
    assert timings[0] == {"idx": 0, "start": 0.0, "end": 1.0, "text": "First paragraph."}
    assert timings[1] == {"idx": 1, "start": 1.0, "end": 2.0, "text": "Second paragraph."}


def test_concat_single_paragraph():
    synth = _fake_synth_factory(sr=22050, seconds_per_para=2.5)
    samples, sr, timings = render_paragraphs(["Only one."], voice="bm_lewis", synth=synth)
    assert sr == 22050
    assert len(samples) == int(22050 * 2.5)
    assert timings == [{"idx": 0, "start": 0.0, "end": 2.5, "text": "Only one."}]


def test_concat_empty_list_returns_empty():
    synth = _fake_synth_factory()
    samples, sr, timings = render_paragraphs([], voice="bm_lewis", synth=synth)
    assert len(samples) == 0
    assert timings == []


def test_variable_length_paragraphs_compute_correct_offsets():
    # Simulate paragraphs of different lengths by varying the synth output.
    sr = 24000
    lengths_in_samples = [24000, 48000, 12000]  # 1s, 2s, 0.5s
    idx = [0]
    def synth(text, voice):
        n = lengths_in_samples[idx[0]]
        idx[0] += 1
        return np.zeros(n, dtype=np.float32), sr
    samples, sr_out, timings = render_paragraphs(
        ["a", "b", "c"], voice="bm_lewis", synth=synth,
    )
    assert sr_out == 24000
    assert len(samples) == sum(lengths_in_samples)
    assert timings[0]["start"] == 0.0 and timings[0]["end"] == 1.0
    assert timings[1]["start"] == 1.0 and timings[1]["end"] == 3.0
    assert timings[2]["start"] == 3.0 and timings[2]["end"] == 3.5
```

- [ ] **Step 2: Run tests — expect failure**

```
cd tools
./venv/bin/pytest test_render_article.py::test_concat_two_paragraphs_tracks_offsets -v
```

Expected: `ImportError: cannot import name 'render_paragraphs'`.

- [ ] **Step 3: Add `render_paragraphs` to `tools/render_article.py`**

Add at top:

```python
from typing import Callable

import numpy as np
```

Add function:

```python
def render_paragraphs(
    paragraphs: list[str],
    voice: str,
    synth: Callable[[str, str], tuple[np.ndarray, int]],
) -> tuple[np.ndarray, int, list[dict]]:
    """Synthesize each paragraph, concat, return (samples, sr, timings).

    `synth(text, voice)` must return (float32 samples, sample_rate).
    """
    if not paragraphs:
        return np.zeros(0, dtype=np.float32), 0, []

    chunks: list[np.ndarray] = []
    timings: list[dict] = []
    sample_rate: int | None = None
    cursor_samples = 0

    for idx, text in enumerate(paragraphs):
        samples, sr = synth(text, voice)
        if sample_rate is None:
            sample_rate = sr
        elif sr != sample_rate:
            raise ValueError(f"sample rate mismatch: paragraph {idx} returned {sr}, expected {sample_rate}")
        start = cursor_samples / sample_rate
        end = (cursor_samples + len(samples)) / sample_rate
        timings.append({"idx": idx, "start": start, "end": end, "text": text})
        chunks.append(samples)
        cursor_samples += len(samples)

    return np.concatenate(chunks), sample_rate, timings
```

- [ ] **Step 4: Run tests — expect pass**

```
cd tools
./venv/bin/pytest test_render_article.py -v
```

Expected: all tests pass (12 total after Task 2 + Task 3 additions).

- [ ] **Step 5: Commit**

```
git add tools/render_article.py tools/test_render_article.py
git commit -m "Add paragraph synthesis + concat with cumulative timings (TDD)"
```

---

## Task 4: JSON emission (TDD)

**Files:**
- Modify: `tools/render_article.py` (add `write_timings_json`, `update_articles_json`)
- Modify: `tools/test_render_article.py`

- [ ] **Step 1: Write failing tests**

Append to `tools/test_render_article.py`:

```python
import json
from render_article import write_timings_json, update_articles_json


def test_write_timings_json_shape(tmp_path):
    out = tmp_path / "slug.timings.json"
    timings = [
        {"idx": 0, "start": 0.0, "end": 1.5, "text": "Hello."},
        {"idx": 1, "start": 1.5, "end": 3.2, "text": "World."},
    ]
    write_timings_json(out, voice="bm_lewis", duration=3.2, timings=timings)
    data = json.loads(out.read_text())
    assert data == {
        "voice": "bm_lewis",
        "duration": 3.2,
        "paragraphs": timings,
    }


def test_update_articles_json_adds_fields(tmp_path):
    aj = tmp_path / "articles.json"
    aj.write_text(json.dumps({
        "foo.md": {"title": "Foo", "date": "2026-01-01", "tags": ["a"]},
        "bar.md": {"title": "Bar", "date": "2026-01-02", "tags": ["b"]},
    }, indent=2))
    update_articles_json(
        aj,
        filename="bar.md",
        audio="audio/bar.ogg",
        timings="audio/bar.timings.json",
        voice="bm_lewis",
        duration=42.5,
    )
    data = json.loads(aj.read_text())
    assert data["foo.md"] == {"title": "Foo", "date": "2026-01-01", "tags": ["a"]}
    assert data["bar.md"] == {
        "title": "Bar",
        "date": "2026-01-02",
        "tags": ["b"],
        "audio": "audio/bar.ogg",
        "timings": "audio/bar.timings.json",
        "voice": "bm_lewis",
        "duration": 42.5,
    }


def test_update_articles_json_unknown_slug_raises(tmp_path):
    aj = tmp_path / "articles.json"
    aj.write_text(json.dumps({"foo.md": {"title": "Foo"}}))
    import pytest
    with pytest.raises(KeyError):
        update_articles_json(aj, filename="missing.md", audio="x", timings="y", voice="z", duration=1.0)


def test_update_articles_json_preserves_formatting(tmp_path):
    """Output should be 2-space indented with trailing newline (matches existing file)."""
    aj = tmp_path / "articles.json"
    aj.write_text(json.dumps({"foo.md": {"title": "Foo"}}, indent=2) + "\n")
    update_articles_json(aj, filename="foo.md", audio="a", timings="t", voice="v", duration=1.0)
    text = aj.read_text()
    assert text.endswith("\n")
    assert '  "foo.md"' in text  # 2-space indent preserved
```

- [ ] **Step 2: Run tests — expect failure**

```
cd tools
./venv/bin/pytest test_render_article.py::test_write_timings_json_shape -v
```

Expected: `ImportError`.

- [ ] **Step 3: Implement the two functions**

Append to `tools/render_article.py`:

```python
import json
from pathlib import Path


def write_timings_json(
    path: Path,
    voice: str,
    duration: float,
    timings: list[dict],
) -> None:
    payload = {
        "voice": voice,
        "duration": round(duration, 3),
        "paragraphs": timings,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n")


def update_articles_json(
    path: Path,
    filename: str,
    audio: str,
    timings: str,
    voice: str,
    duration: float,
) -> None:
    """Add audio/timings/voice/duration to an existing article entry.

    Raises KeyError if the slug isn't already in the file.
    """
    data = json.loads(Path(path).read_text())
    if filename not in data:
        raise KeyError(f"articles.json has no entry for {filename!r}")
    data[filename]["audio"] = audio
    data[filename]["timings"] = timings
    data[filename]["voice"] = voice
    data[filename]["duration"] = round(duration, 3)
    Path(path).write_text(json.dumps(data, indent=2) + "\n")
```

- [ ] **Step 4: Run tests — expect pass**

```
cd tools
./venv/bin/pytest test_render_article.py -v
```

Expected: all tests pass (16 total).

- [ ] **Step 5: Commit**

```
git add tools/render_article.py tools/test_render_article.py
git commit -m "Add timings.json + articles.json writers (TDD)"
```

---

## Task 5: Opus encoding via ffmpeg subprocess (manual verification)

**Files:**
- Modify: `tools/render_article.py` (add `encode_opus`)
- Modify: `tools/test_render_article.py` (smoke test only)

This task wraps `ffmpeg` via subprocess. Full mocking adds no value; a smoke test against real ffmpeg on a tiny WAV is enough to catch regressions.

- [ ] **Step 1: Add `encode_opus` function**

Append to `tools/render_article.py`:

```python
import subprocess
import shutil
import tempfile
import soundfile as sf


def encode_opus(samples: np.ndarray, sample_rate: int, out_path: Path) -> None:
    """Write float32 samples to Opus/Ogg at 64 kbps mono, voip mode.

    Raises RuntimeError if ffmpeg isn't available or encoding fails.
    """
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found in PATH — install via your package manager")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)
    try:
        sf.write(str(wav_path), samples, sample_rate, subtype="PCM_16")
        result = subprocess.run(
            [
                "ffmpeg", "-nostdin", "-y", "-loglevel", "error",
                "-i", str(wav_path),
                "-c:a", "libopus",
                "-b:a", "64k",
                "-ac", "1",
                "-application", "voip",
                "-vbr", "on",
                str(out_path),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr}")
    finally:
        wav_path.unlink(missing_ok=True)
```

- [ ] **Step 2: Add smoke test**

Append to `tools/test_render_article.py`:

```python
from render_article import encode_opus


def test_encode_opus_smoke(tmp_path):
    """End-to-end: sine-wave float32 → .ogg that ffprobe can read."""
    sr = 24000
    duration = 0.5
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    samples = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    out = tmp_path / "out.ogg"
    encode_opus(samples, sr, out)
    assert out.exists()
    assert out.stat().st_size > 500  # sanity: non-empty output
    # Verify ffprobe recognizes it as Opus
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1",
         str(out)],
        capture_output=True, text=True,
    )
    assert probe.stdout.strip() == "opus"
```

- [ ] **Step 3: Run test**

```
cd tools
./venv/bin/pytest test_render_article.py::test_encode_opus_smoke -v
```

Expected: PASS. If ffmpeg isn't installed, the prior `shutil.which` guard raises a clear RuntimeError.

- [ ] **Step 4: Commit**

```
git add tools/render_article.py tools/test_render_article.py
git commit -m "Add ffmpeg Opus encoder with ffprobe smoke test"
```

---

## Task 6: CLI wiring — single-slug path

**Files:**
- Modify: `tools/render_article.py` (add `main`, Kokoro init, CLI)

- [ ] **Step 1: Add Kokoro synth wrapper and main entry**

Append to `tools/render_article.py`:

```python
import argparse
import os
import sys
import time


REPO_ROOT = Path(__file__).resolve().parent.parent
ARTICLES_JSON = REPO_ROOT / "articles" / "articles.json"
ARTICLES_DIR = REPO_ROOT / "articles"
AUDIO_DIR = REPO_ROOT / "audio"
MODEL_DIR = Path(__file__).resolve().parent / "models"


def _load_kokoro():
    """Lazy-load Kokoro so `--help` doesn't pay the ~10s init cost."""
    from kokoro_onnx import Kokoro
    return Kokoro(
        str(MODEL_DIR / "kokoro-v1.0.onnx"),
        str(MODEL_DIR / "voices-v1.0.bin"),
    )


def _kokoro_synth(kokoro, voice: str):
    """Return a synth(text, voice) closure bound to a loaded Kokoro instance."""
    lang = "en-gb" if voice.startswith("b") else "en-us"
    def synth(text: str, _voice: str):
        samples, sr = kokoro.create(text, voice=_voice, speed=1.0, lang=lang)
        return samples, sr
    return synth


def render_article(slug: str, voice: str, force: bool, kokoro) -> bool:
    """Render one article. Returns True if rendered, False if skipped."""
    md_path = ARTICLES_DIR / f"{slug}.md"
    ogg_path = AUDIO_DIR / f"{slug}.ogg"
    timings_path = AUDIO_DIR / f"{slug}.timings.json"

    if not md_path.exists():
        raise FileNotFoundError(f"{md_path} does not exist")

    # Idempotency: skip if output newer than source AND voice hasn't changed.
    if not force and ogg_path.exists() and timings_path.exists():
        if ogg_path.stat().st_mtime > md_path.stat().st_mtime:
            current = json.loads(ARTICLES_JSON.read_text())
            if current.get(f"{slug}.md", {}).get("voice") == voice:
                print(f"  skip {slug}: up to date (voice={voice})")
                return False

    md_text = md_path.read_text()
    paragraphs = extract_paragraphs(md_text)
    if not paragraphs:
        print(f"  skip {slug}: no readable paragraphs")
        return False

    print(f"  rendering {slug} ({len(paragraphs)} paragraphs, voice={voice})…", flush=True)
    t0 = time.time()
    synth = _kokoro_synth(kokoro, voice)
    samples, sr, timings = render_paragraphs(paragraphs, voice=voice, synth=synth)
    duration = len(samples) / sr

    AUDIO_DIR.mkdir(exist_ok=True)
    encode_opus(samples, sr, ogg_path)
    write_timings_json(timings_path, voice=voice, duration=duration, timings=timings)
    update_articles_json(
        ARTICLES_JSON,
        filename=f"{slug}.md",
        audio=f"audio/{slug}.ogg",
        timings=f"audio/{slug}.timings.json",
        voice=voice,
        duration=duration,
    )

    size_mb = ogg_path.stat().st_size / 1024 / 1024
    print(f"    {duration:.1f}s audio, {size_mb:.2f} MB, {time.time()-t0:.1f}s render")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render article audio + paragraph timings")
    parser.add_argument("slug", nargs="?", help="article slug (without .md)")
    parser.add_argument("--all", action="store_true", help="render every article in articles.json")
    parser.add_argument("--voice", default="bm_lewis", help="Kokoro voice ID (default: bm_lewis)")
    parser.add_argument("--force", action="store_true", help="re-render even if output is up-to-date")
    args = parser.parse_args(argv)

    if not args.slug and not args.all:
        parser.error("either <slug> or --all is required")
    if args.slug and args.all:
        parser.error("pass <slug> OR --all, not both")

    kokoro = _load_kokoro()

    if args.all:
        data = json.loads(ARTICLES_JSON.read_text())
        slugs = [name[:-3] for name in data if name.endswith(".md")]
        rendered = 0
        for slug in slugs:
            try:
                if render_article(slug, args.voice, args.force, kokoro):
                    rendered += 1
            except Exception as e:
                print(f"  ERROR {slug}: {e}", file=sys.stderr)
                return 1
        print(f"done: {rendered}/{len(slugs)} articles rendered")
        return 0

    try:
        render_article(args.slug, args.voice, args.force, kokoro)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verify `--help` works without loading Kokoro**

```
tools/venv/bin/python tools/render_article.py --help
```

Expected: help text prints in under a second (no model load).

- [ ] **Step 3: Smoke test on `how-to-config-obsidian.md`**

```
tools/venv/bin/python tools/render_article.py how-to-config-obsidian --voice bm_lewis
```

Expected output (durations will vary):
```
  rendering how-to-config-obsidian (N paragraphs, voice=bm_lewis)…
    XX.Xs audio, Y.YY MB, ZZ.Zs render
```

Verify the artifacts:

```
ls -lh audio/
python3 -m json.tool audio/how-to-config-obsidian.timings.json | head -20
jq '."how-to-config-obsidian.md"' articles/articles.json
```

Expected: `audio/how-to-config-obsidian.ogg` exists, `.timings.json` has the right shape, `articles.json` has the new fields.

- [ ] **Step 4: Test idempotency**

Re-run the same command:

```
tools/venv/bin/python tools/render_article.py how-to-config-obsidian --voice bm_lewis
```

Expected: `skip how-to-config-obsidian: up to date (voice=bm_lewis)`.

- [ ] **Step 5: Test `--force`**

```
tools/venv/bin/python tools/render_article.py how-to-config-obsidian --voice bm_lewis --force
```

Expected: re-renders.

- [ ] **Step 6: Play the result to sanity-check audio**

```
ffplay -nodisp -autoexit audio/how-to-config-obsidian.ogg
```

(or open in any audio player). Listen for ~10 seconds — should sound like bm_lewis reading the article.

- [ ] **Step 7: Commit the tool**

```
git add tools/render_article.py
git commit -m "Wire CLI: render_article.py <slug> / --all / --voice / --force"
```

(Do NOT commit the `audio/` artifacts yet — that's Task 7.)

---

## Task 7: Backfill all articles

**Files:**
- Modify: `audio/*` (new files, committed)
- Modify: `articles/articles.json` (updated with new fields for every entry)

- [ ] **Step 1: Run batch backfill**

```
cd /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com
tools/venv/bin/python tools/render_article.py --all --voice bm_lewis
```

Expected: iterates all 14 articles, renders each, skips the already-rendered `how-to-config-obsidian` (unless `--force`). Total wall time ~15–30 min.

- [ ] **Step 2: Spot-check output**

```
ls -lh audio/ | head -20
jq 'keys | length, [to_entries[] | select(.value.audio != null)] | length' articles/articles.json
```

Expected: second line outputs the same number twice (every entry now has an `audio` field).

- [ ] **Step 3: Play 2–3 random articles to confirm quality**

```
for f in audio/*.ogg | shuf -n 3; do echo "=== $f"; ffplay -nodisp -autoexit -t 15 "$f"; done
```

- [ ] **Step 4: Commit the backfill**

```
git add audio/ articles/articles.json
git commit -m "Backfill: render audio for all 14 articles (voice=bm_lewis)"
```

---

## Task 8: Delete WASM client code

**Files:**
- Modify: `index.html` (large deletions)
- Delete: `tts-worker.js`
- Delete: `tts-mockup.html` (leftover preview from exploration)

The client code that becomes dead with the pre-rendered pipeline:
- `nativeEngine` object (entire const)
- `kokoroEngine` object (entire const)
- `<button class="tts-hq" id="ttsHqBtn">` + all `.tts-hq*` CSS rules
- Voice `<select id="ttsVoiceSelect">` + its options rendering
- `ttsLoadVoices`, `ttsApplyEngineState`, `loadKokoro`, `ttsOnKokoroReady`, `ttsRevertToNative`
- Look-ahead queue: `tts.queue`, `ttsSynth`, `tts._pendingResumeIdx`
- `onvoiceschanged` listener registration
- `.tts-btn:disabled` / `.tts-speed-slider:disabled` CSS rules
- References to `tts.engine`, `_currentAudio._cancel`, `_keepAlive`/`_resumeInterval`

- [ ] **Step 1: Find all blocks to delete with line numbers**

```
cd /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com
grep -n "nativeEngine\|kokoroEngine\|ttsHqBtn\|tts-hq\|ttsVoiceSelect\|ttsLoadVoices\|loadKokoro\|ttsOnKokoroReady\|ttsRevertToNative\|ttsApplyEngineState\|tts\.queue\|ttsSynth\|_pendingResumeIdx\|_currentAudio\|onvoiceschanged\|_resumeInterval\|_keepAlive" index.html | head -60
```

Review the output; you should see hits spanning roughly lines 1594–1610 (disabled CSS), 1800–1850 (HQ button markup + CSS), 3592–3700 (nativeEngine), 3723–3844 (kokoroEngine), 3880–3935 (ttsLoadVoices, ttsApplyEngineState), 3938–4030 (loadKokoro, ttsOnKokoroReady), ~4090–4115 (ttsStop queue cleanup), 4133–4145 (ttsSynth), 4200–4235 (look-ahead), 4250–4280 (paragraph-click queue invalidation), 4290–4330 (ttsRevertToNative, HQ click handler), 4338–4360 (speed slider queue invalidation).

- [ ] **Step 2: Delete `tts-worker.js` and `tts-mockup.html`**

```
git rm tts-worker.js tts-mockup.html
```

- [ ] **Step 3: Delete `nativeEngine` (index.html ~3592–3720)**

Use Read to locate the exact bounds of `const nativeEngine = { ... };` and remove the block with Edit.

- [ ] **Step 4: Delete `kokoroEngine` (index.html ~3723–3844)**

Same approach — locate and remove the entire `const kokoroEngine = { ... };` block.

- [ ] **Step 5: Delete HQ button markup + voice dropdown**

In the TTS bar HTML (`<div id="ttsBar">` region), remove:
- The `<button class="tts-hq" id="ttsHqBtn">` element
- The `<select id="ttsVoiceSelect">` element
- Any wrapper/label elements that now have no content

- [ ] **Step 6: Delete HQ + disabled-state CSS**

Find and delete all rules matching these selectors:
- `.tts-hq`, `.tts-hq.loading`, `.tts-hq.ready`, `.tts-hq.promoted`
- `@keyframes tts-pulse`
- `.tts-btn:disabled`, `.tts-speed-slider:disabled`

- [ ] **Step 7: Delete engine-aware functions**

Remove these functions from `index.html` entirely:
- `ttsLoadVoices`
- `ttsApplyEngineState`
- `loadKokoro`
- `ttsOnKokoroReady`
- `ttsRevertToNative`
- `ttsSynth`
- Any `_pendingResumeIdx` / `_keepAlive` / `_resumeInterval` helper methods

Also remove their callers (e.g. the HQ button click handler, the `onvoiceschanged` listener registration, the initial `ttsLoadVoices()` call).

- [ ] **Step 8: Remove `queue` and engine fields from `tts` object literal**

In the `const tts = { ... }` literal, delete:
- `engine: nativeEngine,`
- `selectedVoiceId: null,`
- `queue: { current: null, next: null, inflight: new Map() },`
- `hqBtn: document.getElementById('ttsHqBtn'),`
- `voiceSelect: document.getElementById('ttsVoiceSelect'),`

Task 9 will add the new fields (`audio`, `timings`, etc.).

- [ ] **Step 9: Verify page loads without JS errors**

Start the local server if it's not already:

```
cd /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com
python3 -m http.server 8000 &
```

Open `http://localhost:8000/#articles/how-to-config-obsidian.md` in a browser. Open DevTools Console. Expected: **no red errors**. The TTS bar may be broken/hidden/absent — that's fine at this stage. The page itself must load cleanly.

- [ ] **Step 10: Commit the deletions**

```
git add -u
git add index.html
git commit -m "Remove WASM/native TTS engines — pre-rendered pipeline takes over"
```

Expected diff stat: ~600 lines removed from `index.html`, `tts-worker.js` deleted, `tts-mockup.html` deleted.

---

## Task 9: Build new pre-rendered TTS client flow

**Files:**
- Modify: `index.html` (new client TTS logic, ~80 lines)

Reuse retained pieces from the previous code: the TTS bar markup (play/pause/stop/progress/speed/close/status), the `.tts-reading` CSS, `ttsCollectParagraphs`, the general shape of `ttsOpen`/`ttsClose`/`ttsPlay`/`ttsPause`/`ttsStop`/`ttsUpdateProgress`.

Replace all engine-driven logic with a single `<audio>` element.

- [ ] **Step 1: Update `tts` object literal**

Find the `const tts = { ... }` block. Replace with:

```javascript
const tts = {
  bar: document.getElementById('ttsBar'),
  playBtn: document.getElementById('ttsPlayBtn'),
  playIcon: document.getElementById('ttsPlayIcon'),
  stopBtn: document.getElementById('ttsStopBtn'),
  progress: document.getElementById('ttsProgress'),
  label: document.getElementById('ttsLabel'),
  statusText: document.getElementById('ttsStatusText'),
  speedSlider: document.getElementById('ttsSpeedSlider'),
  speedLabel: document.getElementById('ttsSpeedLabel'),
  closeBtn: document.getElementById('ttsClose'),

  audio: null,         // HTMLAudioElement (lazy, one per ttsOpen)
  timings: null,       // {voice, duration, paragraphs: [{idx,start,end,text}]}
  paragraphs: [],      // DOM elements (ttsCollectParagraphs result)
  currentIndex: -1,
  rate: 1.0,
};
```

- [ ] **Step 2: Implement `ttsOpen`**

Replace the old `ttsOpen` with:

```javascript
// Open the TTS bar for the currently displayed article.
// `articleFilename` is the key in articles.json (e.g. "how-to-config-obsidian.md").
async function ttsOpen(articleFilename) {
  const meta = articlesData?.[articleFilename];
  if (!meta?.audio || !meta?.timings) {
    // Article has no pre-rendered audio → no TTS bar.
    return;
  }

  // Fetch timings sidecar
  let timings;
  try {
    const res = await fetch(meta.timings);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    timings = await res.json();
  } catch (e) {
    console.warn('[tts] failed to load timings:', e);
    return;
  }

  // Collect paragraph DOM and sanity-check against timings.
  const paras = ttsCollectParagraphs();
  if (paras.length !== timings.paragraphs.length) {
    console.warn('[tts] paragraph count mismatch (' + paras.length + ' dom vs '
      + timings.paragraphs.length + ' timings) — article was edited without re-render. Hiding bar.');
    return;
  }
  const firstDomText = ttsGetText(paras[0]);
  if (firstDomText !== timings.paragraphs[0].text) {
    console.warn('[tts] first paragraph text mismatch — article was edited without re-render. Hiding bar.');
    return;
  }

  // Wire state
  tts.paragraphs = paras;
  tts.timings = timings;
  tts.currentIndex = -1;
  tts.rate = parseFloat(tts.speedSlider.value) || 1.0;

  // Audio element
  const audio = new Audio(meta.audio);
  audio.preload = 'none';
  audio.playbackRate = tts.rate;
  tts.audio = audio;

  audio.addEventListener('timeupdate', ttsOnTimeUpdate);
  audio.addEventListener('ended', ttsOnEnded);
  audio.addEventListener('error', () => {
    console.warn('[tts] audio failed to load — hiding bar');
    ttsClose();
  });

  // Paragraph-click seek
  paras.forEach((para, idx) => {
    para.style.cursor = 'pointer';
    para.addEventListener('click', () => {
      audio.currentTime = timings.paragraphs[idx].start;
      if (audio.paused) audio.play();
    });
  });

  // Show the bar
  tts.bar.classList.add('active');
  document.querySelector('.article-content')?.classList.add('tts-active');
  tts.statusText.textContent = 'ready';
  tts.playIcon.innerHTML = PLAY_SVG;
  tts.progress.style.width = '0%';
}
```

- [ ] **Step 3: Implement `ttsOnTimeUpdate`**

```javascript
function ttsOnTimeUpdate() {
  if (!tts.audio || !tts.timings) return;
  const t = tts.audio.currentTime;
  const paras = tts.timings.paragraphs;
  // linear scan is fine — articles have ~20 paragraphs tops
  let idx = -1;
  for (let i = 0; i < paras.length; i++) {
    if (t >= paras[i].start && t < paras[i].end) { idx = i; break; }
  }
  if (idx === -1 && t >= (paras[paras.length - 1]?.end || 0)) idx = paras.length - 1;

  if (idx !== tts.currentIndex && idx !== -1) {
    tts.paragraphs.forEach(p => p.classList.remove('tts-reading'));
    tts.paragraphs[idx].classList.add('tts-reading');
    tts.paragraphs[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    tts.currentIndex = idx;
    tts.statusText.textContent = `reading paragraph ${idx + 1} of ${paras.length}`;
  }

  // Progress bar
  const pct = Math.min(100, (t / tts.timings.duration) * 100);
  tts.progress.style.width = pct + '%';
}
```

- [ ] **Step 4: Implement transport handlers**

```javascript
function ttsOnEnded() {
  tts.statusText.textContent = 'finished';
  tts.playIcon.innerHTML = PLAY_SVG;
  tts.paragraphs.forEach(p => p.classList.remove('tts-reading'));
  tts.currentIndex = -1;
}

function ttsPlay() {
  if (!tts.audio) return;
  if (tts.audio.paused) {
    tts.audio.play();
    tts.playIcon.innerHTML = PAUSE_SVG;
  } else {
    tts.audio.pause();
    tts.playIcon.innerHTML = PLAY_SVG;
  }
}

function ttsStop() {
  if (!tts.audio) return;
  tts.audio.pause();
  tts.audio.currentTime = 0;
  tts.paragraphs.forEach(p => p.classList.remove('tts-reading'));
  tts.currentIndex = -1;
  tts.playIcon.innerHTML = PLAY_SVG;
  tts.statusText.textContent = 'stopped';
  tts.progress.style.width = '0%';
}

function ttsClose() {
  if (tts.audio) {
    tts.audio.pause();
    tts.audio.src = '';  // release the network request
    tts.audio = null;
  }
  tts.timings = null;
  tts.paragraphs.forEach(p => p.classList.remove('tts-reading'));
  tts.paragraphs = [];
  tts.currentIndex = -1;
  tts.bar.classList.remove('active');
  document.querySelector('.article-content')?.classList.remove('tts-active');
}
```

- [ ] **Step 5: Wire the control buttons and speed slider**

Find (or create, if the old wiring was deleted) the event listener block at the bottom of the TTS section:

```javascript
tts.playBtn.addEventListener('click', ttsPlay);
tts.stopBtn.addEventListener('click', ttsStop);
tts.closeBtn.addEventListener('click', ttsClose);
tts.speedSlider.addEventListener('input', () => {
  tts.rate = parseFloat(tts.speedSlider.value);
  tts.speedLabel.textContent = tts.rate.toFixed(2) + 'x';
  if (tts.audio) tts.audio.playbackRate = tts.rate;
});
```

- [ ] **Step 6: Make `ttsOpen` fire when an article is displayed**

The existing article-display flow already has a point where an article is rendered. Look for where article content is injected into `.article-content` and the TTS bar is currently opened/initialized. Replace that trigger with:

```javascript
// Old code initialized engines and called ttsLoadVoices().
// New code: open the bar if the article has pre-rendered audio.
ttsOpen(articleFilename);
```

If `articlesData` isn't already available as a module-level variable, export the fetch of `articles.json` to set it (it's almost certainly already loaded at startup — grep for `articles.json` in `index.html` to find the existing load).

- [ ] **Step 7: Confirm there are no dangling references**

```
grep -n "tts\." index.html | grep -v -E "(bar|playBtn|playIcon|stopBtn|progress|label|statusText|speedSlider|speedLabel|closeBtn|audio|timings|paragraphs|currentIndex|rate)"
```

Expected: no results related to removed fields like `engine`, `queue`, `selectedVoiceId`, `hqBtn`, `voiceSelect`.

- [ ] **Step 8: Commit**

```
git add index.html
git commit -m "Wire pre-rendered TTS: timings-driven highlight via HTMLAudioElement"
```

---

## Task 10: Browser manual verification

**Files:** none (manual test)

- [ ] **Step 1: Ensure local server is running**

```
pgrep -af "http.server 8000" || (cd /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com && python3 -m http.server 8000 &)
```

- [ ] **Step 2: Open `how-to-config-obsidian` article in browser**

Navigate to `http://localhost:8000/#articles/how-to-config-obsidian.md`.

- [ ] **Step 3: Golden-path test matrix**

Run through each of these and confirm the expected behavior:

| Action | Expected |
|---|---|
| Open the TTS bar | Bar appears; play button visible; no console errors |
| Click play | Audio starts; first paragraph highlights with `.tts-reading` |
| Listen through a paragraph boundary | Highlight moves to next paragraph in sync |
| Click a paragraph further down | Audio jumps to that paragraph; highlight follows |
| Click pause | Audio pauses; highlight stays on current paragraph |
| Click play again | Resumes from where paused |
| Drag speed slider to 1.5× | Playback rate changes live; label updates |
| Click stop | Audio stops, currentTime resets to 0, highlight clears |
| Click close | Bar hides, `.tts-active` class removed, no more audio |
| DevTools: one audio request of size matching `.ogg` size | ✓ |
| DevTools Console | No warnings or errors |

- [ ] **Step 4: Edge-case: article without audio**

Temporarily test graceful degradation — pick any article, edit `articles/articles.json` to remove its `audio` and `timings` fields, reload. Expected: TTS bar does not appear. Restore the fields when done.

- [ ] **Step 5: Edge-case: article edited post-render**

Temporarily edit `articles/how-to-config-obsidian.md`, change the first paragraph text, save, reload the article. Expected: bar does not appear; console warning says "first paragraph text mismatch". Revert the edit.

- [ ] **Step 6: Edge-case: no speech-dispatcher on Linux**

On the author's Brave (which has no speech-dispatcher), the new code never touches Web Speech → the bar works normally. Confirm by playing an article start-to-finish.

- [ ] **Step 7: Commit any fixes**

If any of the above failed and you fixed it:

```
git add index.html
git commit -m "Fix: <specific issue> in pre-rendered TTS client"
```

If everything passed with no fixes, skip this step.

---

## Task 11: Integrate with the publish-article skill

**Files:**
- Modify: `/home/trashh_panda/.claude/skills/publish-article/SKILL.md`

- [ ] **Step 1: Insert new step 4.5 into the skill**

Open `~/.claude/skills/publish-article/SKILL.md`. After the existing step 4 ("Write Files") and before step 5 ("Local Preview"), insert:

````markdown
### 4.5 Render Audio

Every article gets a pre-rendered voice track for the read-aloud feature.

Ask the user: **"Which voice? (default bm_lewis; try bm_daniel, bm_fable, bm_george for other British males, af_nicole / af_heart / af_bella for American females, or any Kokoro voice ID)"**

Run:

```bash
cd ~/code/PROJECTS/VULTR_0/sites/timbeach.com
tools/venv/bin/python tools/render_article.py {slug} --voice {voice}
```

On success: report the audio duration and file size to the user.

On failure:
- If the error is "ffmpeg not found" — tell the user to install it (`sudo pacman -S ffmpeg` on Arch/Artix) and re-run.
- If the error is "no readable paragraphs" — the markdown has nothing the selector matched; skip this step and proceed without audio.
- For other errors — show the error; ask the user whether to continue without audio or abort the publish flow.

This step produces:
- `audio/{slug}.ogg`
- `audio/{slug}.timings.json`
- Updates to `articles/articles.json` (audio/timings/voice/duration fields on the new entry)
````

- [ ] **Step 2: Update step 7 (Git Commit) to include audio artifacts**

Find the `git add` line in step 7 of the skill. Update it to also include the new audio files:

```bash
git add articles/{filename}.md articles/articles.json pix/{specific-new-images} audio/{slug}.ogg audio/{slug}.timings.json
```

- [ ] **Step 3: Verify the skill can be re-read correctly**

```
cat ~/.claude/skills/publish-article/SKILL.md | head -80
```

Expected: the new 4.5 section appears between 4 and 5; no markdown formatting is broken.

- [ ] **Step 4: Commit the skill change**

The skill lives outside the repo, so commit it separately if the skills directory is under git. If not, just save.

---

## Task 12: Final cleanup

**Files:**
- Delete: `audition/` (directory — kept through brainstorming, no longer needed)
- Modify: `.gitignore` (drop the `audition/` entry)
- Modify: `.gitignore` (drop the `models/` entry if it was only for the WASM Kokoro mirror)

- [ ] **Step 1: Remove the `audition/` directory**

The audition/ folder held the venv + samples used to pick a voice during brainstorming. Its venv is redundant with `tools/venv`; the samples aren't needed in the final repo.

```
rm -rf audition/
```

- [ ] **Step 2: Update `.gitignore`**

Remove `audition/` from `.gitignore` (the directory is gone). Check whether `models/` is still needed — it was originally for the in-browser Kokoro mirror fallback. Since the WASM path is deleted, `models/` can go too. Leave only `tools/venv/` and `tools/models/`.

After editing, the tail of `.gitignore` should read:

```
.claude/
thailand_2026/photos/
tools/venv/
tools/models/
```

- [ ] **Step 3: Verify no references to deleted things remain**

```
grep -rn "audition\|tts-worker\|ttsHqBtn\|kokoroEngine\|nativeEngine" \
  --include="*.html" --include="*.js" --include="*.md" --include="*.json" \
  --exclude-dir=docs --exclude-dir=.git \
  /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com
```

Expected: no results (the `docs/` exclude keeps historical spec/plan docs out of this check).

- [ ] **Step 4: Confirm `deploy.sh` includes the new `audio/` directory**

```
grep "exclude" /home/trashh_panda/code/PROJECTS/VULTR_0/sites/timbeach.com/deploy.sh
```

Expected: `--exclude .claude/ --exclude .well-known/ --exclude irc.txt.gpg --exclude .git/ --exclude archive/` — note `audio/` is not excluded, so rsync will sync it.

- [ ] **Step 5: Commit cleanup**

```
git add -A
git commit -m "Clean up: remove audition/ scratch dir and stale gitignore entries"
```

---

## Task 13: End-to-end skill validation

**Files:** none (manual test)

- [ ] **Step 1: Invoke the publish-article skill on a throwaway article**

Create a tiny test markdown file at `/tmp/test-prerender.md`:

```markdown
# TTS Pipeline Test

This is a tiny article used to validate the pre-render pipeline end-to-end.

## A section

With a paragraph.

- list item one
- list item two
```

Invoke:

```
/publish-article /tmp/test-prerender.md
```

Walk through the prompts: accept default metadata; when asked for voice, accept default (bm_lewis).

- [ ] **Step 2: Verify the skill invoked the render step correctly**

Check that the skill:
- Asked "Which voice?"
- Ran `tools/render_article.py test-prerender --voice bm_lewis`
- Reported duration and file size
- Produced `audio/test-prerender.ogg` and `audio/test-prerender.timings.json`
- Updated `articles/articles.json` with the new fields

- [ ] **Step 3: Open in the local preview**

Navigate to `http://localhost:8000/#articles/test-prerender.md`. Confirm the TTS bar appears, play/pause/stop/speed/close all work.

- [ ] **Step 4: Clean up the test article (do NOT deploy it)**

```
rm articles/test-prerender.md audio/test-prerender.ogg audio/test-prerender.timings.json
# Edit articles/articles.json to remove the test-prerender.md entry
```

Do NOT run `./deploy.sh` — this was a validation article, not a real post.

- [ ] **Step 5: Final push**

```
git status   # verify working tree is clean (test artifacts removed)
git log --oneline -20
git push
```

Plan is complete when this task finishes with a clean working tree and a pushed branch.

---

## Self-review

### Spec coverage

- § Decisions → Task 6 (voice=bm_lewis default, bm_* → en-gb inference), Task 9 (native dropped, Opus in `<audio>`), Task 11 (voice prompt in skill)
- § On-disk layout → Task 1 (`tools/` scaffolding), Task 7 (`audio/` directory populated)
- § `timings.json` schema → Task 4 (writer), Task 9 (reader + sanity check)
- § `articles.json` extension → Task 4 (updater), Task 6 (wired into render flow)
- § Render tool pipeline steps 1–9 → Task 2 (parse), Task 3 (render + concat + timings), Task 4 (json writers), Task 5 (encode), Task 6 (idempotency + orchestration)
- § Environment setup → Task 1
- § Skill integration → Task 11
- § Client rewrite deletions → Task 8
- § Client rewrite new flow → Task 9
- § Backfill → Task 7
- § Error handling → Task 5 (ffmpeg missing), Task 6 (no paragraphs, missing file), Task 9 (audio 404, article edited post-render)
- § Testing → Tasks 2/3/4/5 (unit), Task 6 (tool smoke), Task 10 (client manual), Task 13 (end-to-end)

All spec sections have tasks covering them.

### Placeholder scan

No "TBD" / "TODO" / "implement later" in the plan. Every step has either exact code or an exact command with expected output.

### Type consistency

Function names used consistently across tasks:
- `extract_paragraphs` (Task 2, referenced in Task 6)
- `render_paragraphs` (Task 3, referenced in Task 6)
- `write_timings_json` (Task 4, referenced in Task 6)
- `update_articles_json` (Task 4, referenced in Task 6)
- `encode_opus` (Task 5, referenced in Task 6)
- `render_article` (Task 6, referenced in Task 7)
- Client: `ttsOpen`, `ttsClose`, `ttsPlay`, `ttsStop`, `ttsOnTimeUpdate`, `ttsOnEnded`, `ttsCollectParagraphs`, `ttsGetText` — same across Tasks 9 and 10.

`timings` field: consistently `{idx, start, end, text}` across Tasks 3/4/9.

`articles.json` additions: consistently `audio, timings, voice, duration` across Tasks 4/6/9.
