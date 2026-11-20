/**
 * GRDF Consumption Retrieval Hook
 * Fetches and caches historical gas data via React Query.
 */
import { format } from 'date-fns';
import { getGrdfData } from '../services/api';
import { createTokenQuery } from './createTokenQuery';
import { queryKeys } from '../lib/query-keys';

/**
 * Hook to fetch historical gas consumption from GRDF (last 3 years).
 * Longer window than electricity because gas comparisons are seasonal.
 */
export const useGasData = createTokenQuery(queryKeys.energy.gas, (token, signal) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 365 * 3);
  return getGrdfData(token, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), signal);
});
