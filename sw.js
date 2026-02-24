/**
 * Service Worker — 律師計時管理系統
 * 策略：Cache-First（靜態資源）
 */

const CACHE_NAME = 'lawyer-timer-v1';

// 需要預先快取的靜態資源
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// ── 安裝事件：預快取靜態資源 ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // 立即啟用新版 SW
  );
});

// ── 啟用事件：清除舊版快取 ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())  // 立即接管所有頁面
  );
});

// ── Fetch 事件：Cache-First，無快取則回 Network ───────────
self.addEventListener('fetch', event => {
  // 只處理 GET 請求；POST（Google Apps Script）讓它直接走網路
  if (event.request.method !== 'GET') return;

  // Google Apps Script API 呼叫直接走網路，不快取
  const url = event.request.url;
  if (url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        // 未快取：從網路取得並存入快取
        return fetch(event.request)
          .then(response => {
            // 只快取成功的 200 回應，且不快取 chrome-extension://
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => {
            // 離線且無快取：若請求 HTML，回傳 index.html
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
