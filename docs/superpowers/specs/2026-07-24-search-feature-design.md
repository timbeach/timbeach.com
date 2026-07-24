# Search Feature Design — timbeach.com

**Date:** 2026-07-24
**Status:** Approved direction (option B: full-text via deploy-time index); detail
decisions made unattended per Timothy's go-ahead, flagged inline where judgment
was applied.

## Goal

A search box on the homepage, above the "More" section, that finds articles by
full text — not just title/tags — with zero server-side infrastructure. The
site stays a static SPA; search runs entirely in the reader's browser.

## Approach (decided)

**Deploy-time full-text index.** `deploy.sh` already runs Python build tools
(feed, share pages); a new `tools/build_search_index.py` joins that pipeline and
bakes `search-index.json` — a flat `{slug: "plain article text"}` map — which
the client lazy-loads on first use. Rejected alternatives:

- *Metadata-only search* (title/tags/summary from the already-loaded
  `articles.json`): zero extra cost but can't answer "which article mentioned
  fzf?" — the main value of search on a technical blog.
- *Fetch all 36 `.md` files on first keystroke*: works, but re-parses markdown
  client-side and ships raw markdown syntax into the haystack (matches on
  `](http...` noise); the deploy-time index strips to spoken text once.

## Components

### 1. `tools/build_search_index.py` (new)

- Reads `articles/articles.json`; for each registered article, reads the
  markdown and extracts plain text via **`extract_paragraphs` imported from
  `render_article.py`** — the same function that defines TTS paragraph parity.
  One source of truth for "the readable text of an article"; import cost
  measured at ~0.3 s (heavy TTS deps are lazy).
- Output: `search-index.json` at repo root:
  `{"<slug>": "<paragraphs joined by \n>"}`. Original case preserved (needed
  for snippet display); client lowercases at query time.
- Includes **all** registered articles, including future-dated and `unlisted`
  ones — the client only searches slugs present in its own filtered article
  list, so gated articles stay invisible. (Their raw `.md` is already publicly
  fetchable, so the index leaks nothing new.)
- Tested with pytest alongside the existing `tools/test_build_feed.py`.

### 2. `search-index.json` (build artifact)

- Gitignored (like `/a/`), rebuilt by every deploy, rsynced (NOT in
  `.deployignore`). ~350 KB raw / ~120 KB over the wire gzipped; lazy-loaded so
  readers who never search never pay for it.

### 3. `js/search.js` (new client module)

Exports an `initSearch(...)` used by `renderHome`. Responsibilities:

- **Lazy index load:** first keystroke triggers a single cached
  `fetch('search-index.json')`. On fetch failure (e.g. local dev before any
  build), degrade gracefully to metadata-only search — no error surfaced, body
  matches simply absent.
- **Matching:** query split on whitespace into terms; an article matches when
  *every* term appears case-insensitively as a substring of its haystack
  (title + tags + summary + body text).
- **Ranking:** per-term location score — title 4, tag 3, summary 2, body 1 —
  summed across terms; sort score desc, then date desc.
- **Snippets:** for body matches, a ~140-char window around the first term hit,
  trimmed to word boundaries, HTML-escaped, all term occurrences wrapped in
  `<mark>`. Falls back to the summary when the match is metadata-only.

### 4. Homepage UX (`js/app.js` + `css/site.css`)

- A search `<input>` sits above the "More" heading (placement per Timothy).
  Placeholder "Search articles…". Debounced ~150 ms.
- **Non-empty query:** the More section swaps to a results list — every
  matching article site-wide (including the lead/cards ones), rendered in the
  existing `.more li` idiom (date + title link) plus a snippet line. A count
  line ("4 matches") heads the list; "No matches." when empty. Lead and cards
  stay visible above so the page doesn't jump.
- **Empty query:** normal More list restored.
- **Keyboard:** `Escape` clears and blurs; `/` focuses the search box from the
  homepage when focus isn't already in an input.
- `<mark>` styled via theme tokens for day/night.
- Query is *not* persisted in the URL hash (future work if wanted).

### 5. Pipeline wiring

- `deploy.sh`: `→ generating search index` step alongside feed/share-pages.
- `.gitignore`: add `/search-index.json`.
- `CLAUDE.md`: document the module and build step.

## Error handling

- Builder: missing markdown file for a registered slug → hard fail (mirrors the
  registry-integrity stance of the validate gate).
- Client: index fetch failure → metadata-only fallback, silent.
- All user-visible strings HTML-escaped before insertion; `<mark>` injected
  only after escaping.

## Testing

- pytest for the builder: index shape, text extraction parity (reuses
  `extract_paragraphs`), missing-file failure, unlisted/future articles
  included.
- Client: no JS test harness exists in this repo; verification is a local
  static server + scripted DOM checks, plus manual pass in the morning.

## Out of scope (noted for later, per Timothy)

- **Pagination** of the More list / results.
- **Tag browsing** (clickable tag chips, `#/tag/<t>` route). Cheap interim once
  search exists: clicking a tag could prefill the search box.
- URL-persisted queries (`#/?q=...`), fuzzy matching, stemming.
