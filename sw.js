// ArabiHamod service worker
// Bump these version strings whenever index.html's cached assets change,
// to force browsers to fetch the new versions instead of stale cache.
var SHELL_CACHE = 'arabihamod-shell-v2';
var VIDEO_CACHE = 'arabihamod-videos-v1';

var SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './icons/header-logo.png',
  './icons/avatar-96.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== VIDEO_CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // let cross-origin (fonts) pass through untouched

  // The SPA shell: always try network first (to pick up new deploys), fall back to cache offline.
  if (req.mode === 'navigate' || url.pathname === '' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // The video list: network-first so "Update" can discover newly added videos,
  // falling back to the last known copy when offline.
  if (url.pathname.endsWith('videos-index.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // A single video's data: cache the first time it's opened, then serve
  // instantly (and offline) every time after.
  if (url.pathname.indexOf('/videos/') !== -1 && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VIDEO_CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // Everything else same-origin (icons, etc.): cache-first, then network.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
