# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal website (timbeach.com) built as a single-page application with a modular HTML/CSS/JS architecture. The site features:

- A clean, readable layout with day/night theming
- Dynamic article loading system built in vanilla JavaScript
- Custom markdown parsing and syntax highlighting
- Astronomical starfield on the /about route

## Architecture

### Core Components

- **index.html** — thin HTML shell: head + theme inline-script + masthead + `<main id="app">` + footer + `<script type="module">`.
- **css/site.css** — all CSS: tokens, base, layout, components, responsive breakpoints. Day/night via `[data-theme="dark"]` and `prefers-color-scheme`.
- **js/app.js** — site bootstrap, homepage rendering, route registration, starfield-off helper.
- **js/router.js** — hash router (`#/`, `#/article/<slug>`, `#/music`, `#/about`) with legacy `#articles/<slug>.md` redirect.
- **js/article.js** — article fetch + markdown render. Hosts the ported `parseMarkdown` (paragraph-boundary parity with `tools/render_article.py:extract_paragraphs` is required by the TTS validate gate — DO NOT refactor without re-rendering all audio).
- **js/tts.js** — read-aloud bar (transport, voice select, paragraph highlight via timings sidecar). Auto-closes on navigation away from an article.
- **js/theme.js** — theme toggle, localStorage persistence, OS auto-detect fallback.
- **js/starfield.js** — astronomical starfield + sky-info widget. Mounted only on the `/about` route via init/destroy pair.
- **articles/** — markdown articles + `articles.json` registry.
- **audio/** — pre-rendered Opus + timings sidecars (TTS).
- **tools/render_article.py** — TTS pre-render + validate.
- **tools/build_feed.py** — RSS 2.0 generator (run by `deploy.sh`).
- **tools/build_share_pages.py** — per-article social "share pages" generator (run by `deploy.sh`). See [Social Share Pages](#social-share-pages).
- **feed.xml** — generated RSS feed (regenerated each deploy).
- **a/** — generated share pages (`a/<slug>/index.html` + fallback `og.png`). Build artifact: gitignored, rebuilt each deploy, rsynced (not in `.deployignore`).
- **deploy.sh** — validate TTS → build feed → build share pages → rsync.

### Article System

The site uses a lightweight article management system:

1. **Content Creation**: Articles are written in markdown format in the `articles/` directory
2. **Metadata Management**: Each article must be registered in `articles/articles.json`:
   ```json
   "filename.md": {
     "title": "Article Title",
     "date": "YYYY-MM-DD",
     "tags": ["tag1", "tag2"],
     "emoji": "🎯",
     "summary": "One-sentence description shown on the homepage card and in the RSS feed.",
     "section": "override-label",
     "hero": "pix/hero-image.png",
     "audio": "audio/filename.ogg",
     "timings": "audio/filename.timings.json",
     "voice": "bm_lewis",
     "duration": 187.3
   }
   ```
   The `audio`/`timings`/`voice`/`duration` fields are populated automatically by the render tool. Articles without `audio` simply don't show a read-aloud button (graceful degradation). The optional `summary` field powers both the homepage card descriptions and the RSS feed's `<description>` element. `section` overrides the auto-derived label (first tag, capitalized, hyphens-to-spaces). `hero` is reserved for future per-article hero images.
3. **Dynamic Loading**: Articles are fetched via JavaScript and parsed with custom markdown processor
4. **Read-aloud**: Native `<audio>` element streams the pre-rendered Opus; `timeupdate` events drive paragraph highlighting from the timings sidecar. See [TTS Pipeline](#tts-pipeline) below.

## Terminal Interface

Removed in the 2026-05 redesign. Saved as a future Easter-egg follow-up (beads issue `timbeach-d75`).

## Development Commands

### Deployment
```bash
./deploy.sh
```
Syncs the site to the production server via rsync, excluding .git/, archive/, and .well-known/ directories.

### Local Development
No build process required - open `index.html` directly in a browser or serve with any static file server.

## Adding New Articles

The canonical path is the `publish-article` skill (run `/publish-article <path>` in Claude Code), which walks through:
1. Acquire content (file path or inline)
2. Handle images (copy to `pix/`, rewrite paths)
3. Propose metadata, get approval
4. Write `articles/{slug}.md` + extend `articles/articles.json`
5. **4.5 — Render audio** via `tools/render_article.py {slug} --voice {voice}`
6. **4.6 — Validate parity** via `tools/render_article.py --validate {slug}`
7. Local preview, deploy, commit, push

Manual flow (if not using the skill):
1. Drop the markdown into `articles/` and add a basic entry to `articles.json`
2. `tools/venv/bin/python tools/render_article.py {slug} --voice bm_lewis`
3. `./deploy.sh` (which validates first, then rsyncs)
4. Commit the markdown + `audio/{slug}.ogg` + `audio/{slug}.timings.json` + image assets

## TTS Pipeline

Read-aloud audio is **pre-rendered at publish time**, not synthesized in the reader's browser. See `docs/tts-pipeline.md` for the deeper architectural treatment; quick reference below.

### Why pre-render

Web Speech API doesn't work on Linux Brave without `speech-dispatcher + espeak-ng`. In-browser Kokoro WASM has unreliable real-time-factor on mid-range laptops (page-unresponsive warnings, multi-second gaps between paragraphs). Pre-rendering once on the author's laptop solves both: every reader gets identical playback regardless of OS, and timings are exact by construction so paragraph highlighting is always in sync.

### Operational quick reference

| Task | Command |
|---|---|
| Render one article | `tools/venv/bin/python tools/render_article.py {slug} --voice bm_lewis` |
| Re-render with a different voice | `tools/venv/bin/python tools/render_article.py {slug} --voice af_nicole --force` |
| Render every article (batch) | `tools/venv/bin/python tools/render_article.py --all` |
| Validate timings vs markdown | `tools/venv/bin/python tools/render_article.py --validate {slug}` |
| Validate every article | `tools/venv/bin/python tools/render_article.py --validate` |

### Voices (Kokoro)

`bm_lewis` is the site default. Other voices auditioned during the original brainstorm:

- **British male:** `bm_daniel`, `bm_fable`, `bm_george`, `bm_lewis`
- **British female:** `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`
- **American female:** `af_alloy`, `af_aoede`, `af_bella`, `af_heart`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky`

Voice prefix `b*` → `en-gb`, `a*` → `en-us` (inferred automatically). Render-time factor on CPU is ~0.6× (a 5-min article renders in ~3 min).

### One-time setup on a fresh clone

```sh
cd ~/code/PROJECTS/VULTR_0/sites/timbeach.com
python3 -m venv tools/venv
tools/venv/bin/pip install -r tools/requirements.txt
tools/download-models.sh   # downloads kokoro-v1.0.onnx (~310 MB) + voices-v1.0.bin (~27 MB)
```

Requires `ffmpeg` on PATH (system package).

### Common failure modes

- **"index 510 is out of bounds"** → a single paragraph exceeds Kokoro's 510-phoneme context. The renderer auto-splits on `.!?` and retries. If a sentence-less wall (e.g., a markdown table) still overflows, the whole article fails — see next item.
- **Markdown table mangled into spoken pipes** → `extract_paragraphs` uses `markdown-it-py` with `.enable("table")` so tables are properly skipped (the client also doesn't include `<table>` in its TTS selector). If you see stuck pipes, your table syntax is non-standard or the renderer is missing `.enable("table")`.
- **Bar hides itself with `[tts] paragraph count mismatch`** → the markdown was edited after rendering. Re-render with `--force`.
- **Bar hides itself with `[tts] first paragraph text mismatch`** → same root cause as above; re-render with `--force`.
- **Validate passes but the bar still hides client-side** → client/server parser divergence (`parseMarkdown` and `extract_paragraphs` disagree on paragraph boundaries). Two known causes have been fixed: `# → <h2>` title mapping (client selector excludes h2; server excludes h1), and per-line `<p>` wrapping (the client wraps every newline-separated line in its own `<p>`, so verse-style markdown should use `\n\n` separators between every line). If a third divergence appears, the long-term fix is to extract `parseMarkdown` into shared JS and validate via Node.

### Deploy gate

`./deploy.sh` runs `tools/render_article.py --validate` before rsyncing. If any article's timings are stale relative to its markdown, the deploy aborts. Catches "edited an article, forgot to re-render."

## Social Share Pages

Social crawlers (LinkedIn, X, Facebook, Slack, iMessage) don't run JS and never
see the hash fragment — so a shared `#/article/<slug>` URL always resolves to
`index.html`'s generic OG image. To get per-article previews, `deploy.sh`
generates a crawlable page per article:

- `tools/build_share_pages.py` reads `articles/articles.json` and writes
  `a/<slug>/index.html` with that article's `og:`/`twitter:` tags plus a JS +
  `<meta http-equiv="refresh">` redirect into the SPA at `#/article/<slug>`.
- **Share the `https://timbeach.com/a/<slug>/` URL**, not the `#` URL. Humans get
  redirected into the same reader view; crawlers read the baked-in tags.
- **og:image**: always a crisp **1200×630** `a/<slug>/og.png` (rendered with
  Pillow). Handing crawlers an image already at OG dimensions avoids the blur/
  crop they introduce when resampling an arbitrary-aspect source. Source
  precedence: explicit `hero` in `articles.json` → first image embedded in the
  article body → a branded text card (night-theme palette). Local images are
  contain-fit (whole image visible — safe for diagrams/screenshots) onto the
  dark canvas via Lanczos. A remote `hero` URL is passed through verbatim.
- The article reading view also has a **⧉ Copy share link** button that copies
  the `/a/<slug>/` URL.
- After deploying a new/edited article, re-scrape the URL in the
  [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) to bust
  any cached preview.

## Real Star System

The site features an astronomically accurate starfield background:

### Technical Implementation

- **Star Catalog**: Real star data loaded from `stars.json` (100+ bright stars with actual RA/Dec coordinates)
- **Procedural Stars**: 400 additional fainter stars with randomly generated but valid celestial coordinates
- **Projection**: Azimuthal equidistant (fisheye) projection, same as planetarium domes
  - Center of screen = Zenith (directly overhead)
  - Edges of screen = Horizon
  - Azimuth determines position around the circle
- **Real-time Calculations**:
  - Local Sidereal Time (LST) based on observer location and current time
  - Converts celestial coordinates (RA/Dec) to horizon coordinates (Alt/Az)
  - Only displays stars above the horizon
  - Updates every second

### Astronomical Accuracy

The system uses proper astronomical formulas:
- Greenwich Mean Sidereal Time (GMST) calculation
- Local Sidereal Time from longitude
- Coordinate transformation from equatorial (RA/Dec) to horizontal (Alt/Az)
- Geolocation API for observer position

### Visual Features

- Star size based on magnitude (brighter = larger)
- Color-coded by spectral type (emerald, sapphire, ruby, amethyst, topaz, aquamarine)
- Parallax scrolling with depth layers
- Twinkling animation with staggered delays
- Hover tooltips showing star names for cataloged stars

### Sky Info Display

Real-time astronomical data shown in bottom-left corner:
- **LST**: Local Sidereal Time (HH:MM:SS)
- **Location**: Observer coordinates (from geolocation)
- **Visible**: Count of stars currently above horizon

## Code Style Notes

- Vanilla JavaScript with no external dependencies
- CSS uses custom properties for theming
- Markdown parsing handles code blocks, headers, bold/italic, and links
- Terminal simulation includes loading animations and command history