/**
 * Home Assistant Data Fetching Hook
 * Orchestrates states and metadata retrieval with automated background polling.
 *
 * States are polled every 30s. The staleTime (45s) est légèrement supérieur à
 * l'intervalle de polling : si l'utilisateur revient sur l'app dans la minute
 * qui suit son départ, les données sont encore considérées fraîches → pas de
 * refetch déclenché au focus, affichage instantané. Metadata (entity areas,
 * device models) is fetched separately with a 10-minute staleTime — it only
 * changes on HA config updates.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStates, getEntityMetadata } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';
import { groupHAStates, type HAData } from '../lib/ha-groups';

/**
 * Fetches all Home Assistant states and entity metadata.
 * States poll every 30s; metadata is cached for 10 minutes (changes only on HA config updates).
 *
 * @param autoRefresh - Whether to enable background polling (30s interval).
 * @returns React Query result containing grouped HA data.
 */
export function useHAData(autoRefresh: boolean = true) {
  const { token } = useUserProfile();

  const statesQuery = useQuery<HAData>({
    queryKey: queryKeys.ha.states,
    queryFn: async ({ signal }): Promise<HAData> => groupHAStates(await getStates(token!, signal)),
    enabled: !!token,
    staleTime: 45_000,
    refetchInterval: autoRefresh ? 30_000 : false,
    refetchIntervalInBackground: false,
    // The return to the foreground is orchestrated by DashboardScreen (visibilitychange).
    refetchOnWindowFocus: false,
  });

  const metaQuery = useQuery<Record<string, { area: string; floor?: string; model: string }>>({
    queryKey: queryKeys.ha.metadata,
    queryFn: ({ signal }) => getEntityMetadata(token!, signal),
    enabled: !!token,
    // Entity areas/models change only on HA config updates, not during normal use.
    // 1h staleTime avoids re-fetching the slow Jinja2 template on every app relaunch.
    staleTime: 60 * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  // Merge metadata into the states result so callers see the same HAData shape.
  const data = useMemo<HAData | undefined>(
    () => (statesQuery.data ? { ...statesQuery.data, metadata: metaQuery.data ?? {} } : undefined),
    [statesQuery.data, metaQuery.data],
  );

  // Only the fields read by the callers: spreading the whole query result would subscribe them
  // to every query state change (React Query tracks the properties that are read).
  return {
    data,
    error: statesQuery.error,
    dataUpdatedAt: statesQuery.dataUpdatedAt,
    isLoading: statesQuery.isLoading,
    isFetching: statesQuery.isFetching,
  };
}
