/* Офлайн: при изменении файлов поменяйте номер версии, чтобы телефон скачал новое. */
const VERSION = 'tasbih-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'js/data.js', 'js/engine.js', 'js/app.js', 'manifest.webmanifest',
  'img/icons/icon-180.png', 'img/icons/icon-192.png', 'img/icons/icon-512.png',
  ...['forest', 'falls', 'alpine', 'orchard', 'desert', 'sea', 'sakura', 'mosque', 'aurora', 'dawn', 'dusk'].map((n) => `img/bg/${n}.webp`)
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.origin === location.origin }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
