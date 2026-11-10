/* Офлайн. При изменении файлов меняйте номер версии. */
const VERSION = 'tasbih-v3';
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
  const own = url.origin === location.origin;
  if (!own && !font) return;
  const put = (res) => {
    if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  };
  const cached = () => caches.match(e.request, { ignoreSearch: own });
  /* код и страница: сначала сеть (чтобы обновления приходили сразу), без сети — из кэша */
  if (own && !/\.(webp|png|jpg)$/.test(url.pathname)) {
    e.respondWith(fetch(e.request).then(put).catch(() => cached().then((hit) => hit || caches.match('index.html'))));
    return;
  }
  /* картинки и шрифты: сначала кэш */
  e.respondWith(cached().then((hit) => hit || fetch(e.request).then(put)));
});
