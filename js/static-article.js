// js/static-article.js — progressive enhancements for the static /a/<slug>/
// pages: image lightbox + read-aloud bar. Mirrors the SPA behaviors wired in
// js/article.js, but reads article metadata from data attributes baked in at
// build time by tools/build_share_pages.py instead of articles.json.
//
// Paragraph-highlight parity note: these pages are rendered server-side with
// markdown-it — the SAME renderer render_article.py:extract_paragraphs used
// to produce the timings sidecar — so the paragraph sequence tts.js derives
// from this DOM matches the timings by construction (pinned by the
// tts-parity test in tools/test_build_share_pages.py).

import { mountTtsBar } from './tts.js';

function initReadAloud() {
  const btn = document.querySelector('[data-act="read-aloud"]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    mountTtsBar({
      audio: btn.dataset.audio,
      timings: btn.dataset.timings,
      duration: parseFloat(btn.dataset.duration),
    });
  });
}

function initLightbox() {
  const lightbox = document.querySelector('[data-act="img-lightbox"]');
  if (!lightbox) return;
  const lbImg = lightbox.querySelector('.lightbox-image');
  const lbClose = lightbox.querySelector('.lightbox-close');
  const onKey = (e) => { if (e.key === 'Escape') closeLightbox(); };
  function openLightbox(src, alt) {
    lbImg.src = src;
    lbImg.alt = alt || '';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKey);
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lbImg.removeAttribute('src');
    document.removeEventListener('keydown', onKey);
  }
  for (const img of document.querySelectorAll('.article-body img')) {
    img.addEventListener('click', () => openLightbox(img.currentSrc || img.src, img.alt));
  }
  lbClose.addEventListener('click', closeLightbox);
  // Backdrop click closes; clicks on the image itself don't bubble out.
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
}

initReadAloud();
initLightbox();
