#!/usr/bin/env python3
"""build_share_pages.py — generate per-article social "share pages".

Why this exists
---------------
The site is a hash-routed SPA: articles live at
`https://timbeach.com/#/article/<slug>`. The fragment after `#` is never sent
to the server, and social crawlers (LinkedIn, Twitter/X, Facebook, Slack,
iMessage) don't run JS — so they only ever fetch the bare `index.html` and
read its generic Open Graph image. Every shared article gets the same preview.

The fix: emit a real, crawlable HTML file per article at `a/<slug>/index.html`
carrying that article's own OG/Twitter tags. A human who clicks the link is
redirected (JS + <meta refresh>) straight into the SPA at `#/article/<slug>`,
so the reading experience is unchanged — only the URL you *share* differs:

    share  https://timbeach.com/a/<slug>/        (crawlable, per-article preview)
    reader https://timbeach.com/#/article/<slug> (where humans land)

og:image resolution
-------------------
1. If the article's articles.json entry has a `hero`, use it.
2. Otherwise auto-generate a branded 1200x630 card (title over the site's
   night-theme palette) at `a/<slug>/og.png`.

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
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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


_PAGE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title_esc} — {site_name}</title>
<meta name="description" content="{desc_esc}" />
<meta property="og:type" content="article" />
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
<link rel="canonical" href="{reader_url}" />
<meta http-equiv="refresh" content="0; url={reader_path}" />
<script>location.replace("{reader_path}");</script>
</head>
<body style="background:#0e0e0e;color:#e6e3da;font-family:Georgia,serif;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center">
<p>Redirecting to <a href="{reader_path}" style="color:#e6e3da">{title_esc}</a>…</p>
</body>
</html>
"""


def build_share_pages(project_root: Path, site_url: str = SITE_URL_DEFAULT) -> int:
    articles_json = project_root / "articles" / "articles.json"
    articles_dir = project_root / "articles"
    out_root = project_root / "a"
    data = json.loads(articles_json.read_text())

    count = 0
    for filename, meta in data.items():
        if not (meta.get("title") and meta.get("date")):
            continue
        slug = filename[:-3] if filename.endswith(".md") else filename
        title = meta["title"]
        desc = meta.get("summary", "")

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

        page = _PAGE.format(
            title_esc=html.escape(title, quote=True),
            desc_esc=html.escape(desc, quote=True),
            site_name=html.escape(SITE_NAME, quote=True),
            image=html.escape(image, quote=True),
            img_w=img_w,
            img_h=img_h,
            share_url=f"{site_url}/a/{slug}/",
            reader_url=f"{site_url}{reader_path}",
            reader_path=reader_path,
            published=published,
        )
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(page, encoding="utf-8")
        count += 1

    return count


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate per-article social share pages under a/<slug>/")
    p.add_argument("--site-url", default=SITE_URL_DEFAULT)
    args = p.parse_args(argv)

    project_root = Path(__file__).resolve().parent.parent
    n = build_share_pages(project_root, args.site_url)
    print(f"✓ wrote {n} share page(s) under a/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
