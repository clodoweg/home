/**
 * Gas Statistics Hook
 * Processes GRDF consumption data with climatic normalization and historical comparisons.
 */
import { useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import type { GrdfData } from '../services/api';
import { useGasData } from './useGasData';
import {
  computeDayTrend,
  toMonthlySeries,
  valuesOneWeekEarlier,
  valuesOneYearEarlier,
  type MonthlyPoint,
} from './energy-series';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyGas {
  date: string;
  value: number;
  temp?: number;
  isEstimate?: boolean;
}

/** One month, value in kWh. */
export type MonthlyGas = MonthlyPoint;

export interface YesterdayStats {
  consumption: number;
  date: string;
}

export interface WeekStats {
  totalConsumption: number;
  avgConsumption: number;
  maxConsumption: number;
  days: DailyGas[];
  comparisonDays: number[];
  temperatures: number[];
  comparisonTemperatures: number[];
}

export interface YearStats {
  totalConsumption: number;
  maxMonthly: number;
  months: MonthlyGas[];
  avgMonthly: number;
  comparisonMonths: number[];
  temperatures: number[];
  comparisonTemperatures: number[];
}

// ── Constants ────────────────────────────────────────────────────────────────

// Temperatures are only a fallback: GRDF sends the day's temperature (`temp`) and it wins.
// Monthly climatic normals (Saint-Rémy-lès-Chevreuse) cover any day GRDF left without one.
const NORMALS: Record<string, number> = {
  '01': 4.1,
  '02': 4.8,
  '03': 7.9,
  '04': 10.8,
  '05': 14.6,
  '06': 17.6,
  '07': 20.0,
  '08': 19.7,
  '09': 16.3,
  '10': 12.3,
  '11': 7.5,
  '12': 4.7,
};

// Measured monthly means (Toussus-le-Noble) for the months before GRDF sent temperatures.
// Past data: it does not need extending, later months come from GRDF or the normals above.
const HISTORICAL_2024: Record<string, number> = {
  '2024-01': 4.5,
  '2024-02': 9.0,
  '2024-03': 9.5,
  '2024-04': 11.5,
  '2024-05': 15.0,
  '2024-06': 17.5,
  '2024-07': 20.0,
  '2024-08': 20.5,
  '2024-09': 16.0,
  '2024-10': 13.0,
  '2024-11': 8.0,
  '2024-12': 5.5,
  '2025-01': 9.2,
};

// ── Pure functions ───────────────────────────────────────────────────────────

function getTempForDate(dailyData: DailyGas[], dateStr: string, temp?: number): number {
  if (temp !== undefined) return temp;

  const dateObj = parseISO(dateStr);
  const monthKey = format(dateObj, 'MM');
  const monthPrefix = format(dateObj, 'yyyy-MM');

  if (HISTORICAL_2024[monthPrefix] !== undefined) return HISTORICAL_2024[monthPrefix];
  return NORMALS[monthKey] || 0;
}

function computeYesterdayStats(dailyData: DailyGas[]): YesterdayStats | null {
  if (!dailyData.length) return null;
  let lastRealIndex = -1;
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (!dailyData[i].isEstimate) {
      lastRealIndex = i;
      break;
    }
  }
  if (lastRealIndex === -1) lastRealIndex = dailyData.length - 1;
  const lastPoint = dailyData[lastRealIndex];
  return { consumption: lastPoint.value, date: lastPoint.date };
}

function computeWeekStats(dailyData: DailyGas[]): WeekStats | null {
  if (!dailyData.length) return null;

  // Find last real (non-estimate) data point
  let lastRealIndex = -1;
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (!dailyData[i].isEstimate) {
      lastRealIndex = i;
      break;
    }
  }
  if (lastRealIndex === -1) lastRealIndex = dailyData.length - 1;

  const startIdx = Math.max(0, lastRealIndex - 6);
  const last7Range = dailyData.slice(startIdx, lastRealIndex + 1);
  const validDays = last7Range.filter((d) => !d.isEstimate);
  const last7Display = last7Range.map((d) => (d.isEstimate ? { ...d, value: 0 } : d));

  const comparisonDays = valuesOneWeekEarlier(last7Range, dailyData, (p) => !p.isEstimate);

  const total = validDays.reduce((acc, d) => acc + d.value, 0);
  const avg = validDays.length > 0 ? total / validDays.length : 0;
  const max = Math.max(...validDays.map((d) => d.value), ...comparisonDays, 1);

  return {
    totalConsumption: total,
    avgConsumption: avg,
    maxConsumption: max,
    days: last7Display,
    comparisonDays,
    temperatures: last7Range.map((d) => getTempForDate(dailyData, d.date, d.temp)),
    comparisonTemperatures: last7Range.map((d) => {
      const j7Date = format(subDays(parseISO(d.date), 7), 'yyyy-MM-dd');
      const j7Point = dailyData.find((p) => p.date === j7Date);
      return getTempForDate(dailyData, j7Date, j7Point?.temp);
    }),
  };
}

function computeYearStats(dailyData: DailyGas[], monthlyData: MonthlyGas[]): YearStats | null {
  if (!monthlyData.length) return null;
  const last12 = monthlyData.slice(-12);

  const comparisonMonths = valuesOneYearEarlier(last12, monthlyData);

  const total = last12.reduce((acc, m) => acc + m.value, 0);
  const max = Math.max(...last12.map((m) => m.value), ...comparisonMonths, 1);
  const avg = total / last12.length;

  const temperatures = last12.map((m) => {
    const monthPrefix = m.date;
    const monthKey = m.date.split('-')[1];
    const daysInMonth = dailyData.filter(
      (d) => d.date.startsWith(monthPrefix) && d.temp !== undefined,
    );
    if (daysInMonth.length > 5) {
      return daysInMonth.reduce((acc, d) => acc + (d.temp || 0), 0) / daysInMonth.length;
    }
    if (HISTORICAL_2024[monthPrefix] !== undefined) return HISTORICAL_2024[monthPrefix];
    return NORMALS[monthKey] || 0;
  });

  const comparisonTemperatures = last12.map((m) => {
    const [year, month] = m.date.split('-');
    const prevDate = `${parseInt(year) - 1}-${month}`;
    const daysInPrevMonth = dailyData.filter(
      (d) => d.date.startsWith(prevDate) && d.temp !== undefined,
    );
    if (daysInPrevMonth.length > 5) {
      return daysInPrevMonth.reduce((acc, d) => acc + (d.temp || 0), 0) / daysInPrevMonth.length;
    }
    if (HISTORICAL_2024[prevDate] !== undefined) return HISTORICAL_2024[prevDate];
    return NORMALS[month] || 0;
  });

  return {
    totalConsumption: total,
    maxMonthly: max,
    months: last12,
    avgMonthly: avg,
    comparisonMonths,
    temperatures,
    comparisonTemperatures,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook to process and memoize gas consumption statistics.
 *
 * @param dailyData - Standardized daily gas records.
 * @param monthlyData - Standardized monthly gas records.
 * @returns Object containing yesterday, weekly, and yearly statistics.
 */
export function useGasStats(dailyData: DailyGas[], monthlyData: MonthlyGas[]) {
  const yesterdayStats = useMemo(() => computeYesterdayStats(dailyData), [dailyData]);
  const weekStats = useMemo(() => computeWeekStats(dailyData), [dailyData]);
  const yearStats = useMemo(
    () => computeYearStats(dailyData, monthlyData),
    [dailyData, monthlyData],
  );

  return { yesterdayStats, weekStats, yearStats };
}

/**
 * Daily and monthly series of the GRDF answer.
 *
 * @param data - GRDF answer, if loaded.
 * @returns The series.
 */
function toGasSeries(data: GrdfData | null | undefined) {
  const dailyData: DailyGas[] = (data?.dailyConsumption ?? []).map((d) => ({
    date: d.date.split('T')[0],
    value: d.value,
    temp: d.temp,
    isEstimate: d.isEstimate,
  }));
  return { dailyData, monthlyData: toMonthlySeries(dailyData) };
}

/**
 * Everything the gas widget shows: GRDF data, statistics and the last-day trend.
 *
 * @returns Query state, statistics and trend (measured days only, estimates left out).
 */
export function useGasWidgetData() {
  const { data, isLoading } = useGasData();
  const { dailyData, monthlyData } = useMemo(() => toGasSeries(data), [data]);
  const stats = useGasStats(dailyData, monthlyData);
  const dayTrend = useMemo(
    () => computeDayTrend(dailyData.filter((d) => !d.isEstimate)),
    [dailyData],
  );
  return { data, isLoading, dayTrend, ...stats };
}
