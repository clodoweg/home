/**
 * useHistoryData — Chargement des données de l'onglet Historique : électricité sur trois ans et
 * courbe de charge d'une période (Enedis), statistiques long terme HA et compteurs d'usage.
 * Fenêtres longues, jamais persistées (clés `history`).
 */
import { useQuery } from '@tanstack/react-query';
import { addDays, format, subYears } from 'date-fns';
import { useUserProfile } from '../../context/UserContext';
import { queryKeys } from '../../lib/query-keys';
import { dayKey, isTwelveMonths, type Period } from '../../lib/history/period';
import { getEnedisData } from '../../services/energy';
import {
  getDailyUsage,
  getHAStatistics,
  type StatisticPeriod,
  type StatisticType,
} from '../../services/history';

/** History moves slowly: one read per half hour is plenty. */
const STALE_TIME = 30 * 60 * 1000;

/**
 * Daily electricity over the last three years (the back's cap), without the load curve.
 *
 * @param enabled - Whether the tab needs it.
 * @returns The Enedis query.
 */
export function useHistoryElectricity(enabled = true) {
  const { token } = useUserProfile();
  const today = format(new Date(), 'yyyy-MM-dd');
  const start = format(subYears(new Date(), 3), 'yyyy-MM-dd');
  return useQuery({
    // The load curve starts today: the back then sends almost none of it.
    queryKey: queryKeys.history.electricity(start, today, today),
    queryFn: ({ signal }) => getEnedisData(token as string, start, today, today, signal),
    enabled: !!token && enabled,
    staleTime: STALE_TIME,
  });
}

/**
 * Enedis 30-minute load curve of a week or a month (the back keeps 31 days per call).
 *
 * @param period - Period shown.
 * @param enabled - Whether the view needs it (never for a year).
 * @returns The Enedis query.
 */
export function useLoadCurve(period: Period, enabled = true) {
  const { token } = useUserProfile();
  const start = dayKey(period.start);
  // The back keeps points up to `end` at midnight UTC: the day after covers the last evening.
  const end = dayKey(addDays(period.end, 1));
  return useQuery({
    queryKey: queryKeys.history.electricity(start, end, start),
    queryFn: ({ signal }) => getEnedisData(token as string, start, end, start, signal),
    enabled: !!token && enabled && !isTwelveMonths(period.granularity),
    staleTime: STALE_TIME,
  });
}

/**
 * Long-term statistics of some entities over a period.
 *
 * @param ids - Statistic ids (sensors with a state class).
 * @param period - Window.
 * @param statPeriod - Row length (`hour` at most 32 days, `day` at most 400).
 * @param types - Values wanted.
 * @param enabled - Whether the view needs them.
 * @returns The statistics query.
 */
export function useHAStatistics(
  ids: readonly string[],
  period: Period,
  statPeriod: StatisticPeriod,
  types: readonly StatisticType[],
  enabled = true,
) {
  const { token } = useUserProfile();
  const start = period.start.toISOString();
  const end = period.end.toISOString();
  return useQuery({
    queryKey: queryKeys.history.statistics(ids, start, end, statPeriod, types),
    queryFn: ({ signal }) =>
      getHAStatistics(token as string, ids, period.start, period.end, statPeriod, types, signal),
    enabled: !!token && enabled && ids.length > 0,
    staleTime: STALE_TIME,
  });
}

/**
 * Stored usage counters from the start of one period to the end of another (the period shown
 * and the one a year before, in one call).
 *
 * @param from - Earliest period.
 * @param to - Latest period.
 * @param enabled - Whether the view needs them.
 * @returns The usage query.
 */
export function useDailyUsage(from: Period, to: Period, enabled = true) {
  const { token } = useUserProfile();
  const start = dayKey(from.start);
  const end = dayKey(addDays(to.end, -1));
  return useQuery({
    queryKey: queryKeys.history.usage(start, end),
    queryFn: ({ signal }) => getDailyUsage(token as string, start, end, signal),
    enabled: !!token && enabled,
    staleTime: STALE_TIME,
  });
}
