"""Pre-render an article's audio + paragraph timings for timbeach.com."""
from __future__ import annotations

import json
import re
import subprocess
import shutil
import tempfile
from pathlib import Path
from typing import Callable
import numpy as np
import soundfile as sf

from markdown_it import MarkdownIt
from bs4 import BeautifulSoup


# Must match client selector at index.html:3908
PARAGRAPH_SELECTOR = "h2, h3, h4, p, li"


def extract_paragraphs(md_text: str) -> list[str]:
    """Parse markdown, extract readable paragraphs matching client rules."""
    md = MarkdownIt("commonmark", {"html": False, "linkify": False}).enable("table")
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


_SENTENCE_RE = re.compile(r'(?<=[.!?])\s+')


def _split_sentences(text: str) -> list[str]:
    """Split text on sentence boundaries (.!?)."""
    return [s for s in _SENTENCE_RE.split(text.strip()) if s]


def _synth_with_fallback(
    text: str,
    voice: str,
    synth: Callable[[str, str], tuple[np.ndarray, int]],
) -> tuple[np.ndarray, int]:
    """Synth a chunk; fall back to sentence-wise synth on phoneme-overflow errors."""
    try:
        return synth(text, voice)
    except Exception as e:
        msg = str(e).lower()
        if "out of bounds" not in msg and "phoneme" not in msg:
            raise
        pieces = _split_sentences(text)
        if len(pieces) <= 1:
            raise RuntimeError(
                f"paragraph too long and can't be sentence-split: {text[:80]!r}…"
            ) from e
        print(f"    (split long paragraph into {len(pieces)} sentences)", flush=True)
        chunks: list[np.ndarray] = []
        sample_rate: int | None = None
        for piece in pieces:
            samples, sr = _synth_with_fallback(piece, voice, synth)
            if sample_rate is None:
                sample_rate = sr
            elif sr != sample_rate:
                raise ValueError("sample rate mismatch mid-paragraph")
            chunks.append(samples)
        return np.concatenate(chunks), sample_rate


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
        samples, sr = _synth_with_fallback(text, voice, synth)
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


def write_timings_json(
    path: Path,
    voice: str,
    duration: float,
    timings: list[dict],
) -> None:
    """Write timings JSON file with voice, duration, and paragraph timings."""
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


import argparse
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


def validate_article(slug: str) -> tuple[bool, str]:
    """Compare current markdown against committed timings.json.

    Returns (ok, message). Catches "article edited after render" staleness.
    """
    md_path = ARTICLES_DIR / f"{slug}.md"
    timings_path = AUDIO_DIR / f"{slug}.timings.json"

    if not md_path.exists():
        return (False, f"markdown missing: {md_path}")
    if not timings_path.exists():
        return (False, f"timings missing (not rendered yet?): {timings_path}")

    paras = extract_paragraphs(md_path.read_text())
    timings = json.loads(timings_path.read_text())
    stored = timings.get("paragraphs", [])

    if len(paras) != len(stored):
        return (False, f"paragraph count mismatch: {len(paras)} in markdown vs {len(stored)} in timings")

    if paras and paras[0] != stored[0].get("text", ""):
        return (False, f"first-paragraph text differs — re-render needed")

    return (True, f"OK ({len(paras)} paragraphs)")


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
    parser.add_argument("--validate", action="store_true",
                        help="check that timings.json is in sync with the markdown; don't render")
    args = parser.parse_args(argv)

    if not args.slug and not args.all and not args.validate:
        parser.error("either <slug>, --all, or --validate is required")
    if args.slug and args.all:
        parser.error("pass <slug> OR --all, not both")

    if args.validate:
        data = json.loads(ARTICLES_JSON.read_text())
        if args.slug:
            slugs = [args.slug]
        else:
            slugs = [n[:-3] for n in data if n.endswith(".md")]
        errors = 0
        for slug in slugs:
            entry = data.get(f"{slug}.md", {})
            if not entry.get("audio"):
                print(f"  {slug}: no audio metadata, skipping")
                continue
            ok, msg = validate_article(slug)
            marker = "OK " if ok else "FAIL"
            print(f"  [{marker}] {slug}: {msg}")
            if not ok:
                errors += 1
        print(f"validate: {len(slugs) - errors}/{len(slugs)} passed, {errors} errors")
        return 1 if errors else 0

    kokoro = _load_kokoro()

    if args.all:
        data = json.loads(ARTICLES_JSON.read_text())
        slugs = [name[:-3] for name in data if name.endswith(".md")]
        rendered = 0
        errors: list[str] = []
        for slug in slugs:
            try:
                if render_article(slug, args.voice, args.force, kokoro):
                    rendered += 1
            except Exception as e:
                print(f"  ERROR {slug}: {e}", file=sys.stderr)
                errors.append(slug)
        print(f"done: {rendered}/{len(slugs)} articles rendered, {len(errors)} errors")
        return 1 if errors else 0

    try:
        render_article(args.slug, args.voice, args.force, kokoro)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
