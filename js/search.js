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

  // "/" focuses search. The handler is document-level and renderHome re-runs
  // on every visit home, so: drop the previous one, and self-remove once the
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
