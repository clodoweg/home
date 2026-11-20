/**
 * query-client — Shared TanStack Query client, its localStorage persister and the rules
 * deciding which queries may be written to disk.
 */
import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { ownerGuardedStorage } from './user-data';
import { groupHAStates, type HAData } from './ha-groups';
import { queryKeys } from './query-keys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000, // 20s — data considered fresh
      // At least the persisted cache's maxAge (7 days, QueryProvider): a query collected sooner
      // would also disappear from the persisted copy (TanStack persistence guide).
      gcTime: 7 * 24 * 60 * 60 * 1000,
      // Default OFF: au retour de l'app au premier plan, on évite la tempête
      // de refetchs simultanés (HA states + petkit + weather + N historiques).
      // Le dashboard orchestre lui-même la séquence via un listener visibilitychange
      // (cf. DashboardScreen), avec ha-states en priorité puis le reste différé.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** localStorage key of the persisted cache (matched by the logout purge, `hsh` prefix). */
export const QUERY_CACHE_STORAGE_KEY = 'hsh-react-query-cache';

const isStatesQuery = (queryKey: QueryKey) =>
  queryKey.length === queryKeys.ha.states.length &&
  queryKey.every((part, i) => part === queryKeys.ha.states[i]);

/**
 * Persisted copy of the cache, with the Home Assistant states reduced to their entity list:
 * the groups (lights, sensors…) repeat the same entities and are rebuilt when read back.
 *
 * @param client - Cache as dehydrated by TanStack.
 * @returns The JSON written to localStorage.
 */
export const serializeCache = (client: PersistedClient): string =>
  JSON.stringify({
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((query) =>
        isStatesQuery(query.queryKey) && query.state.data
          ? { ...query, state: { ...query.state, data: { all: (query.state.data as HAData).all } } }
          : query,
      ),
    },
  });

/**
 * Reads back a cache written by `serializeCache`, rebuilding the Home Assistant groups.
 *
 * @param stored - JSON read from localStorage.
 * @returns The cache to restore.
 */
export const deserializeCache = (stored: string): PersistedClient => {
  const client = JSON.parse(stored) as PersistedClient;
  for (const query of client.clientState.queries) {
    const data = query.state.data as { all?: HAData['all'] } | undefined;
    if (isStatesQuery(query.queryKey) && Array.isArray(data?.all)) {
      query.state.data = groupHAStates(data.all);
    }
  }
  return client;
};

export const persister = createSyncStoragePersister({
  // Writes are throttled (1 s): one may fire after the logout purge. The guard drops it.
  storage: ownerGuardedStorage(window.localStorage),
  key: QUERY_CACHE_STORAGE_KEY,
  throttleTime: 1_000,
  serialize: serializeCache,
  deserialize: deserializeCache,
});

// Bump quand la forme des données en cache change de façon incompatible
// (ex: renommage d'un champ HA, refonte d'un payload). Le rehydratation est
// alors ignoré et le cache reconstruit depuis le réseau.
export const CACHE_BUSTER = 'v2.0.0-4';

/**
 * Persisted-cache version for a given user: a cache written for another account (or an
 * older shape) is discarded on restore instead of being shown.
 *
 * @param userId - Clerk id of the signed-in user.
 * @returns The `buster` passed to the persister.
 */
export const cacheBusterFor = (userId: string | null | undefined): string =>
  `${CACHE_BUSTER}:${userId ?? 'anonymous'}`;

/**
 * Domains whose data may be written to disk for an instant start. Profile, preferences and
 * images are not Query data today; this allowlist keeps it that way if they become so.
 */
const PERSISTABLE_ROOT_KEYS = new Set(['ha', 'petkit', 'energy']);

/**
 * Tells whether a query may be persisted to localStorage.
 *
 * @param queryKey - Key of the query.
 * @param status - Current status of the query.
 * @returns True for a successful query of an allowlisted domain.
 */
export function shouldPersistQuery(queryKey: QueryKey, status: string): boolean {
  if (status !== 'success') return false;
  const root = queryKey[0];
  return typeof root === 'string' && PERSISTABLE_ROOT_KEYS.has(root);
}
