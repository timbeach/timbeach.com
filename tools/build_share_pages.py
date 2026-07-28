#!/usr/bin/env python3
"""build_share_pages.py — generate static per-article pages under a/<slug>/.

Why this exists
---------------
The site is a hash-routed SPA: articles live at
`https://timbeach.com/#/article/<slug>`. The fragment after `#` is never sent
to the server, so neither social crawlers nor Googlebot can ever see an
article as its own page — they all fetch the bare `index.html`.

The fix: emit a real, crawlable HTML page per article at `a/<slug>/index.html`
carrying that article's OG/Twitter tags AND its full rendered body. These
pages are the site's indexable surface:

    share/index  https://timbeach.com/a/<slug>/        (static, canonical)
    reader       https://timbeach.com/#/article/<slug> (interactive SPA)

History: until 2026-07 these were zero-second meta-refresh redirect stubs into
the SPA. Google treats meta-refresh-0 as a redirect and refused to index them
("Page with redirect" in Search Console), which left the site's writing
invisible to search. Now the page IS the content; a link offers the
interactive reader (read-aloud audio) instead of forcing a redirect.

Gating: future-dated and `unlisted` articles still get pages (so they can be
shared by direct link) but carry `<meta name="robots" content="noindex">` and
are excluded from sitemap.xml. The nightly anacron redeploy regenerates the
pages, so a scheduled article's noindex lifts automatically on its date.

og:image resolution
-------------------
1. If the article's articles.json entry has a `hero`, use it.
2. Otherwise auto-generate a branded 1200x630 card (title over the site's
   night-theme palette) at `a/<slug>/og-<hash>.png`.

Run:
    tools/venv/bin/python tools/build_share_pages.py
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_feed import render_article_html

# First markdown image in an article body: ![alt](path)
_MD_IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)")

SITE_URL_DEFAULT = "https://timbeach.com"
SITE_NAME = "Timothy D Beach"

# Night-theme tokens, mirrored from css/site.css [data-theme="dark"].
CARD_BG = (14, 14, 14)       # --bg
CARD_FG = (230, 227, 218)    # --fg
CARD_MUTED = (154, 149, 138)  # --fg-muted
CARD_RULE = (46, 46, 44)     # subtle divider

CARD_W, CARD_H = 1200, 630

# Serif faces, in preference order — matches the literary feel of the site.
_SERIF_BOLD = [
    "/usr/share/fonts/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSerif-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf",
]
_SERIF = [
    "/usr/share/fonts/liberation/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/TTF/DejaVuSerif.ttf",
    "/usr/share/fonts/dejavu/DejaVuSerif.ttf",
]


def _load_font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    # Last resort: PIL's bundled default (won't honor size well, but never fails).
    return ImageFont.load_default()


def _wrap_to_width(text: str, font: ImageFont.FreeTypeFont, max_w: int,
                   draw: ImageDraw.ImageDraw) -> list[str]:
    """Greedy word-wrap so each line's rendered width fits within max_w."""
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def generate_card(title: str, out_path: Path) -> None:
    """Render a branded 1200x630 OG card for an article with no hero image."""
    img = Image.new("RGB", (CARD_W, CARD_H), CARD_BG)
    draw = ImageDraw.Draw(img)

    margin = 90
    max_text_w = CARD_W - 2 * margin

    # Title: shrink font until it wraps into at most 4 lines.
    title_font = None
    lines: list[str] = []
    for size in (96, 84, 72, 62, 54):
        title_font = _load_font(_SERIF_BOLD, size)
        lines = _wrap_to_width(title, title_font, max_text_w, draw)
        if len(lines) <= 4:
            break

    line_h = int((title_font.size if hasattr(title_font, "size") else 72) * 1.18)
    block_h = line_h * len(lines)
    # Vertically center the title block, biased slightly up to leave room for footer.
    y = (CARD_H - block_h) // 2 - 30
    for line in lines:
        draw.text((margin, y), line, font=title_font, fill=CARD_FG)
        y += line_h

    # Footer: divider rule + site wordmark.
    foot_font = _load_font(_SERIF, 34)
    fy = CARD_H - margin
    draw.line([(margin, fy - 18), (CARD_W - margin, fy - 18)], fill=CARD_RULE, width=2)
    draw.text((margin, fy), "timbeach.com", font=foot_font, fill=CARD_MUTED)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")


def generate_hero_card(src_path: Path, out_path: Path) -> None:
    """Composite an article image onto the exact 1200x630 OG canvas.

    Handing crawlers an image already at OG dimensions avoids the blur that
    comes from them crop-resampling an arbitrary-aspect source down to 1.91:1
    and re-encoding it. The image is contain-fit (whole image always visible —
    important for diagrams and text screenshots) on the night-theme background,
    downscaled with Lanczos for sharpness.
    """
    canvas = Image.new("RGB", (CARD_W, CARD_H), CARD_BG)
    with Image.open(src_path) as src:
        src = src.convert("RGBA")
        # Contain-fit: scale so the whole image fits within the canvas.
        scale = min(CARD_W / src.width, CARD_H / src.height)
        new_w = max(1, round(src.width * scale))
        new_h = max(1, round(src.height * scale))
        resized = src.resize((new_w, new_h), Image.LANCZOS)
        x = (CARD_W - new_w) // 2
        y = (CARD_H - new_h) // 2
        # Use the alpha channel as the paste mask so transparent PNGs (diagrams)
        # show the dark background instead of black boxes.
        canvas.paste(resized, (x, y), resized)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, "PNG", optimize=True)


def _local_image_path(project_root: Path, ref: str) -> Path | None:
    """Project-root path for a site-relative image ref, if the file exists."""
    if ref.startswith(("http://", "https://")):
        return None
    p = project_root / _normalize_ref(ref)
    return p if p.exists() else None


def _abs_url(site_url: str, ref: str) -> str:
    """Resolve an articles.json image reference to an absolute URL."""
    if ref.startswith(("http://", "https://")):
        return ref
    return f"{site_url}/{_normalize_ref(ref)}"


def _normalize_ref(ref: str) -> str:
    """'../pix/foo.png' or '/pix/foo.png' → 'pix/foo.png' (site-root-relative)."""
    ref = ref.lstrip("/")
    while ref.startswith("../"):
        ref = ref[3:]
    return ref


def _first_article_image(md_path: Path) -> str | None:
    """Return the first embedded image's site-root-relative path, or None.

    Skips fenced code blocks so an example `![](...)` in a snippet is ignored.
    """
    in_fence = False
    for line in md_path.read_text().splitlines():
        s = line.strip()
        if s.startswith("```") or s.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _MD_IMAGE.search(line)
        if m:
            return _normalize_ref(m.group(1))
    return None


def _image_dims(project_root: Path, ref: str) -> tuple[str, str]:
    """Real pixel dimensions of a site-root-relative image, as strings.

    Falls back to the 1.91:1 OG default if the file can't be measured — the
    width/height tags are advisory hints, so a miss never breaks the preview.
    """
    path = project_root / _normalize_ref(ref)
    try:
        with Image.open(path) as im:
            return str(im.width), str(im.height)
    except Exception:
        return str(CARD_W), str(CARD_H)


# Relative src/href attributes in rendered article HTML. The page lives two
# levels deep (/a/<slug>/), so 'pix/foo.png' and '../pix/foo.png' must become
# '/pix/foo.png' or every embedded image 404s.
_REL_ATTR = re.compile(r'\b(src|href)="(?!https?://|mailto:|#|/|data:)([^"]+)"')

# {{youtube:ID}} / {{youtube:ID|short}} lines pass through markdown-it as a
# literal text paragraph; swap them for the same responsive iframe the SPA
# renders (js/article.js).
_YT_PARA = re.compile(r"<p>\{\{youtube:([\w-]+)(\|short)?\}\}</p>")


def _rootify_html(body: str) -> str:
    return _REL_ATTR.sub(
        lambda m: f'{m.group(1)}="/{_normalize_ref(m.group(2))}"', body)


def _embed_youtube(body: str) -> str:
    def sub(m: re.Match) -> str:
        cls = "video-embed short" if m.group(2) else "video-embed"
        return (
            f'<div class="{cls}"><iframe src="https://www.youtube.com/embed/{m.group(1)}" '
            'title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; '
            'clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
            'allowfullscreen loading="lazy"></iframe></div>'
        )
    return _YT_PARA.sub(sub, body)


def _derive_section(meta: dict) -> str:
    """Mirror of js/article.js deriveSection: override → first tag, prettified."""
    if meta.get("section"):
        return meta["section"]
    tags = meta.get("tags") or []
    if tags:
        return tags[0][:1].upper() + tags[0][1:].replace("-", " ")
    return "Writing"


def _format_long_date(iso: str) -> str:
    """'2026-05-02' → 'May 2, 2026' (matches the SPA reader's meta line)."""
    d = datetime.strptime(iso, "%Y-%m-%d")
    return f"{d.strftime('%B')} {d.day}, {d.year}"


# Doubled braces ({{ }}) are literal — this template goes through str.format.
_PAGE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title_esc} — {site_name}</title>
<meta name="description" content="{desc_esc}" />
{robots}<meta property="og:type" content="article" />
<meta property="og:title" content="{title_esc}" />
<meta property="og:description" content="{desc_esc}" />
<meta property="og:image" content="{image}" />
<meta property="og:image:width" content="{img_w}" />
<meta property="og:image:height" content="{img_h}" />
<meta property="og:url" content="{share_url}" />
<meta property="og:site_name" content="{site_name}" />
{published}<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title_esc}" />
<meta name="twitter:description" content="{desc_esc}" />
<meta name="twitter:image" content="{image}" />
<link rel="canonical" href="{share_url}" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="alternate" type="application/rss+xml" title="{site_name}" href="/feed.xml" />
<script>
(function () {{
  try {{
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {{
      document.documentElement.setAttribute('data-theme', t);
    }}
  }} catch (e) {{ /* ignore: localStorage may be disabled */ }}
}})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Charis+SIL:wght@400;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/css/site.css" />
</head>
<body>
<div class="page">
  <header class="masthead">
    <a href="/" class="brand">{site_name}</a>
    <nav class="nav" aria-label="Primary">
      <a href="/#/">Writing</a>
      <a href="/#/music">Music</a>
      <a href="/#/about">About</a>
    </nav>
  </header>
  <main role="main">
    <a class="back-link" href="/#/">← Writing</a>
    <article class="article">
      <header class="article-header">
        <p class="meta">{date_long} · {section}</p>
        <h1>{title_esc}</h1>
{actions}      </header>
      <div class="article-body">{body_html}</div>
    </article>
  </main>
  <footer class="site-footer">
    © {year} Timothy D Beach
    &middot; <a href="/feed.xml">RSS</a>
    &middot; <a href="https://github.com/timbeach" target="_blank" rel="noopener">GitHub</a>
    &middot; <a href="mailto:beachtimothyd@gmail.com">Email</a>
  </footer>
</div>
</body>
</html>
"""


def build_share_pages(project_root: Path, site_url: str = SITE_URL_DEFAULT) -> int:
    articles_json = project_root / "articles" / "articles.json"
    articles_dir = project_root / "articles"
    out_root = project_root / "a"
    data = json.loads(articles_json.read_text())

    # Same local-calendar gate as build_feed: pages regenerate on every deploy
    # (including the nightly anacron one), so noindex lifts on the go-live date.
    today = datetime.now().strftime("%Y-%m-%d")

    count = 0
    for filename, meta in data.items():
        if not (meta.get("title") and meta.get("date")):
            continue
        slug = filename[:-3] if filename.endswith(".md") else filename
        title = meta["title"]
        desc = meta.get("summary", "")

        md_path = articles_dir / filename
        if not md_path.exists():
            continue

        out_dir = out_root / slug
        reader_path = f"/#/article/{slug}"

        # Every article gets a crisp 1200x630 card image so crawlers never have
        # to crop-resample an arbitrary-aspect source (the cause of blurry/
        # cropped previews). og:image precedence:
        #   explicit `hero` → first image embedded in the body → text card.
        # A local image is composited onto the OG canvas; a remote `hero` URL is
        # used verbatim (we can't fetch it to recompose at build time).
        #
        # The card filename is content-hashed (og-<hash>.png) so its URL changes
        # whenever — and only when — the image changes. LinkedIn/etc. cache OG
        # images by URL far more stubbornly than the page; a stable filename
        # whose bytes change is the one case their cache never refreshes.
        out_dir.mkdir(parents=True, exist_ok=True)
        for stale in out_dir.glob("og*.png"):  # drop prior-build cards
            stale.unlink()

        hero = meta.get("hero") or _first_article_image(articles_dir / filename)
        local_hero = _local_image_path(project_root, hero) if hero else None
        if hero and not local_hero:  # remote URL — pass through untouched
            image = _abs_url(site_url, hero)
            img_w, img_h = _image_dims(project_root, hero)
        else:
            tmp = out_dir / "og.tmp.png"
            if local_hero:
                generate_hero_card(local_hero, tmp)
            else:
                generate_card(title, tmp)
            digest = hashlib.sha1(tmp.read_bytes()).hexdigest()[:10]
            tmp.replace(out_dir / f"og-{digest}.png")
            image = f"{site_url}/a/{slug}/og-{digest}.png"
            img_w, img_h = str(CARD_W), str(CARD_H)

        published = ""
        if meta.get("date"):
            published = f'<meta property="article:published_time" content="{meta["date"]}" />\n'

        # Not-yet-published and unlisted articles stay shareable but must not
        # enter the index before the homepage would show them.
        robots = ""
        if meta.get("unlisted") or meta["date"] > today:
            robots = '<meta name="robots" content="noindex" />\n'

        body_html = _embed_youtube(_rootify_html(render_article_html(md_path)))

        actions = ""
        if meta.get("audio") and meta.get("timings"):
            actions = (
                '        <div class="article-actions">\n'
                f'          <a class="read-aloud" href="{reader_path}">▶ Listen to this article</a>\n'
                '        </div>\n'
            )

        page = _PAGE.format(
            title_esc=html.escape(title, quote=True),
            desc_esc=html.escape(desc, quote=True),
            site_name=html.escape(SITE_NAME, quote=True),
            image=html.escape(image, quote=True),
            img_w=img_w,
            img_h=img_h,
            share_url=f"{site_url}/a/{slug}/",
            published=published,
            robots=robots,
            date_long=_format_long_date(meta["date"]),
            section=html.escape(_derive_section(meta), quote=True),
            actions=actions,
            body_html=body_html,
            year=datetime.now().year,
        )
        (out_dir / "index.html").write_text(page, encoding="utf-8")
        count += 1

    return count


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate per-article static pages under a/<slug>/")
    p.add_argument("--site-url", default=SITE_URL_DEFAULT)
    args = p.parse_args(argv)

    project_root = Path(__file__).resolve().parent.parent
    n = build_share_pages(project_root, args.site_url)
    print(f"✓ wrote {n} share page(s) under a/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
