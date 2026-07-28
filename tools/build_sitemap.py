#!/usr/bin/env python3
"""build_sitemap.py — generate sitemap.xml from articles/articles.json.

Lists the homepage plus every published, listed article's static page
(a/<slug>/ — the site's canonical, crawlable article URLs). Future-dated and
`unlisted` articles are excluded, mirroring the homepage gate in js/app.js;
their share pages carry noindex until they go live (see build_share_pages.py).

Hash-route URLs (#/article/...) never appear here: crawlers strip fragments,
so listing them would just re-submit the homepage.

Run:
    tools/venv/bin/python tools/build_sitemap.py
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

SITE_URL_DEFAULT = "https://timbeach.com"


def build_sitemap(project_root: Path, out_path: Path,
                  site_url: str = SITE_URL_DEFAULT) -> int:
    data = json.loads((project_root / "articles" / "articles.json").read_text())
    today = datetime.now().strftime("%Y-%m-%d")

    items = sorted(
        (
            (filename, meta)
            for filename, meta in data.items()
            if meta.get("date") and meta.get("title")
            and meta["date"] <= today and not meta.get("unlisted")
        ),
        key=lambda kv: kv[1]["date"],
        reverse=True,
    )

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        f'    <loc>{escape(site_url)}/</loc>',
        '  </url>',
    ]
    for filename, meta in items:
        slug = filename[:-3] if filename.endswith(".md") else filename
        parts.append('  <url>')
        parts.append(f'    <loc>{escape(site_url)}/a/{slug}/</loc>')
        parts.append(f'    <lastmod>{escape(meta["date"])}</lastmod>')
        parts.append('  </url>')
    parts.append('</urlset>')

    out_path.write_text("\n".join(parts) + "\n", encoding="utf-8")
    return len(items)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate sitemap.xml from articles.json")
    p.add_argument("--site-url", default=SITE_URL_DEFAULT)
    p.add_argument("--out", default=None, help="Output path (default: <project>/sitemap.xml)")
    args = p.parse_args(argv)

    project_root = Path(__file__).resolve().parent.parent
    out_path = Path(args.out) if args.out else project_root / "sitemap.xml"
    n = build_sitemap(project_root, out_path, args.site_url)
    print(f"✓ wrote {out_path.name} ({n} article URL(s) + homepage)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
