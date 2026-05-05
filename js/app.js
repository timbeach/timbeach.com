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
