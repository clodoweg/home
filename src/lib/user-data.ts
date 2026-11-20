/**
 * user-data — Removes every piece of user data kept on the device: at logout, and when
 * another account signs in on the same browser.
 *
 * WARNING: Security sensitive. Any new storage key or cache holding user data must be
 * covered here (prefixes below), and the theme / collapsed-widget keys must stay excluded.
 */
import type { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';
import {
  CLEAR_USER_CACHES_MESSAGE,
  WORKBOX_EXPIRATION_DB,
  isUserCacheName,
} from './sw-cache-policy';

/**
 * localStorage prefixes of user data: React Query cache, cached profile, owner marker
 * (`hsh…`) and Petkit images from older versions (`petkit_img_…`).
 * Not matched on purpose: `app-theme-preference`, `widget-collapsed-states`.
 */
const USER_STORAGE_PREFIXES = ['hsh', 'petkit_img_'] as const;

/** Keys written by older versions that nothing reads any more. */
const LEGACY_KEY_PREFIXES = ['hsh_background_token', 'petkit_img_'] as const;

/** Clerk user id the data stored on this device belongs to. */
export const CACHE_OWNER_KEY = 'hsh_cache_owner';

/**
 * Tells whether a signed-in user currently owns the data on this device. The logout purge
 * removes the owner marker, so a late write (throttled persister, in-flight request) can
 * check this and give up instead of putting user data back after the purge.
 *
 * @param storage - Storage to inspect (localStorage by default).
 * @returns True while an owner is recorded.
 */
export function isDeviceClaimed(storage: Storage = window.localStorage): boolean {
  try {
    return storage.getItem(CACHE_OWNER_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Wraps a storage so that writes are dropped once the device is no longer claimed.
 *
 * @param storage - Underlying storage.
 * @returns A storage-like object for persisters.
 */
export function ownerGuardedStorage(
  storage: Storage,
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => {
      if (isDeviceClaimed(storage)) storage.setItem(key, value);
    },
    removeItem: (key) => storage.removeItem(key),
  };
}

const keysMatching = (storage: Storage, prefixes: readonly string[]): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
  }
  return keys;
};

const removeKeys = (storage: Storage, prefixes: readonly string[]): void => {
  try {
    keysMatching(storage, prefixes).forEach((key) => storage.removeItem(key));
  } catch (error) {
    logger.error('[user-data] Failed to clear localStorage', error);
  }
};

/**
 * Removes the user data kept in localStorage.
 *
 * @param storage - Storage to clean (localStorage by default).
 */
export function clearUserStorage(storage: Storage = window.localStorage): void {
  removeKeys(storage, USER_STORAGE_PREFIXES);
}

/**
 * Deletes the API caches of the service worker and Workbox's expiration database, from the
 * page and through the worker itself (which may be writing to them at the same time).
 *
 * @param cacheStorage - Cache Storage (undefined when the browser has none).
 * @param serviceWorker - Service worker container (undefined when unsupported).
 * @returns Resolves once the page-side deletion is done.
 */
export async function clearUserCaches(
  cacheStorage: CacheStorage | undefined = globalThis.caches,
  serviceWorker: ServiceWorkerContainer | undefined = globalThis.navigator?.serviceWorker,
): Promise<void> {
  serviceWorker?.controller?.postMessage({ type: CLEAR_USER_CACHES_MESSAGE });
  try {
    globalThis.indexedDB?.deleteDatabase(WORKBOX_EXPIRATION_DB);
  } catch (error) {
    logger.error('[user-data] Failed to delete the Workbox expiration database', error);
  }
  if (!cacheStorage) return;
  try {
    const names = await cacheStorage.keys();
    await Promise.all(names.filter(isUserCacheName).map((name) => cacheStorage.delete(name)));
  } catch (error) {
    logger.error('[user-data] Failed to clear Cache Storage', error);
  }
}

/**
 * Logout: drops the in-memory query cache, the persisted one, the cached profile and
 * the service worker API caches.
 *
 * @param queryClient - The app query client.
 * @returns Resolves once every store is cleared.
 */
export async function purgeUserData(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  clearUserStorage();
  await clearUserCaches();
}

/**
 * Sign-in: unless the data on this device is known to belong to this account, wipes it
 * before anything is shown or restored; then records the current owner. Data without an
 * owner marker (written by an older version) is treated as foreign. Also removes legacy keys.
 *
 * @param userId - Clerk id of the signed-in user.
 * @param storage - Storage to inspect (localStorage by default).
 * @returns True when the stored data was wiped.
 */
export function claimDeviceForUser(
  userId: string,
  storage: Storage = window.localStorage,
): boolean {
  removeKeys(storage, LEGACY_KEY_PREFIXES);
  let previousOwner: string | null;
  try {
    previousOwner = storage.getItem(CACHE_OWNER_KEY);
  } catch {
    previousOwner = null;
  }
  const isOwnedByUser = previousOwner === userId;
  if (!isOwnedByUser) {
    clearUserStorage(storage);
    void clearUserCaches();
  }
  try {
    storage.setItem(CACHE_OWNER_KEY, userId);
  } catch (error) {
    logger.error('[user-data] Failed to record cache owner', error);
  }
  return !isOwnedByUser;
}
