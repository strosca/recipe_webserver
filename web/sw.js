/* Service Worker: „Netz zuerst, Cache als Rückfallebene“ – mit Zeitlimit.
 *
 * - Wird nur in sicheren Kontexten registriert (https:// oder localhost), so verlangen es die Browser.
 * - Jede erfolgreiche Antwort landet im Cache. Ist der Server nicht erreichbar oder antwortet er nicht
 *   innerhalb von NETWORK_TIMEOUT_MS (Funkloch im Supermarkt), kommt die gespeicherte Version.
 * - Antworten aus dem Cache tragen den Header „X-Rezepte-Offline: 1“, damit die App „Offline“ anzeigen kann.
 */
const CACHE = 'rezepte-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png'];
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Rezeptdaten gleich mitnehmen – die erste Seite lädt sie, bevor der Service Worker aktiv ist.
    await cache.add('rezepte.json').catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event, req));
});

async function networkFirst(event, req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil(cache.put(req, copy));
    }
    return res;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('index.html')) : undefined);
    if (hit) return markOffline(hit);
    return network; // nichts im Cache → weiter aufs Netz warten (oder dessen Fehler durchreichen)
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function markOffline(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Rezepte-Offline', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
