/**
 * Energy APIs (Enedis electricity + GRDF/Gazpar gas + Suez water)
 * Historical consumption used by the energy widgets.
 */
import { request } from './request';

export interface EnedisData {
  dailyConsumption: { date: string; value: number }[];
  dailyMaxPower: { date: string; value: number }[];
  loadCurve: { date: string; value: number }[];
}

/**
 * Fetches electricity consumption stats from the backend.
 */
/**
 * Fetches electricity consumption stats from the backend.
 *
 * @param token - Session token.
 * @param start - First day (yyyy-MM-dd).
 * @param end - Last day (yyyy-MM-dd).
 * @param loadCurveStart - First day of the 30-min load curve.
 * @param signal - Cancellation from React Query.
 * @returns Daily consumption, daily max power and load curve.
 */
export const getEnedisData = (
  token: string,
  start?: string,
  end?: string,
  loadCurveStart?: string,
  signal?: AbortSignal,
): Promise<EnedisData | null> =>
  request<EnedisData | null>(token, '/api/enedis/data', {
    query: { start, end, loadCurveStart },
    signal,
    name: 'getEnedisData',
  });

export interface GrdfData {
  dailyConsumption: { date: string; value: number; temp?: number; isEstimate: boolean }[];
}

/**
 * Fetches gas consumption (GRDF / Gazpar) from the backend.
 *
 * @param token - Session token.
 * @param start - First day (yyyy-MM-dd).
 * @param end - Last day (yyyy-MM-dd).
 * @param signal - Cancellation from React Query.
 * @returns Daily consumption with temperatures and estimates.
 */
export const getGrdfData = (
  token: string,
  start?: string,
  end?: string,
  signal?: AbortSignal,
): Promise<GrdfData | null> =>
  request<GrdfData | null>(token, '/api/grdf', {
    query: { start, end },
    signal,
    name: 'getGrdfData',
  });

interface SuezDailyPoint {
  date: string;
  value: number;
  isEstimate?: boolean;
}

export interface SuezData {
  dailyConsumption: SuezDailyPoint[];
  price: number;
}

/**
 * Fetches Suez water consumption stats from the backend.
 */
/**
 * Fetches Suez water consumption stats from the backend.
 *
 * @param token - Session token.
 * @param start - First day (yyyy-MM-dd).
 * @param end - Last day (yyyy-MM-dd).
 * @param signal - Cancellation from React Query.
 * @returns Daily consumption and the water price.
 */
export const getSuezData = (
  token: string,
  start?: string,
  end?: string,
  signal?: AbortSignal,
): Promise<SuezData | null> =>
  request<SuezData | null>(token, '/api/suez', {
    query: { start, end },
    signal,
    name: 'getSuezData',
  });
