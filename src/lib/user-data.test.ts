/** user-data tests — logout purge and account switch on a shared device. */
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLEAR_USER_CACHES_MESSAGE } from './sw-cache-policy';
import {
  CACHE_OWNER_KEY,
  claimDeviceForUser,
  clearUserCaches,
  clearUserStorage,
  purgeUserData,
} from './user-data';

const USER_KEYS = {
  'hsh-react-query-cache': '{"clientState":{}}',
  hsh_cached_profile: '{"email":"a@b"}',
  hsh_background_token: 'eyJ.jwt.sig',
  [CACHE_OWNER_KEY]: 'user_a',
  petkit_img_123: 'data:image/png;base64,AAAA',
};
const UI_KEYS = { 'app-theme-preference': 'light', 'widget-collapsed-states': '{"lights":true}' };

const seed = (entries: Record<string, string>) =>
  Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value));

const storedKeys = () => Object.keys({ ...localStorage }).sort();

/** In-memory Cache Storage double. */
const fakeCacheStorage = (names: string[]) => {
  const existing = new Set(names);
  return {
    keys: vi.fn(async () => [...existing]),
    delete: vi.fn(async (name: string) => existing.delete(name)),
    remaining: () => [...existing],
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearUserStorage', () => {
  it('removes user data and keeps the UI preferences', () => {
    seed({ ...USER_KEYS, ...UI_KEYS });
    clearUserStorage();
    expect(storedKeys()).toEqual(Object.keys(UI_KEYS).sort());
  });

  it('does not throw when the storage is unusable', () => {
    const broken = {
      get length(): number {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(() => clearUserStorage(broken)).not.toThrow();
  });
});

describe('clearUserCaches', () => {
  it('deletes the api-* caches, keeps the precache and notifies the service worker', async () => {
    const cacheStorage = fakeCacheStorage(['api-get', 'api-history-v1', 'workbox-precache-v2']);
    const postMessage = vi.fn();
    const serviceWorker = { controller: { postMessage } } as unknown as ServiceWorkerContainer;

    await clearUserCaches(cacheStorage as unknown as CacheStorage, serviceWorker);

    expect(cacheStorage.remaining()).toEqual(['workbox-precache-v2']);
    expect(postMessage).toHaveBeenCalledWith({ type: CLEAR_USER_CACHES_MESSAGE });
  });

  it('copes with a browser without Cache Storage nor service worker', async () => {
    await expect(clearUserCaches(undefined, undefined)).resolves.toBeUndefined();
  });

  it('does not throw when Cache Storage fails', async () => {
    const failing = { keys: vi.fn().mockRejectedValue(new Error('denied')) };
    await expect(
      clearUserCaches(failing as unknown as CacheStorage, undefined),
    ).resolves.toBeUndefined();
  });
});

describe('purgeUserData', () => {
  it('empties the query cache, the user storage and the API caches', async () => {
    const cacheStorage = fakeCacheStorage(['api-history-v1']);
    vi.stubGlobal('caches', cacheStorage);
    seed({ ...USER_KEYS, ...UI_KEYS });
    const queryClient = new QueryClient();
    queryClient.setQueryData(['ha', 'states'], [{ entity_id: 'light.salon' }]);

    await purgeUserData(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storedKeys()).toEqual(Object.keys(UI_KEYS).sort());
    expect(cacheStorage.remaining()).toEqual([]);
  });
});

describe('claimDeviceForUser', () => {
  it('keeps the data of the same user and drops legacy keys', () => {
    seed({ ...USER_KEYS, ...UI_KEYS });
    vi.stubGlobal('caches', fakeCacheStorage([]));

    expect(claimDeviceForUser('user_a')).toBe(false);

    expect(localStorage.getItem('hsh_cached_profile')).toBe(USER_KEYS.hsh_cached_profile);
    expect(localStorage.getItem('hsh_background_token')).toBeNull();
    expect(localStorage.getItem('petkit_img_123')).toBeNull();
  });

  it("wipes another account's data before recording the new owner", async () => {
    seed({ ...USER_KEYS, ...UI_KEYS });
    const cacheStorage = fakeCacheStorage(['api-history-v1']);
    vi.stubGlobal('caches', cacheStorage);

    expect(claimDeviceForUser('user_b')).toBe(true);

    expect(localStorage.getItem('hsh-react-query-cache')).toBeNull();
    expect(localStorage.getItem('hsh_cached_profile')).toBeNull();
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe('user_b');
    expect(localStorage.getItem('app-theme-preference')).toBe('light');
    await vi.waitFor(() => expect(cacheStorage.delete).toHaveBeenCalledWith('api-history-v1'));
  });

  it('treats data without an owner marker (older version) as foreign', () => {
    seed({ 'hsh-react-query-cache': '{}', hsh_cached_profile: '{}' });
    vi.stubGlobal('caches', fakeCacheStorage([]));

    expect(claimDeviceForUser('user_a')).toBe(true);

    expect(storedKeys()).toEqual([CACHE_OWNER_KEY]);
  });

  it('does not throw when the storage refuses reads and writes', () => {
    vi.stubGlobal('caches', fakeCacheStorage([]));
    const locked = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    } as unknown as Storage;

    expect(claimDeviceForUser('user_a', locked)).toBe(true);
  });
});

describe('ownerGuardedStorage', () => {
  it('writes while the device is claimed and drops writes after the purge', async () => {
    const { isDeviceClaimed, ownerGuardedStorage } = await import('./user-data');
    const guarded = ownerGuardedStorage(localStorage);
    expect(isDeviceClaimed()).toBe(false);

    guarded.setItem('hsh-react-query-cache', 'A');
    expect(localStorage.getItem('hsh-react-query-cache')).toBeNull();

    localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
    guarded.setItem('hsh-react-query-cache', 'A');
    expect(guarded.getItem('hsh-react-query-cache')).toBe('A');
    guarded.removeItem('hsh-react-query-cache');
    expect(localStorage.getItem('hsh-react-query-cache')).toBeNull();
  });

  it('reports an unreadable storage as not claimed', async () => {
    const { isDeviceClaimed } = await import('./user-data');
    const locked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(isDeviceClaimed(locked)).toBe(false);
  });
});

describe('clearUserCaches and IndexedDB', () => {
  it('deletes the Workbox expiration database', async () => {
    const deleteDatabase = vi.fn();
    vi.stubGlobal('indexedDB', { deleteDatabase });
    await clearUserCaches(undefined, undefined);
    expect(deleteDatabase).toHaveBeenCalledWith('workbox-expiration');
  });

  it('does not throw when IndexedDB refuses', async () => {
    vi.stubGlobal('indexedDB', {
      deleteDatabase: () => {
        throw new Error('denied');
      },
    });
    await expect(clearUserCaches(undefined, undefined)).resolves.toBeUndefined();
  });
});
