// js/app.js — site bootstrap and homepage rendering, populated in Tasks 4-5.
import { initTheme } from './theme.js';
import { initRouter } from './router.js';

export function bootstrap() {
  initTheme();
  initRouter();
}
