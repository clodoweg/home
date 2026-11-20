/**
 * useHAHistory — Fetches and processes Home Assistant entity history into hourly series.
 * Buckets raw state points by hour, forward-fills gaps, and injects the live current value
 * as the last data point so charts stay up-to-date between refreshes.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHistory } from '../services/api';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';

interface UseHAHistoryOptions {
  entityId?: string;
  hours?: number;
  showHistory?: boolean;
  attribute?: string; // If we want to track a specific attribute (e.g. temperature)
  /** Converts a raw state or attribute value to a number (default: parseFloat). */
  processValue?: (val: unknown) => number;
  currentValue?: number; // Optional live state to "close" the series at i=0
}

/**
 * useHAHistory Hook
 * Handles fetching, caching, and processing HA history into hourly averages for charts.
 * Powered by React Query for robust caching and de-duplication.
 */
export function useHAHistory({
  entityId,
  hours = 24,
  showHistory = true,
  attribute,
  processValue,
  currentValue,
}: UseHAHistoryOptions) {
  const { token } = useUserProfile();

  const query = useQuery({
    queryKey: queryKeys.ha.history(entityId ?? '', hours, attribute || 'state'),
    queryFn: async ({ signal }) => {
      if (!token || !entityId) return { series: [], labels: [] };

      const history = await getHistory(token, entityId, hours, signal);

      // Group by hour
      const hourlyMap: Record<number, number[]> = {};

      const now = new Date();
      const windowStart = new Date(now.getTime() - (hours - 1) * 60 * 60 * 1000);
      const windowStartBucket = new Date(
        windowStart.getFullYear(),
        windowStart.getMonth(),
        windowStart.getDate(),
        windowStart.getHours(),
      ).getTime();
      // Hours of the window before its first point show the value in effect at its start: the
      // last one before the window, or else the first one known.
      let valueBeforeWindow: number | null = null;
      let firstAvailableValue: number | null = null;
      const sortedHistory = [...history].sort(
        (a, b) => new Date(a.last_changed).getTime() - new Date(b.last_changed).getTime(),
      );

      for (const point of sortedHistory) {
        const val = attribute ? point.attributes?.[attribute] : point.state;
        const numVal = processValue ? processValue(val) : parseFloat(val as string);
        if (!isNaN(numVal)) {
          if (firstAvailableValue === null) firstAvailableValue = numVal;

          const date = new Date(point.last_changed);
          // Use a unique bucket for each hour (start of the hour timestamp)
          const bucket = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
          ).getTime();
          if (bucket < windowStartBucket) valueBeforeWindow = numVal;
          if (!hourlyMap[bucket]) hourlyMap[bucket] = [];
          hourlyMap[bucket].push(numVal);
        }
      }

      // Reconstruct time series (last X hours)
      const series: number[] = [];
      const labels: string[] = [];

      for (let i = hours - 1; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 60 * 60 * 1000);
        const h = targetDate.getHours();
        labels.push(h.toString().padStart(2, '0'));

        const bucket = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          targetDate.getHours(),
        ).getTime();
        const values = hourlyMap[bucket];

        if (values && values.length > 0) {
          // Use the most recent value in this hour
          series.push(values[values.length - 1]);
        } else if (series.length > 0) {
          // Forward fill to avoid gaps
          series.push(series[series.length - 1]);
        } else {
          series.push(valueBeforeWindow ?? firstAvailableValue ?? 0);
        }
      }

      return { series, labels };
    },
    enabled: !!token && !!entityId && showHistory,
    staleTime: 10 * 60 * 1000, // 10 minutes — historical data changes slowly; live tail injected via currentValue
  });

  // Inject current value if history is loaded
  const data = useMemo(() => {
    const result = query.data || { series: [], labels: [] };
    if (currentValue !== undefined && result.series.length > 0) {
      const nextSeries = [...result.series];
      nextSeries[nextSeries.length - 1] = currentValue;
      return { ...result, series: nextSeries };
    }
    return result;
  }, [query.data, currentValue]);

  return {
    ...data,
    loading: query.isLoading,
    refresh: () => query.refetch(),
  };
}
