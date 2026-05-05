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
