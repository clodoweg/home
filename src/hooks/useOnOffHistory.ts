/** useOnOffHistory — Last 24 h of an on/off entity (light room), for the timeline chart. */
import { useQuery } from '@tanstack/react-query';
import { getHistory } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';

/** One state change: 1 on, 0 anything else. */
export interface OnOffStep {
  timestamp: number;
  state: number;
}

/**
 * Loads the 24 h on/off history of an entity.
 *
 * @param entityId - Entity id, or undefined when nothing is selected.
 * @param enabled - Whether the chart is shown.
 * @returns React Query result with the steps, oldest first.
 */
export function useOnOffHistory(entityId: string | undefined, enabled: boolean) {
  const { token } = useUserProfile();
  return useQuery<OnOffStep[]>({
    queryKey: queryKeys.ha.history(entityId ?? '', 24, 'on-off'),
    queryFn: async ({ signal }) => {
      const points = await getHistory(token!, entityId!, 24, signal);
      return points
        .map((point) => ({
          timestamp: new Date(point.last_changed).getTime(),
          state: point.state === 'on' ? 1 : 0,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    enabled: !!token && !!entityId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
