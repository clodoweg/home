/**
 * Water Statistics Hook
 * Processes Suez consumption data and cost metrics with historical comparisons.
 */
import { useMemo } from 'react';
import type { SuezData } from '../services/api';
import { useSuezData } from './useSuezData';
import {
  computeDayTrend,
  toMonthlySeries,
  valuesOneWeekEarlier,
  valuesOneYearEarlier,
  type MonthlyPoint,
} from './energy-series';
import { DEFAULT_WATER_PRICE } from '../lib/history/tariffs';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyWater {
  date: string;
  value: number; // in Liters (L)
  cost: number; // in €
  isEstimate?: boolean;
}

/** One month, value in liters. */
export type MonthlyWater = MonthlyPoint;

export interface YesterdayStats {
  consumption: number;
  date: string;
  cost: number;
}

export interface WeekStats {
  totalConsumption: number;
  avgConsumption: number;
  maxConsumption: number;
  days: DailyWater[];
  comparisonDays: number[];
}

export interface YearStats {
  totalConsumption: number;
  maxMonthly: number;
  months: MonthlyWater[];
  avgMonthly: number;
  comparisonMonths: number[];
}

// ── Calculations ─────────────────────────────────────────────────────────────

function computeYesterdayStats(dailyData: DailyWater[]): YesterdayStats | null {
  const nonZero = dailyData.filter((d) => d.value > 0);
  if (!nonZero.length) return null;

  const lastPoint = nonZero[nonZero.length - 1];
  return {
    consumption: lastPoint.value,
    date: lastPoint.date,
    cost: lastPoint.cost,
  };
}

function computeWeekStats(dailyData: DailyWater[]): WeekStats | null {
  if (!dailyData.length) return null;

  const last7Range = dailyData.slice(-7);
  const comparisonDays = valuesOneWeekEarlier(last7Range, dailyData);

  const total = last7Range.reduce((acc, d) => acc + d.value, 0);
  const avg = last7Range.length > 0 ? total / last7Range.length : 0;
  const max = Math.max(...last7Range.map((d) => d.value), ...comparisonDays, 1);

  return {
    totalConsumption: total,
    avgConsumption: avg,
    maxConsumption: max,
    days: last7Range,
    comparisonDays,
  };
}

function computeYearStats(monthlyData: MonthlyWater[]): YearStats | null {
  if (!monthlyData.length) return null;
  const last12 = monthlyData.slice(-12);
  const comparisonMonths = valuesOneYearEarlier(last12, monthlyData);

  const total = last12.reduce((acc, m) => acc + m.value, 0);
  const max = Math.max(...last12.map((m) => m.value), ...comparisonMonths, 1);
  const avg = total / last12.length;

  return {
    totalConsumption: total,
    maxMonthly: max,
    months: last12,
    avgMonthly: avg,
    comparisonMonths,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook to process and memoize water consumption statistics from Suez data.
 *
 * @param dailyData - Standardized daily water consumption records.
 * @param monthlyData - Standardized monthly water consumption records.
 * @returns Object containing yesterday, weekly, and yearly statistics.
 */
export function useWaterStats(dailyData: DailyWater[], monthlyData: MonthlyWater[]) {
  const yesterdayStats = useMemo(() => computeYesterdayStats(dailyData), [dailyData]);
  const weekStats = useMemo(() => computeWeekStats(dailyData), [dailyData]);
  const yearStats = useMemo(() => computeYearStats(monthlyData), [monthlyData]);

  return { yesterdayStats, weekStats, yearStats };
}

/**
 * Daily and monthly series of the Suez answer, with the cost of each day.
 *
 * @param data - Suez answer, if loaded.
 * @returns The series and the price used.
 */
function toWaterSeries(data: SuezData | null | undefined) {
  const price = data?.price || DEFAULT_WATER_PRICE;
  const dailyData: DailyWater[] = (data?.dailyConsumption ?? []).map((d) => ({
    date: d.date.split('T')[0],
    value: d.value,
    cost: (d.value * price) / 1000,
    isEstimate: d.isEstimate,
  }));
  return { dailyData, monthlyData: toMonthlySeries(dailyData), price };
}

/**
 * Everything the water widget shows: Suez data, statistics and the last-day trend.
 *
 * @returns Query state, price, statistics and trend (days with a reading only).
 */
export function useWaterWidgetData() {
  const { data, isLoading } = useSuezData();
  const { dailyData, monthlyData, price } = useMemo(() => toWaterSeries(data), [data]);
  const stats = useWaterStats(dailyData, monthlyData);
  // Days at 0 are days Suez has not read yet, not days without water use.
  const dayTrend = useMemo(
    () => computeDayTrend(dailyData.filter((d) => d.value > 0)),
    [dailyData],
  );
  return { data, isLoading, price, dayTrend, ...stats };
}
