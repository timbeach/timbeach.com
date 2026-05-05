// js/app.js — site bootstrap and homepage rendering.
import { initTheme } from './theme.js';
import { initRouter, registerRoute } from './router.js';
import { renderArticle } from './article.js';
import { initStarfield, destroyStarfield } from './starfield.js';

const app = () => document.getElementById('app');

// === Article helpers ===

let articlesCache = null;

let starfieldActive = false;

function ensureStarfieldOff() {
  if (starfieldActive) {
    destroyStarfield();
    starfieldActive = false;
  }
}

async function loadArticles() {
  if (articlesCache) return articlesCache;
  const res = await fetch(`articles/articles.json?t=${Date.now()}`);
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
    // Convert "software-engineering" -> "Software engineering"
    return t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ');
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

// === Route renderers ===

async function renderHome() {
  ensureStarfieldOff();
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
            <time datetime="${escapeHtml(a.date)}">${escapeHtml(formatDateShort(a.date))}</time>
            <a href="#/article/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
          </li>
        `).join('')}
      </ul>
    </section>
  ` : '';

  app().innerHTML = leadHtml + cardsHtml + moreHtml;
  document.title = 'Timothy D Beach';
}

function renderMusic() {
  ensureStarfieldOff();
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
         tabindex="-1"
         aria-disabled="true"
         target="_blank"
         rel="noopener">gutlens.net</a>
    </section>
  `;
  document.title = 'Music · Timothy D Beach';
}

function renderAbout() {
  if (!starfieldActive) {
    initStarfield().catch((err) => console.error('[starfield] init failed', err));
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

function renderNotFound() {
  ensureStarfieldOff();
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
  registerRoute('article', ({ slug }) => {
    ensureStarfieldOff();
    return renderArticle(slug, app());
  });
  registerRoute('music', renderMusic);
  registerRoute('about', renderAbout);
  registerRoute('404', renderNotFound);
  initRouter();
}
