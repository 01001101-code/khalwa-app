/* ============================================================
   KHALWA SERVICE WORKER v4.0
   - Static cache: app shell + JS modules
   - API cache: network-first with offline fallback
   - Skip-waiting for fast updates
   ============================================================ */
const V = 'khalwa-v5-shell';
const API_V = 'khalwa-v5-api';

// نطاقات بث الراديو المباشر — يجب ألا يتدخل الـ Service Worker في طلباتها
// أبداً (لا cache ولا أي معالجة)، لأن البث صوتي مستمر (يبقى مفتوحاً بلا
// نهاية) وأي تغليف له بمنطق الكاش يكسره أو يجعله غير مستقر، وهذا يظهر
// بوضوح على الهاتف (حيث الـ SW يكون فعّالاً عند تشغيل التطبيق كموقع/تطبيق
// مثبّت عبر HTTPS) بعكس فتح الملف مباشرة على اللابتوب (file://) حيث لا
// يُسجَّل الـ Service Worker أصلاً فلا يتأثر البث
const STREAM_HOSTS = ['radiojar.com', 'qurango.net', 'allorigins.win'];
const STATIC = [
  './',
  './index.html',
  './css/app.css',
  './js/data.js',
  './js/companions.js',
  './js/fiqh.js',
  './js/adhkar.js',
  './js/api.js',
  './js/storage.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c =>
    Promise.allSettled(STATIC.map(a => c.add(a).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== V && k !== API_V).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // لا تتدخل أبداً في طلبات بث الراديو المباشر أو أي عنصر صوتي — اتركها
  // تذهب مباشرة للشبكة بدون أي اعتراض من Service Worker (هذا أهم تعديل
  // لإصلاح عدم عمل الراديو على الهاتف)
  const isStream = STREAM_HOSTS.some(h => url.hostname.includes(h)) ||
                   e.request.destination === 'audio';
  if (isStream) return;

  const isAPI = url.hostname.includes('alquran.cloud') ||
                url.hostname.includes('aladhan.com') ||
                url.hostname.includes('islamic.network') ||
                url.hostname.includes('nominatim') ||
                url.hostname.includes('openstreetmap');

  // Only handle GET
  if (e.request.method !== 'GET') return;

  e.respondWith(isAPI ? networkFirst(e.request) : cacheFirst(e.request));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
      (await caches.open(V)).put(req, res.clone());
    }
    return res;
  } catch {
    // Offline fallback for HTML pages
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(API_V)).put(req, res.clone());
    return res;
  } catch {
    const hit = await caches.match(req);
    if (hit) return hit;
    return new Response('{"error":"offline"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(d.title || 'خُلوة', {
    body: d.body || 'حان وقت خلوتك مع الله',
    icon: './favicon.svg', dir: 'rtl', lang: 'ar', tag: 'khalwa',
    vibrate: [100, 50, 100]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cls => {
    for (const c of cls) {
      if ('focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
