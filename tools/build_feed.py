#!/usr/bin/env python3
"""build_feed.py — generate RSS 2.0 feed.xml from articles/articles.json.

Outputs full-content <content:encoded> per item, plus a plaintext
<description> from articles.json's 'summary' field.

Run:
    tools/venv/bin/python tools/build_feed.py
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

from markdown_it import MarkdownIt

SITE_URL_DEFAULT = "https://timbeach.com"
SITE_TITLE = "Timothy D Beach"
SITE_DESC  = "Software engineer, recording artist, GNU/Linux enthusiast."
CONTENT_NS = "http://purl.org/rss/1.0/modules/content/"

_md = MarkdownIt("commonmark", {"html": False, "linkify": True}).enable("table")


def render_article_html(md_path: Path) -> str:
    """Render an article's markdown body to HTML, stripping the H1 title."""
    text = md_path.read_text()
    # Strip the first H1 — articles use it as the title; we render that in
    # the channel's <title> instead.
    lines = text.splitlines()
    out_lines = []
    skipped_h1 = False
    for line in lines:
        if not skipped_h1 and line.lstrip().startswith("# "):
            skipped_h1 = True
            continue
        out_lines.append(line)
    return _md.render("\n".join(out_lines))


def _date_to_rfc822(date_str: str) -> str:
    """'2026-05-02' → 'Sat, 02 May 2026 00:00:00 +0000'."""
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return format_datetime(dt)


def build_feed(project_root: Path, out_path: Path, site_url: str = SITE_URL_DEFAULT) -> None:
    articles_json = project_root / "articles" / "articles.json"
    articles_dir  = project_root / "articles"
    data = json.loads(articles_json.read_text())

    # Sort by date descending
    items = sorted(
        ((filename, meta) for filename, meta in data.items() if meta.get("date") and meta.get("title")),
        key=lambda kv: kv[1]["date"],
        reverse=True,
    )

    last_build = format_datetime(datetime.now(tz=timezone.utc))

    parts: list[str] = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    parts.append(f'<rss version="2.0" xmlns:content="{CONTENT_NS}">')
    parts.append('  <channel>')
    parts.append(f'    <title>{escape(SITE_TITLE)}</title>')
    parts.append(f'    <link>{escape(site_url)}</link>')
    parts.append(f'    <description>{escape(SITE_DESC)}</description>')
    parts.append(f'    <lastBuildDate>{last_build}</lastBuildDate>')
    parts.append(f'    <language>en-us</language>')
    parts.append(f'    <atom:link href="{escape(site_url)}/feed.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />')

    for filename, meta in items:
        slug = filename[:-3] if filename.endswith(".md") else filename
        link = f"{site_url}/#/article/{slug}"
        title = meta["title"]
        desc  = meta.get("summary", "")
        pubdate = _date_to_rfc822(meta["date"])

        md_path = articles_dir / filename
        if not md_path.exists():
            continue
        body_html = render_article_html(md_path)

        parts.append('    <item>')
        parts.append(f'      <title>{escape(title)}</title>')
        parts.append(f'      <link>{escape(link)}</link>')
        parts.append(f'      <guid isPermaLink="true">{escape(link)}</guid>')
        parts.append(f'      <pubDate>{pubdate}</pubDate>')
        parts.append(f'      <description>{escape(desc)}</description>')
        # CDATA wrapper keeps embedded HTML readable to RSS readers without
        # double-escaping. Note: ']]>' inside content would break us, but
        # markdown rendering won't produce that sequence.
        parts.append(f'      <content:encoded><![CDATA[{body_html}]]></content:encoded>')
        parts.append('    </item>')

    parts.append('  </channel>')
    parts.append('</rss>')
    out_path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate feed.xml from articles.json")
    p.add_argument("--site-url", default=SITE_URL_DEFAULT)
    p.add_argument("--out", default=None, help="Output path (default: <project>/feed.xml)")
    args = p.parse_args(argv)

    project_root = Path(__file__).resolve().parent.parent
    out_path = Path(args.out) if args.out else project_root / "feed.xml"
    build_feed(project_root, out_path, args.site_url)
    print(f"✓ wrote {out_path.relative_to(project_root)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
