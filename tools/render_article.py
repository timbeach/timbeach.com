"""Pre-render an article's audio + paragraph timings for timbeach.com."""
from __future__ import annotations

from typing import Callable
import numpy as np

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
