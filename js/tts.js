// js/tts.js — read-aloud bar. Plays a per-article pre-rendered Opus track and
// drives paragraph highlighting from the timings sidecar.
//
// Voice is fixed at publish time by tools/render_article.py (one voice per
// article, picked at render). The bar exposes transport + speed only — no
// voice picker, since alternate voices aren't rendered.
//
// API:
//   mountTtsBar(article) — article = { slug, title, audio, timings, voice, duration }
//                          Mounts the bar into <body> if not already present,
//                          wires it to the article body, plays on click.

let bar = null;
let audio = null;
let timings = null;
let currentArticle = null;
let lastParagraphIdx = -1;
let hashListenerInstalled = false;
let mountGeneration = 0;

function buildBar() {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.className = 'tts-bar';
  bar.innerHTML = `
    <div class="tts-progress-track"><div class="tts-progress-fill"></div></div>
    <div class="tts-bar-inner">
      <div class="tts-transport">
        <button class="tts-btn" data-act="rewind"  title="Rewind to start" aria-label="Rewind to start">⏮</button>
        <button class="tts-btn" data-act="play"    title="Play / pause"     aria-label="Play / pause">▶</button>
      </div>
      <div class="tts-status">
        <span class="tts-status-label">Reading</span>
        <span class="tts-status-text">—</span>
        <span class="tts-status-label" style="margin-left:12px">Time</span>
        <span class="tts-status-time">0:00 / 0:00</span>
      </div>
      <div class="tts-speed">
        <span class="tts-speed-label">Speed</span>
        <input class="tts-speed-slider" type="range" min="0.6" max="1.6" step="0.05" value="1.0" />
        <span class="tts-speed-value">1.00×</span>
      </div>
      <button class="tts-close" type="button" aria-label="Close">×</button>
    </div>
  `;
  document.body.appendChild(bar);

  audio = document.createElement('audio');
  audio.preload = 'auto';
  document.body.appendChild(audio);

  wireBar();
  installHashListener();
  return bar;
}

function wireBar() {
  bar.querySelector('[data-act="play"]').addEventListener('click', togglePlay);
  bar.querySelector('[data-act="rewind"]').addEventListener('click', () => {
    if (audio) audio.currentTime = 0;
  });
  bar.querySelector('.tts-close').addEventListener('click', closeBar);
  bar.querySelector('.tts-speed-slider').addEventListener('input', (e) => {
    if (audio) audio.playbackRate = parseFloat(e.target.value);
    bar.querySelector('.tts-speed-value').textContent = `${parseFloat(e.target.value).toFixed(2)}×`;
  });

  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', () => {
    setPlayIcon(false);
    clearHighlight();
  });
  audio.addEventListener('loadedmetadata', () => {
    updateTimeLabel();
  });
}

function installHashListener() {
  // Close the bar (and stop audio) when the user navigates away from any
  // article route. Without this, the audio element survives `app.innerHTML`
  // replacement and keeps playing on the homepage / music / about.
  if (hashListenerInstalled) return;
  hashListenerInstalled = true;
  window.addEventListener('hashchange', () => {
    const isArticleHash = /^#\/article\//.test(location.hash);
    if (!isArticleHash && bar && bar.classList.contains('visible')) {
      closeBar();
    }
  });
}

function setPlayIcon(playing) {
  bar.querySelector('[data-act="play"]').textContent = playing ? '❚❚' : '▶';
}

function togglePlay() {
  if (!audio) return;
  if (audio.paused) {
    audio.play().then(() => setPlayIcon(true)).catch(() => setPlayIcon(false));
  } else {
    audio.pause();
    setPlayIcon(false);
  }
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) return '--:--';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Some Opus streams lack a duration header until the full file loads, so
// audio.duration can read Infinity. Fall back to the duration recorded in
// articles.json (which the renderer wrote at publish time).
function totalDuration() {
  const d = audio ? audio.duration : NaN;
  if (Number.isFinite(d) && d > 0) return d;
  if (currentArticle && Number.isFinite(currentArticle.duration)) return currentArticle.duration;
  return 0;
}

function updateTimeLabel() {
  const el = bar.querySelector('.tts-status-time');
  if (el) el.textContent = `${fmtTime(audio.currentTime || 0)} / ${fmtTime(totalDuration())}`;
}

// Match tools/render_article.py:extract_paragraphs — same selector, same empty filter
// (strips elements whose text is empty after <img> removal, e.g. a hero image's <p>).
function eligibleParagraphs() {
  const body = document.querySelector('.article-body');
  if (!body) return [];
  const all = Array.from(body.querySelectorAll('p, h2, h3, h4, li'));
  return all.filter((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('img').forEach((img) => img.remove());
    return clone.textContent.trim().length > 0;
  });
}

function paragraphTimings() {
  return (timings && Array.isArray(timings.paragraphs)) ? timings.paragraphs : [];
}

function clearHighlight() {
  document.querySelectorAll('.article-body .tts-reading').forEach((p) => p.classList.remove('tts-reading'));
  document.querySelector('.article-body')?.classList.remove('tts-active');
}

function clearParagraphClicks() {
  document.querySelectorAll('.article-body [data-tts-wired]').forEach((el) => {
    el.removeAttribute('data-tts-wired');
    el.style.cursor = '';
  });
}

function wireParagraphClicks() {
  const paras = eligibleParagraphs();
  const t = paragraphTimings();
  if (!paras.length || !t.length) return;
  if (paras.length !== t.length) {
    console.warn(`[tts] paragraph count mismatch (${paras.length} DOM vs ${t.length} in timings) — click-to-seek may map to wrong paragraphs. Re-render with --force.`);
  }
  paras.forEach((el, idx) => {
    if (el.dataset.ttsWired) return;
    el.dataset.ttsWired = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', (ev) => {
      // Don't hijack clicks on real links or interactive controls inside the paragraph.
      const interactive = ev.target.closest('a, button, input, textarea, select, [contenteditable="true"]');
      if (interactive) return;
      if (!audio) return;
      const entry = paragraphTimings()[idx];
      if (!entry) return;
      audio.currentTime = entry.start;
      if (audio.paused) {
        audio.play().then(() => setPlayIcon(true)).catch(() => setPlayIcon(false));
      }
    });
  });
}

function onTimeUpdate() {
  updateTimeLabel();
  // Progress bar — uses the same duration fallback as the time label.
  const total = totalDuration();
  const pct = total > 0 ? (audio.currentTime / total) * 100 : 0;
  bar.querySelector('.tts-progress-fill').style.width = `${pct}%`;

  const t = paragraphTimings();
  if (!t.length) return;
  const now = audio.currentTime;
  let idx = -1;
  for (let i = 0; i < t.length; i++) {
    const p = t[i];
    if (now >= p.start && now < p.end) { idx = i; break; }
  }
  if (idx === lastParagraphIdx) return;
  lastParagraphIdx = idx;

  const body = document.querySelector('.article-body');
  if (!body) return;
  body.classList.add('tts-active');
  body.querySelectorAll('.tts-reading').forEach((p) => p.classList.remove('tts-reading'));

  if (idx >= 0) {
    const eligible = eligibleParagraphs();
    const target = eligible[idx];
    if (target) {
      target.classList.add('tts-reading');
      const status = bar.querySelector('.tts-status-text');
      if (status) status.textContent = (target.textContent || '').slice(0, 80);
    }
  }
}

async function loadTimings(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`timings: ${res.status}`);
  return await res.json();
}

function closeBar() {
  if (audio) { audio.pause(); audio.currentTime = 0; }
  setPlayIcon(false);
  clearHighlight();
  clearParagraphClicks();
  bar.classList.remove('visible');
  document.body.classList.remove('tts-open');
  lastParagraphIdx = -1;
}

export async function mountTtsBar(article) {
  const gen = ++mountGeneration;
  buildBar();
  currentArticle = article;
  lastParagraphIdx = -1;

  audio.src = article.audio;
  audio.load();
  audio.playbackRate = parseFloat(bar.querySelector('.tts-speed-slider').value);

  let loaded;
  try {
    loaded = await loadTimings(article.timings);
  } catch (e) {
    if (gen !== mountGeneration) return; // superseded by a later mountTtsBar call
    console.warn('[tts] failed to load timings; bar will play audio without highlight', e);
    timings = [];
    bar.classList.add('visible');
    document.body.classList.add('tts-open');
    audio.play().then(() => setPlayIcon(true)).catch(() => setPlayIcon(false));
    return;
  }

  if (gen !== mountGeneration) return; // superseded by a later mountTtsBar call
  timings = loaded;

  bar.classList.add('visible');
  document.body.classList.add('tts-open');
  wireParagraphClicks();

  // Auto-play on user-gesture-initiated mount (link click counts as gesture).
  audio.play().then(() => setPlayIcon(true)).catch(() => setPlayIcon(false));
}
