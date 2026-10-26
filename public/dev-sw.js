// Lightweight pass-through Service Worker for development preview (no HMR dependencies)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Network pass-through to satisfy PWA installability criteria without intercepting dev streams
});
