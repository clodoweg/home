/** energy-series — Series helpers shared by the electricity, gas and water statistics. */
import { format, parseISO, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

/** One day of consumption, `date` as `yyyy-MM-dd`. */
export interface DailyPoint {
  date: string;
  value: number;
}

/** One month of consumption, `date` as `yyyy-MM`, `label` the short French month name. */
export interface MonthlyPoint {
  date: string;
  value: number;
  label: string;
}

/** Last day compared with the day before, plus the 7-day average, for the widget subtitle. */
export interface DayTrend {
  lastDay: number;
  lastDayDate: string;
  prevDay: number;
  prevDayDate: string;
  avg7days: number;
  trend: 'up' | 'down' | 'same';
}

/**
 * Sums daily values per calendar month.
 *
 * @param daily - Days, `date` as `yyyy-MM-dd`.
 * @returns Months in chronological order.
 */
export function toMonthlySeries(daily: DailyPoint[]): MonthlyPoint[] {
  const totals = new Map<string, number>();
  for (const day of daily) {
    const month = day.date.substring(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + day.value);
  }
  return [...totals.entries()]
    .map(([date, value]) => ({
      date,
      value,
      label: format(parseISO(`${date}-01`), 'MMM', { locale: fr }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Value of the same weekday one week earlier, for each day of a range (0 when unknown).
 *
 * @param range - Days to compare.
 * @param all - Every known day.
 * @param isUsable - Whether a day of `all` may serve as comparison (e.g. not an estimate).
 * @returns One value per day of `range`.
 */
export function valuesOneWeekEarlier<T extends DailyPoint>(
  range: T[],
  all: T[],
  isUsable: (day: T) => boolean = () => true,
): number[] {
  return range.map((day) => {
    const weekBefore = format(subDays(parseISO(day.date), 7), 'yyyy-MM-dd');
    const match = all.find((p) => p.date === weekBefore);
    return match && isUsable(match) ? match.value : 0;
  });
}

/**
 * Value of the same month one year earlier, for each month of a range (0 when unknown).
 *
 * @param range - Months to compare.
 * @param all - Every known month.
 * @returns One value per month of `range`.
 */
export function valuesOneYearEarlier(range: MonthlyPoint[], all: MonthlyPoint[]): number[] {
  return range.map((month) => {
    const yearBefore = format(subMonths(parseISO(`${month.date}-01`), 12), 'yyyy-MM');
    return all.find((p) => p.date === yearBefore)?.value ?? 0;
  });
}

/**
 * Compares the last two days of a series; a change within ±2 % counts as stable.
 *
 * @param days - Days in chronological order, already restricted to meaningful readings.
 * @returns The trend, or null with fewer than two days.
 */
export function computeDayTrend(days: DailyPoint[]): DayTrend | null {
  if (days.length < 2) return null;
  const last = days[days.length - 1];
  const prev = days[days.length - 2];
  const last7 = days.slice(-7);
  return {
    lastDay: last.value,
    lastDayDate: last.date,
    prevDay: prev.value,
    prevDayDate: prev.date,
    avg7days: last7.reduce((sum, d) => sum + d.value, 0) / last7.length,
    trend: last.value > prev.value * 1.02 ? 'up' : last.value < prev.value * 0.98 ? 'down' : 'same',
  };
}
