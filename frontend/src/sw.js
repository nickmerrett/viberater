import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// AI calls are always network-only — no point caching LLM responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/ai') || url.pathname.startsWith('/api/capture'),
  new NetworkOnly()
);

// All other API calls: try network first, fall back to cache for up to 5 minutes
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Background Sync: browser fires this when connectivity is restored,
// even if the tab was closed. We just tell any open clients to run their
// sync queue — auth tokens live in the page, not the SW.
self.addEventListener('sync', (event) => {
  if (event.tag === 'viberater-sync') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clients.length > 0) {
    clients.forEach(client => client.postMessage({ type: 'BACKGROUND_SYNC' }));
  }
  // If no clients are open the browser will re-open the app (on Android) — handled by the sync tag
}
