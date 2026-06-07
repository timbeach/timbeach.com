// js/counter.js — fetch the site view count and render it in the footer.
// Fails silently (badge stays hidden) so the page degrades gracefully when
// the /count.php endpoint is unavailable.
export async function initCounter() {
  const el = document.getElementById('site-counter');
  if (!el) return;
  try {
    const res = await fetch('/count.php');
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.total !== 'number') return;
    el.textContent = `👁 ${data.total.toLocaleString()} views`;
    el.hidden = false;
  } catch (err) {
    console.debug('[counter] unavailable', err);
  }
}
