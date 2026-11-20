/** energy-summary.test — Figures of the home "energy" tile. */
import { describe, expect, it } from 'vitest';
import type { DayTrend } from '../hooks/energy-series';
import { summarizeEnergy } from './energy-summary';

const days = (values: number[]) =>
  values.map((value, index) => ({ date: `2026-11-0${index + 1}`, value }));

const trend: DayTrend = {
  lastDay: 12,
  lastDayDate: '2026-11-07',
  prevDay: 10,
  prevDayDate: '2026-11-06',
  avg7days: 10,
  trend: 'up',
};

describe('summarizeEnergy', () => {
  it('pairs each day with the week before and totals the week', () => {
    const summary = summarizeEnergy(days([1, 2, 3]), [2, 2], null);
    expect(summary?.days).toEqual([
      { date: '2026-11-01', value: 1, previous: 2 },
      { date: '2026-11-02', value: 2, previous: 2 },
      { date: '2026-11-03', value: 3, previous: 0 },
    ]);
    expect(summary?.total).toBe(6);
    expect(summary?.lastDay).toBeNull();
  });

  it('compares the weeks only over days known on both sides', () => {
    // Day 3 has no reading yet, day 4 nothing a week earlier: both are left out.
    const summary = summarizeEnergy(days([10, 10, 0, 50]), [8, 12, 20, 0], null);
    expect(summary?.weekChange).toBeCloseTo(0);
    expect(summarizeEnergy(days([12, 12]), [10, 10], null)?.weekChange).toBeCloseTo(20);
  });

  it('has no week change when no day can be compared', () => {
    expect(summarizeEnergy(days([5, 6]), [0, 0], null)?.weekChange).toBeNull();
  });

  it('gives the last day and its change against the day before', () => {
    expect(summarizeEnergy(days([10, 12]), [], trend)?.lastDay).toEqual({
      date: '2026-11-07',
      value: 12,
      change: 20,
      trend: 'up',
    });
    expect(
      summarizeEnergy(days([1]), [], { ...trend, prevDay: 0, trend: 'up' })?.lastDay?.change,
    ).toBeNull();
  });

  it('returns null without days', () => {
    expect(summarizeEnergy([], [], trend)).toBeNull();
  });
});
