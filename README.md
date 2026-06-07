# timbeach.com

My personal website — a static, single-page reading site built in vanilla
JavaScript with no build step and no framework. Clean day/night layout, a
dynamic article system with pre-rendered read-aloud audio, an RSS feed, and an
astronomically accurate starfield on the `/about` route.

## Architecture

A thin HTML shell loads a small set of ES modules. No bundler, no dependencies.

| File | Role |
|---|---|
| `index.html` | HTML shell: head + theme inline-script + masthead + `<main id="app">` + footer |
| `css/site.css` | All CSS — tokens, layout, components, responsive. Day/night via `[data-theme]` + `prefers-color-scheme` |
| `js/app.js` | Bootstrap, homepage rendering, route registration |
| `js/router.js` | Hash router (`#/`, `#/article/<slug>`, `#/music`, `#/about`) |
| `js/article.js` | Article fetch + custom markdown render |
| `js/tts.js` | Read-aloud bar — transport, voice select, paragraph highlight |
| `js/theme.js` | Theme toggle + persistence + OS auto-detect |
| `js/starfield.js` | Astronomical starfield + sky-info widget (mounted only on `/about`) |
| `articles/` | Markdown articles + `articles.json` registry |
| `audio/` | Pre-rendered Opus audio + timings sidecars (TTS) |
| `tools/` | Python tooling — TTS render, RSS feed, share-page generators |

## Local Development

No build process. Open `index.html` directly, or serve statically:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deployment

```bash
./deploy.sh
```

Deploys to my Vultr VPS via rsync. The script runs a pipeline first:

1. **Validate TTS** — aborts if any article's audio timings are stale relative
   to its markdown (catches "edited an article, forgot to re-render").
2. **Build RSS feed** — regenerates `feed.xml`.
3. **Build share pages** — regenerates the crawlable per-article social preview
   pages under `a/<slug>/`.
4. **rsync** — pushes the site (excluding `.git/`, `archive/`, `.well-known/`).

## Articles

Articles are markdown files in `articles/`, each registered in
`articles/articles.json` with title, date, tags, emoji, and an optional
homepage/RSS `summary`. They're fetched and rendered client-side by a custom
markdown parser.

The canonical way to publish is the `publish-article` skill (`/publish-article
<path>` in Claude Code), which handles images, metadata, audio rendering, and
parity validation. See `CLAUDE.md` for the full flow and the manual fallback.

## Read-Aloud (TTS)

Read-aloud audio is **pre-rendered at publish time** with Kokoro, not
synthesized in the reader's browser — every reader gets identical playback and
paragraph highlighting is exact by construction. Articles without audio simply
omit the read-aloud button.

```bash
tools/venv/bin/python tools/render_article.py <slug> --voice bm_lewis
tools/venv/bin/python tools/render_article.py --validate <slug>
```

See `docs/tts-pipeline.md` for the architecture and `CLAUDE.md` for voices,
one-time setup, and common failure modes.

## Social Share Pages

Crawlers (LinkedIn, X, Slack, iMessage) don't run JS and never see the hash
fragment, so `deploy.sh` generates a crawlable `a/<slug>/index.html` per article
with baked-in OG/Twitter tags and a 1200×630 `og.png`. **Share the
`https://timbeach.com/a/<slug>/` URL**, not the `#/article/<slug>` one — humans
get redirected into the reader, crawlers read the static tags. See `CLAUDE.md`.

## Starfield

The `/about` route renders an astronomically accurate starfield: real star
catalog (`stars.json`) projected with an azimuthal-equidistant (planetarium)
projection, using live Local Sidereal Time and the browser's geolocation to show
only stars currently above the horizon. Details in `STARS.md` and `CLAUDE.md`.
