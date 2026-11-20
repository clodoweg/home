/**
 * History APIs — statistiques long terme de Home Assistant et compteurs d'usage quotidiens,
 * lus par l'onglet Historique (droit `history`).
 */
import { request } from './request';

export type StatisticPeriod = 'hour' | 'day' | 'week' | 'month';
export type StatisticType = 'mean' | 'min' | 'max' | 'change' | 'sum';

/** One row of a long-term statistic; `start` is the ISO instant the row begins. */
export interface StatisticRow {
  start: string;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
  change?: number | null;
  sum?: number | null;
}

/** Rows per statistic id (an entity without statistics is absent). */
export type StatisticsResponse = Record<string, StatisticRow[]>;

/**
 * Reads the HA recorder's long-term statistics (kept beyond the 10 days of history).
 *
 * @param token - Session token.
 * @param statisticIds - Entities (sensors with a state class).
 * @param start - Window start.
 * @param end - Window end.
 * @param period - Row length.
 * @param types - Values wanted per row.
 * @param signal - Cancellation from React Query.
 * @returns Rows per statistic id.
 */
export const getHAStatistics = (
  token: string,
  statisticIds: readonly string[],
  start: Date,
  end: Date,
  period: StatisticPeriod,
  types: readonly StatisticType[],
  signal?: AbortSignal,
): Promise<StatisticsResponse> =>
  request<StatisticsResponse>(token, '/api/ha/statistics', {
    query: {
      statistic_ids: statisticIds.join(','),
      start: start.toISOString(),
      end: end.toISOString(),
      period,
      types: types.join(','),
    },
    signal,
    name: `getHAStatistics ${period} [${statisticIds.slice(0, 3).join(', ')}${statisticIds.length > 3 ? '...' : ''}]`,
  });

/** Series per usage metric (`washer_cycles`, `light_hours:light.salon`…), days as `yyyy-MM-dd`. */
export type UsageResponse = Record<string, { date: string; value: number }[]>;

/**
 * Reads the stored daily usage counters (hours on, cycles, detections, meals, alerts).
 *
 * @param token - Session token.
 * @param start - First day (`yyyy-MM-dd`).
 * @param end - Last day (`yyyy-MM-dd`), included.
 * @param signal - Cancellation from React Query.
 * @returns Series per metric.
 */
export const getDailyUsage = (
  token: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<UsageResponse> =>
  request<UsageResponse>(token, '/api/history/usage', {
    query: { start, end },
    signal,
    name: 'getDailyUsage',
  });
