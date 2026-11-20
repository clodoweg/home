/**
 * history/energy — Calculs de l'onglet Historique pour l'électricité, le gaz et l'eau : séries
 * journalières, coût, gaz face à la température, degrés-jours, carte horaire et talon de nuit.
 */
import { addDays, format, getHours, parseISO } from 'date-fns';
import type { EnedisData, GrdfData, SuezData } from '../../services/api';
import { DEFAULT_WATER_PRICE, electricityPrice, gasPrice } from './tariffs';
import { dayKey, periodBuckets, type DayValue, type Period } from './period';

export type EnergyKind = 'electricity' | 'gas' | 'water';

/** A day of consumption: kWh (electricity, gas) or litres (water). */
export interface EnergyDay extends DayValue {
  /** Mean outdoor temperature of the day (gas, from GRDF). */
  temp?: number;
  /** Monthly reading spread over the days: no daily detail. */
  isEstimate?: boolean;
}

/**
 * Enedis, GRDF and Suez send 0 for a day not read yet (the last days, a meter late): such a day
 * is unknown, not empty, and must not lower an average or a comparison. Same rule as the home
 * energy tile.
 */
const isRead = (day: { value: number }): boolean => day.value > 0;

/**
 * Electricity days in kWh (Enedis sends Wh), days not read yet left out.
 *
 * @param data - Enedis answer.
 * @returns The days, in kWh.
 */
export const electricityDays = (data: EnedisData | null | undefined): EnergyDay[] =>
  (data?.dailyConsumption ?? [])
    .filter(isRead)
    .map((d) => ({ date: d.date.slice(0, 10), value: d.value / 1000 }));

/**
 * Gas days in kWh with their temperature, days not read yet left out.
 *
 * @param data - GRDF answer.
 * @returns The days.
 */
export const gasDays = (data: GrdfData | null | undefined): EnergyDay[] =>
  (data?.dailyConsumption ?? []).filter(isRead).map((d) => ({
    date: d.date.slice(0, 10),
    value: d.value,
    temp: d.temp,
    isEstimate: d.isEstimate,
  }));

/**
 * Water days in litres, days not read yet left out.
 *
 * @param data - Suez answer.
 * @returns The days.
 */
export const waterDays = (data: SuezData | null | undefined): EnergyDay[] =>
  (data?.dailyConsumption ?? []).filter(isRead).map((d) => ({
    date: d.date.slice(0, 10),
    value: d.value,
    isEstimate: d.isEstimate,
  }));

/**
 * Cost of a day of consumption, consumption part only.
 *
 * @param kind - Energy.
 * @param day - Day of consumption.
 * @param waterPrice - €/m³ reported by Suez.
 * @returns Euros TTC.
 */
export function dayCost(kind: EnergyKind, day: DayValue, waterPrice = DEFAULT_WATER_PRICE): number {
  if (kind === 'electricity') return day.value * electricityPrice(day.date);
  if (kind === 'gas') return day.value * gasPrice(day.date).price;
  return (day.value / 1000) * waterPrice;
}

/**
 * Cost of each day of a series.
 *
 * @param kind - Energy.
 * @param days - Days of consumption.
 * @param waterPrice - €/m³ reported by Suez.
 * @returns The same days, valued in euros.
 */
export const costDays = (
  kind: EnergyKind,
  days: readonly DayValue[],
  waterPrice?: number,
): DayValue[] => days.map((day) => ({ date: day.date, value: dayCost(kind, day, waterPrice) }));

/**
 * Whether the gas cost of a period uses an approximate price for one of its months.
 *
 * @param period - Period.
 * @returns True when a month of the period has no certain reference price.
 */
export function periodHasApproximateGasPrice(period: Period): boolean {
  for (let day = period.start; day < period.end; day = addDays(day, 1)) {
    if (gasPrice(dayKey(day)).approximate) return true;
  }
  return false;
}

/**
 * Days of a period with a real daily reading: estimates (monthly reading spread over the
 * days) and zeros (day not read yet) say nothing about a single day.
 *
 * @param days - Days of consumption.
 * @param period - Period.
 * @returns The days of the period that were actually read.
 */
export function readDaysOf(days: readonly EnergyDay[], period: Period): EnergyDay[] {
  const first = dayKey(period.start);
  const last = dayKey(addDays(period.end, -1));
  return days.filter((d) => d.date >= first && d.date <= last && !d.isEstimate && d.value > 0);
}

/** Base temperature of the unified degree days (DJU), °C. */
const DEGREE_DAY_BASE = 18;

/**
 * Heating degree days of a day: how far its mean temperature stayed under 18 °C.
 *
 * @param temp - Mean temperature of the day.
 * @returns The degree days (0 on a warm day).
 */
export const degreeDays = (temp: number): number => Math.max(0, DEGREE_DAY_BASE - temp);

/** Gas against the cold over a period. */
export interface GasWeatherSummary {
  /** Gas of the days with a temperature, kWh. */
  kwh: number;
  /** Degree days of the same days. */
  degreeDays: number;
  /** kWh per degree day, null when the period was never cold. */
  kwhPerDegreeDay: number | null;
  /** Mean temperature of the days. */
  meanTemp: number | null;
}

/**
 * Gas consumption weighed by the cold: the kWh per degree day compare two winters at equal
 * weather.
 *
 * @param days - Gas days with their temperature.
 * @param period - Period.
 * @returns The summary over the days read with a temperature.
 */
export function gasWeatherSummary(days: readonly EnergyDay[], period: Period): GasWeatherSummary {
  const withTemp = readDaysOf(days, period).filter((d) => typeof d.temp === 'number');
  const kwh = withTemp.reduce((sum, d) => sum + d.value, 0);
  const dd = withTemp.reduce((sum, d) => sum + degreeDays(d.temp as number), 0);
  return {
    kwh,
    degreeDays: dd,
    kwhPerDegreeDay: dd > 0 ? kwh / dd : null,
    meanTemp:
      withTemp.length > 0
        ? withTemp.reduce((sum, d) => sum + (d.temp as number), 0) / withTemp.length
        : null,
  };
}

/**
 * kWh per degree day for each bucket of a period.
 *
 * @param days - Gas days with their temperature.
 * @param period - Period.
 * @returns One ratio per bucket, null when unknown or never cold.
 */
export function gasPerDegreeDayBuckets(
  days: readonly EnergyDay[],
  period: Period,
): (number | null)[] {
  return periodBuckets(period).map((bucket) => {
    const summary = gasWeatherSummary(days, {
      granularity: period.granularity,
      start: bucket.start,
      end: bucket.end,
    });
    return summary.kwhPerDegreeDay;
  });
}

/** A point of the gas/temperature cloud. */
export interface GasTemperaturePoint {
  date: string;
  temp: number;
  kwh: number;
}

/**
 * Days of a period as points (temperature, gas), for the scatter chart.
 *
 * @param days - Gas days with their temperature.
 * @param period - Period.
 * @returns One point per day read with a temperature.
 */
export const gasTemperaturePoints = (
  days: readonly EnergyDay[],
  period: Period,
): GasTemperaturePoint[] =>
  readDaysOf(days, period)
    .filter((d) => typeof d.temp === 'number')
    .map((d) => ({ date: d.date, temp: d.temp as number, kwh: d.value }));

/** Electricity per hour of each day: rows are days, columns the 24 hours, kWh. */
export interface HourlyHeatmap {
  days: string[];
  cells: (number | null)[][];
  max: number;
}

/**
 * Enedis load curve points are the mean power (W) of the 30 minutes ending at their time:
 * the point of 01:00 covers 00:30-01:00.
 */
const HALF_HOUR_MS = 30 * 60 * 1000;
const intervalStart = (iso: string) => new Date(parseISO(iso).getTime() - HALF_HOUR_MS);

/**
 * Energy of each hour of each day of a period, from the 30-minute load curve.
 *
 * @param loadCurve - Enedis load curve (W per 30 minutes).
 * @param period - A week or a month.
 * @returns The grid, days in order.
 */
export function hourlyHeatmap(loadCurve: EnedisData['loadCurve'], period: Period): HourlyHeatmap {
  const days = periodBuckets(period).map((b) => b.key);
  const index = new Map(days.map((d, i) => [d, i]));
  const cells: (number | null)[][] = days.map(() => Array<number | null>(24).fill(null));
  for (const point of loadCurve) {
    const start = intervalStart(point.date);
    const row = index.get(dayKey(start));
    if (row === undefined) continue;
    const hour = getHours(start);
    cells[row][hour] = (cells[row][hour] ?? 0) + (point.value * 0.5) / 1000;
  }
  const max = Math.max(0, ...cells.flat().map((v) => v ?? 0));
  return { days, cells, max };
}

/** Night hours whose lowest consumption is the house's baseline (standby, fridge, VMC). */
const NIGHT_HOURS = [1, 2, 3, 4, 5];

/**
 * Night baseline of each day: the lowest mean power between 1 am and 6 am.
 *
 * @param loadCurve - Enedis load curve (W per 30 minutes).
 * @param period - A week or a month.
 * @returns One value per day of the period, in W (null when the night is unknown).
 */
export function nightBaseline(
  loadCurve: EnedisData['loadCurve'],
  period: Period,
): (number | null)[] {
  const heatmap = hourlyHeatmap(loadCurve, period);
  return heatmap.cells.map((row) => {
    const night = NIGHT_HOURS.map((h) => row[h]).filter((v): v is number => v !== null);
    // kWh over one hour = mean kW over that hour.
    return night.length === 0 ? null : Math.min(...night) * 1000;
  });
}

/**
 * Days of a year as a calendar: weeks in columns, Monday to Sunday in rows.
 *
 * @param days - Daily values.
 * @param period - A year.
 * @returns Weeks of seven cells (null outside the year), with the max for the colour scale.
 */
export function yearCalendar(
  days: readonly DayValue[],
  period: Period,
): { weeks: ({ date: string; value: number | null } | null)[][]; max: number } {
  const values = new Map(days.map((d) => [d.date, d.value]));
  const weeks: ({ date: string; value: number | null } | null)[][] = [];
  let week: ({ date: string; value: number | null } | null)[] = Array(
    (period.start.getDay() + 6) % 7,
  ).fill(null);
  let max = 0;
  for (let day = period.start; day < period.end; day = addDays(day, 1)) {
    const key = dayKey(day);
    const value = values.get(key) ?? null;
    if (value !== null) max = Math.max(max, value);
    week.push({ date: key, value });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);
  return { weeks, max };
}

/**
 * Label of a day for a tooltip.
 *
 * @param day - Day as `yyyy-MM-dd`.
 * @returns E.g. « 18/11/2026 ».
 */
export const shortDate = (day: string): string => format(parseISO(day), 'dd/MM/yyyy');
