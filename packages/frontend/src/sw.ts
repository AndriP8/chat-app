/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

interface SyncEvent extends ExtendableEvent {
  tag: string;
  lastChance: boolean;
}

declare const self: ServiceWorkerGlobalScope;

// self.__WB_MANIFEST is default injection point
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

clientsClaim();

registerRoute(
  ({ request, url }: { request: Request; url: URL }) =>
    request.mode === 'navigate' &&
    !url.pathname.startsWith('/ws') &&
    !url.pathname.startsWith('/api'),
  createHandlerBoundToURL('index.html')
);

registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === 'sync-messages') {
    syncEvent.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_MESSAGES',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[Service Worker] Error during background sync:', error);
    throw error;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled promise rejection:', event.reason);
});
