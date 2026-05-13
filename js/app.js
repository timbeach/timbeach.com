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
  app().innerHTML = `
    <section class="music-page">
      <button type="button" class="music-cover" data-act="play-promo" aria-label="Play GUT_LENS promo video">
        <img src="pix/TWO_ROOMS_1.jpeg" alt="GUT_LENS by Gut Lens — single cover art" />
        <span class="music-cover-play" aria-hidden="true">▶</span>
      </button>
      <h1 class="music-title">GUT_LENS</h1>
      <p class="music-artist">Gut Lens</p>
      <p class="music-status">Single · Out Now</p>
      <p class="music-streaming">
        <a href="https://music.youtube.com/playlist?list=OLAK5uy_k8GenqXSSx8jD0y6KBkRClx1o4yxc2S6M&si=K2RNckUVVjj1GX6L" target="_blank" rel="noopener">YouTube Music</a>
        <span class="sep" aria-hidden="true">·</span>
        <a href="https://open.spotify.com/album/1mTTLgGZDODcBT8wT0VN8u" target="_blank" rel="noopener">Spotify</a>
        <span class="sep" aria-hidden="true">·</span>
        <a href="https://music.apple.com/us/album/gut-lens-single/1896449537" target="_blank" rel="noopener">Apple Music</a>
      </p>
      <a class="music-link"
         href="https://gutlens.net"
         data-link-live="true"
         target="_blank"
         rel="noopener">gutlens.net</a>

      <div class="lightbox" data-act="lightbox" aria-hidden="true">
        <button type="button" class="lightbox-close" aria-label="Close video">×</button>
        <video class="lightbox-video" preload="metadata" controls loop playsinline>
          <source src="video/gut-lens_lioness.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  `;

  const cover = app().querySelector('[data-act="play-promo"]');
  const lightbox = app().querySelector('[data-act="lightbox"]');
  const video = lightbox.querySelector('.lightbox-video');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  const onKey = (e) => { if (e.key === 'Escape') closePromo(); };

  function openPromo() {
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    video.currentTime = 0;
    video.play().catch(() => { /* browser blocked — controls still work */ });
    document.addEventListener('keydown', onKey);
  }
  function closePromo() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    video.pause();
    document.removeEventListener('keydown', onKey);
  }

  cover.addEventListener('click', openPromo);
  closeBtn.addEventListener('click', closePromo);
  // Backdrop click closes; clicks on the video itself don't bubble out.
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closePromo();
  });

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
      <p>I'm Timothy. I write software professionally, record music as <a href="https://gutlens.net" target="_blank" rel="noopener">Gut Lens</a>, run <a href="https://aegixlinux.org" target="_blank" rel="noopener">Aegix Linux</a> with my soulmate <a href="https://masonborchard.com" target="_blank" rel="noopener">Mason</a>, and build websites for businesses as <a href="https://zenshinsuru.com" target="_blank" rel="noopener">Zenshin Suru</a>. This site is where I write things down so I don't have to remember them twice.</p>
      <p>In the words of Rose Namajunas, "This belt don't mean nothing, man! Just be a good person."</p>
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
