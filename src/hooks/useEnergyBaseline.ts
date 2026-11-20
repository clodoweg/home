/** useEnergyBaseline — Value of an energy counter at the last midnight, to derive today's use. */
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getHistory } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';
import { useNow } from './useNow';

/**
 * Loads the counter value at the last midnight (last point before it in the 48 h history,
 * or the oldest point when none precedes midnight). Keyed by day: a PWA left open past
 * midnight gets the new baseline.
 *
 * @param entityId - Energy counter entity id, or undefined.
 * @param enabled - Whether the value is shown.
 * @returns React Query result with the baseline (null when the history is empty or invalid).
 */
export function useEnergyBaseline(entityId: string | undefined, enabled: boolean) {
  const { token } = useUserProfile();
  const today = format(useNow(), 'yyyy-MM-dd');
  return useQuery<number | null>({
    queryKey: queryKeys.ha.history(entityId ?? '', 48, `baseline-${today}`),
    queryFn: async ({ signal }) => {
      const history = await getHistory(token!, entityId!, 48, signal);
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const beforeMidnight = history.filter((p) => new Date(p.last_changed) < midnight);
      const point =
        beforeMidnight.length > 0 ? beforeMidnight[beforeMidnight.length - 1] : history[0];
      const value = parseFloat(point?.state ?? '');
      return isNaN(value) ? null : value;
    },
    enabled: !!token && !!entityId && enabled,
    staleTime: 30 * 60 * 1000,
  });
}
