/**
 * ═══════════════════════════════════════════════════════════════
 *  SERVICE WORKER — Trivia Seguridad e Higiene
 *  CD Esteban Echeverría
 *
 *  ⚠️ IMPORTANTE: Incrementar CACHE_VERSION en cada subida a GitHub
 *  para forzar que los browsers descarguen los archivos nuevos.
 *  Ejemplo: v1 → v2 → v3...
 * ═══════════════════════════════════════════════════════════════
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `trivia-sh-${CACHE_VERSION}`;

// Archivos a cachear para uso offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Nunito:wght@300;400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// ── INSTALL: cachea los archivos estáticos ──
self.addEventListener('install', event => {
  console.log(`[SW] Instalando versión ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando assets...');
        // Cachear uno por uno para que un fallo no rompa todo
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] No se pudo cachear ${url}:`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: elimina caches viejos ──
self.addEventListener('activate', event => {
  console.log(`[SW] Activando versión ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('trivia-sh-') && name !== CACHE_NAME)
            .map(name => {
              console.log(`[SW] Eliminando cache viejo: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia Network-first con fallback a cache ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Dejar pasar siempre las llamadas al GAS (Google Apps Script)
  if (url.hostname === 'script.google.com') {
    return; // No interceptar — el GAS necesita red
  }

  // Para Google Fonts y CDN: Cache-first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com'
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Para archivos locales: Network-first, fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar respuesta fresca en cache
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red → usar cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback final: página principal
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
