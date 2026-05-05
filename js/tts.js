// js/tts.js — read-aloud bar, ported from pre-redesign index.html.
// Behavior must not regress: paragraph highlighting via timings sidecar,
// transport controls, voice select, speed slider, close-to-stop.
//
// API:
//   mountTtsBar(article) — article = { slug, title, audio, timings, voice, duration }
//                          Mounts the bar into <body> if not already present,
//                          wires it to the article body, autoplays on click.

const VOICES = [
  // British male
  { id: 'bm_daniel',  label: 'Daniel (UK)' },
  { id: 'bm_fable',   label: 'Fable (UK)' },
  { id: 'bm_george',  label: 'George (UK)' },
  { id: 'bm_lewis',   label: 'Lewis (UK)' },
  // British female
  { id: 'bf_alice',   label: 'Alice (UK)' },
  { id: 'bf_emma',    label: 'Emma (UK)' },
  { id: 'bf_isabella',label: 'Isabella (UK)' },
  { id: 'bf_lily',    label: 'Lily (UK)' },
  // American female
  { id: 'af_alloy',   label: 'Alloy (US)' },
  { id: 'af_aoede',   label: 'Aoede (US)' },
  { id: 'af_bella',   label: 'Bella (US)' },
  { id: 'af_heart',   label: 'Heart (US)' },
  { id: 'af_jessica', label: 'Jessica (US)' },
  { id: 'af_kore',    label: 'Kore (US)' },
  { id: 'af_nicole',  label: 'Nicole (US)' },
  { id: 'af_nova',    label: 'Nova (US)' },
  { id: 'af_river',   label: 'River (US)' },
  { id: 'af_sarah',   label: 'Sarah (US)' },
  { id: 'af_sky',     label: 'Sky (US)' },
];

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
      <select class="tts-voice-select" aria-label="Voice">
        ${VOICES.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}
      </select>
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
  bar.querySelector('.tts-voice-select').addEventListener('change', (e) => {
    // Switching voices means switching to the corresponding audio file. We
    // map by replacing the voice token in the audio path. Convention from the
    // TTS pipeline: audio/<slug>.<voice>.ogg if voice != default; otherwise
    // audio/<slug>.ogg. (Older articles only have the default voice rendered.)
    if (!currentArticle) return;
    const newVoice = e.target.value;
    const newSrc = currentArticle.audio.replace(/\.ogg$/, `.${newVoice}.ogg`);
    audio.src = newSrc;
    audio.load();
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
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function updateTimeLabel() {
  const el = bar.querySelector('.tts-status-time');
  if (el) el.textContent = `${fmtTime(audio.currentTime || 0)} / ${fmtTime(audio.duration || 0)}`;
}

function clearHighlight() {
  document.querySelectorAll('.article-body .tts-reading').forEach((p) => p.classList.remove('tts-reading'));
  document.querySelector('.article-body')?.classList.remove('tts-active');
}

function onTimeUpdate() {
  updateTimeLabel();
  // Progress bar
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  bar.querySelector('.tts-progress-fill').style.width = `${pct}%`;

  // Paragraph highlight: timings is an array of paragraph entries with start/end seconds.
  if (!timings || !timings.length) return;
  const t = audio.currentTime;
  let idx = -1;
  for (let i = 0; i < timings.length; i++) {
    const p = timings[i];
    if (t >= p.start && t < p.end) { idx = i; break; }
  }
  if (idx === lastParagraphIdx) return;
  lastParagraphIdx = idx;

  const body = document.querySelector('.article-body');
  if (!body) return;
  body.classList.add('tts-active');
  body.querySelectorAll('.tts-reading').forEach((p) => p.classList.remove('tts-reading'));

  if (idx >= 0) {
    // Identify paragraph elements eligible for TTS (matches what
    // tools/render_article.py extracts: p, h2, h3, h4, li, td).
    const eligible = body.querySelectorAll('p, h2, h3, h4, li, td');
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
  bar.classList.remove('visible');
  document.body.classList.remove('tts-open');
  lastParagraphIdx = -1;
}

export async function mountTtsBar(article) {
  const gen = ++mountGeneration;
  buildBar();
  currentArticle = article;
  lastParagraphIdx = -1;

  // Voice select reflects the rendered voice
  const sel = bar.querySelector('.tts-voice-select');
  if (article.voice) sel.value = article.voice;

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

  // Auto-play on user-gesture-initiated mount (link click counts as gesture).
  audio.play().then(() => setPlayIcon(true)).catch(() => setPlayIcon(false));
}
