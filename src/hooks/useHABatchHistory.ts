/**
 * Hook to retrieve Home Assistant entity state history in batch.
 */
import { useQuery } from '@tanstack/react-query';
import { getHistoryBatch, type HistoryPoint } from '../services/api';
import { queryKeys } from '../lib/query-keys';
import { useUserProfile } from '../context/UserContext';

interface UseHABatchHistoryOptions {
  /** Array of Home Assistant entity IDs to query */
  entityIds: string[];
  /** Amount of hours back in time to fetch history for */
  hours?: number;
  /** Conditional flag to enable/disable the query execution */
  enabled?: boolean;
}

/**
 * useHABatchHistory — Fetches and processes Home Assistant history in batch for multiple entities.
 *
 * @param options - Hook configuration options.
 * @returns React Query object containing mapped history points indexed by entity_id.
 */
export function useHABatchHistory({
  entityIds,
  hours = 2,
  enabled = true,
}: UseHABatchHistoryOptions) {
  const { token } = useUserProfile();

  return useQuery<Record<string, HistoryPoint[]>>({
    queryKey: queryKeys.ha.historyBatch(entityIds, hours),
    queryFn: ({ signal }) =>
      token && entityIds.length > 0
        ? getHistoryBatch(token, entityIds, hours, signal)
        : Promise.resolve({}),
    enabled: !!token && entityIds.length > 0 && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
