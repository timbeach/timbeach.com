#!/usr/bin/env python3
"""build_search_index.py — bake search-index.json from articles/articles.json.

Maps each registered article's slug to its full plain text, extracted with the
same extract_paragraphs used for TTS parity — one definition of "the readable
text of an article". The client (js/search.js) lazy-loads the result for
full-text homepage search. Future-dated/unlisted articles are included on
purpose: the client only searches slugs in its own date-filtered list, and the
raw .md files are publicly fetchable anyway.

Run:
    tools/venv/bin/python tools/build_search_index.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from render_article import extract_paragraphs


def build_index(project_root: Path) -> dict[str, str]:
    articles_dir = project_root / "articles"
    registry = json.loads((articles_dir / "articles.json").read_text())

    index: dict[str, str] = {}
    for filename in registry:
        md_path = articles_dir / filename
        if not md_path.is_file():
            raise FileNotFoundError(f"registered article missing: {md_path}")
        slug = filename.removesuffix(".md")
        index[slug] = "\n".join(extract_paragraphs(md_path.read_text()))
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate search-index.json")
    parser.add_argument(
        "--root", type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="project root (default: repo root above tools/)",
    )
    args = parser.parse_args()

    index = build_index(args.root)
    out_path = args.root / "search-index.json"
    out_path.write_text(json.dumps(index, ensure_ascii=False))
    kib = out_path.stat().st_size / 1024
    print(f"search-index.json: {len(index)} articles, {kib:.0f} KiB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
