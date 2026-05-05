# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cyberpunk terminal interface at timbeach.com with a clean, American newspaper-style site (Drudge/Heavy.com inspired) — featured lead article + secondary cards + dated list, neutral palette, Source Serif 4 + IBM Plex Sans typography, day/night modes (auto-detect with manual override), RSS feed. Per-article TTS read-aloud preserved. Starfield/sky-info relocated to `/about` only.

**Architecture:** Split the existing 3,800-line `index.html` into a thin HTML skeleton + `css/site.css` + ~6 small JS modules (`router.js`, `theme.js`, `app.js`, `article.js`, `tts.js`, `starfield.js`). Hash-based routing (`#/`, `#/article/<slug>`, `#/music`, `#/about`) with legacy `#articles/<slug>.md` redirected. New build-time RSS generator (`tools/build_feed.py`) wired into `deploy.sh`. CSS-only day/night via custom properties + `[data-theme="dark"]` and `prefers-color-scheme` media query.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no bundler, no Node toolchain). Python 3 + `markdown-it-py` for the RSS generator. Pytest for Python tests. Browser-based smoke testing for the frontend.

**Spec:** [`docs/superpowers/specs/2026-05-04-ui-redesign-design.md`](../specs/2026-05-04-ui-redesign-design.md) — read this first.

**Branch:** `ui-redesign` (already checked out).

**Beads issue:** `timbeach-dcl` — claim it with `bd update timbeach-dcl --status=in_progress` before starting Task 1.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `css/site.css` | All CSS — tokens, base, layout, typography, components |
| `js/router.js` | Hash router; parses `#/<route>`, dispatches to page renderers, handles legacy `#articles/<slug>.md` redirect |
| `js/theme.js` | Reads `localStorage.theme`; toggles `data-theme` on `<html>`; wires the sun/moon button |
| `js/app.js` | Bootstraps the site — fetches `articles/articles.json`, dispatches the initial route, owns the homepage rendering |
| `js/article.js` | Article fetch + markdown render; mounts the article reading view; updates `<title>` and meta description |
| `js/tts.js` | Read-aloud bar — markup, transport controls, paragraph highlighting via timings sidecar |
| `js/starfield.js` | Starfield background + sky-info widget; only initialized when the `/about` route mounts |
| `tools/build_feed.py` | RSS 2.0 generator; reads `articles/articles.json`, emits `feed.xml` |
| `tools/test_build_feed.py` | Pytest tests for the RSS generator |

**Modified:**

| File | What changes |
|---|---|
| `index.html` | Reduced from 3,800 lines to ~80 lines: head + theme inline-script + masthead + `<main id="app">` + footer + `<script>` tags |
| `articles/articles.json` | Optional new fields (`summary`, `section`, `hero`) — schema only; no required backfill |
| `deploy.sh` | Calls `tools/build_feed.py` after `--validate`, before rsync |
| `CLAUDE.md` | Updated architecture description and file map |

**Deleted (assets only):**

- `mr-robot-mask_pixel-ROUGH_block48_5c.png` — unused after redesign
- `sparkle_heart_actually_transparent.png` — unused after redesign
- `icons8-orthodox-cross-50.png` — unused after redesign

(The original `index.html`'s terminal code is preserved in git history for the future Easter-egg follow-up — issue `timbeach-d75`. No need to copy aside.)

---

## Testing Strategy

- **`tools/build_feed.py`:** TDD with pytest. Mirrors the pattern in `tools/test_render_article.py`.
- **Frontend (HTML/CSS/JS):** No JS test framework exists in the project; introducing one is out of scope. Verification is **browser smoke-test based**, with explicit checks listed in each task. Use a static-file server: `python3 -m http.server 8000` from the project root, then visit `http://localhost:8000`.
- **TTS regression:** After Task 7, validate that `tools/render_article.py --validate` still passes for every article and that paragraph highlighting works on at least one article in both light and dark modes.
- **Deploy gate:** After Task 11, validate that `./deploy.sh` (run with rsync target unreachable, e.g., comment the rsync line temporarily) runs validate → build_feed → would-rsync, and produces a valid `feed.xml`.

---

## Task 1: Scaffold file structure and CSS tokens

**Files:**
- Create: `css/site.css`
- Create: `js/router.js` (stub)
- Create: `js/theme.js` (stub)
- Create: `js/app.js` (stub)
- Create: `js/article.js` (stub)
- Create: `js/tts.js` (stub)
- Create: `js/starfield.js` (stub)

**Goal:** Lay down the directory structure and CSS design tokens. No HTML changes yet — `index.html` still serves the old terminal site.

- [ ] **Step 1: Create the directories**

```bash
mkdir -p css js
```

- [ ] **Step 2: Write `css/site.css` with tokens + base styles**

```css
/* css/site.css — timbeach.com design tokens + base */

:root {
  /* === Light mode (default) === */
  --bg:           #fbfaf6;
  --bg-elev:      #f3f0e8;
  --fg:           #111111;
  --fg-muted:     #555555;
  --fg-faint:     #888888;
  --divider:      #d8d4cc;
  --rule-bold:    #111111;
  --link:         #111111;
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
  --fg:        #e6e3da;
  --fg-muted:  #9a958a;
  --fg-faint:  #6e6a60;
  --divider:   #2a2a28;
  --rule-bold: #e6e3da;
  --link:      #e6e3da;
  --link-hover: #ffffff;
  --selection: #3a3a36;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
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

/* === Reset === */

*, *::before, *::after { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection { background: var(--selection); }

a {
  color: var(--link);
  text-decoration: none;
  border-bottom: 1px solid var(--divider);
  transition: color 0.15s, border-color 0.15s;
}
a:hover { color: var(--link-hover); border-bottom-color: var(--fg); }

/* === Page container === */

.page {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 32px 24px 64px;
}

/* === Masthead === */

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 3px solid var(--rule-bold);
  padding-bottom: 12px;
  margin-bottom: 32px;
}

.brand {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  margin: 0;
  border: none;
}
.brand:hover { border: none; }

.nav {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.nav a { margin-left: 16px; border: none; color: var(--fg-muted); }
.nav a:hover { color: var(--fg); }
.nav a.active { color: var(--fg); }

.theme-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  margin-left: 16px;
  padding: 4px;
  color: var(--fg-muted);
  font-size: 16px;
  line-height: 1;
}
.theme-toggle:hover { color: var(--fg); }

/* === Type scale === */

h1, h2, h3, h4 { font-family: var(--font-serif); margin: 0; }

.meta {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-faint);
  margin-bottom: 6px;
}

/* === Footer === */

.site-footer {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid var(--divider);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--fg-faint);
  text-align: center;
}
.site-footer a { color: var(--fg-faint); border: none; }
.site-footer a:hover { color: var(--fg); }
```

- [ ] **Step 3: Write JS module stubs**

Each stub exports nothing yet — they'll be filled in in subsequent tasks. The point of this step is to lock in module identity so the import order in `index.html` is stable.

`js/router.js`:
```js
// js/router.js — hash router, populated in Task 4.
export function initRouter() {}
```

`js/theme.js`:
```js
// js/theme.js — theme toggle wiring, populated in Task 3.
export function initTheme() {}
```

`js/app.js`:
```js
// js/app.js — site bootstrap and homepage rendering, populated in Tasks 4-5.
import { initTheme } from './theme.js';
import { initRouter } from './router.js';

export function bootstrap() {
  initTheme();
  initRouter();
}
```

`js/article.js`:
```js
// js/article.js — article fetch + render, populated in Task 6.
export async function renderArticle(slug, mountEl) {
  mountEl.textContent = `[article placeholder: ${slug}]`;
}
```

`js/tts.js`:
```js
// js/tts.js — read-aloud bar, populated in Task 7.
export function mountTtsBar(article) {}
```

`js/starfield.js`:
```js
// js/starfield.js — starfield + sky-info, populated in Task 9.
export function initStarfield(rootEl) {}
```

- [ ] **Step 4: Verify the files exist**

```bash
ls -la css/site.css js/router.js js/theme.js js/app.js js/article.js js/tts.js js/starfield.js
```
Expected: all 7 files listed.

- [ ] **Step 5: Commit**

```bash
git add css/site.css js/
git commit -m "Scaffold redesign file structure with CSS tokens

- css/site.css: design tokens, base reset, masthead, footer
- js/{router,theme,app,article,tts,starfield}.js: module stubs

Site still serves the old terminal index.html; no behavior change yet."
```

---

## Task 2: HTML skeleton with theme inline script

**Files:**
- Modify: `index.html` (replace entire file)

**Goal:** Replace the existing terminal HTML with a thin skeleton: head + theme FOUC-prevention script + masthead + nav + `<main id="app">` + footer + module imports. The site will look broken at this point — that's expected. The next tasks fill in `<main id="app">`.

- [ ] **Step 1: Save the current `index.html` to a snapshot for reference (optional, for sanity)**

```bash
git show HEAD:index.html > /tmp/index-pre-redesign.html
```
This snapshot is **not** committed — it's just for ad-hoc reference while building. The original is forever in git history.

- [ ] **Step 2: Replace `index.html` with the new skeleton**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Timothy D Beach</title>
  <meta name="description" content="Software engineer, recording artist, GNU/Linux enthusiast. Writing, music, and notes from a working bench." />

  <!-- Open Graph / Social Media Preview -->
  <meta property="og:title" content="Timothy D Beach" />
  <meta property="og:description" content="Software engineer, recording artist, GNU/Linux enthusiast." />
  <meta property="og:image" content="https://timbeach.com/pix/zenshin-suru.jpg" />
  <meta property="og:image:width" content="1600" />
  <meta property="og:image:height" content="1200" />
  <meta property="og:url" content="https://timbeach.com" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Timothy D Beach" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Timothy D Beach" />
  <meta name="twitter:description" content="Software engineer, recording artist, GNU/Linux enthusiast." />
  <meta name="twitter:image" content="https://timbeach.com/pix/zenshin-suru.jpg" />

  <!-- Favicons -->
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <link rel="shortcut icon" href="favicon.ico" />
  <link rel="manifest" href="site.webmanifest" />

  <!-- RSS autodiscovery (feed.xml is generated at deploy time) -->
  <link rel="alternate" type="application/rss+xml" title="Timothy D Beach" href="/feed.xml" />

  <!-- FOUC prevention: apply explicit theme before stylesheets load -->
  <script>
    (function () {
      try {
        var t = localStorage.getItem('theme');
        if (t === 'light' || t === 'dark') {
          document.documentElement.setAttribute('data-theme', t);
        }
      } catch (e) { /* ignore: localStorage may be disabled */ }
    })();
  </script>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="css/site.css" />
</head>
<body>
  <div class="page">
    <header class="masthead">
      <a href="#/" class="brand">Timothy D Beach</a>
      <nav class="nav" aria-label="Primary">
        <a href="#/" data-nav="home">Writing</a>
        <a href="#/music" data-nav="music">Music</a>
        <a href="#/about" data-nav="about">About</a>
        <button class="theme-toggle" type="button" aria-label="Toggle light/dark mode" title="Toggle theme">☾</button>
      </nav>
    </header>

    <main id="app" role="main">
      <p class="meta">Loading…</p>
    </main>

    <footer class="site-footer">
      © <span id="footer-year">2026</span> Timothy D Beach
      &middot; <a href="/feed.xml">RSS</a>
      &middot; <a href="https://github.com/timbeach" target="_blank" rel="noopener">GitHub</a>
      &middot; <a href="mailto:beachtimothyd@gmail.com">Email</a>
    </footer>
  </div>

  <script type="module">
    import { bootstrap } from './js/app.js';
    bootstrap();
    document.getElementById('footer-year').textContent = new Date().getFullYear();
  </script>
</body>
</html>
```

- [ ] **Step 3: Smoke test**

Run a static server:
```bash
python3 -m http.server 8000 &
```
Open `http://localhost:8000` in a browser.

Expected: see "Timothy D Beach" masthead with three nav links, "Loading…" placeholder, footer with RSS / GitHub / Email links. Cream-colored background in light mode; near-black in dark mode (toggle your OS preference to verify both). No console errors.

- [ ] **Step 4: Stop the test server**

```bash
kill %1 2>/dev/null || pkill -f "http.server 8000"
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Replace index.html with redesign skeleton

- Head: meta + favicons + RSS autodiscovery + theme inline-script
- Body: masthead, nav, <main id=\"app\">, footer
- Imports js/app.js as module entry point

Page renders an empty 'Loading…' shell — module stubs fire but render
nothing yet. Old terminal interface and starfield removed."
```

---

## Task 3: Theme toggle wiring

**Files:**
- Modify: `js/theme.js`

**Goal:** Implement the sun/moon toggle: read `localStorage.theme`, set `data-theme` on `<html>` (already done by the inline script), wire the button to flip between light/dark and persist.

- [ ] **Step 1: Implement `js/theme.js`**

```js
// js/theme.js — theme toggle. The FOUC-prevention <script> in <head> already
// applies localStorage.theme before CSS loads. This module wires the button.

const STORAGE_KEY = 'theme';
const ATTR = 'data-theme';

function effectiveTheme() {
  const explicit = document.documentElement.getAttribute(ATTR);
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(next) {
  document.documentElement.setAttribute(ATTR, next);
  try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  updateButtonIcon();
}

function updateButtonIcon() {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const isDark = effectiveTheme() === 'dark';
  // Icon shows what you'll switch TO: sun in dark mode, moon in light mode.
  btn.textContent = isDark ? '☀' : '☾';
  btn.setAttribute('aria-label',
    isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

export function initTheme() {
  updateButtonIcon();

  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      applyTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // Update icon if the OS preference changes while the page is open and the
  // user hasn't set an explicit theme.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (stored !== 'light' && stored !== 'dark') updateButtonIcon();
  });
}
```

- [ ] **Step 2: Smoke test**

Run `python3 -m http.server 8000` and open `http://localhost:8000`.

Verify:
1. Initial icon matches current effective theme (☾ in light, ☀ in dark).
2. Click the toggle. Background flips. Icon flips. Reload — preference persists.
3. Open DevTools → Application → Local Storage → confirm `theme` key has correct value.
4. Clear localStorage `theme`, change OS dark-mode preference, reload — site matches OS.

Stop server: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add js/theme.js
git commit -m "Implement theme toggle with localStorage persistence

- Sun/moon button flips light/dark and saves to localStorage
- Icon shows the destination state (sun in dark mode = 'switch to light')
- Honors OS prefers-color-scheme when no explicit choice is stored
- Updates icon if OS preference changes mid-session"
```

---

## Task 4: Hash router

**Files:**
- Modify: `js/router.js`
- Modify: `js/app.js`

**Goal:** Parse `location.hash`, dispatch to one of: home / article / music / about / 404. Handle the legacy `#articles/<slug>.md` form by rewriting to `#/article/<slug>` before dispatch.

- [ ] **Step 1: Implement `js/router.js`**

```js
// js/router.js — hash-based router. Routes:
//   #/                 → home
//   #/article/<slug>   → article reading view
//   #/music            → music page
//   #/about            → about page
// Legacy redirect:
//   #articles/<slug>.md → #/article/<slug>

const handlers = new Map();

export function registerRoute(name, handler) {
  handlers.set(name, handler);
}

function parseHash(hash) {
  // Legacy form: #articles/<slug>.md
  const legacy = hash.match(/^#articles\/(.+)\.md$/);
  if (legacy) {
    const newHash = `#/article/${legacy[1]}`;
    // Replace the URL silently so back-button history isn't polluted.
    history.replaceState(null, '', newHash);
    return { route: 'article', slug: legacy[1] };
  }

  if (hash === '' || hash === '#' || hash === '#/') return { route: 'home' };

  const article = hash.match(/^#\/article\/(.+)$/);
  if (article) return { route: 'article', slug: article[1] };

  if (hash === '#/music') return { route: 'music' };
  if (hash === '#/about') return { route: 'about' };

  return { route: '404' };
}

function dispatch() {
  const parsed = parseHash(location.hash);
  const handler = handlers.get(parsed.route) || handlers.get('404');
  if (handler) handler(parsed);
  updateActiveNav(parsed.route);
  window.scrollTo(0, 0);
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav a[data-nav]').forEach((a) => {
    const navKey = a.getAttribute('data-nav');
    const matches =
      (navKey === 'home'  && (route === 'home' || route === 'article')) ||
      (navKey === 'music' && route === 'music') ||
      (navKey === 'about' && route === 'about');
    a.classList.toggle('active', matches);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}
```

- [ ] **Step 2: Wire the routes in `js/app.js`**

Replace the contents of `js/app.js`:

```js
// js/app.js — site bootstrap and homepage rendering.
import { initTheme } from './theme.js';
import { initRouter, registerRoute } from './router.js';
import { renderArticle } from './article.js';

const app = () => document.getElementById('app');

function renderHome() {
  // Filled in by Task 5.
  app().innerHTML = `<p class="meta">[home placeholder]</p>`;
}

function renderMusic() {
  // Filled in by Task 8.
  app().innerHTML = `<p class="meta">[music placeholder]</p>`;
}

function renderAbout() {
  // Filled in by Task 9.
  app().innerHTML = `<p class="meta">[about placeholder]</p>`;
}

function renderNotFound() {
  app().innerHTML = `
    <p class="meta">404</p>
    <h1>Page not found</h1>
    <p><a href="#/">← back to home</a></p>
  `;
  document.title = 'Not found · Timothy D Beach';
}

export function bootstrap() {
  initTheme();
  registerRoute('home', renderHome);
  registerRoute('article', ({ slug }) => renderArticle(slug, app()));
  registerRoute('music', renderMusic);
  registerRoute('about', renderAbout);
  registerRoute('404', renderNotFound);
  initRouter();
}
```

- [ ] **Step 3: Smoke test routes**

```bash
python3 -m http.server 8000 &
```

Visit each URL and verify:
- `http://localhost:8000/` → "[home placeholder]", **Writing** is active in nav
- `http://localhost:8000/#/about` → "[about placeholder]", **About** active
- `http://localhost:8000/#/music` → "[music placeholder]", **Music** active
- `http://localhost:8000/#/article/osi-model-whiteboard` → "[article placeholder: osi-model-whiteboard]", **Writing** active (article route highlights Writing)
- `http://localhost:8000/#articles/osi-model-whiteboard.md` → URL bar should rewrite to `#/article/osi-model-whiteboard` and content updates
- `http://localhost:8000/#/asdf` → 404 page with back link

Stop the server: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add js/router.js js/app.js
git commit -m "Add hash router with legacy redirect

- Routes: #/ home, #/article/<slug>, #/music, #/about, 404 fallback
- Legacy #articles/<slug>.md silently rewrites to #/article/<slug>
- Active nav state syncs on route change
- Scroll resets to top on navigation"
```

---

## Task 5: Homepage rendering

**Files:**
- Modify: `js/app.js` (replace `renderHome`)

**Goal:** Fetch `articles/articles.json`, sort by date desc, render lead article + 3 secondary cards + dated list of older articles. No images at launch.

- [ ] **Step 1: Add CSS for homepage components**

Append to `css/site.css`:

```css
/* === Homepage === */

.lead {
  padding-bottom: 28px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 28px;
  max-width: var(--content-width);
}
.lead .headline {
  font-size: clamp(28px, 4vw, 32px);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 8px;
}
.lead .headline a { color: var(--fg); border: none; }
.lead .headline a:hover { color: var(--link-hover); }
.lead .lede {
  font-size: 17px;
  line-height: 1.5;
  color: var(--fg-muted);
  margin: 0;
}

.cards-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 28px;
}
.cards-row .card-headline {
  font-size: 16px;
  line-height: 1.2;
  font-weight: 700;
  margin: 0 0 6px;
}
.cards-row .card-headline a { color: var(--fg); border: none; }
.cards-row .card-headline a:hover { color: var(--link-hover); }
.cards-row .card-summary {
  font-size: 13px;
  line-height: 1.4;
  color: var(--fg-muted);
  margin: 0;
}

.more h2 {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-faint);
  margin: 0 0 12px;
}
.more ul { list-style: none; padding: 0; margin: 0; }
.more li {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 16px;
  padding: 6px 0;
  border-bottom: 1px dotted var(--divider);
  align-items: baseline;
}
.more li time {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-faint);
  letter-spacing: 0.04em;
}
.more li a {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--fg);
  border: none;
}
.more li a:hover { color: var(--link-hover); }
```

- [ ] **Step 2: Implement `renderHome` in `js/app.js`**

Replace the placeholder `renderHome` function:

```js
let articlesCache = null;

async function loadArticles() {
  if (articlesCache) return articlesCache;
  const res = await fetch('articles/articles.json');
  if (!res.ok) throw new Error(`Failed to load articles.json: ${res.status}`);
  const map = await res.json();
  // Convert {slug.md: {meta}} into [{slug, ...meta}], sorted by date desc.
  articlesCache = Object.entries(map)
    .map(([filename, meta]) => ({
      filename,                     // "osi-model-whiteboard.md"
      slug: filename.replace(/\.md$/, ''),
      ...meta,
    }))
    .filter((a) => a.date && a.title)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return articlesCache;
}

function deriveSummary(article) {
  if (article.summary) return article.summary;
  // Fallback: empty for now. Task 6 (article render) provides the lede;
  // we don't fetch every article on the homepage just for summaries.
  return '';
}

function deriveSection(article) {
  if (article.section) return article.section;
  if (Array.isArray(article.tags) && article.tags.length) {
    const t = article.tags[0];
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return 'Writing';
}

function formatDateShort(iso) {
  // "2026-05-02" -> "May 2"
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function renderHome() {
  const all = await loadArticles();
  if (!all.length) {
    app().innerHTML = `<p class="meta">No articles yet.</p>`;
    return;
  }

  const lead = all[0];
  const cards = all.slice(1, 4);
  const more = all.slice(4);

  const leadHtml = `
    <article class="lead">
      <p class="meta">${escapeHtml(formatDateShort(lead.date))} · ${escapeHtml(deriveSection(lead))}</p>
      <h1 class="headline"><a href="#/article/${encodeURIComponent(lead.slug)}">${escapeHtml(lead.title)}</a></h1>
      ${lead.summary ? `<p class="lede">${escapeHtml(lead.summary)}</p>` : ''}
    </article>
  `;

  const cardsHtml = cards.length ? `
    <section class="cards-row">
      ${cards.map((a) => `
        <article class="card">
          <p class="meta">${escapeHtml(formatDateShort(a.date))} · ${escapeHtml(deriveSection(a))}</p>
          <h2 class="card-headline"><a href="#/article/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a></h2>
          ${a.summary ? `<p class="card-summary">${escapeHtml(a.summary)}</p>` : ''}
        </article>
      `).join('')}
    </section>
  ` : '';

  const moreHtml = more.length ? `
    <section class="more">
      <h2>More</h2>
      <ul>
        ${more.map((a) => `
          <li>
            <time datetime="${escapeHtml(a.date)}">${escapeHtml(a.date)}</time>
            <a href="#/article/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
          </li>
        `).join('')}
      </ul>
    </section>
  ` : '';

  app().innerHTML = leadHtml + cardsHtml + moreHtml;
  document.title = 'Timothy D Beach';
}
```

- [ ] **Step 3: Smoke test**

```bash
python3 -m http.server 8000 &
```

Open `http://localhost:8000/`. Verify:
- Lead article = newest article (today should be "The OSI Model, Explained from a Whiteboard").
- Three secondary cards below, then a dated list with the rest.
- Each title is a link that navigates to `#/article/<slug>`.
- Switch theme — both modes look readable.

Stop server: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add css/site.css js/app.js
git commit -m "Render homepage: lead + cards + dated list

- loadArticles() fetches articles.json, sorts by date desc, caches
- renderHome() splits into lead (newest), 3 cards, and dated list
- Section label derives from articles.json 'section' or first tag
- Date shown as 'May 2' for cards, ISO for the more-list time element
- Empty summary gracefully omitted (no empty <p> elements)"
```

---

## Task 6: Article reading view (markdown parser port)

**Files:**
- Modify: `js/article.js`
- Modify: `css/site.css` (append article-body styles)

**Goal:** Port the existing `parseMarkdown` function from old `index.html` (lines 2356+) verbatim into `js/article.js`. The TTS pipeline depends on its paragraph-boundary behavior matching `tools/render_article.py`'s `extract_paragraphs` — do not refactor opportunistically.

- [ ] **Step 1: Append article-body CSS to `css/site.css`**

```css
/* === Article reading view === */

.back-link {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-muted);
  border: none;
  display: inline-block;
  margin-bottom: 24px;
}
.back-link:hover { color: var(--fg); border: none; }

.article {
  max-width: var(--content-width);
}
.article-header { margin-bottom: 32px; }
.article-header .meta { margin-bottom: 8px; }
.article-header h1 {
  font-size: clamp(28px, 4vw, 32px);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.article-body { font-size: 16px; line-height: 1.65; }
.article-body p { margin: 0 0 1.1em; }
.article-body h2 {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  margin: 1.6em 0 0.5em;
}
.article-body h3 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  margin: 1.4em 0 0.5em;
}
.article-body h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 1.2em 0 0.4em;
}
.article-body ul, .article-body ol { padding-left: 1.4em; margin: 0 0 1.1em; }
.article-body li { margin-bottom: 0.4em; }

.article-body a { color: var(--fg); border-bottom: 1px solid var(--fg-muted); }
.article-body a:hover { border-bottom-color: var(--fg); }

.article-body img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.2em 0;
}

.article-body code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-elev);
  padding: 1px 4px;
  border-radius: 3px;
}
.article-body pre {
  font-family: var(--font-mono);
  background: var(--bg-elev);
  padding: 16px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.55;
  margin: 1.2em 0;
  border-radius: 4px;
}
.article-body pre code { background: none; padding: 0; font-size: inherit; }

.article-body blockquote {
  border-left: 3px solid var(--divider);
  padding-left: 16px;
  margin: 1.2em 0;
  color: var(--fg-muted);
  font-style: italic;
}

.article-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.2em 0;
  font-size: 14px;
}
.article-body th, .article-body td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider);
}
.article-body th {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-faint);
}
```

- [ ] **Step 2: Port `parseMarkdown` verbatim**

Open the original `index.html` from git history (or `/tmp/index-pre-redesign.html` if you saved it in Task 2 Step 1) and locate the `function parseMarkdown(content) {` block — it's at line 2356 in the pre-redesign file. Copy it **verbatim** into `js/article.js` as a non-exported helper. Do not refactor.

Replace the contents of `js/article.js`:

```js
// js/article.js — fetch + render an article, port of the in-browser parser
// from the pre-redesign index.html. Paragraph-boundary behavior must remain
// byte-equivalent with tools/render_article.py:extract_paragraphs — the TTS
// pipeline (timings.json sidecars) was generated against that exact split.
// DO NOT refactor parseMarkdown opportunistically; re-render audio first.

import { mountTtsBar } from './tts.js';

let articlesIndex = null;

async function loadIndex() {
  if (articlesIndex) return articlesIndex;
  const res = await fetch('articles/articles.json');
  if (!res.ok) throw new Error(`articles.json: ${res.status}`);
  articlesIndex = await res.json();
  return articlesIndex;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatLongDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function deriveSection(meta) {
  if (meta.section) return meta.section;
  if (Array.isArray(meta.tags) && meta.tags.length) {
    const t = meta.tags[0];
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return 'Writing';
}

// === parseMarkdown (PORT — DO NOT MODIFY without re-rendering all audio) ===
//
// Copied verbatim from the pre-redesign index.html. The TTS validator in
// tools/render_article.py asserts paragraph-by-paragraph parity against
// extract_paragraphs — any divergence in paragraph boundaries causes the
// deploy gate to fail.

function parseMarkdown(content) {
  // [paste the entire body of parseMarkdown from the old index.html here,
  //  starting at "let processedContent = content;" and continuing through
  //  the closing brace of the function. ~250 lines. Verbatim.]
}

export async function renderArticle(slug, mountEl) {
  const index = await loadIndex();
  const filename = `${slug}.md`;
  const meta = index[filename];

  if (!meta) {
    mountEl.innerHTML = `
      <p class="meta">404</p>
      <h1>Article not found</h1>
      <p><a class="back-link" href="#/">← back to writing</a></p>
    `;
    document.title = 'Not found · Timothy D Beach';
    return;
  }

  const cacheBust = `?t=${Date.now()}`;
  const res = await fetch(`articles/${filename}${cacheBust}`);
  if (!res.ok) {
    mountEl.innerHTML = `<p class="meta">Error</p><h1>Could not load article</h1>`;
    return;
  }
  const md = await res.text();

  // Strip the H1 (article title) — we render it from articles.json instead so
  // the meta line and title share styling with the homepage.
  const bodyMd = md.replace(/^#\s+.*$/m, '').trimStart();
  const bodyHtml = parseMarkdown(bodyMd);

  mountEl.innerHTML = `
    <a class="back-link" href="#/">← Writing</a>
    <article class="article">
      <header class="article-header">
        <p class="meta">${escapeHtml(formatLongDate(meta.date))} · ${escapeHtml(deriveSection(meta))}</p>
        <h1>${escapeHtml(meta.title)}</h1>
      </header>
      <div class="article-body">${bodyHtml}</div>
    </article>
  `;

  document.title = `${meta.title} · Timothy D Beach`;
  // Update meta description for SEO/social previews on this page
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && meta.summary) metaDesc.setAttribute('content', meta.summary);

  if (meta.audio && meta.timings) {
    mountTtsBar({ ...meta, slug });
  }
}
```

- [ ] **Step 3: Smoke test article rendering**

```bash
python3 -m http.server 8000 &
```

Open `http://localhost:8000/#/article/osi-model-whiteboard`. Verify:
- Back-link reads "← Writing"
- Date + section in the meta line, then headline.
- Body renders headings (`##` → h2, `###` → h3), paragraphs, code blocks (monospace, tinted background), inline code (subtle tint), bold/italic.
- TTS bar **does not** appear yet — it's still a stub. That's correct for now.
- Browser console: no errors.

Open another article: `http://localhost:8000/#/article/aegix-on-the-aur`. Same checks. Try one with a table (e.g., `osi-model-whiteboard` has a layer-summary table near the bottom) — verify the table renders with header row + bottom-bordered rows.

Stop the server: `kill %1`.

- [ ] **Step 4: Validate TTS parity is preserved**

```bash
tools/venv/bin/python tools/render_article.py --validate
```
Expected: `✓ all articles valid` (or whatever the existing success message is). The parser hasn't moved files, but this runs the full validator against every article.

- [ ] **Step 5: Commit**

```bash
git add css/site.css js/article.js
git commit -m "Render article reading view; port markdown parser verbatim

- js/article.js: fetch + render flow, port of parseMarkdown from
  the pre-redesign index.html (DO NOT refactor — TTS validator
  depends on paragraph-boundary parity)
- css/site.css: article body typography, code blocks, tables,
  blockquotes
- TTS bar stub still mounts nothing; wired up in Task 7

Validates clean against tools/render_article.py --validate."
```

---

## Task 7: TTS bar restyle to neutral palette

**Files:**
- Modify: `js/tts.js`
- Modify: `css/site.css` (append TTS styles)

**Goal:** Extract the TTS bar logic + markup from the old `index.html` into `js/tts.js`. Restyle the CSS to use the neutral-palette tokens instead of `var(--accent)` / `var(--background)` / etc. Behavior (paragraph highlight, audio sync, voice select, speed slider) must not regress.

- [ ] **Step 1: Append TTS bar CSS to `css/site.css`**

```css
/* === TTS read-aloud bar === */

.tts-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9000;
  background: var(--bg);
  border-top: 1px solid var(--divider);
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: var(--font-sans);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}
[data-theme="dark"] .tts-bar { box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.4); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .tts-bar { box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.4); }
}
.tts-bar.visible { transform: translateY(0); }

.tts-bar-inner {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.tts-progress-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--divider);
}
.tts-progress-fill {
  height: 100%;
  background: var(--fg-muted);
  width: 0%;
  transition: width 0.3s ease;
}

.tts-transport { display: flex; gap: 6px; flex-shrink: 0; }
.tts-btn {
  background: transparent;
  border: 1px solid var(--divider);
  color: var(--fg);
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.tts-btn:hover { border-color: var(--fg); }
.tts-btn.active { background: var(--fg); color: var(--bg); }
.tts-btn svg { width: 14px; height: 14px; }

.tts-status { flex: 1; min-width: 0; font-size: 12px; }
.tts-status-label {
  color: var(--fg-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
  margin-right: 6px;
}
.tts-status-text {
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 60%;
  vertical-align: bottom;
}

.tts-speed { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.tts-speed-label { color: var(--fg-faint); }
.tts-speed-slider { width: 80px; accent-color: var(--fg); }

.tts-voice-select {
  font-family: var(--font-sans);
  font-size: 11px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--divider);
  padding: 4px 6px;
  border-radius: 4px;
}
.tts-voice-select:focus { outline: 1px solid var(--fg); }

.tts-close {
  background: transparent;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
}
.tts-close:hover { color: var(--fg); }

.article-body.tts-active > * { opacity: 0.45; transition: opacity 0.3s; }
.article-body.tts-active > .tts-reading { opacity: 1; }

body.tts-open .page { padding-bottom: 88px; }
```

- [ ] **Step 2: Port the TTS bar JS from the old `index.html`**

The pre-redesign `index.html` contains the TTS bar HTML markup, audio element wiring, paragraph-highlight logic, voice-select and speed-slider handlers. They are spread across the old `<script>` block (lines ~1700-2700) under names like `mountTtsBar`, `playTts`, `pauseTts`, `setupTimingsHighlight`, etc.

Move this code **as a single self-contained module** into `js/tts.js`:

```js
// js/tts.js — read-aloud bar, ported from pre-redesign index.html.
// Behavior must not regress: paragraph highlighting via timings sidecar,
// transport controls, voice select, speed slider, close-to-stop.
//
// API:
//   mountTtsBar(article) — article = { slug, title, audio, timings, voice, duration }
//                          Mounts the bar into <body> if not already present,
//                          wires it to the article body, autoplays on click.

const VOICES = [
  // British male
  { id: 'bm_daniel',  label: 'Daniel (UK)' },
  { id: 'bm_fable',   label: 'Fable (UK)' },
  { id: 'bm_george',  label: 'George (UK)' },
  { id: 'bm_lewis',   label: 'Lewis (UK)' },
  // British female
  { id: 'bf_alice',   label: 'Alice (UK)' },
  { id: 'bf_emma',    label: 'Emma (UK)' },
  { id: 'bf_isabella',label: 'Isabella (UK)' },
  { id: 'bf_lily',    label: 'Lily (UK)' },
  // American female
  { id: 'af_alloy',   label: 'Alloy (US)' },
  { id: 'af_aoede',   label: 'Aoede (US)' },
  { id: 'af_bella',   label: 'Bella (US)' },
  { id: 'af_heart',   label: 'Heart (US)' },
  { id: 'af_jessica', label: 'Jessica (US)' },
  { id: 'af_kore',    label: 'Kore (US)' },
  { id: 'af_nicole',  label: 'Nicole (US)' },
  { id: 'af_nova',    label: 'Nova (US)' },
  { id: 'af_river',   label: 'River (US)' },
  { id: 'af_sarah',   label: 'Sarah (US)' },
  { id: 'af_sky',     label: 'Sky (US)' },
];

let bar = null;
let audio = null;
let timings = null;
let currentArticle = null;
let lastParagraphIdx = -1;

function buildBar() {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.className = 'tts-bar';
  bar.innerHTML = `
    <div class="tts-progress-track"><div class="tts-progress-fill"></div></div>
    <div class="tts-bar-inner">
      <div class="tts-transport">
        <button class="tts-btn" data-act="rewind"  title="Rewind to start" aria-label="Rewind to start">⏮</button>
        <button class="tts-btn" data-act="play"    title="Play / pause"     aria-label="Play / pause">▶</button>
      </div>
      <div class="tts-status">
        <span class="tts-status-label">Reading</span>
        <span class="tts-status-text">—</span>
        <span class="tts-status-label" style="margin-left:12px">Time</span>
        <span class="tts-status-time">0:00 / 0:00</span>
      </div>
      <div class="tts-speed">
        <span class="tts-speed-label">Speed</span>
        <input class="tts-speed-slider" type="range" min="0.6" max="1.6" step="0.05" value="1.0" />
        <span class="tts-speed-value">1.00×</span>
      </div>
      <select class="tts-voice-select" aria-label="Voice">
        ${VOICES.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}
      </select>
      <button class="tts-close" type="button" aria-label="Close">×</button>
    </div>
  `;
  document.body.appendChild(bar);

  audio = document.createElement('audio');
  audio.preload = 'auto';
  document.body.appendChild(audio);

  wireBar();
  return bar;
}

function wireBar() {
  bar.querySelector('[data-act="play"]').addEventListener('click', togglePlay);
  bar.querySelector('[data-act="rewind"]').addEventListener('click', () => {
    if (audio) audio.currentTime = 0;
  });
  bar.querySelector('.tts-close').addEventListener('click', closeBar);
  bar.querySelector('.tts-speed-slider').addEventListener('input', (e) => {
    if (audio) audio.playbackRate = parseFloat(e.target.value);
    bar.querySelector('.tts-speed-value').textContent = `${parseFloat(e.target.value).toFixed(2)}×`;
  });
  bar.querySelector('.tts-voice-select').addEventListener('change', (e) => {
    // Switching voices means switching to the corresponding audio file. We
    // map by replacing the voice token in the audio path. Convention from the
    // TTS pipeline: audio/<slug>.<voice>.ogg if voice != default; otherwise
    // audio/<slug>.ogg. (Older articles only have the default voice rendered.)
    if (!currentArticle) return;
    // For now, voice-select acts as a UI placeholder when no alternate
    // voice is rendered; switching only works when the .ogg exists. We
    // simply update the audio src and let the browser report failure.
    const newVoice = e.target.value;
    const newSrc = currentArticle.audio.replace(/\.ogg$/, `.${newVoice}.ogg`);
    audio.src = newSrc;
    audio.load();
  });

  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', () => {
    setPlayIcon(false);
    clearHighlight();
  });
  audio.addEventListener('loadedmetadata', () => {
    updateTimeLabel();
  });
}

function setPlayIcon(playing) {
  bar.querySelector('[data-act="play"]').textContent = playing ? '❚❚' : '▶';
}

function togglePlay() {
  if (!audio) return;
  if (audio.paused) { audio.play(); setPlayIcon(true); }
  else { audio.pause(); setPlayIcon(false); }
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function updateTimeLabel() {
  const el = bar.querySelector('.tts-status-time');
  if (el) el.textContent = `${fmtTime(audio.currentTime || 0)} / ${fmtTime(audio.duration || 0)}`;
}

function clearHighlight() {
  document.querySelectorAll('.article-body .tts-reading').forEach((p) => p.classList.remove('tts-reading'));
  document.querySelector('.article-body')?.classList.remove('tts-active');
}

function onTimeUpdate() {
  updateTimeLabel();
  // Progress bar
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  bar.querySelector('.tts-progress-fill').style.width = `${pct}%`;

  // Paragraph highlight: timings is an array of paragraph entries with start/end seconds.
  if (!timings || !timings.length) return;
  const t = audio.currentTime;
  let idx = -1;
  for (let i = 0; i < timings.length; i++) {
    const p = timings[i];
    if (t >= p.start && t < p.end) { idx = i; break; }
  }
  if (idx === lastParagraphIdx) return;
  lastParagraphIdx = idx;

  const body = document.querySelector('.article-body');
  if (!body) return;
  body.classList.add('tts-active');
  body.querySelectorAll('.tts-reading').forEach((p) => p.classList.remove('tts-reading'));

  if (idx >= 0) {
    // Identify paragraph elements eligible for TTS (matches what
    // tools/render_article.py extracts: p, h2, h3, h4, li, td).
    const eligible = body.querySelectorAll('p, h2, h3, h4, li, td');
    const target = eligible[idx];
    if (target) {
      target.classList.add('tts-reading');
      const status = bar.querySelector('.tts-status-text');
      if (status) status.textContent = (target.textContent || '').slice(0, 80);
    }
  }
}

async function loadTimings(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`timings: ${res.status}`);
  return await res.json();
}

function closeBar() {
  if (audio) { audio.pause(); audio.currentTime = 0; }
  setPlayIcon(false);
  clearHighlight();
  bar.classList.remove('visible');
  document.body.classList.remove('tts-open');
  lastParagraphIdx = -1;
}

export async function mountTtsBar(article) {
  buildBar();
  currentArticle = article;
  lastParagraphIdx = -1;

  // Voice select reflects the rendered voice
  const sel = bar.querySelector('.tts-voice-select');
  if (article.voice) sel.value = article.voice;

  audio.src = article.audio;
  audio.load();
  audio.playbackRate = parseFloat(bar.querySelector('.tts-speed-slider').value);

  try {
    timings = await loadTimings(article.timings);
  } catch (e) {
    console.warn('[tts] failed to load timings; bar will play audio without highlight', e);
    timings = [];
  }

  bar.classList.add('visible');
  document.body.classList.add('tts-open');

  // Auto-play on user-gesture-initiated mount (link click counts as gesture).
  audio.play().then(() => setPlayIcon(true)).catch(() => setPlayIcon(false));
}
```

> **Note for the implementer:** The voice-switch behavior in `tts-voice-select.change` above is a simplification — the original may have had different audio-path conventions. If the pre-redesign code had a different lookup, copy that behavior verbatim. The point of this task is preservation, not enhancement.

- [ ] **Step 3: Smoke test TTS playback**

```bash
python3 -m http.server 8000 &
```

Open `http://localhost:8000/#/article/osi-model-whiteboard`. Verify:
1. TTS bar slides up from the bottom on article load.
2. Auto-plays the article. Time counter ticks. Progress fill grows left-to-right.
3. Current paragraph is highlighted (other paragraphs dimmed). Highlight moves with audio.
4. Click ▶/❚❚ — pauses/resumes.
5. Click ⏮ — jumps to start, audio restarts.
6. Speed slider adjusts playback rate (visible label updates).
7. Click × — bar closes, audio stops, highlight clears.
8. Theme toggle works while bar is open (bar respects neutral palette in both modes).

Stop server: `kill %1`.

- [ ] **Step 4: Validate TTS audio parity is still intact**

```bash
tools/venv/bin/python tools/render_article.py --validate
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add css/site.css js/tts.js
git commit -m "Restyle TTS bar to neutral palette; extract to js/tts.js

- Bar markup, transport, paragraph highlight, voice/speed controls all
  moved out of the monolithic index.html
- CSS uses --bg / --divider / --fg-muted / --fg tokens; works in both
  light and dark
- Behavior preserved: timings-driven highlight, autoplay on mount,
  click-to-close stops audio
- Voice-select switches audio src by convention <slug>.<voice>.ogg
  (no-op for articles with only the default voice rendered)"
```

---

## Task 8: Music page (TWO_ROOMS teaser)

**Files:**
- Modify: `js/app.js` (replace `renderMusic`)
- Modify: `css/site.css` (append music page styles)

**Goal:** Render the TWO_ROOMS coming-soon page. Centered. Cover-art placeholder. Disabled-link placeholder for gutlens.net until it goes live.

- [ ] **Step 1: Append music page CSS to `css/site.css`**

```css
/* === Music page === */

.music-page {
  max-width: 480px;
  margin: 48px auto 0;
  text-align: center;
}
.music-cover {
  width: 280px;
  height: 280px;
  margin: 0 auto 32px;
  background: linear-gradient(135deg, var(--divider) 0%, var(--bg-elev) 100%);
  border: 1px solid var(--divider);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-faint);
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.music-title {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.4px;
  margin: 0 0 6px;
}
.music-artist {
  font-family: var(--font-sans);
  font-size: 14px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin: 0 0 14px;
}
.music-status {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-faint);
  margin: 0 0 32px;
}
.music-link[data-link-live="false"] {
  color: var(--fg-faint);
  border: none;
  pointer-events: none;
  font-family: var(--font-sans);
  font-size: 13px;
}
.music-link[data-link-live="false"]::after {
  content: " (soon)";
  font-style: italic;
}
.music-link[data-link-live="true"] {
  color: var(--fg);
  border-bottom: 1px solid var(--fg-muted);
  font-family: var(--font-sans);
  font-size: 13px;
}
```

- [ ] **Step 2: Replace `renderMusic` in `js/app.js`**

Replace the placeholder `renderMusic` function:

```js
function renderMusic() {
  // Flip data-link-live to "true" once gutlens.net is live.
  app().innerHTML = `
    <section class="music-page">
      <div class="music-cover">[cover art coming]</div>
      <h1 class="music-title">TWO_ROOMS</h1>
      <p class="music-artist">Gut Lens</p>
      <p class="music-status">Coming Soon · May 2026</p>
      <a class="music-link"
         href="https://gutlens.net"
         data-link-live="false"
         target="_blank"
         rel="noopener">gutlens.net</a>
    </section>
  `;
  document.title = 'Music · Timothy D Beach';
}
```

- [ ] **Step 3: Smoke test**

```bash
python3 -m http.server 8000 &
```

Open `http://localhost:8000/#/music`. Verify:
- Centered layout with cover-art square, title, artist, status, link.
- "gutlens.net (soon)" is italic-suffixed and not clickable.
- Both light and dark modes render legibly.

Stop server: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add css/site.css js/app.js
git commit -m "Render music page: TWO_ROOMS coming-soon teaser

- Centered cover-art placeholder + title + artist + status + link
- gutlens.net rendered as disabled '(soon)' until data-link-live='true'
- Flip the attribute to make it a live clickable link"
```

---

## Task 9: Starfield extraction + About page

**Files:**
- Modify: `js/starfield.js`
- Modify: `js/app.js` (replace `renderAbout`)
- Modify: `css/site.css` (append about page + starfield styles)

**Goal:** Move the starfield + sky-info logic out of the old `index.html` into `js/starfield.js`. Mount it only when the `/about` route is active. Tear down on route change.

- [ ] **Step 1: Append starfield + about CSS to `css/site.css`**

```css
/* === Starfield (only on /about) === */

.starfield {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}
.star {
  position: absolute;
  border-radius: 50%;
  background: var(--fg-faint);
  opacity: 0.6;
  animation: twinkle 4s infinite ease-in-out;
}
.star.bright { opacity: 0.9; }

@keyframes twinkle {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50%      { opacity: 0.9; transform: scale(1.1); }
}

.sky-info {
  position: fixed;
  bottom: 16px;
  left: 16px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-faint);
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  border: 1px solid var(--divider);
  padding: 6px 10px;
  border-radius: 4px;
  pointer-events: none;
  line-height: 1.6;
  z-index: 1;
}

/* === About page === */

.about-page {
  max-width: var(--content-width);
}
.about-page h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 16px;
}
.about-page p {
  font-size: 17px;
  line-height: 1.6;
  margin: 0 0 1em;
}
.about-page .links {
  margin-top: 24px;
  font-family: var(--font-sans);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.about-page .links a { color: var(--fg-muted); border: none; margin-right: 16px; }
.about-page .links a:hover { color: var(--fg); }
```

- [ ] **Step 2: Implement `js/starfield.js`**

Port the GMST + alt/az computation + star rendering + sky-info update from the pre-redesign `index.html` (lines ~3200-3790). Wrap in an init/destroy pair so navigation away from `/about` cleans up.

```js
// js/starfield.js — astronomically-accurate fisheye-projected starfield + sky-info
// widget. Ported from the pre-redesign index.html. Only active on /about.

let interval = null;
let rootEl = null;
let infoEl = null;
let resizeListener = null;
let observerLat = 47.6;   // Seattle as default; updated by geolocation if granted
let observerLon = -122.3;

function getGMST(date) {
  // Days since J2000.0
  const jd = date.getTime() / 86400000 + 2440587.5;
  const D = jd - 2451545.0;
  const T = D / 36525.0;
  let gmst = 280.46061837 + 360.98564736629 * D + T * T * (0.000387933 - T / 38710000);
  gmst = ((gmst % 360) + 360) % 360;
  return gmst; // degrees
}

function lstHours(date, lonDeg) {
  const lstDeg = (getGMST(date) + lonDeg + 360) % 360;
  return lstDeg / 15; // hours
}

function eqToAltAz(raDeg, decDeg, latDeg, lstDeg) {
  const ha = ((lstDeg - raDeg + 540) % 360) - 180; // hour angle deg, [-180,180]
  const haRad = ha * Math.PI / 180;
  const decRad = decDeg * Math.PI / 180;
  const latRad = latDeg * Math.PI / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad)
               + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad))
              / (Math.cos(alt) * Math.cos(latRad) || 1e-9);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(haRad) > 0) az = 2 * Math.PI - az;
  return { alt: alt * 180 / Math.PI, az: az * 180 / Math.PI };
}

function projectFisheye(altDeg, azDeg) {
  // Azimuthal equidistant: r = 1 - alt/90, theta = az
  if (altDeg < 0) return null;
  const r = 1 - altDeg / 90;
  const theta = (azDeg - 90) * Math.PI / 180; // North = up
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

function magnitudeToSize(mag) {
  // Brighter (lower mag) = larger pixel.
  if (mag < 1) return 3;
  if (mag < 2) return 2.5;
  if (mag < 3) return 2;
  if (mag < 4) return 1.5;
  return 1;
}

async function loadStars() {
  try {
    const res = await fetch('stars.json');
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function generateProcedural(count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      ra:  Math.random() * 360,
      dec: (Math.random() * 180) - 90,
      mag: 4 + Math.random() * 2,
      name: '',
    });
  }
  return stars;
}

function render(stars) {
  if (!rootEl) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 2 - 20;

  const now = new Date();
  const lstDeg = lstHours(now, observerLon) * 15;

  rootEl.innerHTML = '';
  let visible = 0;

  for (const s of stars) {
    const { alt, az } = eqToAltAz(s.ra, s.dec, observerLat, lstDeg);
    const proj = projectFisheye(alt, az);
    if (!proj) continue;
    visible++;
    const px = cx + proj.x * radius;
    const py = cy + proj.y * radius;
    const size = magnitudeToSize(s.mag);
    const el = document.createElement('div');
    el.className = 'star' + (s.mag < 2 ? ' bright' : '');
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.animationDelay = `${(s.ra * 0.011) % 4}s`;
    if (s.name) el.title = s.name;
    rootEl.appendChild(el);
  }

  if (infoEl) {
    const lstH = lstHours(now, observerLon);
    const hh = Math.floor(lstH);
    const mm = Math.floor((lstH - hh) * 60);
    const ss = Math.floor((((lstH - hh) * 60) - mm) * 60);
    infoEl.innerHTML = `
      LST ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}<br>
      ${observerLat.toFixed(1)}°N ${Math.abs(observerLon).toFixed(1)}°W<br>
      ${visible} stars visible
    `;
  }
}

export async function initStarfield(rootContainer) {
  rootEl = document.createElement('div');
  rootEl.className = 'starfield';
  document.body.appendChild(rootEl);

  infoEl = document.createElement('div');
  infoEl.className = 'sky-info';
  document.body.appendChild(infoEl);

  // Try geolocation; ignore failures and stick with default.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        observerLat = pos.coords.latitude;
        observerLon = pos.coords.longitude;
        render(allStars);
      },
      () => { /* keep defaults */ },
      { timeout: 5000, maximumAge: 60_000 },
    );
  }

  const cataloged = await loadStars();
  const procedural = generateProcedural(400);
  const allStars = cataloged.concat(procedural);

  render(allStars);
  interval = setInterval(() => render(allStars), 1000);
  resizeListener = () => render(allStars);
  window.addEventListener('resize', resizeListener);
}

export function destroyStarfield() {
  if (interval) { clearInterval(interval); interval = null; }
  if (resizeListener) { window.removeEventListener('resize', resizeListener); resizeListener = null; }
  if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
  if (infoEl && infoEl.parentNode) infoEl.parentNode.removeChild(infoEl);
  rootEl = null;
  infoEl = null;
}
```

- [ ] **Step 3: Replace `renderAbout` in `js/app.js` and tear-down on route change**

In `js/app.js`, replace the placeholder `renderAbout`:

```js
import { initStarfield, destroyStarfield } from './starfield.js';

let starfieldActive = false;

function ensureStarfieldOff() {
  if (starfieldActive) {
    destroyStarfield();
    starfieldActive = false;
  }
}

function renderHome()   { ensureStarfieldOff(); /* …existing renderHome body */ }
function renderMusic()  { ensureStarfieldOff(); /* …existing renderMusic body */ }
function renderNotFound() { ensureStarfieldOff(); /* …existing renderNotFound body */ }

function renderAbout() {
  if (!starfieldActive) {
    initStarfield();
    starfieldActive = true;
  }

  app().innerHTML = `
    <section class="about-page">
      <h1>About</h1>
      <p>I'm Timothy. I write software, record music as Gut Lens, and run Aegix Linux. This site is where I write things down so I don't have to remember them twice.</p>
      <p class="links">
        <a href="mailto:beachtimothyd@gmail.com">Email</a>
        <a href="https://github.com/timbeach" target="_blank" rel="noopener">GitHub</a>
      </p>
    </section>
  `;
  document.title = 'About · Timothy D Beach';
}
```

Also wire `renderArticle` to call `ensureStarfieldOff()` before mounting — easiest path: wrap the article handler in `bootstrap()`:

```js
  registerRoute('article', ({ slug }) => {
    ensureStarfieldOff();
    return renderArticle(slug, app());
  });
```

- [ ] **Step 4: Smoke test**

```bash
python3 -m http.server 8000 &
```

Verify:
1. `http://localhost:8000/#/about` — starfield appears as the page background. Sky-info widget bottom-left shows LST + lat/lon + visible-star count, updating per second. Bio text + email/GitHub links render.
2. Browser may prompt for geolocation. Allow or deny — both should work (deny falls back to Seattle default).
3. Navigate to `#/` (home) — starfield disappears; widget gone. No console errors.
4. Navigate back to `#/about` — starfield reappears.
5. Resize window — starfield re-renders to new dimensions (no stale stars).
6. Toggle dark mode while on `/about` — stars remain visible against the new background; sky-info bg blurs the new bg correctly.
7. `http://localhost:8000/#/article/osi-model-whiteboard` — no starfield (article route).

Stop server: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add css/site.css js/starfield.js js/app.js
git commit -m "About page with starfield (only on /about)

- js/starfield.js: full GMST + alt/az + fisheye projection port,
  with init/destroy pair for route-aware mount
- About page: bio paragraph + email/GitHub links
- Other routes call ensureStarfieldOff() so starfield never bleeds
  into homepage/article/music
- Geolocation permission optional; falls back to Seattle"
```

---

## Task 10: RSS feed generator (TDD)

**Files:**
- Create: `tools/build_feed.py`
- Create: `tools/test_build_feed.py`
- Modify: `deploy.sh`
- Modify: `.gitignore` (add `feed.xml` if treating as build artifact, OR commit it — pick one in Step 5)

**Goal:** Build-time RSS 2.0 generator with `<content:encoded>` full-content per item. Pytest-driven. Wired into `deploy.sh`.

- [ ] **Step 1: Write failing test for RSS structure (TDD)**

Create `tools/test_build_feed.py`:

```python
"""Tests for tools/build_feed.py — the RSS 2.0 generator."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from build_feed import build_feed, render_article_html


def _articles_fixture(tmp_path: Path) -> Path:
    """Set up a minimal articles/ directory with two articles."""
    articles = tmp_path / "articles"
    articles.mkdir()

    (articles / "first-article.md").write_text(
        "# First Article\n\n"
        "Body paragraph one.\n\n"
        "## A subsection\n\n"
        "Body paragraph two with **bold**.\n"
    )
    (articles / "second-article.md").write_text(
        "# Second Article\n\nA single paragraph.\n"
    )
    (articles / "articles.json").write_text(json.dumps({
        "first-article.md": {
            "title": "First Article",
            "date": "2026-05-02",
            "tags": ["test", "first"],
            "summary": "The first one.",
        },
        "second-article.md": {
            "title": "Second Article",
            "date": "2026-04-01",
            "tags": ["test"],
            "summary": "The second one.",
        },
    }))
    return tmp_path


def test_build_feed_produces_valid_xml(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    tree = ET.parse(out)
    root = tree.getroot()
    assert root.tag == "rss"
    assert root.attrib.get("version") == "2.0"


def test_feed_has_channel_metadata(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    root = ET.parse(out).getroot()
    channel = root.find("channel")
    assert channel is not None
    assert channel.findtext("title") == "Timothy D Beach"
    assert channel.findtext("link") == "https://timbeach.com"
    assert channel.findtext("description")  # any non-empty value
    assert channel.findtext("lastBuildDate")  # RFC 822 date


def test_feed_items_sorted_newest_first(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    items = ET.parse(out).getroot().find("channel").findall("item")
    titles = [it.findtext("title") for it in items]
    assert titles == ["First Article", "Second Article"]


def test_feed_item_has_link_pubdate_guid(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    item = ET.parse(out).getroot().find("channel/item")
    assert item.findtext("link") == "https://timbeach.com/#/article/first-article"
    assert item.findtext("pubDate")  # RFC 822
    assert item.findtext("guid") == "https://timbeach.com/#/article/first-article"
    assert item.findtext("description") == "The first one."


def test_feed_item_has_content_encoded(tmp_path):
    project = _articles_fixture(tmp_path)
    out = project / "feed.xml"
    build_feed(project_root=project, out_path=out, site_url="https://timbeach.com")

    # Use the namespace map to find content:encoded
    NS = {"content": "http://purl.org/rss/1.0/modules/content/"}
    item = ET.parse(out).getroot().find("channel/item")
    encoded = item.find("content:encoded", NS)
    assert encoded is not None
    assert "<p>" in encoded.text  # rendered HTML
    assert "<strong>bold</strong>" in encoded.text


def test_render_article_html_strips_h1(tmp_path):
    project = _articles_fixture(tmp_path)
    html = render_article_html(project / "articles" / "first-article.md")
    assert "<h1>" not in html      # H1 stripped (it's the article title, in <title>)
    assert "<h2>A subsection</h2>" in html
    assert "<p>Body paragraph one.</p>" in html
```

- [ ] **Step 2: Run failing tests to confirm they fail**

```bash
cd tools
../tools/venv/bin/pytest test_build_feed.py -v
```
Expected: ImportError or ModuleNotFoundError on `build_feed` — there's no module yet.

- [ ] **Step 3: Implement `tools/build_feed.py`**

```python
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
```

- [ ] **Step 4: Run tests until they pass**

```bash
tools/venv/bin/pytest tools/test_build_feed.py -v
```
Expected: all tests pass. If `markdown_it` raises errors on the H1-stripping behavior, debug `render_article_html` (most likely culprit: leading whitespace).

- [ ] **Step 5: Decide whether to commit `feed.xml`**

The deploy gate will regenerate `feed.xml` every deploy, but pinning it in git also lets readers fetch it from a clone of the repo if the site is down. Lower-risk path: commit it (and accept noisy diffs). Add nothing to `.gitignore`.

- [ ] **Step 6: Generate the feed against real articles**

```bash
tools/venv/bin/python tools/build_feed.py
```
Expected: `✓ wrote feed.xml`.

Verify it parses cleanly and includes every article:
```bash
python3 -c "import xml.etree.ElementTree as ET; r=ET.parse('feed.xml').getroot(); print(len(r.findall('channel/item')), 'items')"
```
Expected: count matches `articles/articles.json` (currently 20+).

- [ ] **Step 7: Wire into `deploy.sh`**

Replace `deploy.sh` with:
```sh
#!/bin/sh
set -e

if [ -x tools/venv/bin/python ]; then
  echo "→ validating audio/timings parity"
  tools/venv/bin/python tools/render_article.py --validate
  echo "→ generating feed.xml"
  tools/venv/bin/python tools/build_feed.py
else
  echo "! tools/venv missing; skipping audio validation and feed generation"
fi

rsync -vhrla --exclude .claude/ --exclude .well-known/ --exclude irc.txt.gpg --exclude .git/ --exclude archive/ --exclude tools/ --exclude audition/ --exclude .superpowers/ $PWD/ vultr:/var/www/timbeach.com
```

(Note: `.superpowers/` added to rsync excludes too, so we never deploy brainstorm artifacts.)

- [ ] **Step 8: Commit**

```bash
git add tools/build_feed.py tools/test_build_feed.py feed.xml deploy.sh
git commit -m "Add RSS feed generator and wire into deploy.sh

- tools/build_feed.py: RSS 2.0 + content:encoded full-content
- tools/test_build_feed.py: pytest tests covering structure + sorting
- deploy.sh: runs build_feed.py after the TTS validate step
- deploy.sh: excludes .superpowers/ from rsync
- feed.xml: pinned (regenerated each deploy)"
```

---

## Task 11: Mobile breakpoints

**Files:**
- Modify: `css/site.css` (append media queries)

**Goal:** Below 760px, collapse the 3-column secondary cards to a single stack, the 96px-date dated-list to a single column, and the masthead nav to a smaller layout.

- [ ] **Step 1: Append responsive rules to `css/site.css`**

```css
/* === Responsive === */

@media (max-width: 760px) {
  .page { padding: 24px 16px 48px; }

  .masthead {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .nav { font-size: 10px; }
  .nav a { margin-left: 0; margin-right: 12px; }
  .nav a:last-of-type { margin-right: 0; }

  .lead .headline { font-size: 26px; }

  .cards-row {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .more li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .more li time { font-size: 10px; }

  .article-header h1 { font-size: 26px; }

  .tts-bar-inner {
    flex-wrap: wrap;
    padding: 10px 16px;
    gap: 8px;
  }
  .tts-status { order: 99; flex-basis: 100%; }
  .tts-speed { display: none; } /* drop slider on mobile to save space */

  .music-cover { width: 220px; height: 220px; }
  .music-title { font-size: 26px; }
}
```

- [ ] **Step 2: Smoke test mobile**

```bash
python3 -m http.server 8000 &
```

Open `http://localhost:8000/` and use DevTools' device-toolbar (Cmd-Shift-M / Ctrl-Shift-M) to switch to a 375×667 (iPhone SE) viewport. Verify:
- Masthead stacks (brand on top, nav below).
- Cards row becomes a single column, three articles stacked.
- Dated list becomes single-column too (date above title).
- Article body paragraph reads comfortably (no horizontal scroll).
- TTS bar is readable; speed slider is hidden.
- Music page cover scales smaller.

Stop server: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add css/site.css
git commit -m "Add mobile breakpoints (≤760px)

- Masthead stacks vertically, nav size reduces
- Cards row → single column
- Dated list → single column with date above title
- TTS bar speed slider hidden; bar wraps if needed
- Music cover scales down to 220px"
```

---

## Task 12: Cleanup, asset removal, smoke test, CLAUDE.md update

**Files:**
- Delete: `mr-robot-mask_pixel-ROUGH_block48_5c.png`, `sparkle_heart_actually_transparent.png`, `icons8-orthodox-cross-50.png`, `taiko.mp3` (if confirmed unused)
- Modify: `CLAUDE.md`

**Goal:** Drop unused assets, update the project's CLAUDE.md to describe the new architecture, do a final cross-route smoke test in both modes.

- [ ] **Step 1: Confirm taiko.mp3 is unused, then delete**

```bash
grep -rn "taiko" --include="*.html" --include="*.js" --include="*.css" .
```
If no hits (it was a relic of the terminal interface), remove:

```bash
git rm taiko.mp3 mr-robot-mask_pixel-ROUGH_block48_5c.png sparkle_heart_actually_transparent.png icons8-orthodox-cross-50.png
```

If `taiko.mp3` does turn up somewhere — leave it. The other three icons are confirmed unused by inspection.

- [ ] **Step 2: Update `CLAUDE.md`**

Open `CLAUDE.md` and replace the **Architecture > Core Components** subsection with:

```markdown
### Core Components

- **index.html** — thin HTML shell: head + theme inline-script + masthead + `<main id="app">` + footer + `<script type="module">`.
- **css/site.css** — all CSS: tokens, base, layout, components, responsive breakpoints. Day/night via `[data-theme="dark"]` and `prefers-color-scheme`.
- **js/app.js** — site bootstrap, homepage rendering, route registration.
- **js/router.js** — hash router (`#/`, `#/article/<slug>`, `#/music`, `#/about`) with legacy `#articles/<slug>.md` redirect.
- **js/article.js** — article fetch + markdown render. Hosts the ported `parseMarkdown` (paragraph-boundary parity with `tools/render_article.py:extract_paragraphs` is required by the TTS validate gate — DO NOT refactor without re-rendering all audio).
- **js/tts.js** — read-aloud bar (transport, voice select, paragraph highlight via timings sidecar).
- **js/theme.js** — theme toggle, localStorage persistence, OS auto-detect fallback.
- **js/starfield.js** — astronomical starfield + sky-info widget. Mounted only on the `/about` route via init/destroy pair.
- **articles/** — markdown articles + `articles.json` registry.
- **audio/** — pre-rendered Opus + timings sidecars (TTS).
- **tools/render_article.py** — TTS pre-render + validate.
- **tools/build_feed.py** — RSS 2.0 generator (run by `deploy.sh`).
- **feed.xml** — generated RSS feed (regenerated each deploy).
- **deploy.sh** — validate TTS → build feed → rsync.
```

Replace the **Article System** subsection's metadata example with the extended schema (the `summary`, `section`, and `hero` optional fields). Add a sentence about the `summary` field powering both the homepage cards and the RSS `<description>`.

Replace the **Terminal Interface** subsection with a single line: `Removed in the 2026-05 redesign. Saved as a future Easter-egg follow-up (beads issue timbeach-d75).`

- [ ] **Step 3: Final cross-route smoke test**

```bash
python3 -m http.server 8000 &
```

For each combination of `{light, dark} × {/, /#/article/osi-model-whiteboard, /#/music, /#/about}`:

1. Load the URL.
2. Verify expected content renders (no console errors, no missing fonts, no broken layout).
3. Toggle theme. Verify both modes are legible.

Then test:
- Old hash form: `#articles/osi-model-whiteboard.md` redirects to `#/article/osi-model-whiteboard` (URL bar updates).
- 404: `#/asdf` shows 404 page.
- TTS bar opens on article load and plays correctly.
- RSS feed: `http://localhost:8000/feed.xml` parses (open in browser → see XML).
- View-source on homepage shows `<link rel="alternate" type="application/rss+xml" ...>` autodiscovery.

Stop server: `kill %1`.

- [ ] **Step 4: Run TTS validator one last time**

```bash
tools/venv/bin/python tools/render_article.py --validate
```
Expected: clean.

- [ ] **Step 5: Run RSS test suite one last time**

```bash
tools/venv/bin/pytest tools/test_build_feed.py -v
```
Expected: all green.

- [ ] **Step 6: Commit and close beads issue**

```bash
git add -A
git commit -m "Cleanup: remove obsolete terminal-era assets and update CLAUDE.md

- Delete mr-robot-mask, sparkle_heart, orthodox-cross icons
- Delete taiko.mp3 if unreferenced
- Rewrite CLAUDE.md Core Components for the new architecture
- Article System schema documents new optional fields
- Terminal Interface subsection points to the Easter-egg follow-up"

bd update timbeach-dcl --status=in_progress
# After PR merges to main and you've deployed:
# bd close timbeach-dcl
# bd sync
```

---

## Self-Review (run after writing the plan)

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| Routes | Task 4 |
| Layout system / page widths | Task 1 (tokens) + Task 5 (homepage) + Task 6 (article) |
| Color & typography tokens | Task 1 |
| Theme switching | Task 3 |
| Article data model (optional fields) | Documented in Task 12 (CLAUDE.md update); the rendering code in Tasks 5/6 already reads optional fields |
| RSS feed | Task 10 |
| File architecture | Task 1 (scaffold) + every subsequent task fills modules |
| Mobile breakpoints | Task 11 |
| What's removed | Task 2 (terminal HTML) + Task 12 (asset deletion) |
| Backward compatibility | Task 4 (legacy redirect) + Task 6 (TTS validate) |
| Heading hierarchy | Task 5 (homepage uses h1 for lead, h2 for cards) + Task 6 (article uses h1 for title, h2/h3 in body) |
| Music page TWO_ROOMS | Task 8 |
| About page + starfield-only-here | Task 9 |
| TTS bar restyle | Task 7 |

All spec sections are covered.

**Placeholder scan:**

The plan contains one explicit placeholder marker — Task 6 Step 2 says "paste the entire body of `parseMarkdown` from the old `index.html` here, starting at...". This is intentional: the function is ~250 lines of regex-heavy code that must be copied verbatim, not retyped. The instruction is precise (line 2356 in the pre-redesign file) and the engineer can use `git show HEAD~N:index.html` to retrieve it. Acceptable.

No other "TBD", "TODO", or vague-fix placeholders.

**Type consistency:**

- `effectiveTheme()` and `applyTheme()` defined and used in `theme.js` only — consistent.
- `loadArticles()` is local to `js/app.js`; `loadIndex()` is local to `js/article.js`. They both fetch `articles/articles.json` but cache independently. Acceptable — caching layers are local concerns.
- `mountTtsBar(article)` signature: `{ slug, title, audio, timings, voice, duration, ... }`. Called with this shape in Task 6's `renderArticle`. Consistent.
- `initStarfield()` / `destroyStarfield()` pair from `js/starfield.js`. Both used in `js/app.js`. Consistent.
- `parseMarkdown` is local to `js/article.js`, not exported. Consistent.
- `build_feed(project_root, out_path, site_url)` and `render_article_html(md_path)` — both used by tests with the same signatures.

No inconsistencies.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task; review between tasks; fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans; batch with checkpoints.

Which approach?
