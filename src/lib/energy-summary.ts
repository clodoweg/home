/** energy-summary — Week and last-day figures of the home "energy" tile, from the widgets' own statistics. */
import type { DailyPoint, DayTrend } from '../hooks/energy-series';

/** One day of the week, with the same weekday one week earlier (0 when unknown). */
interface EnergySummaryDay {
  date: string;
  value: number;
  previous: number;
}

/** What the "energy" tile shows for one supply (electricity, gas or water). */
export interface EnergySummary {
  /** The 7 days the widget's week view shows, oldest first. */
  days: EnergySummaryDay[];
  /** Total of those 7 days, as in the widget's week view. */
  total: number;
  /** Change against the week before, in %, over the days known in both weeks; null when none. */
  weekChange: number | null;
  /** Last known day and its change against the day before, in %; null with fewer than two days. */
  lastDay: { date: string; value: number; change: number | null; trend: DayTrend['trend'] } | null;
}

const percentChange = (value: number, reference: number) =>
  reference > 0 ? ((value - reference) / reference) * 100 : null;

/**
 * Builds the tile figures of one supply from what its widget already computes.
 *
 * @param days - The week view's days (same unit as `previous` and `trend`).
 * @param previous - The week view's comparison values, one per day (0 when unknown).
 * @param trend - The widget's last-day trend.
 * @returns The summary, or null when the widget has no week to show.
 */
export function summarizeEnergy(
  days: DailyPoint[],
  previous: number[],
  trend: DayTrend | null,
): EnergySummary | null {
  if (days.length === 0) return null;
  const week = days.map((day, index) => ({
    date: day.date,
    value: day.value,
    previous: previous[index] ?? 0,
  }));
  // A day at 0 is a day not read yet (Suez) or an estimate left out (GRDF): comparing the
  // weeks over it would show a drop that did not happen. Only days known on both sides count.
  const comparable = week.filter((day) => day.value > 0 && day.previous > 0);
  const weekChange = percentChange(
    comparable.reduce((sum, day) => sum + day.value, 0),
    comparable.reduce((sum, day) => sum + day.previous, 0),
  );

  return {
    days: week,
    total: week.reduce((sum, day) => sum + day.value, 0),
    weekChange: comparable.length > 0 ? weekChange : null,
    lastDay: trend && {
      date: trend.lastDayDate,
      value: trend.lastDay,
      change: percentChange(trend.lastDay, trend.prevDay),
      trend: trend.trend,
    },
  };
}
