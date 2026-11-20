/** useAlarmHistory — Last 24 h of an alarm panel, as ordered steps for the timeline chart. */
import { useQuery } from '@tanstack/react-query';
import { getHistory } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';

/** One state change of the alarm, as a chart level. */
export interface AlarmStep {
  timestamp: number;
  /** 3 triggered, 2 night/home, 1 away, 0 disarmed, -1 unavailable/unknown. */
  state: number;
}

/**
 * Maps an alarm state to its timeline level.
 *
 * @param state - Home Assistant alarm state.
 * @returns The chart level.
 */
export const alarmLevel = (state: string): number => {
  if (state === 'triggered') return 3;
  if (state === 'armed_night' || state === 'armed_home') return 2;
  if (state === 'armed_away') return 1;
  if (state === 'unavailable' || state === 'unknown') return -1;
  return 0;
};

/**
 * Loads the 24 h history of an alarm panel.
 *
 * @param entityId - Alarm panel entity id.
 * @param enabled - Whether the user may read history.
 * @returns React Query result with the steps, oldest first.
 */
export function useAlarmHistory(entityId: string, enabled: boolean) {
  const { token } = useUserProfile();
  return useQuery<AlarmStep[]>({
    queryKey: queryKeys.ha.history(entityId, 24, 'alarm-steps'),
    queryFn: async ({ signal }) => {
      const points = await getHistory(token!, entityId, 24, signal);
      return points
        .map((point) => ({
          timestamp: new Date(point.last_changed).getTime(),
          state: alarmLevel(point.state),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    enabled: !!token && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
