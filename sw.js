// Service worker de Cinc: guarda los archivos de la página para que
// abra aunque no haya conexión. Los datos de la hoja NO se guardan aquí
// (las peticiones a Google pasan de largo).

const CACHE = 'cinc-v2';

const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
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
  const esDatos = url.pathname.endsWith('datos-ejemplo.json');

  if (evento.request.method !== 'GET' || !esDeEstaWeb || esDatos) return;

  evento.respondWith(
    fetch(evento.request)
      .then(respuesta => {
        const copia = respuesta.clone();
        caches.open(CACHE).then(cache => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request))
  );
});
