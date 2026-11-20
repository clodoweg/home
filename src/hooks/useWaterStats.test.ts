/** useWaterStats tests — last non-zero reading, 7-day and 12-month Suez aggregates with M-12 comparisons. */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWaterStats, type DailyWater, type MonthlyWater } from './useWaterStats';

const day = (date: string, value: number, cost = value / 100): DailyWater => ({
  date,
  value,
  cost,
});
const month = (date: string, value: number): MonthlyWater => ({ date, value, label: date });

describe('useWaterStats', () => {
  it('returns only nulls without data', () => {
    const { result } = renderHook(() => useWaterStats([], []));
    expect(result.current).toEqual({ yesterdayStats: null, weekStats: null, yearStats: null });
  });

  it('reports the last non-zero day as yesterday', () => {
    const daily = [day('2026-03-12', 120), day('2026-03-13', 150, 0.6), day('2026-03-14', 0)];
    const { result } = renderHook(() => useWaterStats(daily, []));
    expect(result.current.yesterdayStats).toEqual({
      consumption: 150,
      date: '2026-03-13',
      cost: 0.6,
    });
  });

  it('has no yesterday when every day is zero', () => {
    const { result } = renderHook(() => useWaterStats([day('2026-03-14', 0)], []));
    expect(result.current.yesterdayStats).toBeNull();
    expect(result.current.weekStats?.maxConsumption).toBe(1);
  });

  it('keeps the last 7 days and compares each with D-7 by date', () => {
    const daily = Array.from({ length: 12 }, (_, i) =>
      day(`2026-03-${String(i + 3).padStart(2, '0')}`, (i + 1) * 10),
    );
    const { result } = renderHook(() => useWaterStats(daily, []));
    const week = result.current.weekStats;

    expect(week?.days.map((d) => d.date)).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
    ]);
    // D-7 of 03-08 and 03-09 (03-01, 03-02) are absent.
    expect(week?.comparisonDays).toEqual([0, 0, 10, 20, 30, 40, 50]);
    expect(week?.totalConsumption).toBe(630);
    expect(week?.avgConsumption).toBe(90);
    expect(week?.maxConsumption).toBe(120);
  });

  it('keeps the last 12 months and compares with M-12 by date', () => {
    const monthly = [
      month('2024-12', 999),
      month('2025-01', 100),
      ...Array.from({ length: 12 }, (_, i) => {
        const d = new Date(2025, 2 + i, 1);
        return month(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 50);
      }),
    ];
    const { result } = renderHook(() => useWaterStats([], monthly));
    const year = result.current.yearStats;

    expect(year?.months[0].date).toBe('2025-03');
    expect(year?.months[11].date).toBe('2026-02');
    // Only 2025-12 and 2026-01 have their M-12 (2024-12, 2025-01).
    expect(year?.comparisonMonths).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 999, 100, 0]);
    expect(year?.totalConsumption).toBe(600);
    expect(year?.avgMonthly).toBe(50);
    expect(year?.maxMonthly).toBe(999);
  });

  it('finds the same month one year earlier', () => {
    const monthly = [month('2025-03', 80), month('2026-03', 40)];
    const { result } = renderHook(() => useWaterStats([], monthly));
    expect(result.current.yearStats).toMatchObject({
      comparisonMonths: [0, 80],
      maxMonthly: 80,
      totalConsumption: 120,
      avgMonthly: 60,
    });
  });
});
