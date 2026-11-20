/** query-client tests — which queries reach localStorage, and per-user cache versions. */
import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_BUSTER,
  QUERY_CACHE_STORAGE_KEY,
  cacheBusterFor,
  persister,
  shouldPersistQuery,
  deserializeCache,
  serializeCache,
} from './query-client';
import { CACHE_OWNER_KEY, clearUserStorage } from './user-data';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { groupHAStates, type HAData } from './ha-groups';

describe('shouldPersistQuery', () => {
  it.each([
    [['ha', 'states']],
    [['ha', 'history', 'sensor.a', 24, undefined]],
    [['ha', 'scenes']],
    [['ha', 'forecast', 'weather.home', 'daily']],
    [['petkit', 'data']],
    [['energy', 'electricity']],
  ])('persists the dashboard data %j', (queryKey) => {
    expect(shouldPersistQuery(queryKey, 'success')).toBe(true);
  });

  it.each([
    [['user', 'me']],
    [['user', 'preferences']],
    [['ha-scenes']],
    [['weather', 'x']],
    [[42]],
  ])('never persists %j', (queryKey) => {
    expect(shouldPersistQuery(queryKey, 'success')).toBe(false);
  });

  it('never persists a failed or pending query', () => {
    expect(shouldPersistQuery(['ha', 'states'], 'error')).toBe(false);
    expect(shouldPersistQuery(['ha', 'states'], 'pending')).toBe(false);
  });
});

describe('cacheBusterFor', () => {
  it('ties the persisted cache to the user', () => {
    expect(cacheBusterFor('user_a')).toBe(`${CACHE_BUSTER}:user_a`);
    expect(cacheBusterFor('user_a')).not.toBe(cacheBusterFor('user_b'));
    expect(cacheBusterFor(undefined)).toBe(`${CACHE_BUSTER}:anonymous`);
  });
});

describe('persister after a logout', () => {
  it('does not write the cache back once the purge removed the owner', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(CACHE_OWNER_KEY, 'user_a');
      // A save scheduled while signed in (throttled)…
      void persister.persistClient({
        timestamp: Date.now(),
        buster: 'b',
        clientState: { queries: [], mutations: [] },
      });
      vi.advanceTimersByTime(1_100);
      expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();

      void persister.persistClient({
        timestamp: Date.now(),
        buster: 'b',
        clientState: { queries: [], mutations: [] },
      });
      // …then the logout purge runs before the throttled write fires.
      clearUserStorage();
      vi.advanceTimersByTime(1_100);

      expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('persisted Home Assistant states', () => {
  const entity = (entity_id: string) => ({
    entity_id,
    state: 'on',
    attributes: {},
    last_changed: '',
    last_updated: '',
    context: {},
  });
  const all = [entity('light.salon'), entity('sensor.temperature_salon'), entity('scene.soir')];
  const client = (data: unknown, queryKey: unknown[] = ['ha', 'states']) =>
    ({
      timestamp: 1,
      buster: 'b',
      clientState: {
        mutations: [],
        queries: [{ queryKey, queryHash: JSON.stringify(queryKey), state: { data } }],
      },
    }) as unknown as PersistedClient;

  it('writes the entity list only and rebuilds the groups when read back', () => {
    const stored = serializeCache(client(groupHAStates(all)));

    expect(stored).not.toContain('"lights"');
    expect(stored.length).toBeLessThan(JSON.stringify(client(groupHAStates(all))).length);
    const restored = deserializeCache(stored).clientState.queries[0].state.data as HAData;
    expect(restored).toEqual(groupHAStates(all));
  });

  it('leaves the other queries and an empty states query as they are', () => {
    const energy = client({ dailyConsumption: [1] }, ['energy', 'gas']);
    expect(deserializeCache(serializeCache(energy))).toEqual(energy);
    const empty = client(undefined);
    expect(
      deserializeCache(serializeCache(empty)).clientState.queries[0].state.data,
    ).toBeUndefined();
  });
});
