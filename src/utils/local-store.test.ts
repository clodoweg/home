/** local-store tests — localStorage wrapper that never throws and degrades outside a browser. */
import { describe, expect, it, vi } from 'vitest';
import { silenceConsole } from '../test/services/helpers';
import { localStore } from './local-store';

describe('localStore in a browser', () => {
  it('reports itself available', async () => {
    await expect(localStore.isAvailableAsync()).resolves.toBe(true);
  });

  it('writes, reads and deletes through localStorage', async () => {
    await localStore.setItemAsync('hsh_cached_profile', '{"email":"a@b"}');
    expect(localStorage.getItem('hsh_cached_profile')).toBe('{"email":"a@b"}');
    await expect(localStore.getItemAsync('hsh_cached_profile')).resolves.toBe('{"email":"a@b"}');

    await localStore.deleteItemAsync('hsh_cached_profile');

    await expect(localStore.getItemAsync('hsh_cached_profile')).resolves.toBeNull();
  });

  it('returns null for a missing key', async () => {
    await expect(localStore.getItemAsync('missing')).resolves.toBeNull();
  });

  it('logs and swallows storage errors', async () => {
    const spies = silenceConsole();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });

    await expect(localStore.getItemAsync('k')).resolves.toBeNull();
    await expect(localStore.setItemAsync('k', 'v')).resolves.toBeUndefined();
    await expect(localStore.deleteItemAsync('k')).resolves.toBeUndefined();

    expect(spies.error).toHaveBeenCalledWith(
      expect.any(String),
      'localStore get item error:',
      expect.any(Error),
    );
    expect(spies.error).toHaveBeenCalledWith(
      expect.any(String),
      'localStore set item error:',
      expect.any(Error),
    );
    expect(spies.error).toHaveBeenCalledWith(
      expect.any(String),
      'localStore delete item error:',
      expect.any(Error),
    );
  });
});

describe('localStore without localStorage', () => {
  it('is unavailable and turns every operation into a no-op', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    try {
      const { localStore: store } = await import('./local-store');

      await expect(store.isAvailableAsync()).resolves.toBe(false);
      await expect(store.getItemAsync('k')).resolves.toBeNull();
      await store.setItemAsync('k', 'v');
      await store.deleteItemAsync('k');
    } finally {
      vi.unstubAllGlobals();
    }
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
