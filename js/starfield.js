// js/starfield.js — astronomically-accurate fisheye-projected starfield + sky-info
// widget. Ported from the pre-redesign index.html. Only active on /about.

let interval = null;
let rootEl = null;
let infoEl = null;
let resizeListener = null;
let observerLat = 47.6;   // Seattle as default; updated by geolocation if granted
let observerLon = -122.3;

function getGMST(date) {
  // Days since J2000.0
  const jd = date.getTime() / 86400000 + 2440587.5;
  const D = jd - 2451545.0;
  const T = D / 36525.0;
  let gmst = 280.46061837 + 360.98564736629 * D + T * T * (0.000387933 - T / 38710000);
  gmst = ((gmst % 360) + 360) % 360;
  return gmst; // degrees
}

function lstHours(date, lonDeg) {
  const lstDeg = (getGMST(date) + lonDeg + 360) % 360;
  return lstDeg / 15; // hours
}

function eqToAltAz(raDeg, decDeg, latDeg, lstDeg) {
  const ha = ((lstDeg - raDeg + 540) % 360) - 180; // hour angle deg, [-180,180]
  const haRad = ha * Math.PI / 180;
  const decRad = decDeg * Math.PI / 180;
  const latRad = latDeg * Math.PI / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad)
               + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad))
              / (Math.cos(alt) * Math.cos(latRad) || 1e-9);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(haRad) > 0) az = 2 * Math.PI - az;
  return { alt: alt * 180 / Math.PI, az: az * 180 / Math.PI };
}

function projectFisheye(altDeg, azDeg) {
  // Azimuthal equidistant: r = 1 - alt/90, theta = az
  if (altDeg < 0) return null;
  const r = 1 - altDeg / 90;
  const theta = (azDeg - 90) * Math.PI / 180; // North = up
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

function magnitudeToSize(mag) {
  // Brighter (lower mag) = larger pixel.
  if (mag < 1) return 4;
  if (mag < 2) return 3.5;
  if (mag < 3) return 3;
  if (mag < 4) return 2.5;
  return 2;
}

async function loadStars() {
  try {
    const res = await fetch('stars.json');
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function generateProcedural(count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      ra:  Math.random() * 360,
      dec: (Math.random() * 180) - 90,
      mag: 4 + Math.random() * 2,
      name: '',
    });
  }
  return stars;
}

// Module-scope so the geolocation callback (registered before await completes)
// can call render(currentStars) without a TDZ on the const declaration.
let currentStars = [];

function render(stars) {
  if (!rootEl) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 2 - 20;

  const now = new Date();
  const lstDeg = lstHours(now, observerLon) * 15;

  rootEl.innerHTML = '';
  let visible = 0;

  for (const s of stars) {
    const { alt, az } = eqToAltAz(s.ra, s.dec, observerLat, lstDeg);
    const proj = projectFisheye(alt, az);
    if (!proj) continue;
    visible++;
    const px = cx + proj.x * radius;
    const py = cy + proj.y * radius;
    const size = magnitudeToSize(s.mag);
    const el = document.createElement('div');
    el.className = 'star' + (s.mag < 2 ? ' bright' : '');
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.animationDelay = `${(s.ra * 0.011) % 4}s`;
    if (s.name) el.title = s.name;
    rootEl.appendChild(el);
  }

  if (infoEl) {
    const lstH = lstHours(now, observerLon);
    const hh = Math.floor(lstH);
    const mm = Math.floor((lstH - hh) * 60);
    const ss = Math.floor((((lstH - hh) * 60) - mm) * 60);
    infoEl.innerHTML = `
      LST ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}<br>
      ${observerLat.toFixed(1)}°N ${Math.abs(observerLon).toFixed(1)}°W<br>
      ${visible} stars visible
    `;
  }
}

export async function initStarfield() {
  if (rootEl) return;   // already mounted; ignore re-entrant call
  rootEl = document.createElement('div');
  rootEl.className = 'starfield';
  document.body.appendChild(rootEl);

  infoEl = document.createElement('div');
  infoEl.className = 'sky-info';
  document.body.appendChild(infoEl);

  // Try geolocation; ignore failures and stick with default.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        observerLat = pos.coords.latitude;
        observerLon = pos.coords.longitude;
        render(currentStars);
      },
      () => { /* keep defaults */ },
      { timeout: 5000, maximumAge: 60_000 },
    );
  }

  const cataloged = await loadStars();
  const procedural = generateProcedural(400);
  currentStars = cataloged.concat(procedural);

  render(currentStars);
  interval = setInterval(() => render(currentStars), 1000);
  resizeListener = () => render(currentStars);
  window.addEventListener('resize', resizeListener);
}

export function destroyStarfield() {
  if (interval) { clearInterval(interval); interval = null; }
  if (resizeListener) { window.removeEventListener('resize', resizeListener); resizeListener = null; }
  if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
  if (infoEl && infoEl.parentNode) infoEl.parentNode.removeChild(infoEl);
  rootEl = null;
  infoEl = null;
  currentStars = [];
}
