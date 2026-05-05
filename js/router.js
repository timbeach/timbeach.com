// js/router.js — hash-based router. Routes:
//   #/                 → home
//   #/article/<slug>   → article reading view
//   #/music            → music page
//   #/about            → about page
// Legacy redirect:
//   #articles/<slug>.md → #/article/<slug>

const handlers = new Map();

export function registerRoute(name, handler) {
  handlers.set(name, handler);
}

function parseHash(hash) {
  // Legacy form: #articles/<slug>.md
  const legacy = hash.match(/^#articles\/(.+)\.md$/);
  if (legacy) {
    const newHash = `#/article/${legacy[1]}`;
    // Replace the URL silently so back-button history isn't polluted.
    history.replaceState(null, '', newHash);
    return { route: 'article', slug: legacy[1] };
  }

  if (hash === '' || hash === '#' || hash === '#/') return { route: 'home' };

  const article = hash.match(/^#\/article\/(.+)$/);
  if (article) return { route: 'article', slug: article[1] };

  if (hash === '#/music') return { route: 'music' };
  if (hash === '#/about') return { route: 'about' };

  return { route: '404' };
}

function dispatch() {
  const parsed = parseHash(location.hash);
  const handler = handlers.get(parsed.route) || handlers.get('404');
  if (handler) {
    Promise.resolve(handler(parsed)).catch((err) => {
      console.error('[router] handler error:', err);
      const main = document.getElementById('app');
      if (main) {
        main.innerHTML = `<p class="meta">Something went wrong. Try refreshing.</p>`;
      }
    });
  }
  updateActiveNav(parsed.route);
  window.scrollTo(0, 0);
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav a[data-nav]').forEach((a) => {
    const navKey = a.getAttribute('data-nav');
    const matches =
      (navKey === 'home'  && (route === 'home' || route === 'article')) ||
      (navKey === 'music' && route === 'music') ||
      (navKey === 'about' && route === 'about');
    a.classList.toggle('active', matches);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}
