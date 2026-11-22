/* Service Worker – Matchday & Taktik Pro (Offline-App)
   Strategie: Seite zuerst aus dem Netz (damit Updates sofort ankommen), bei fehlender
   Verbindung aus dem Zwischenspeicher. Fremde Adressen (Microsoft-Anmeldung, Graph,
   SharePoint) werden nie angefasst. Bei neuer Version CACHE hochzählen. */
const CACHE = 'matchday-v54';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('matchday-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // nur eigene Dateien
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await Promise.race([
        fetch(isPage ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), isPage ? 4000 : 8000))
      ]);
      if (fresh && fresh.ok) {
        // Seiten unter fester Adresse ablegen (Anmelde-Parameter ?code=… nicht mitspeichern)
        const key = isPage ? new Request(new URL('./index.html', self.registration.scope).href) : req;
        cache.put(key, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) ||
                  (isPage ? await cache.match('./index.html') : null);
      if (hit) return hit;
      return new Response('Offline – diese Datei ist nicht zwischengespeichert.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
