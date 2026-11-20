/** energy-series tests — monthly totals, week and year comparisons, last-day trend. */
import { describe, expect, it } from 'vitest';
import {
  computeDayTrend,
  toMonthlySeries,
  valuesOneWeekEarlier,
  valuesOneYearEarlier,
} from './energy-series';

describe('toMonthlySeries', () => {
  it('sums the days of each month, in order, with the French short name', () => {
    expect(
      toMonthlySeries([
        { date: '2026-02-01', value: 4 },
        { date: '2026-01-31', value: 2 },
        { date: '2026-01-01', value: 1 },
      ]),
    ).toEqual([
      { date: '2026-01', value: 3, label: 'janv.' },
      { date: '2026-02', value: 4, label: 'févr.' },
    ]);
  });
});

describe('valuesOneWeekEarlier', () => {
  const all = [
    { date: '2026-10-12', value: 5, isEstimate: true },
    { date: '2026-10-13', value: 7, isEstimate: false },
    { date: '2026-10-19', value: 1, isEstimate: false },
    { date: '2026-10-20', value: 2, isEstimate: false },
  ];

  it('takes D-7 by date, 0 when it is missing', () => {
    expect(valuesOneWeekEarlier(all.slice(2), all)).toEqual([5, 7]);
    expect(
      valuesOneWeekEarlier([{ date: '2026-10-25', value: 1, isEstimate: false }], all),
    ).toEqual([0]);
  });

  it('leaves out the days refused by the filter', () => {
    expect(valuesOneWeekEarlier(all.slice(2), all, (day) => !day.isEstimate)).toEqual([0, 7]);
  });
});

describe('valuesOneYearEarlier', () => {
  it('takes M-12 by date, 0 when it is missing', () => {
    const all = [
      { date: '2025-03', value: 9, label: 'mars' },
      { date: '2026-03', value: 4, label: 'mars' },
      { date: '2026-04', value: 2, label: 'avr.' },
    ];
    expect(valuesOneYearEarlier(all.slice(1), all)).toEqual([9, 0]);
  });
});

describe('computeDayTrend', () => {
  const days = (...values: number[]) =>
    values.map((value, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, value }));

  it('needs two days', () => {
    expect(computeDayTrend(days(3))).toBeNull();
  });

  it('compares the last two days and averages the last seven', () => {
    expect(computeDayTrend(days(100, 1, 1, 1, 1, 1, 1, 10, 20))).toEqual({
      lastDay: 20,
      lastDayDate: '2026-10-18',
      prevDay: 10,
      prevDayDate: '2026-10-17',
      avg7days: 35 / 7,
      trend: 'up',
    });
  });

  it.each([
    [[100, 97], 'down'],
    [[100, 101], 'same'],
    [[100, 99], 'same'],
  ])('%j is %s (±2 % counts as stable)', (values, trend) => {
    expect(computeDayTrend(days(...values))?.trend).toBe(trend);
  });
});
