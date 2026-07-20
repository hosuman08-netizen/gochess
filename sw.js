/* Legion PWA shell gochess */
const C = 'gochess-v2';
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C).then(c => c.addAll([
      './', './index.html', './style.css',
      './script.js', './chess-pro.js', './chess-pro-ui.js', './legion-beacon.js'
    ])).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
