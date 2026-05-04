# timbeach.com UI Redesign — Design Spec

**Status:** Draft for review · **Date:** 2026-05-04 · **Branch:** `ui-redesign`

## Summary

Replace the current cyberpunk terminal interface with a clean, American newspaper-style site inspired by Drudge Report and Heavy.com. Single-page layout with a featured lead article + secondary cards + dated list. Source Serif 4 + IBM Plex Sans. Neutral palette with first-class light/dark modes (auto-detect with manual override). RSS feed added. Per-article TTS read-aloud preserved. Starfield/sky-info preserved but relocated to `/about` only.

## Decisions

Locked in during brainstorming:

| Decision | Choice |
|---|---|
| Direction | Drop terminal interface entirely; full visual replacement |
| Homepage layout | "Heavy" hybrid — lead story + 3 secondary cards + dated list of older articles |
| Top-level sections | Writing · Music · About |
| Day/night mode | Auto-detect OS via `prefers-color-scheme`, plus manual toggle that persists in `localStorage` |
| Palette | Neutral — cream paper / off-black ink (light), near-black / warm off-white (dark). No accent color |
| Typography | Source Serif 4 (body & headlines) + IBM Plex Sans (nav/meta/UI) + JetBrains Mono (code only) |
| Hero images | None at launch. Layout accommodates an optional `hero` field per article for future opt-in |
| Per-article TTS audio bar | Keep |
| Starfield + sky-info | Relocated to `/about` only |
| RSS feed | Build it (does not currently exist) |
| Music page | TWO_ROOMS by Gut Lens "coming soon" teaser. Will eventually link to gutlens.net (not yet live) |
| `/mason-anniversary/`, `/thailand_2026/` | Untouched, unlisted |
| Terminal interface | Out of scope for this redesign. Saved for a future Easter-egg follow-up |

Defaults selected autonomously (override on review):

| Decision | Default | Why |
|---|---|---|
| File architecture | Split `index.html` + `css/site.css` + `js/app.js` + `js/tts.js` + `js/theme.js` + `js/router.js` | Current 3,800-line single file is past the point where edits stay local. Splitting also isolates the theme JS for testing. |
| Routing | Hash-based (existing model). New routes: `#/`, `#/article/<slug>`, `#/music`, `#/about` | Backward-compatible; works on plain rsync hosting; no server config needed. |
| Backward compatibility | Old `#articles/<slug>.md` URLs redirect to new `#/article/<slug>` form via JS shim | Avoid breaking shared/indexed links. |
| About page bio | One short paragraph. Email, GitHub links. Starfield as a subtle background element (not full-screen). | "Super short or leave it out" — bias toward short. |
| RSS generation | Build-time (`tools/build_feed.py`), wired into `deploy.sh` between `--validate` and `rsync` | Mirrors the existing TTS pipeline pattern. |
| Music page TWO_ROOMS treatment | Centered placeholder cover + "TWO_ROOMS · Gut Lens · Coming Soon · 2026" + a link to gutlens.net set behind a `data-link-live="false"` attribute that's just disabled-looking text until the link is flipped on. | gutlens.net not live yet; no broken link in the meantime. |

## Routes

| Route | Page | Notes |
|---|---|---|
| `/` or `#/` | Homepage | Lead article + 3 secondary cards + dated list |
| `#/article/<slug>` | Article reading view | TTS bar, paragraph highlighting, back-to-writing link |
| `#articles/<slug>.md` | Legacy redirect | Maps to `#/article/<slug>` (drop the `.md`) on load |
| `#/music` | Music page | TWO_ROOMS teaser |
| `#/about` | About page | Bio + starfield (only here) |
| `/feed.xml` | RSS 2.0 feed | Generated at deploy time |
| `/mason-anniversary/` | Existing standalone page | Untouched |
| `/thailand_2026/` | Existing standalone, unlinked | Untouched |

## Layout System

### Page widths
- **`--page-width: 860px`** — outer container max width. Masthead, nav, footer, secondary cards row, and dated list all span this.
- **`--content-width: 720px`** — reading column. Used by the article body, lead-story headline + lede block on the homepage, and the centered single-column About bio.
- Below 760px viewport: collapse to single-column, 16px horizontal page padding, 3-column secondary card row becomes a stack of three.

### Homepage anatomy

```
┌──────────────────────────────────────────────────────────────┐
│  Timothy D Beach              Writing · Music · About · ☀/🌙 │
├──────────────────────────────────────────────────────────────┤  ← 3px solid border
│                                                              │
│  MAY 2 · NETWORKING                                          │  ← meta (Plex Sans, uppercase, tracked)
│  The OSI Model, Explained from a Whiteboard                  │  ← lead headline (Source Serif, 28-32px, weight 700)
│  Sometimes the best way to lock in a concept is to grab     │  ← lede paragraph (17px, color-muted)
│  a marker and start scribbling…                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤  ← 1px divider
│  MAY 1 · LINUX     │ APR 29 · DEVOPS    │ APR 26 · TTS       │
│  From ~/.local/src │ Pipeline vs Harness│ How My Blog Got    │
│  to the AUR        │                    │ a Voice            │
│  short summary     │ short summary      │ short summary      │
├──────────────────────────────────────────────────────────────┤  ← 1px divider
│  More                                                        │
│  2026-04-23   Jungian Dream Notes                            │  ← dated list (Plex Sans for date, Source Serif for title)
│  2026-04-21   How to Configure Obsidian the Agentic Way      │
│  2026-04-06   Dependency Hell                                │
│  …                                                           │
├──────────────────────────────────────────────────────────────┤
│  © 2026 Timothy D Beach · RSS · GitHub · Email               │  ← footer (Plex Sans, small, muted)
└──────────────────────────────────────────────────────────────┘
```

- **Lead** = newest article (by `date` desc).
- **Secondary cards** = next 3 articles. Each card: meta line (`MMM D · TAG`), headline, ~1-line summary.
- **Dated list** = remaining articles, newest first. Two columns on wide screens (date | title), single column on mobile.
- **Footer** is always visible at the bottom of the page (not sticky).
- **Theme toggle** lives in the nav as a small sun/moon button at the right end.

The lead-story area reserves a horizontal slot for a future optional hero image. When `articles.json[slug].hero` is present, the headline + lede shift left (1.3fr) and the image takes the right slot (1fr). When absent (the launch state), the headline+lede span the full width.

### Article reading view

```
┌──────────────────────────────────────────────────────────────┐
│  Timothy D Beach              Writing · Music · About · ☀/🌙 │
├──────────────────────────────────────────────────────────────┤
│  ← Writing                                                   │  ← back link, top-left (Plex Sans, small)
│                                                              │
│  MAY 2, 2026 · NETWORKING                                    │
│  The OSI Model, Explained from a Whiteboard                  │
│                                                              │
│  Sometimes the best way to lock in a concept is to grab a    │  ← article body, max 720px
│  marker and start scribbling…                                │
│                                                              │
│  ## What the OSI Model Actually Is                           │  ← h2, Source Serif 600
│                                                              │
│  The Open Systems Interconnection model is a conceptual…     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ # code block — JetBrains Mono                          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  …                                                           │
├──────────────────────────────────────────────────────────────┤
│  ▶ Read aloud  [████░░░░░░░░░░] 02:15 / 06:42  ⏪ ⏯ ⏩ 1.0× │  ← TTS bar (preserved, restyled)
└──────────────────────────────────────────────────────────────┘
```

- Article body uses `--content-width: 720px`.
- Headings: `h1` is the article title; `h2` for top-level sections (Source Serif 600, 22px); `h3` for sub-sections (Source Serif 600, 18px).
- Code blocks: JetBrains Mono, 14px, padded 16px, neutral surface tint (light: `#f3f0e8`, dark: `#1a1a18`) — matches `--bg-elev`.
- Inline code: same font, 0.9em, background `--bg-elev`, 2px horizontal padding, 1px vertical padding, no border.
- Images: full content-width, with optional caption below in Plex Sans 12px muted.
- TTS bar: existing functionality preserved (timings-driven paragraph highlighting). Restyled to neutral palette — drop the cyan-on-black accent, use foreground/muted/divider tokens.

### Music page

```
┌──────────────────────────────────────────────────────────────┐
│  Timothy D Beach              Writing · Music · About · ☀/🌙 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              ┌─────────────────┐                             │
│              │                 │                             │
│              │   [cover art]   │                             │
│              │   placeholder   │                             │
│              │                 │                             │
│              └─────────────────┘                             │
│                                                              │
│                    TWO_ROOMS                                 │  ← Source Serif 700, 32px, centered
│                    Gut Lens                                  │  ← Plex Sans 14px, tracked, muted
│                  COMING SOON · 2026                          │
│                                                              │
│                  gutlens.net (soon)                          │  ← disabled-looking link until live
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Centered, vertical rhythm. No nav bar duplication.
- Cover placeholder: neutral square with a subtle gradient or just a flat tone matching dividers.
- "gutlens.net (soon)" is rendered as plain muted text. When the site goes live, flip a single config flag to make it a clickable link.

### About page

```
┌──────────────────────────────────────────────────────────────┐
│  Timothy D Beach              Writing · Music · About · ☀/🌙 │
├──────────────────────────────────────────────────────────────┤
│  [starfield background — visible only on this page]          │
│                                                              │
│  About                                                       │  ← Source Serif 700, 28px
│                                                              │
│  I'm Timothy. I write software, record music as Gut Lens,    │  ← bio (Source Serif body, 1-2 paragraphs)
│  and run Aegix Linux. This site is where I write things      │
│  down so I don't have to remember them twice.                │
│                                                              │
│  Email · GitHub                                              │  ← contact links, Plex Sans
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ LST 23:47:12 · 47.6°N 122.3°W · 184 stars visible    │    │  ← sky-info widget (preserved)
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

- Starfield runs full-page behind the content **only on `/about`**. On other pages, the starfield code is not active.
- Sky-info widget styled to match the neutral palette (drop the cyan).
- Bio is intentionally short. Author can override on review.

## Color & Typography Tokens

CSS custom properties on `:root`, with `[data-theme="dark"]` overrides. Both modes share variable names so layout CSS doesn't branch on theme.

```css
:root {
  /* === Light mode (default) === */
  --bg:           #fbfaf6;   /* cream paper */
  --bg-elev:     #f3f0e8;   /* code block surface, dividers in card backgrounds */
  --fg:           #111111;   /* primary ink */
  --fg-muted:     #555555;   /* secondary text, nav inactive */
  --fg-faint:     #888888;   /* meta, dates, captions */
  --divider:      #d8d4cc;   /* horizontal rules between sections */
  --rule-bold:    #111111;   /* the 3px masthead bottom border */
  --link:         #111111;   /* same as fg — distinguished by underline only */
  --link-hover:   #000000;
  --selection:    #d8d4cc;

  /* Typography stacks */
  --font-serif: "Source Serif 4", Charter, Georgia, "Times New Roman", serif;
  --font-sans:  "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:  "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* Sizing */
  --page-width:    860px;
  --content-width: 720px;
}

[data-theme="dark"] {
  --bg:        #0e0e0e;
  --bg-elev:   #1a1a18;
  --fg:        #e6e3da;   /* warm off-white, not pure white */
  --fg-muted:  #9a958a;
  --fg-faint:  #6e6a60;
  --divider:   #2a2a28;
  --rule-bold: #e6e3da;
  --link:      #e6e3da;
  --link-hover: #ffffff;
  --selection: #3a3a36;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { /* respect OS only when user hasn't chosen */
    --bg:        #0e0e0e;
    --bg-elev:   #1a1a18;
    --fg:        #e6e3da;
    --fg-muted:  #9a958a;
    --fg-faint:  #6e6a60;
    --divider:   #2a2a28;
    --rule-bold: #e6e3da;
    --link:      #e6e3da;
    --link-hover: #ffffff;
    --selection: #3a3a36;
  }
}
```

### Heading hierarchy

- The masthead brand "Timothy D Beach" is a link, not a heading.
- **Homepage:** lead article's headline is `<h1>`. Secondary cards use `<h2>`. Dated list titles use `<h3>` (or `<a>` inside a `<li>` — implementation choice, not semantic).
- **Article reading view:** article title is `<h1>`. Top-level sections in the body are `<h2>`. Sub-sections are `<h3>`.
- **Music / About pages:** page title ("Music" / "About") is `<h1>`.

This avoids two `<h1>`s on a page and keeps SEO/accessibility tooling happy.

### Type scale

| Use | Font | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Article H1 / lead headline | Serif | 28-32px (clamp) | 700 | 1.1 | -0.01em |
| Section H2 | Serif | 22px | 600 | 1.2 | normal |
| Section H3 | Serif | 18px | 600 | 1.25 | normal |
| Lede paragraph | Serif | 17px | 400 | 1.5 | normal |
| Body paragraph | Serif | 16px | 400 | 1.65 | normal |
| Card headline | Serif | 15-16px | 700 | 1.2 | normal |
| Card summary | Serif | 13px | 400 | 1.4 | normal |
| Dated-list title | Serif | 14px | 400 | 1.3 | normal |
| Nav / meta / labels | Sans | 11px | 500 | 1.3 | 0.12em (uppercase) |
| Code block | Mono | 14px | 400 | 1.55 | normal |
| Inline code | Mono | 0.9em | 400 | inherit | normal |
| Footer | Sans | 12px | 400 | 1.4 | 0.06em |

## Theme Switching Mechanic

`js/theme.js`:

1. On load: read `localStorage.theme`. If set ("light" | "dark"), apply `data-theme="<value>"` on `<html>`.
2. If not set: do nothing — the `:root:not([data-theme])` + `prefers-color-scheme: dark` media query handles auto.
3. Toggle button click: read current effective theme (`getComputedStyle` or check `data-theme` / fall back to media query), set the opposite on `<html>` and write to `localStorage.theme`.
4. A "match system" reset action is reachable via long-press / option-click (or just a small "system" button next to the toggle if simpler) — clears `localStorage.theme` and removes `data-theme`.

The toggle icon flips between sun (currently dark, click to go light) and moon (currently light, click to go dark) based on effective theme. No FOUC: a tiny inline `<script>` at the top of `<head>` reads localStorage and sets `data-theme` *before* CSS loads.

```html
<!-- inline in <head>, before any <link> -->
<script>
  (function() {
    try {
      var t = localStorage.getItem('theme');
      if (t === 'light' || t === 'dark') {
        document.documentElement.setAttribute('data-theme', t);
      }
    } catch (e) {}
  })();
</script>
```

## Article Data Model

`articles/articles.json` extends with two optional fields:

```json
"osi-model-whiteboard.md": {
  "title": "The OSI Model, Explained from a Whiteboard",
  "date": "2026-05-02",
  "tags": ["networking", "fundamentals"],
  "emoji": "🌐",
  "audio": "audio/osi-model-whiteboard.ogg",
  "timings": "audio/osi-model-whiteboard.timings.json",
  "voice": "bm_lewis",
  "duration": 412.6,

  "summary": "A walk up the seven layers, with the cables and the bullshit included.",  // NEW (optional)
  "section": "Networking",   // NEW (optional, defaults to first tag, capitalized)
  "hero": "pix/osi-board.jpg" // NEW (optional, future opt-in)
}
```

- `summary` powers the secondary card's 1-line description and the RSS `<description>`. If absent, derive from the article's lede (first paragraph after title).
- `section` powers the meta-line label. Defaults to title-casing the first tag.
- `hero` powers the optional lead-story image (and per-article OG image if we want later). Absent at launch.

The `publish-article` skill workflow updates to prompt for `summary` and `section`.

## RSS Feed

`tools/build_feed.py` produces `feed.xml` at the project root.

- Reads `articles/articles.json`.
- Outputs RSS 2.0 with `<channel>` (title, link, description, lastBuildDate) and `<item>` per article (title, link, pubDate, description=summary, guid=permalink).
- Wired into `deploy.sh` after the existing `--validate` step:

  ```sh
  tools/venv/bin/python tools/render_article.py --validate || exit 1
  tools/venv/bin/python tools/build_feed.py || exit 1
  rsync -av --exclude=...
  ```

- Footer link `RSS` points to `/feed.xml`.
- `<head>` autodiscovery: `<link rel="alternate" type="application/rss+xml" title="Timothy D Beach" href="/feed.xml" />`

## File Architecture

```
index.html              ← skeleton: <head>, route shell, <main id="app">, <footer>, theme inline-script
css/
  site.css              ← all CSS: tokens, layout, typography, components
js/
  app.js                ← homepage rendering, route dispatch, mounts pages
  router.js             ← hash router, parses #/<route>, supports legacy redirects
  article.js            ← article fetch + markdown render + meta head update
  tts.js                ← read-aloud bar (preserved logic, restyled)
  theme.js              ← theme toggle + localStorage + media query
  starfield.js          ← starfield + sky-info, only initialized on /about
articles/               ← (unchanged) markdown + articles.json
audio/                  ← (unchanged) Opus + timings sidecars
pix/                    ← (unchanged) inline article images
tools/
  build_feed.py         ← NEW: RSS generator
  render_article.py     ← (unchanged) TTS pre-render
feed.xml                ← (generated)
```

The existing markdown parser (with the recent bold/italic-inside-list-items fix) moves into `js/article.js` as-is. The TTS bar's HTML is mounted by `js/tts.js` at the bottom of `<body>`; CSS moves to `css/site.css` under `.tts-bar` selectors.

## What's Removed

- Terminal commands (`ls`, `cd`, `cat`, `tree`, `pwd`, `whoami`, `help`, `clear`, `back`)
- Terminal prompt UI, command history, simulated typing
- Scanline overlay, glow effects, cyan/cyberpunk accent colors (`--accent: #5de4c7`, `--highlight: #e8a87c`, etc.)
- Confetti explosion on title click
- Marquee animation
- The taiko.mp3 ambient audio (if it was wired anywhere)
- Mr. Robot mask image, sparkle heart, Orthodox cross icon (unless reused on `/about`)
- Starfield + sky-info from the global background (relocated to `/about` only)

## Backward Compatibility

- **Article URLs:** old `#articles/<slug>.md` maps to new `#/article/<slug>` via a one-line shim in `js/router.js`. Both forms resolve to the same content.
- **Existing standalone pages:** `/mason-anniversary/`, `/thailand_2026/` are unchanged — they're separate static directories.
- **Articles JSON schema:** new fields are optional. Articles without `summary`/`section` get sensible derivations.
- **TTS audio files:** unchanged. `audio/<slug>.ogg` and `.timings.json` continue to work.
- **Deploy:** `deploy.sh` continues to validate TTS, plus generates RSS, plus rsyncs.

## Out of Scope (Follow-ups)

These are explicitly *not* part of this redesign:

1. **Terminal interface as Easter egg.** Future `bd create` task: revive the terminal at a hidden URL (e.g., `#/terminal` or `?cmd=ls`). Out of scope for the redesign because it's its own surface area and we said "full replacement" first.
2. **Hero images for legacy articles.** Layout supports `hero` field; no requirement to backfill.
3. **Per-article OG/Twitter card images.** Site-wide OG image (`zenshin-suru.jpg`) continues to be used.
4. **Article comments / search.** No.
5. **Section archive pages.** `#/writing/networking` etc. — not at launch. The dated list on the homepage shows everything.
6. **Newsletter signup.** No.

## Open Questions to Confirm on Review

These were defaulted autonomously while you were away:

1. **File split (B) confirmed?** The single-file vs split decision. Default: split. Strongly recommended.
2. **Hash-based routes new form (`#/article/<slug>`) vs preserve exact existing form (`#articles/<slug>.md`)?** Default: new form, with old form redirected. The `.md` extension in URLs is a wart inherited from the terminal `cat <filename>` interface.
3. **About-page bio length and content?** Default written above is a placeholder — please supply the bio text you want, or keep it minimal as proposed.
4. **Footer items: any addition or removal?** Default: `© 2026 Timothy D Beach · RSS · GitHub · Email`. Some sites add "site source on GitHub" too.
5. **TWO_ROOMS placeholder:** is "Coming Soon · 2026" right? Or do you want a specific date or "TBA"?
6. **Theme toggle "match system" affordance.** Long-press? Separate button? Default: just a sun/moon toggle for v1; "match system" is a follow-up.
7. **RSS feed scope.** All articles, full content vs summary-only. Default: summary + link only (no full body). Easier on storage and respects the read-aloud / on-site experience.

## Risks

- **Markdown parser divergence with TTS validate step.** The existing `extract_paragraphs` in `tools/render_article.py` and the JS `parseMarkdown` must continue to agree on paragraph boundaries (per `CLAUDE.md` notes). When the parser moves from `index.html` to `js/article.js`, copy it verbatim — don't refactor opportunistically.
- **TTS bar visual regression.** Restyling the TTS bar to match the neutral palette is in scope, but the *behavior* (paragraph highlighting, audio sync, voice select) must not regress. Existing audio files and timings.json shape are unchanged.
- **FOUC on theme switch.** The inline `<script>` in `<head>` must execute before the first stylesheet to prevent a light-mode flash for dark-mode users. Test on cold-load with throttled CPU.
- **Mobile layout for the secondary cards row.** A 3-column row collapses to a single stack. Test breakpoints and verify reading order is maintained.

## Success Criteria

- Homepage: lead article + 3 secondary cards + dated list, neutral palette, both light and dark modes verified, theme toggle works, persists across reloads.
- Article reading view: TTS bar plays, paragraph highlighting works, `← Writing` back-link works.
- `/music`: TWO_ROOMS placeholder displays correctly in both modes.
- `/about`: bio renders, starfield is visible only here, sky-info widget shows live LST.
- `/feed.xml`: validates as RSS 2.0; auto-discovery link present in `<head>`.
- Old `#articles/<slug>.md` URLs still resolve to the right article.
- `deploy.sh` runs the TTS validate step + RSS build + rsync without manual intervention.
- No terminal-era code or assets ship to production.
