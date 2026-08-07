/* Service worker: hace que la app abra sin internet y que abra RÁPIDO.
   Las llamadas /api nunca pasan por aquí: las ventas offline se encolan en la
   app (js/api.js), que es quien sabe cuáles ya subieron y cuáles no. */
const CACHE = 'polleria-v8';
const ARCHIVOS = [
  '/', '/index.html', '/css/app.css', '/js/temas.js', '/js/api.js', '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png?v=2', '/icons/icon-512.png?v=2', '/icons/icon-maskable-512.png?v=2',
  '/icons/apple-touch-icon.png?v=2', '/icons/favicon-32.png?v=2', '/icons/favicon-64.png?v=2',
  '/icons/logo.svg?v=2', '/icons/logo-horizontal.svg?v=2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll falla entero si un archivo falla; así se guarda lo que sí se pueda.
      .then((c) => Promise.all(ARCHIVOS.map((f) => c.add(f).catch(() => null))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const llaves = await caches.keys();
    const habiaVersionVieja = llaves.some((k) => k.startsWith('polleria-') && k !== CACHE);
    await Promise.all(llaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    // Si esto fue una actualización (no la primera instalación), se avisa a la
    // app: la pestaña abierta todavía tiene el código viejo en memoria.
    if (habiaVersionVieja) {
      const clientes = await self.clients.matchAll({ type: 'window' });
      for (const c of clientes) c.postMessage({ tipo: 'actualizado' });
    }
  })());
});

/** Red con cronómetro: si el wifi del local está "presente pero muerto",
    no se queda esperando; tira de la caché y la app abre igual. */
function redConLimite(req, ms) {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error('lenta')), ms);
    fetch(req).then((r) => { clearTimeout(reloj); resolve(r); },
                    (e) => { clearTimeout(reloj); reject(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api')) return; // API siempre a la red

  // Abrir la app: se intenta la red 4 s (para recibir actualizaciones) y si no,
  // el cascarón guardado.
  if (req.mode === 'navigate') {
    e.respondWith(
      redConLimite(req, 4000)
        .then((r) => { caches.open(CACHE).then((c) => c.put('/index.html', r.clone())); return r; })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }

  // Estáticos: se responde YA con lo guardado y se actualiza por detrás. Es lo
  // que quita el "lag" de arranque en redes malas.
  e.respondWith(
    caches.match(req).then((guardado) => {
      const enRed = fetch(req).then((r) => {
        if (r && r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
        return r;
      }).catch(() => guardado);
      return guardado || enRed;
    }));
});
