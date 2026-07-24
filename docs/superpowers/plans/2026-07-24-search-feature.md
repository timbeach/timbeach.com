# Homepage Full-Text Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A search box above the homepage "More" section that full-text-searches all visible articles client-side, backed by a deploy-time `search-index.json`.

**Architecture:** `tools/build_search_index.py` (new, joins the existing feed/share-pages deploy pipeline) bakes `{slug: plain text}` using `extract_paragraphs` from `render_article.py`. New `js/search.js` lazy-loads the index on first keystroke, matches/ranks/snippets, and swaps the More list for results. Shared tiny helpers move to new `js/util.js` so `search.js` stays DOM-import-free and node-verifiable.

**Tech Stack:** Vanilla ES modules, Python 3 (`markdown-it-py`, `beautifulsoup4` — already in tools/venv), pytest.

**Spec:** `docs/superpowers/specs/2026-07-24-search-feature-design.md`

## Global Constraints

- No external JS dependencies; no build step for the front end.
- All user-visible strings HTML-escaped before `innerHTML`; `<mark>` injected only around already-escaped segments.
- `search-index.json` is a build artifact: gitignored, NOT in `.deployignore`.
- The client must only surface articles present in its own filtered list (future-dated/unlisted stay invisible even though they're in the index).
- Index text extraction MUST go through `render_article.extract_paragraphs` (single source of truth; do not reimplement markdown stripping).
- Python tests run as: `cd tools && ./venv/bin/python -m pytest test_build_search_index.py -v`
- Commits: no Co-Authored-By trailer (repo hook blocks it).

---

### Task 1: Extract shared helpers to `js/util.js`

**Files:**
- Create: `js/util.js`
- Modify: `js/app.js` (remove local `escapeHtml`/`formatDateShort`, import instead)

**Interfaces:**
- Produces: `escapeHtml(s: any) -> string`, `formatDateShort(iso: string) -> string` (exact current behavior, moved verbatim).

- [ ] **Step 1: Create `js/util.js`** with the two functions moved verbatim from `js/app.js` (lines 65–75):

```js
// js/util.js — tiny shared helpers (DOM-free; importable from node for checks).

export function formatDateShort(iso) {
  // "2026-05-02" -> "May 2"
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
```

- [ ] **Step 2: Update `js/app.js`** — delete its local `formatDateShort` and `escapeHtml` definitions and add to the imports block:

```js
import { escapeHtml, formatDateShort } from './util.js';
```

- [ ] **Step 3: Verify** — syntax-check both modules and confirm no other file defined-and-used these names incorrectly:

Run: `node --check js/util.js && node --check js/app.js && grep -rn "function escapeHtml\|function formatDateShort" js/`
Expected: both checks silent; grep shows definitions only in `js/util.js` (and `js/article.js` if it has its own copy — leave that one alone, out of scope).

- [ ] **Step 4: Commit**

```bash
git add js/util.js js/app.js
git commit -m "Extract escapeHtml/formatDateShort into js/util.js"
```

---

### Task 2: `tools/build_search_index.py` (TDD)

**Files:**
- Create: `tools/build_search_index.py`
- Test: `tools/test_build_search_index.py`

**Interfaces:**
- Consumes: `render_article.extract_paragraphs(md_text: str) -> list[str]`
- Produces: `build_index(project_root: Path) -> dict[str, str]` (slug → paragraphs joined with `"\n"`); CLI writes `<root>/search-index.json`.

- [ ] **Step 1: Write the failing tests** (`tools/test_build_search_index.py`):

```python
"""Tests for tools/build_search_index.py — the search index generator."""
import json
from pathlib import Path

import pytest

from build_search_index import build_index


def _project_fixture(tmp_path: Path) -> Path:
    """Minimal project tree: articles/ with registry + two markdown files."""
    articles = tmp_path / "articles"
    articles.mkdir()

    (articles / "first-article.md").write_text(
        "# First Article\n\n"
        "Body paragraph one.\n\n"
        "```sh\nblockcode_token --flag\n```\n\n"
        "Paragraph two with **bold** and `inline_token` kept.\n"
    )
    (articles / "future-article.md").write_text(
        "# Future\n\nNot yet public text.\n"
    )
    (articles / "articles.json").write_text(json.dumps({
        "first-article.md": {
            "title": "First Article", "date": "2026-05-02", "tags": ["test"],
        },
        "future-article.md": {
            "title": "Future", "date": "2099-01-01", "tags": ["test"],
            "unlisted": True,
        },
    }))
    return tmp_path


def test_index_maps_slug_to_plain_text(tmp_path):
    index = build_index(_project_fixture(tmp_path))
    assert set(index) == {"first-article", "future-article"}
    assert "Body paragraph one." in index["first-article"]


def test_markdown_syntax_stripped(tmp_path):
    index = build_index(_project_fixture(tmp_path))
    text = index["first-article"]
    assert "**" not in text
    assert "bold" in text


def test_h1_title_excluded(tmp_path):
    # Server-side parity rule: h1 is the article title, not body text.
    index = build_index(_project_fixture(tmp_path))
    assert "First Article" not in index["first-article"]


def test_block_code_excluded_inline_code_kept(tmp_path):
    index = build_index(_project_fixture(tmp_path))
    text = index["first-article"]
    assert "blockcode_token" not in text
    assert "inline_token" in text


def test_future_and_unlisted_articles_included(tmp_path):
    # Client gates visibility; the index deliberately includes everything.
    index = build_index(_project_fixture(tmp_path))
    assert "Not yet public text." in index["future-article"]


def test_missing_markdown_fails(tmp_path):
    project = _project_fixture(tmp_path)
    (project / "articles" / "first-article.md").unlink()
    with pytest.raises(FileNotFoundError, match="first-article.md"):
        build_index(project)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools && ./venv/bin/python -m pytest test_build_search_index.py -v`
Expected: collection error — `ModuleNotFoundError: No module named 'build_search_index'`

- [ ] **Step 3: Write `tools/build_search_index.py`:**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools && ./venv/bin/python -m pytest test_build_search_index.py -v`
Expected: 6 passed. Also run the full tools suite to check for collateral damage: `./venv/bin/python -m pytest test_build_feed.py test_build_search_index.py -v` → all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/build_search_index.py tools/test_build_search_index.py
git commit -m "Add search index generator (slug -> plain text via extract_paragraphs)"
```

---

### Task 3: `js/search.js` — matching, ranking, snippets (logic only)

**Files:**
- Create: `js/search.js`
- Test: node assertion script at `$SCRATCHPAD/search-logic-test.mjs` (repo has no JS test harness; this is a throwaway check, not committed)

**Interfaces:**
- Consumes: `escapeHtml`, `formatDateShort` from `js/util.js` (Task 1).
- Produces (all exported for the node check and Task 4):
  - `searchArticles(articles, index, query) -> [{article, score, body}]` — every whitespace-split term must substring-match (case-insensitive) title/tags/summary/body; per-term score title 4 + tags 3 + summary 2 + body 1; sorted score desc then date desc.
  - `markTerms(text, terms) -> string` — HTML-escaped text with case-insensitive term occurrences wrapped in `<mark>`, overlap-safe (ranges merged before escaping — never regex over escaped HTML).
  - `buildSnippet(body, terms) -> string` — ~70 chars each side of the earliest term hit, word-boundary trimmed, ellipses, marked via `markTerms`.
  - `renderResults(results, terms) -> string` — count line + `<ul>` in the `.more li` idiom (time + div.search-hit with title link + p.search-snippet). Snippet falls back to marked summary when only metadata matched; `"No matches."` when empty.
  - `initSearch(section, articles)` — DOM wiring (written here, exercised in Task 4).

- [ ] **Step 1: Write `js/search.js`:**

```js
// js/search.js — homepage full-text search.
//
// The index (search-index.json, baked by tools/build_search_index.py at deploy
// time) maps slug -> plain article text. Lazy-loaded on first keystroke; if
// the fetch fails (e.g. local checkout before any build) search silently
// degrades to metadata-only (title/tags/summary from articles.json).

import { escapeHtml, formatDateShort } from './util.js';

let indexPromise = null;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('search-index.json')
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return indexPromise;
}

const FIELD_WEIGHTS = { title: 4, tags: 3, summary: 2, body: 1 };

export function searchArticles(articles, index, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const results = [];
  for (const a of articles) {
    const body = index[a.slug] || '';
    const fields = {
      title: (a.title || '').toLowerCase(),
      tags: (Array.isArray(a.tags) ? a.tags.join(' ') : '').toLowerCase(),
      summary: (a.summary || '').toLowerCase(),
      body: body.toLowerCase(),
    };
    let score = 0;
    let everyTermHit = true;
    for (const term of terms) {
      let termScore = 0;
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        if (fields[field].includes(term)) termScore += weight;
      }
      if (!termScore) { everyTermHit = false; break; }
      score += termScore;
    }
    if (everyTermHit) results.push({ article: a, score, body });
  }

  results.sort((x, y) =>
    y.score - x.score || (x.article.date < y.article.date ? 1 : -1));
  return results;
}

// Escape-safe highlighting: find match ranges on the raw text, merge overlaps,
// then emit alternating escaped/marked-escaped segments. Never regex over
// already-escaped HTML (a search for "amp" must not corrupt "&amp;").
export function markTerms(text, terms) {
  const lower = text.toLowerCase();
  const ranges = [];
  for (const t of terms) {
    let i = 0;
    while (t && (i = lower.indexOf(t, i)) !== -1) {
      ranges.push([i, i + t.length]);
      i += t.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  let out = '';
  let pos = 0;
  for (const [s, e] of merged) {
    out += escapeHtml(text.slice(pos, s))
      + '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>';
    pos = e;
  }
  return out + escapeHtml(text.slice(pos));
}

const SNIPPET_RADIUS = 70;

export function buildSnippet(body, terms) {
  const lower = body.toLowerCase();
  let hit = -1;
  let hitLen = 0;
  for (const t of terms) {
    const i = t ? lower.indexOf(t) : -1;
    if (i !== -1 && (hit === -1 || i < hit)) { hit = i; hitLen = t.length; }
  }
  if (hit === -1) return '';

  let start = Math.max(0, hit - SNIPPET_RADIUS);
  let end = Math.min(body.length, hit + hitLen + SNIPPET_RADIUS);
  if (start > 0) {
    const sp = body.indexOf(' ', start);
    if (sp !== -1 && sp < hit) start = sp + 1;
  }
  if (end < body.length) {
    const sp = body.lastIndexOf(' ', end);
    if (sp > hit + hitLen) end = sp;
  }

  const text = body.slice(start, end).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '… ' : '')
    + markTerms(text, terms)
    + (end < body.length ? ' …' : '');
}

export function renderResults(results, terms) {
  if (!results.length) return '<p class="search-count">No matches.</p>';
  const n = results.length;
  return `
    <p class="search-count">${n} match${n === 1 ? '' : 'es'}</p>
    <ul>
      ${results.map(({ article: a, body }) => {
        const bodyLower = body.toLowerCase();
        const hasBodyHit = terms.some((t) => t && bodyLower.includes(t));
        const snippet = hasBodyHit
          ? buildSnippet(body, terms)
          : (a.summary ? markTerms(a.summary, terms) : '');
        return `
          <li>
            <time datetime="${escapeHtml(a.date)}">${escapeHtml(formatDateShort(a.date))}</time>
            <div class="search-hit">
              <a href="#/article/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
              ${snippet ? `<p class="search-snippet">${snippet}</p>` : ''}
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

// --- DOM wiring ---

let slashHandler = null;

export function initSearch(section, articles) {
  const input = section.querySelector('.search-input');
  const heading = section.querySelector('h2');
  const defaultEl = section.querySelector('[data-search-default]');
  const resultsEl = section.querySelector('[data-search-results]');
  const defaultHeading = heading.textContent;
  let timer = 0;

  const runSearch = async () => {
    const query = input.value.trim();
    if (!query) {
      heading.textContent = defaultHeading;
      resultsEl.hidden = true;
      resultsEl.innerHTML = '';
      defaultEl.hidden = false;
      return;
    }
    const index = await loadIndex();
    if (input.value.trim() !== query) return; // superseded keystroke
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    heading.textContent = 'Search';
    defaultEl.hidden = true;
    resultsEl.hidden = false;
    resultsEl.innerHTML = renderResults(searchArticles(articles, index, query), terms);
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      runSearch();
      input.blur();
    }
  });

  // "/" focuses search. Handler is document-level and renderHome re-runs on
  // every visit home, so: drop the previous one, and self-remove once the
  // input leaves the DOM (navigated away).
  if (slashHandler) document.removeEventListener('keydown', slashHandler);
  slashHandler = (e) => {
    if (!input.isConnected) {
      document.removeEventListener('keydown', slashHandler);
      slashHandler = null;
      return;
    }
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = document.activeElement;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!typing) {
      e.preventDefault();
      input.focus();
    }
  };
  document.addEventListener('keydown', slashHandler);
}
```

- [ ] **Step 2: Write the node check** (`$SCRATCHPAD/search-logic-test.mjs`) — plain assertions, imports the real module:

```js
import assert from 'node:assert/strict';
import { searchArticles, markTerms, buildSnippet, renderResults } from '<ABS_REPO>/js/search.js';

const articles = [
  { slug: 'tmux', title: 'How tmux works', date: '2026-01-02', tags: ['tmux', 'cli'], summary: 'Panes and windows.' },
  { slug: 'fzf', title: 'Fuzzy finding', date: '2026-03-01', tags: ['bash'], summary: 'CLI joy.' },
  { slug: 'quiet', title: 'Unrelated', date: '2026-02-01', tags: ['misc'], summary: '' },
];
const index = {
  tmux: 'Sessions hold windows. Windows hold panes.',
  fzf: 'Pipe anything into fzf and fuzzy-find it. tmux integration exists too.',
  quiet: 'Nothing relevant here.',
};

// every-term-must-match + ranking: title hit ranks above body-only hit
let r = searchArticles(articles, index, 'tmux');
assert.deepEqual(r.map((x) => x.article.slug), ['tmux', 'fzf']);

// multi-term AND across fields
r = searchArticles(articles, index, 'tmux panes');
assert.deepEqual(r.map((x) => x.article.slug), ['tmux']);

// no match
assert.equal(searchArticles(articles, index, 'zzznope').length, 0);

// metadata-only fallback (empty index) still finds by title
r = searchArticles(articles, {}, 'fuzzy');
assert.deepEqual(r.map((x) => x.article.slug), ['fzf']);

// markTerms: escape-safe, overlap-merged, case-insensitive
assert.equal(markTerms('A & B', ['a']), '<mark>A</mark> &amp; B');
assert.equal(markTerms('xAByx', ['ab', 'by']), 'x<mark>ABy</mark>x');
assert.equal(markTerms('&amp;', ['amp']), '&<mark>amp</mark>;');  // raw text, not entity corruption

// buildSnippet: window + ellipses + mark
const long = 'w '.repeat(100) + 'needle sits here' + ' w'.repeat(100);
const snip = buildSnippet(long, ['needle']);
assert.ok(snip.startsWith('… ') && snip.endsWith(' …'));
assert.ok(snip.includes('<mark>needle</mark>'));
assert.ok(snip.length < 260);

// renderResults: count + snippet fallback to summary on metadata-only hit
const html = renderResults(searchArticles(articles, index, 'fuzzy'), ['fuzzy']);
assert.ok(html.includes('1 match<'));
assert.ok(html.includes('#/article/fzf'));
assert.ok(renderResults([], []).includes('No matches.'));

console.log('search logic: all assertions passed');
```

- [ ] **Step 3: Run the check**

Run: `node $SCRATCHPAD/search-logic-test.mjs`
Expected: `search logic: all assertions passed`

- [ ] **Step 4: Commit**

```bash
git add js/search.js
git commit -m "Add search module: match/rank/snippet logic + DOM wiring"
```

---

### Task 4: Wire the homepage UI (`js/app.js` + `css/site.css`)

**Files:**
- Modify: `js/app.js` (renderHome: More section markup + initSearch call; import)
- Modify: `css/site.css` (search styles after the `.more` block, ~line 243)

**Interfaces:**
- Consumes: `initSearch(section, articles)` from Task 3. DOM contract: section contains `.search-input`, `h2`, `[data-search-default]`, `[data-search-results]`.

- [ ] **Step 1: Update `js/app.js`** — add `import { initSearch } from './search.js';`, then in `renderHome` replace the `moreHtml` construction and final assignment with:

```js
  const moreHtml = `
    <section class="more">
      <div class="search-box">
        <input class="search-input" type="search" placeholder="Search articles…"
               aria-label="Search articles" autocomplete="off" spellcheck="false" />
      </div>
      <h2>More</h2>
      <div data-search-default>
        ${more.length ? `
        <ul>
          ${more.map((a) => `
            <li>
              <time datetime="${escapeHtml(a.date)}">${escapeHtml(formatDateShort(a.date))}</time>
              <a href="#/article/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
            </li>
          `).join('')}
        </ul>
        ` : ''}
      </div>
      <div data-search-results hidden></div>
    </section>
  `;

  app().innerHTML = leadHtml + cardsHtml + moreHtml;
  initSearch(app().querySelector('.more'), all);
```

(Note the section now renders unconditionally — search covers all articles, so it must exist even if the tail list were empty.)

- [ ] **Step 2: Add CSS** after `.more li a:hover` (css/site.css:242):

```css
/* === Homepage search === */

.search-box { margin: 0 0 14px; }
.search-input {
  width: 100%;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg);
  background: var(--bg-elev);
  border: 1px solid var(--divider);
  border-radius: 2px;
  padding: 7px 10px;
  outline: none;
}
.search-input:focus { border-color: var(--fg-faint); }
.search-input::placeholder { color: var(--fg-faint); }

.search-count {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-faint);
  margin: 0 0 8px;
}
.more li .search-hit { min-width: 0; }
.search-snippet {
  font-family: var(--font-serif);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--fg-muted);
  margin: 2px 0 0;
}
.search-snippet mark {
  background: var(--selection);
  color: var(--fg);
  padding: 0 1px;
}
```

- [ ] **Step 3: Verify** — `node --check js/app.js js/search.js js/util.js`; build a real index (`cd tools && ./venv/bin/python build_search_index.py`); serve the repo (`python3 -m http.server`) and confirm `index.html`, `js/search.js`, `search-index.json` all return 200 and the homepage HTML references the module chain. If a headless chromium is available, dump the rendered homepage and grep for `search-input`; otherwise record that browser verification is pending morning review.

- [ ] **Step 4: Commit**

```bash
git add js/app.js css/site.css
git commit -m "Wire homepage search box above the More list"
```

---

### Task 5: Pipeline + docs

**Files:**
- Modify: `deploy.sh` (add index build step)
- Modify: `.gitignore` (add `/search-index.json`)
- Modify: `CLAUDE.md` (architecture bullets)

- [ ] **Step 1: `deploy.sh`** — inside the existing `if [ -x tools/venv/bin/python ]` block, after the share-pages line:

```sh
  echo "→ generating search index"
  tools/venv/bin/python tools/build_search_index.py
```

- [ ] **Step 2: `.gitignore`** — after the `/a/` block:

```
# Generated full-text search index — rebuilt by deploy.sh via
# tools/build_search_index.py. Build artifact, like /a/.
/search-index.json
```

- [ ] **Step 3: `CLAUDE.md`** — add to Core Components: `js/search.js` and `js/util.js` bullets, `tools/build_search_index.py` bullet, `search-index.json` build-artifact bullet; add the index step to the deploy.sh description line.

- [ ] **Step 4: Verify** — `sh -n deploy.sh` (syntax), `git status --porcelain | grep search-index` shows nothing (ignored), `grep -n search .deployignore` shows nothing (i.e., it ships).

- [ ] **Step 5: Commit**

```bash
git add deploy.sh .gitignore CLAUDE.md
git commit -m "Build search-index.json at deploy time; document search feature"
```

---

### Task 6: End-to-end verification + ship

- [ ] **Step 1:** Full tools test suite: `cd tools && ./venv/bin/python -m pytest test_build_feed.py test_build_search_index.py -v` → all pass. (Skip `test_render_article.py` only if it needs models; try it first.)
- [ ] **Step 2:** Rebuild real index; sanity-query it with node against the real `articles.json` (e.g. "fzf", "repeater", "luks") and confirm expected slugs surface.
- [ ] **Step 3:** Serve locally; headless-browser check if chromium/chrome binary exists (dump DOM after typing into `.search-input` is not feasible without a driver — at minimum confirm page load with no console errors via `--dump-dom | grep search-input`).
- [ ] **Step 4:** Session close: `git status` (leave pre-existing modified/untracked files — IDEAS.md, feed.xml, .gitignore hunk NOT ours? our .gitignore hunk IS ours; add only our files), `bd sync`, push. Update STATUS doc. Do NOT run `./deploy.sh` unattended unless every verification above passed; note the anacron auto-redeploy means committed main may go live regardless, so nothing may be pushed in a known-broken state.
