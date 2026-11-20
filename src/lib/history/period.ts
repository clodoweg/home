/**
 * period — Périodes de l'onglet Historique (semaine, mois, année), leur navigation, leur
 * comparaison avec l'année précédente et leur découpage en barres (jours ou mois).
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';

/** `rolling`: the 12 last complete months (a sliding year), instead of 1 January – 31 December. */
export type Granularity = 'week' | 'month' | 'year' | 'rolling';

/**
 * Whether a granularity covers twelve months, shown as one bar per month.
 *
 * @param granularity - Granularity of the period.
 * @returns True for a calendar year and a sliding year.
 */
export const isTwelveMonths = (granularity: Granularity): boolean =>
  granularity === 'year' || granularity === 'rolling';

/** A period: local midnight `start` included, `end` excluded. */
export interface Period {
  granularity: Granularity;
  start: Date;
  end: Date;
}

/** One bar of a period: a day (week, month) or a month (year). */
export interface Bucket {
  /** `yyyy-MM-dd` for a day, `yyyy-MM` for a month. */
  key: string;
  label: string;
  start: Date;
  end: Date;
}

/** One value per day, `date` as `yyyy-MM-dd`. */
export interface DayValue {
  date: string;
  value: number;
}

/**
 * Local day of a date, as the series key it.
 *
 * @param date - Instant.
 * @returns `yyyy-MM-dd` in the device's time zone.
 */
export const dayKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/**
 * Period of the given granularity containing a date (weeks start on Monday). A sliding year is
 * the 12 complete months before the month of the date: the month in progress is never in it.
 *
 * @param granularity - Week, month, year or sliding year.
 * @param date - Any instant of the period; for a sliding year, an instant of the month after it.
 * @returns The period.
 */
export function periodContaining(granularity: Granularity, date: Date): Period {
  if (granularity === 'rolling') {
    const end = startOfMonth(date);
    return { granularity, start: addMonths(end, -12), end };
  }
  if (granularity === 'week') {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return { granularity, start, end: addWeeks(start, 1) };
  }
  if (granularity === 'month') {
    const start = startOfMonth(date);
    return { granularity, start, end: addMonths(start, 1) };
  }
  const start = startOfYear(date);
  return { granularity, start, end: addYears(start, 1) };
}

/**
 * Period before or after another one, of the same granularity.
 *
 * @param period - Current period.
 * @param delta - -1 for the previous one, 1 for the next one.
 * @returns The shifted period.
 */
export function shiftPeriod(period: Period, delta: number): Period {
  const { granularity, start } = period;
  // A sliding year moves one month at a time.
  if (granularity === 'rolling') return periodContaining(granularity, addMonths(period.end, delta));
  const shifted =
    granularity === 'week'
      ? addWeeks(start, delta)
      : granularity === 'month'
        ? addMonths(start, delta)
        : addYears(start, delta);
  return periodContaining(granularity, shifted);
}

/**
 * The same period one year earlier: the same month or year, or the week 52 weeks before (same
 * weekdays, so Mondays face Mondays).
 *
 * @param period - Current period.
 * @returns The period of the year before.
 */
export function previousYearPeriod(period: Period): Period {
  if (period.granularity === 'week') return periodContaining('week', subWeeks(period.start, 52));
  if (period.granularity === 'rolling')
    return periodContaining('rolling', addYears(period.end, -1));
  return periodContaining(period.granularity, addYears(period.start, -1));
}

/** « déc. 2025 – nov. 2026 »: first and last months of a sliding year. */
const monthSpan = (period: Period): string =>
  `${format(period.start, 'MMM yyyy', { locale: fr })} – ${format(addMonths(period.end, -1), 'MMM yyyy', { locale: fr })}`;

/**
 * Title of a period.
 *
 * @param period - Period.
 * @returns E.g. « Semaine du 16 nov. 2026 », « Novembre 2026 », « 2026 »,
 * « 12 mois : déc. 2025 – nov. 2026 ».
 */
export function periodLabel(period: Period): string {
  if (period.granularity === 'rolling') return `12 mois : ${monthSpan(period)}`;
  if (period.granularity === 'week') {
    return `Semaine du ${format(period.start, 'd MMM yyyy', { locale: fr })}`;
  }
  if (period.granularity === 'month') {
    const label = format(period.start, 'MMMM yyyy', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return format(period.start, 'yyyy');
}

/**
 * Short label of the period one year earlier, for the comparison legends.
 *
 * @param period - Current period.
 * @returns E.g. « nov. 2025 », « 2025 ».
 */
export function previousYearLabel(period: Period): string {
  const previous = previousYearPeriod(period);
  if (period.granularity === 'rolling') return monthSpan(previous);
  if (period.granularity === 'year') return format(previous.start, 'yyyy');
  if (period.granularity === 'month') return format(previous.start, 'MMM yyyy', { locale: fr });
  return `sem. du ${format(previous.start, 'd MMM yyyy', { locale: fr })}`;
}

/**
 * Bars of a period: its days for a week or a month, its months for a year or a sliding year.
 *
 * @param period - Period.
 * @returns The buckets in chronological order.
 */
export function periodBuckets(period: Period): Bucket[] {
  if (isTwelveMonths(period.granularity)) {
    return Array.from({ length: 12 }, (_, i) => {
      const start = addMonths(period.start, i);
      return {
        key: format(start, 'yyyy-MM'),
        label: format(start, 'MMM', { locale: fr }),
        start,
        end: addMonths(start, 1),
      };
    });
  }
  const days = differenceInCalendarDays(period.end, period.start);
  return Array.from({ length: days }, (_, i) => {
    const start = addDays(period.start, i);
    return {
      key: dayKey(start),
      label:
        period.granularity === 'week' ? format(start, 'EEE', { locale: fr }) : format(start, 'd'),
      start,
      end: addDays(start, 1),
    };
  });
}

/**
 * Bucket a day falls in, for a granularity.
 *
 * @param granularity - Granularity of the period.
 * @param day - Day as `yyyy-MM-dd`.
 * @returns The bucket key.
 */
export const bucketKeyOfDay = (granularity: Granularity, day: string): string =>
  isTwelveMonths(granularity) ? day.slice(0, 7) : day;

/**
 * Daily values gathered into the buckets of a period.
 *
 * @param days - Daily values (any range; days outside the period are ignored).
 * @param period - Period.
 * @param mode - `sum` (consumption, counts) or `mean` (temperatures).
 * @returns One value per bucket, null when no day of the bucket is known.
 */
export function aggregateDays(
  days: readonly DayValue[],
  period: Period,
  mode: 'sum' | 'mean' = 'sum',
): (number | null)[] {
  const first = dayKey(period.start);
  const last = dayKey(addDays(period.end, -1));
  const totals = new Map<string, { sum: number; count: number }>();
  for (const { date, value } of days) {
    if (date < first || date > last || !Number.isFinite(value)) continue;
    const key = bucketKeyOfDay(period.granularity, date);
    const total = totals.get(key) ?? { sum: 0, count: 0 };
    total.sum += value;
    total.count += 1;
    totals.set(key, total);
  }
  return periodBuckets(period).map((bucket) => {
    const total = totals.get(bucket.key);
    if (!total) return null;
    return mode === 'sum' ? total.sum : total.sum / total.count;
  });
}

/**
 * Sum of the known values of a series of buckets.
 *
 * @param values - Values per bucket (null = unknown).
 * @returns The sum, or null when nothing is known.
 */
export function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

/**
 * Change of a value against a reference, in percent.
 *
 * @param current - Value of the period.
 * @param reference - Value of the compared period.
 * @returns The change (e.g. -12.5), or null when either is unknown or the reference is 0.
 */
export function percentChange(current: number | null, reference: number | null): number | null {
  if (current === null || reference === null || reference === 0) return null;
  return ((current - reference) / reference) * 100;
}

/**
 * Totals of two periods restricted to the buckets known on both sides, so that a period still in
 * progress (or a meter not yet read) is compared like for like.
 *
 * @param current - Values of the period.
 * @param previous - Values of the compared period, bucket for bucket.
 * @returns Both totals over the common buckets (null when none).
 */
export function comparableTotals(
  current: readonly (number | null)[],
  previous: readonly (number | null)[],
): { current: number | null; previous: number | null } {
  let a = 0;
  let b = 0;
  let count = 0;
  current.forEach((value, i) => {
    const other = previous[i];
    if (value === null || other === null || other === undefined) return;
    a += value;
    b += other;
    count += 1;
  });
  return count === 0 ? { current: null, previous: null } : { current: a, previous: b };
}

/**
 * Totals of a period and of the period a year earlier over the days known on both sides, day by
 * day: the n-th day of the period faces the n-th day of the other one (same weekday for a week).
 * A period in progress, or a meter not read yet, is then compared like for like, whatever the
 * bars (a year's months included).
 *
 * @param days - Daily values covering both periods (an unknown day is absent).
 * @param period - Period shown.
 * @param previous - Period compared.
 * @returns Both totals over the common days (null when none).
 */
export function comparableDayTotals(
  days: readonly DayValue[],
  period: Period,
  previous: Period,
): { current: number | null; previous: number | null } {
  const values = new Map<string, number>();
  for (const { date, value } of days) {
    if (Number.isFinite(value)) values.set(date, (values.get(date) ?? 0) + value);
  }
  let current = 0;
  let before = 0;
  let count = 0;
  for (let i = 0; addDays(period.start, i) < period.end; i++) {
    const other = addDays(previous.start, i);
    if (other >= previous.end) break;
    const a = values.get(dayKey(addDays(period.start, i)));
    const b = values.get(dayKey(other));
    if (a === undefined || b === undefined) continue;
    current += a;
    before += b;
    count += 1;
  }
  return count === 0 ? { current: null, previous: null } : { current, previous: before };
}
