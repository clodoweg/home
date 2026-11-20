/**
 * Suez Consumption Retrieval Hook
 * Fetches and caches historical water data via React Query.
 */
import { format } from 'date-fns';
import { getSuezData } from '../services/api';
import { createTokenQuery } from './createTokenQuery';
import { queryKeys } from '../lib/query-keys';

/**
 * Hook to fetch historical water consumption from Suez (last 3 years).
 * Long comparison window is key to tracking seasonal changes (like summer lawn watering).
 */
export const useSuezData = createTokenQuery(queryKeys.energy.water, (token, signal) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 365 * 3);
  return getSuezData(token, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), signal);
});
