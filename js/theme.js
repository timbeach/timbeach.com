// js/theme.js — theme toggle. The FOUC-prevention <script> in <head> already
// applies localStorage.theme before CSS loads. This module wires the button.
//
// Default theme is light, regardless of OS preference. Dark mode is opt-in
// via the sun/moon button and persisted to localStorage.

const STORAGE_KEY = 'theme';
const ATTR = 'data-theme';

function effectiveTheme() {
  const explicit = document.documentElement.getAttribute(ATTR);
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return 'light';
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
}
