/**
 * Electricity Statistics Hook
 * Processes Enedis consumption data into daily, weekly, and yearly views with memoized calculations.
 */
import { useMemo } from 'react';
import { EnedisData } from '../services/api';
import { format, parseISO } from 'date-fns';
import { computeDayTrend, type DayTrend } from './energy-series';
import { fr } from 'date-fns/locale';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyViewStats {
  date: string;
  hourlyData: number[];
  maxPower: number;
  avgPower: number;
  totalConsumption: number;
  label: string;
}

export interface WeekStats {
  days: { date: string; value: number }[];
  comparisonDays: number[];
  maxDailyConsumption: number;
  avgDailyConsumption: number;
  totalConsumption: number;
  maxPowerPeriod: number;
}

export interface YearStats {
  months: { date: string; value: number }[];
  comparisonMonths: number[];
  maxMonthlyConsumption: number;
  avgMonthlyConsumption: number;
  totalConsumption: number;
  maxPowerPeriod: number;
}

// ── Pure functions ───────────────────────────────────────────────────────────

function getDateAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
}

/**
 * Load-curve points of one local day, sorted. The curve is timestamped in UTC: the day is
 * matched in local time, otherwise the first hours after midnight land on the wrong day.
 */
function pointsOfLocalDay<T extends { date: string }>(loadCurve: T[], day: string): T[] {
  return loadCurve
    .filter((p) => format(new Date(p.date), 'yyyy-MM-dd') === day)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function processDailyViewData(data: EnedisData | null): DailyViewStats | null {
  if (!data?.loadCurve?.length) return null;

  let targetDate = getDateAgo(1);
  let label = format(parseISO(targetDate), 'eeee', { locale: fr });
  label = label.charAt(0).toUpperCase() + label.slice(1);

  let dailyPoints = pointsOfLocalDay(data.loadCurve, targetDate);

  // Fallback logic: check for 48 points (full day)
  let daysAgo = 1;
  while (dailyPoints.length < 48 && daysAgo < 5) {
    daysAgo++;
    targetDate = getDateAgo(daysAgo);
    label = format(parseISO(targetDate), 'eeee', { locale: fr });
    label = label.charAt(0).toUpperCase() + label.slice(1);
    dailyPoints = pointsOfLocalDay(data.loadCurve, targetDate);
  }

  if (dailyPoints.length < 1) return null;

  const maxPower = Math.max(...dailyPoints.map((p: { value: number }) => p.value || 0));
  const avgPower =
    dailyPoints.reduce((acc: number, p: { value: number }) => acc + (p.value || 0), 0) /
    dailyPoints.length;

  // Aggregate to hourly consumption (kWh). Load curve: 30min intervals (Watts).
  const hourlyData = new Array(24).fill(0);
  dailyPoints.forEach((p: { date: string; value: number }) => {
    const hour = new Date(p.date).getHours();
    hourlyData[hour] += (p.value * 0.5) / 1000;
  });

  const totalConsumption = hourlyData.reduce((acc, v) => acc + v, 0);

  return { date: targetDate, hourlyData, maxPower, avgPower, totalConsumption, label };
}

function processWeekData(data: EnedisData | null): WeekStats | null {
  if (!data?.dailyConsumption?.length) return null;

  const sorted = [...data.dailyConsumption].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const currentPeriod = sorted.slice(-7);
  if (!currentPeriod.length) return null;

  // Comparison period (7 days before)
  const comparisonPeriod = sorted.slice(-14, -7).map((d) => d.value / 1000); // kWh conversion

  const maxDailyConsumption = Math.max(...currentPeriod.map((d) => d.value));
  const avgDailyConsumption =
    currentPeriod.reduce((acc, d) => acc + d.value, 0) / currentPeriod.length;
  const totalConsumption = currentPeriod.reduce((acc, d) => acc + d.value, 0);

  const start = currentPeriod[0].date;
  const end = currentPeriod[currentPeriod.length - 1].date;
  const maxPowerPeriod = data.dailyMaxPower
    .filter((p: { date: string }) => p.date >= start && p.date <= end)
    .reduce((max: number, p: { value: number }) => Math.max(max, p.value), 0);

  return {
    days: currentPeriod,
    comparisonDays: comparisonPeriod,
    maxDailyConsumption: maxDailyConsumption || 0,
    avgDailyConsumption: avgDailyConsumption || 0,
    totalConsumption: totalConsumption || 0,
    maxPowerPeriod: maxPowerPeriod || 0,
  };
}

function processYearData(data: EnedisData | null): YearStats | null {
  if (!data?.dailyConsumption?.length) return null;

  const sorted = [...data.dailyConsumption].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  if (!sorted.length) return null;

  const monthMap: Record<string, number> = {};
  sorted.forEach((day) => {
    const monthKey = day.date.substring(0, 7);
    monthMap[monthKey] = (monthMap[monthKey] || 0) + day.value;
  });

  const allMonths = Object.entries(monthMap)
    .map(([key, value]) => ({ date: key + '-01', value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const currentMonths = allMonths.slice(-12);
  // Same month one year earlier, looked up by date: the history may have gaps or be
  // shorter than 24 months. kWh; 0 when that month is not in the history.
  const comparisonMonths = currentMonths.map(
    (m) => (monthMap[`${Number(m.date.slice(0, 4)) - 1}${m.date.slice(4, 7)}`] ?? 0) / 1000,
  );

  const maxMonthlyConsumption = Math.max(...currentMonths.map((m) => m.value));
  const avgMonthlyConsumption =
    currentMonths.reduce((acc, m) => acc + m.value, 0) / currentMonths.length;
  const totalConsumption = currentMonths.reduce((acc, m) => acc + m.value, 0);

  const start = sorted[0].date;
  const end = sorted[sorted.length - 1].date;
  const maxPowerPeriod = data.dailyMaxPower
    .filter((p: { date: string }) => p.date >= start && p.date <= end)
    .reduce((max: number, p: { value: number }) => Math.max(max, p.value), 0);

  return {
    months: currentMonths,
    comparisonMonths,
    maxMonthlyConsumption: maxMonthlyConsumption || 0,
    avgMonthlyConsumption: avgMonthlyConsumption || 0,
    totalConsumption: totalConsumption || 0,
    maxPowerPeriod: maxPowerPeriod || 0,
  };
}

/** Last-day trend shown in the widget subtitle (kWh). */
export type HeaderStats = DayTrend;

function processHeaderStats(data: EnedisData | null): HeaderStats | null {
  if (!data?.dailyConsumption?.length) return null;

  const sorted = [...data.dailyConsumption]
    .filter((d) => d.value > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return computeDayTrend(sorted.map((d) => ({ date: d.date, value: d.value / 1000 })));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook to process and memoize electricity statistics from Enedis data.
 *
 * @param data - Raw Enedis data from API.
 * @returns Object containing daily, weekly, yearly, and header statistics.
 */
export function useElectricityStats(data: EnedisData | null) {
  const dailyStats = useMemo(() => processDailyViewData(data), [data]);
  const weekStats = useMemo(() => processWeekData(data), [data]);
  const yearStats = useMemo(() => processYearData(data), [data]);
  const headerStats = useMemo(() => processHeaderStats(data), [data]);

  return { dailyStats, weekStats, yearStats, headerStats };
}
