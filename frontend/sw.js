/**
 * Service Worker para modasnancy PWA
 * Estrategias:
 * - Cache-First: CSS, JS, fuentes, iconos
 * - Network-First: /api/products (catálogo)
 * - Stale-While-Revalidate: HTML
 */

const CACHE_NAME = 'modasnancy-cache-v20';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/producto.html',
  '/carrito.html',
  '/checkout.html',
  '/live.html',
  '/instalar.html',
  '/offline.html',
  '/css/theme-tokens.css',
  '/css/style.css',
  '/css/home.css',
  '/css/admin-theme.css',
  '/css/admin-dashboard.css',
  '/js/config.js',
  '/js/api.js',
  '/js/cart.js',
  '/js/ui.js',
  '/js/home.js',
  '/js/live.js',
  '/js/pwa.js',
  '/js/guatemala-data.js',
  '/js/menu-drawer.js',
  '/manifest.json',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/brand/logo.png',
  '/assets/brand/favicon.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

const API_CACHE_NAME = 'modasnancy-api-cache-v2';
const API_ROUTES = ['/api/products'];

// Instalacion: precachear assets estaticos
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.warn('[SW] Precache parcial:', err);
    })
  );
});

// Activacion: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: estrategias por tipo de request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests no GET
  if (request.method !== 'GET') return;

  // Ignorar chrome-extension y analytics
  if (url.protocol === 'chrome-extension:') return;

  // Estrategia 1: API /api/products → Network-First con fallback a cache
  if (API_ROUTES.some((route) => url.pathname === route)) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
    return;
  }

  // Estrategia 2: Assets estaticos (CSS, JS, fuentes, iconos, imagenes de brand) → Cache-First
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Estrategia 3: HTML → Stale-While-Revalidate
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  // Default: network con fallback a cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((res) => res || caches.match('/offline.html')))
  );
});

// ── Estrategias ────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return cached || new Response('Recurso no disponible offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Sin conexion', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ── Mensajes desde la app (ej: skip waiting) ───────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
