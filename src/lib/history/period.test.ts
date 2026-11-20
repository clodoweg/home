/** period tests — périodes (semaine, mois, année), navigation, an passé, barres et agrégation. */
import { describe, expect, it } from 'vitest';
import {
  aggregateDays,
  comparableDayTotals,
  bucketKeyOfDay,
  isTwelveMonths,
  comparableTotals,
  dayKey,
  percentChange,
  periodBuckets,
  periodContaining,
  periodLabel,
  previousYearLabel,
  previousYearPeriod,
  shiftPeriod,
  sumKnown,
} from './period';

const DAY = new Date('2026-11-19T15:00:00');

describe('periods', () => {
  it('builds the week (from Monday), the month and the year of a day', () => {
    const week = periodContaining('week', DAY);
    expect([dayKey(week.start), dayKey(week.end)]).toEqual(['2026-11-16', '2026-11-23']);
    const month = periodContaining('month', DAY);
    expect([dayKey(month.start), dayKey(month.end)]).toEqual(['2026-11-01', '2026-12-01']);
    const year = periodContaining('year', DAY);
    expect([dayKey(year.start), dayKey(year.end)]).toEqual(['2026-01-01', '2027-01-01']);
  });

  it('moves to the previous and next periods', () => {
    expect(dayKey(shiftPeriod(periodContaining('week', DAY), -1).start)).toBe('2026-11-09');
    expect(dayKey(shiftPeriod(periodContaining('month', DAY), 1).start)).toBe('2026-12-01');
    expect(dayKey(shiftPeriod(periodContaining('year', DAY), -1).start)).toBe('2025-01-01');
  });

  it('faces the same period a year earlier, Mondays facing Mondays', () => {
    expect(dayKey(previousYearPeriod(periodContaining('week', DAY)).start)).toBe('2025-11-17');
    expect(dayKey(previousYearPeriod(periodContaining('month', DAY)).start)).toBe('2025-11-01');
    expect(dayKey(previousYearPeriod(periodContaining('year', DAY)).start)).toBe('2025-01-01');
  });

  it('names the periods in French', () => {
    expect(periodLabel(periodContaining('week', DAY))).toBe('Semaine du 16 nov. 2026');
    expect(periodLabel(periodContaining('month', DAY))).toBe('Novembre 2026');
    expect(periodLabel(periodContaining('year', DAY))).toBe('2026');
    expect(previousYearLabel(periodContaining('week', DAY))).toBe('sem. du 17 nov. 2025');
    expect(previousYearLabel(periodContaining('month', DAY))).toBe('nov. 2025');
    expect(previousYearLabel(periodContaining('year', DAY))).toBe('2025');
  });

  it('splits a period into days or months', () => {
    const week = periodBuckets(periodContaining('week', DAY));
    expect(week.map((b) => b.label)).toEqual([
      'lun.',
      'mar.',
      'mer.',
      'jeu.',
      'ven.',
      'sam.',
      'dim.',
    ]);
    const month = periodBuckets(periodContaining('month', DAY));
    expect(month).toHaveLength(30);
    expect(month[0]).toMatchObject({ key: '2026-11-01', label: '1' });
    const year = periodBuckets(periodContaining('year', DAY));
    expect(year.map((b) => b.key)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
    );
    expect(bucketKeyOfDay('year', '2026-03-04')).toBe('2026-03');
    expect(bucketKeyOfDay('month', '2026-03-04')).toBe('2026-03-04');
  });
});

describe('aggregation', () => {
  const days = [
    { date: '2026-10-31', value: 100 },
    { date: '2026-11-01', value: 2 },
    { date: '2026-11-01', value: 4 },
    { date: '2026-11-03', value: Number.NaN },
    { date: '2026-11-30', value: 5 },
    { date: '2026-12-01', value: 100 },
  ];

  it('sums or averages the days of each bucket, null when unknown', () => {
    const month = periodContaining('month', DAY);
    const sums = aggregateDays(days, month);
    expect(sums[0]).toBe(6);
    expect(sums[1]).toBeNull();
    expect(sums[2]).toBeNull();
    expect(sums[29]).toBe(5);
    expect(aggregateDays(days, month, 'mean')[0]).toBe(3);
    expect(aggregateDays(days, periodContaining('year', DAY))[10]).toBe(11);
  });

  it('totals, changes and like-for-like comparisons', () => {
    expect(sumKnown([null, 1, 2])).toBe(3);
    expect(sumKnown([null])).toBeNull();
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(1, 0)).toBeNull();
    expect(percentChange(null, 1)).toBeNull();
    expect(comparableTotals([1, 2, null], [3, null, 4])).toEqual({ current: 1, previous: 3 });
    expect(comparableTotals([null], [1])).toEqual({ current: null, previous: null });
  });
});

describe('comparableDayTotals', () => {
  it('compares a period in progress with the same days a year earlier only', () => {
    const year = periodContaining('year', new Date('2026-11-19T12:00:00'));
    const previous = previousYearPeriod(year);
    const days = [
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-02', value: 20 },
      { date: '2025-01-01', value: 5 },
      { date: '2025-01-02', value: 5 },
      // November 2025 is complete, November 2026 stops on the 3rd: the rest of 2025 is left out.
      { date: '2025-11-20', value: 100 },
      { date: '2025-12-31', value: 100 },
      { date: '2026-01-03', value: Number.NaN },
    ];
    expect(comparableDayTotals(days, year, previous)).toEqual({ current: 30, previous: 10 });
  });

  it('faces the same weekdays for a week, and knows when nothing is common', () => {
    const week = periodContaining('week', new Date('2026-11-19T12:00:00'));
    const previous = previousYearPeriod(week);
    expect(
      comparableDayTotals(
        [
          { date: '2026-11-16', value: 4 },
          { date: '2025-11-17', value: 2 },
        ],
        week,
        previous,
      ),
    ).toEqual({ current: 4, previous: 2 });
    expect(comparableDayTotals([{ date: '2026-11-16', value: 4 }], week, previous)).toEqual({
      current: null,
      previous: null,
    });
  });
});

describe('sliding year', () => {
  const rolling = periodContaining('rolling', DAY);

  it('covers the 12 complete months before the current one', () => {
    expect([dayKey(rolling.start), dayKey(rolling.end)]).toEqual(['2025-11-01', '2026-11-01']);
    expect(periodLabel(rolling)).toBe('12 mois : nov. 2025 – oct. 2026');
    expect(isTwelveMonths('rolling')).toBe(true);
    expect(isTwelveMonths('month')).toBe(false);
  });

  it('moves one month at a time and faces the 12 months before', () => {
    expect(dayKey(shiftPeriod(rolling, -1).start)).toBe('2025-10-01');
    expect(dayKey(previousYearPeriod(rolling).start)).toBe('2024-11-01');
    expect(previousYearLabel(rolling)).toBe('nov. 2024 – oct. 2025');
  });

  it('is split into its 12 months', () => {
    const buckets = periodBuckets(rolling);
    expect(buckets.map((b) => b.key)[0]).toBe('2025-11');
    expect(buckets.map((b) => b.key)[11]).toBe('2026-10');
    expect(bucketKeyOfDay('rolling', '2026-03-04')).toBe('2026-03');
    expect(
      aggregateDays(
        [
          { date: '2026-10-31', value: 2 },
          { date: '2026-11-01', value: 9 },
        ],
        rolling,
      )[11],
    ).toBe(2);
  });
});
