/**
 * sw-cache-policy — Which API responses the service worker may keep, and under which cache.
 * Pure functions shared by `src/sw.ts` and the page-side purge, so they can be unit tested.
 */

/** Every runtime cache holding API responses starts with this prefix (purged at logout). */
const API_CACHE_PREFIX = 'api-';

/**
 * Current runtime cache for API responses. The name is versioned: any older `api-*` cache
 * (including the former `api-get`, which held profiles and camera images) is deleted on activation.
 */
export const API_HISTORY_CACHE = `${API_CACHE_PREFIX}history-v1`;

/** IndexedDB database where Workbox keeps the cached URLs (entity ids, time ranges) and their dates. */
export const WORKBOX_EXPIRATION_DB = 'workbox-expiration';

/** Message posted by the page to make the service worker drop every user cache. */
export const CLEAR_USER_CACHES_MESSAGE = 'CLEAR_USER_CACHES';

/** Bounds of the API cache: old or excess entries are evicted. */
export const API_CACHE_MAX_ENTRIES = 60;
export const API_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Read-only endpoints whose data changes slowly (history, long-term statistics, usage
 * counters, energy). Everything else —
 * profile, preferences, live states, Petkit, camera and media images — never reaches
 * the service worker cache.
 */
const CACHEABLE_PATH_PREFIXES = [
  '/api/ha/history',
  '/api/ha/statistics',
  '/api/history/usage',
  '/api/enedis/',
  '/api/grdf',
  '/api/suez',
];

/**
 * Tells whether the service worker may serve this request from its API cache.
 *
 * @param url - Request URL.
 * @param method - HTTP method.
 * @param apiOrigin - Origin of the backend (other origins are never cached).
 * @returns True for a GET to an allowed backend path.
 */
export function isCacheableApiRequest(url: URL, method: string, apiOrigin: string): boolean {
  if (method !== 'GET' || url.origin !== apiOrigin) return false;
  return CACHEABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

/**
 * Tells whether a Cache Storage entry holds API (hence user) data.
 *
 * @param cacheName - Name of a Cache Storage cache.
 * @returns True for `api-*` caches.
 */
export function isUserCacheName(cacheName: string): boolean {
  return cacheName.startsWith(API_CACHE_PREFIX);
}

/**
 * Lists the API caches left by previous service worker versions.
 *
 * @param cacheNames - Every cache name currently in Cache Storage.
 * @returns The `api-*` caches other than the current one.
 */
export function obsoleteApiCaches(cacheNames: readonly string[]): string[] {
  return cacheNames.filter((name) => isUserCacheName(name) && name !== API_HISTORY_CACHE);
}
