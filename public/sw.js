/*
 * musicbox service worker.
 *
 * Deliberately narrow: it caches the application shell and the artwork the
 * catalogues publish for public display. Audio streams are NEVER cached —
 * storing a copy of a track would be an offline copy, which only some rights
 * holders grant, so the app does not do it at all.
 */
const VERSION = 'musicbox-v1';
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-images`;
const MAX_IMAGES = 150;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Audio: always straight to the network, never stored.
  if (request.destination === 'audio' || /\.(mp3|ogg|flac|m4a|wav)(\?|$)/i.test(url.pathname)) return;

  // API responses are cached in memory by the app itself; keep them fresh here.
  if (url.hostname.endsWith('jamendo.com') || url.hostname.endsWith('archive.org')) {
    if (request.destination === 'image') {
      event.respondWith(
        caches.open(IMAGES).then(async (cache) => {
          const hit = await cache.match(request);
          if (hit) return hit;
          const res = await fetch(request);
          if (res.ok) {
            await cache.put(request, res.clone());
            void trimCache(IMAGES, MAX_IMAGES);
          }
          return res;
        }),
      );
    }
    return;
  }

  // App shell: network first for navigations so deploys land immediately,
  // cache as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r ?? Response.error())),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              void caches.open(SHELL).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
