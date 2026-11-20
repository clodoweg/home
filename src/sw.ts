/// <reference lib="webworker" />
/**
 * sw.ts — PWA Service Worker (Workbox precache + bounded API runtime cache).
 *
 * - Precache : assets du build (JS, CSS, icônes).
 * - Cache API : StaleWhileRevalidate pour les seules lectures lentes du back (historiques,
 *   énergie), bornée en nombre et en âge. Profil, préférences, états temps réel, Petkit et
 *   images ne passent jamais par ce cache (cf. lib/sw-cache-policy).
 * - Purge : la page envoie CLEAR_USER_CACHES au logout ; les caches `api-*` d'anciennes
 *   versions sont supprimés à l'activation.
 * - Alertes (admins) : un push affiche une notification et prévient les fenêtres ouvertes (la
 *   cloche se met à jour) ; un clic ouvre l'appli sur le widget concerné.
 * - Mise à jour : skipWaiting + clientsClaim, pour qu'un correctif s'applique sans attendre
 *   la fermeture de toutes les fenêtres de la PWA.
 */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { resolveApiUrl } from './constants/api';
import { PUSH_RECEIVED_MESSAGE, alertHref, parseAlertPush } from './lib/alert-notifications';
import {
  API_CACHE_MAX_AGE_SECONDS,
  API_CACHE_MAX_ENTRIES,
  API_HISTORY_CACHE,
  CLEAR_USER_CACHES_MESSAGE,
  WORKBOX_EXPIRATION_DB,
  isCacheableApiRequest,
  isUserCacheName,
  obsoleteApiCaches,
} from './lib/sw-cache-policy';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const apiOrigin = new URL(resolveApiUrl(import.meta.env.VITE_API_URL)).origin;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url, request }) => isCacheableApiRequest(url, request.method, apiOrigin),
  new StaleWhileRevalidate({
    cacheName: API_HISTORY_CACHE,
    plugins: [
      // Only real 200s: never an opaque or error response.
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: API_CACHE_MAX_ENTRIES,
        maxAgeSeconds: API_CACHE_MAX_AGE_SECONDS,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

const deleteCaches = async (names: string[]) => {
  await Promise.all(names.map((name) => caches.delete(name)));
};

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => deleteCaches(obsoleteApiCaches(names))));
});

const deleteExpirationDb = () =>
  new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(WORKBOX_EXPIRATION_DB);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });

self.addEventListener('message', (event) => {
  if (event.data?.type === CLEAR_USER_CACHES_MESSAGE) {
    event.waitUntil(
      Promise.all([
        caches.keys().then((names) => deleteCaches(names.filter(isUserCacheName))),
        deleteExpirationDb(),
      ]),
    );
  }
});

const readPushPayload = (event: PushEvent): unknown => {
  try {
    return event.data?.json();
  } catch {
    return null;
  }
};

self.addEventListener('push', (event) => {
  const alert = parseAlertPush(readPushPayload(event));
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(alert.title, {
        body: alert.body,
        // One notification per alert: a repeated delivery replaces it instead of piling up.
        tag: alert.id === null ? undefined : `alert-${alert.id}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { category: alert.category },
      }),
      self.clients
        .matchAll({ type: 'window' })
        .then((windows) =>
          windows.forEach((client) => client.postMessage({ type: PUSH_RECEIVED_MESSAGE })),
        ),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const category = (event.notification.data as { category?: string } | null)?.category ?? '';
  const url = new URL(`/${alertHref(category)}`, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows[0];
      if (open) {
        // Navigating to a new hash keeps the page: no reload, the dashboard follows the hash.
        await open.navigate(url).catch(() => undefined);
        await open.focus();
        return;
      }
      await self.clients.openWindow(url);
    }),
  );
});
