// Service worker de Cinc: guarda los archivos de la página para que
// abra aunque no haya conexión.

const CACHE = 'cinc-v30';

const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
  'calculos.js',
  'app.js',
  'manifest.webmanifest',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Al instalar: guardar los archivos
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

// Al activar: borrar cachés de versiones anteriores
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(nombres =>
      Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Primero la red (para tener siempre la última versión);
// si no hay conexión, lo que haya en la caché.
self.addEventListener('fetch', evento => {
  const url = new URL(evento.request.url);
  const esDeEstaWeb = url.origin === self.location.origin;

  if (evento.request.method !== 'GET' || !esDeEstaWeb) return;

  evento.respondWith(
    // «no-cache»: pregunta siempre al servidor si hay versión nueva, en vez de
    // fiarse de la copia que guarda el navegador por su cuenta
    fetch(evento.request, { cache: 'no-cache' })
      .then(respuesta => {
        // Si el servidor da error (por ejemplo un 404 mientras GitHub publica),
        // no se guarda y se usa la copia que ya había
        if (!respuesta.ok) {
          return caches.match(evento.request).then(guardada => guardada || respuesta);
        }
        const copia = respuesta.clone();
        caches.open(CACHE).then(cache => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request))
  );
});
