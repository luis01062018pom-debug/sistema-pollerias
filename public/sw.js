/* Service worker: cachea el cascarón de la app para que abra sin internet.
   Las llamadas /api van siempre a la red (las ventas offline se encolan en la app). */
const CACHE = 'polleria-v2';
const ARCHIVOS = [
  '/', '/index.html', '/css/app.css', '/js/api.js', '/js/app.js',
  '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api')) return; // API siempre a la red

  // Estáticos: red primero (para recibir actualizaciones), caché si no hay internet
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
