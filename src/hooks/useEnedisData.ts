/**
 * Enedis Consumption Retrieval Hook
 * Fetches and caches historical electricity data via React Query.
 */
import { format } from 'date-fns';
import { getEnedisData, EnedisData } from '../services/api';
import { createTokenQuery } from './createTokenQuery';
import { queryKeys } from '../lib/query-keys';

/**
 * Hook to fetch Enedis electricity data with optimized date ranges:
 * - Daily consumption/max-power: Jan 1st of previous year → today (year-over-year view)
 * - Load curve: last 15 days (enough for the chart, avoids fetching 30-min points for 2 years)
 */
export const useEnedisData = createTokenQuery<EnedisData | null>(
  queryKeys.energy.electricity,
  (token, signal) => {
    const end = new Date();

    // Jan 1st of the previous year for daily data (current year + last year for comparison)
    const start = new Date(end.getFullYear() - 1, 0, 1);

    // 15 days back for load curve only
    const loadCurveStart = new Date();
    loadCurveStart.setDate(loadCurveStart.getDate() - 15);

    return getEnedisData(
      token,
      format(start, 'yyyy-MM-dd'),
      format(end, 'yyyy-MM-dd'),
      format(loadCurveStart, 'yyyy-MM-dd'),
      signal,
    );
  },
);
