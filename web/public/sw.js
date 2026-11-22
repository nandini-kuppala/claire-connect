/* CLAIRE Connect service worker: offline cold start for the app shell (slice 9 follow-up).
 *
 * What it caches
 * - The page shell (index.html): network first, the cached copy when offline. Every in-app navigation gets the same
 *   shell (single-page app), so one visit is enough to open any screen with no network.
 * - Hashed build files under /assets/: cache first (a file name changes whenever its content does). The build
 *   (web/vite.config.ts, plugin "sw-manifest") writes the build id and the list of shell + Goods chunks to precache
 *   into the line below; language overlays and the call SDK are cached the first time they load.
 * - Icons and other files from web/public: stale-while-revalidate.
 * - Google Fonts (CSS + font files): their own cache, kept across deploys.
 *
 * What it never caches: /api/*, /l/* (statement pages), /uploads/*, and any non-GET request. Offline data (lists
 * and the outbox) is handled by web/src/lib/offline.ts in IndexedDB, not here.
 *
 * Updates: a new build changes this file (the build id), so the browser installs the new worker; it takes over at
 * once and deletes the caches of older builds.
 */
/*__SW_MANIFEST__*/
const BUILD = self.__SW_BUILD__ || 'dev';
const PRECACHE = self.__SW_PRECACHE__ || [];
const PREFIX = 'cc-shell-';
const SHELL = PREFIX + BUILD;
const FONTS = 'cc-fonts-v1';
const INDEX = '/index.html';
const NEVER = /^\/(api|l|uploads)(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // The shell must be there for offline cold start; a failed asset is fetched again on first use.
      const index = await fetch(INDEX, { cache: 'no-cache' });
      if (index.ok) await cache.put(INDEX, index);
      await Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('cc-') && k !== SHELL && k !== FONTS).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    // Only a real HTML page becomes the offline shell (not an error page or a redirect).
    if (res.status === 200 && (res.headers.get('content-type') || '').includes('text/html')) {
      await cache.put(INDEX, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(INDEX);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') await cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName, refetch) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  const fresh = fetch(refetch || request)
    .then(async (res) => {
      if (res.ok) await cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (cached) return cached;
  return (await fresh) || Response.error();
}

// Google Fonts serves one @font-face block per family and script subset ("/* latin */", "/* tamil */" …). On the
// first visit the font files load before this worker controls the page, so it fetches the ones the UI needs: Latin
// for the two UI families and the page language's own script for every family. Later visits cache whatever loads.
const SCRIPT = { ta: 'tamil', hi: 'devanagari', mr: 'devanagari', te: 'telugu', kn: 'kannada', ml: 'malayalam', bn: 'bengali', or: 'oriya', gu: 'gujarati' };
async function warmFonts(cssText, lang) {
  const script = SCRIPT[String(lang || '').slice(0, 2)];
  const urls = new Set();
  for (const block of cssText.split('/* ').slice(1)) {
    const subset = block.slice(0, block.indexOf(' */'));
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1] || '';
    const src = (block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/) || [])[1];
    if (src && ((subset === 'latin' && /^(Figtree|Bricolage Grotesque)$/.test(family)) || (script && subset === script))) urls.add(src);
  }
  const cache = await caches.open(FONTS);
  await Promise.all(
    [...urls].map(async (u) => {
      if (await cache.match(u)) return;
      const res = await fetch(u, { mode: 'cors', credentials: 'omit' }).catch(() => undefined);
      if (res && res.ok) await cache.put(u, res);
    }),
  );
}

// The page loads before this worker controls it, so on the first visit it sends the files it already loaded (the
// fonts stylesheet, its language overlay) and its language; only build files from this origin and Google Fonts are
// accepted.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'cc-warm' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    Promise.all(
      data.urls.slice(0, 200).map(async (u) => {
        let url;
        try { url = new URL(u); } catch { return; }
        const own = url.origin === self.location.origin && url.pathname.startsWith('/assets/');
        const font = url.protocol === 'https:' && (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com');
        if (!own && !font) return;
        const cache = await caches.open(own ? SHELL : FONTS);
        let res = await cache.match(url.href, { ignoreVary: true });
        if (!res) {
          res = await fetch(url.href, own ? undefined : { mode: 'cors', credentials: 'omit' }).catch(() => undefined);
          if (!res || !res.ok) return;
          await cache.put(url.href, res.clone());
        }
        if (url.hostname === 'fonts.googleapis.com') await warmFonts(await res.text(), data.lang);
      }),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (NEVER.test(url.pathname)) return; // API, statement pages, uploads: straight to the network
    if (url.pathname === '/sw.js') return;
    if (request.mode === 'navigate') {
      event.respondWith(networkFirstShell(request));
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, SHELL));
      return;
    }
    if (url.search === '') event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }

  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com') {
    // The stylesheet <link> is a no-cors request; fetch it with CORS so the cached copy is readable (not opaque).
    event.respondWith(staleWhileRevalidate(request, FONTS, new Request(request.url, { mode: 'cors', credentials: 'omit' })));
  }
});
