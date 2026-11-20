/** useGasStats tests — last real reading, 7-day and 12-month GRDF aggregates with temperature fallbacks. */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGasStats, type DailyGas, type MonthlyGas } from './useGasStats';

const day = (date: string, value: number, extra: Partial<DailyGas> = {}): DailyGas => ({
  date,
  value,
  ...extra,
});

const month = (date: string, value: number): MonthlyGas => ({ date, value, label: date });

const monthsRange = (
  fromYear: number,
  fromMonth: number,
  count: number,
  valueOf: (i: number) => number,
) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(fromYear, fromMonth - 1 + i, 1);
    return month(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, valueOf(i));
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T12:00:00+01:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGasStats', () => {
  it('returns only nulls without data', () => {
    const { result } = renderHook(() => useGasStats([], []));
    expect(result.current).toEqual({ yesterdayStats: null, weekStats: null, yearStats: null });
  });

  describe('yesterday', () => {
    it('is the last non-estimated reading', () => {
      const daily = [
        day('2026-03-12', 3),
        day('2026-03-13', 4),
        day('2026-03-14', 9, { isEstimate: true }),
      ];
      const { result } = renderHook(() => useGasStats(daily, []));
      expect(result.current.yesterdayStats).toEqual({ consumption: 4, date: '2026-03-13' });
    });

    it('falls back to the last reading when all are estimates', () => {
      const daily = [
        day('2026-03-13', 4, { isEstimate: true }),
        day('2026-03-14', 9, { isEstimate: true }),
      ];
      const { result } = renderHook(() => useGasStats(daily, []));
      expect(result.current.yesterdayStats).toEqual({ consumption: 9, date: '2026-03-14' });
    });
  });

  describe('week', () => {
    it('ends at the last real reading, zeroes estimates and compares with D-7', () => {
      const daily = [
        day('2026-03-01', 1, { temp: 3 }),
        day('2026-03-02', 2, { isEstimate: true }),
        day('2026-03-03', 3),
        day('2026-03-04', 4),
        day('2026-03-05', 5),
        day('2026-03-06', 6, { temp: 5 }),
        day('2026-03-07', 7),
        day('2026-03-08', 8),
        day('2026-03-09', 9, { isEstimate: true }),
        day('2026-03-10', 10),
        day('2026-03-11', 11),
        day('2026-03-12', 12, { temp: 0 }),
        day('2026-03-13', 13, { isEstimate: true }),
        day('2026-03-14', 14, { isEstimate: true }),
      ];
      const { result } = renderHook(() => useGasStats(daily, []));
      const week = result.current.weekStats;

      expect(week?.days.map((d) => [d.date, d.value])).toEqual([
        ['2026-03-06', 6],
        ['2026-03-07', 7],
        ['2026-03-08', 8],
        ['2026-03-09', 0],
        ['2026-03-10', 10],
        ['2026-03-11', 11],
        ['2026-03-12', 12],
      ]);
      // D-7 of 03-06 is 02-27 (absent), of 03-09 is 03-02 (estimate).
      expect(week?.comparisonDays).toEqual([0, 0, 1, 0, 3, 4, 5]);
      expect(week?.totalConsumption).toBe(54);
      expect(week?.avgConsumption).toBe(9);
      expect(week?.maxConsumption).toBe(12);
      // Given temperature first, then the March climatic normal (7.9 °C).
      expect(week?.temperatures).toEqual([5, 7.9, 7.9, 7.9, 7.9, 7.9, 0]);
      expect(week?.comparisonTemperatures).toEqual([4.8, 4.8, 3, 7.9, 7.9, 7.9, 7.9]);
    });

    it('uses the 2024-2025 local history for the temperature fallback', () => {
      const daily = [day('2024-02-10', 0), day('2025-01-20', 0)];
      const { result } = renderHook(() => useGasStats(daily, []));
      const week = result.current.weekStats;

      expect(week?.temperatures).toEqual([9.0, 9.2]);
      expect(week?.comparisonTemperatures).toEqual([9.0, 9.2]);
      expect(week?.maxConsumption).toBe(1);
    });

    it('reports zeros when every reading is an estimate', () => {
      const daily = [day('2026-03-14', 5, { isEstimate: true })];
      const { result } = renderHook(() => useGasStats(daily, []));
      expect(result.current.weekStats).toMatchObject({
        totalConsumption: 0,
        avgConsumption: 0,
        maxConsumption: 1,
        days: [{ date: '2026-03-14', value: 0, isEstimate: true }],
      });
    });
  });

  describe('year', () => {
    it('keeps 12 months, compares with M-12 by date and averages known temperatures', () => {
      const monthly = monthsRange(2024, 1, 24, (i) => i + 1);
      const daily = [
        ...[20, 20, 20, 20, 20, 0].map((t, i) => day(`2024-06-1${i}`, 1, { temp: t })),
        ...[10, 11, 12, 13, 14, 0].map((t, i) => day(`2025-07-1${i}`, 1, { temp: t })),
        ...[1, 2, 3, 4, 5].map((t, i) => day(`2025-08-1${i}`, 1, { temp: t })),
      ];
      const { result } = renderHook(() => useGasStats(daily, monthly));
      const year = result.current.yearStats;

      expect(year?.months.map((m) => m.date)).toEqual(monthly.slice(12).map((m) => m.date));
      expect(year?.comparisonMonths).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(year?.totalConsumption).toBe(222);
      expect(year?.avgMonthly).toBe(18.5);
      expect(year?.maxMonthly).toBe(24);
      // 2025-01 has a local history value; 2025-07 has more than 5 daily temperatures;
      // 2025-08 has only 5, so the climatic normal is used.
      expect(year?.temperatures[0]).toBe(9.2);
      expect(year?.temperatures[1]).toBe(4.8);
      expect(year?.temperatures[6]).toBe(10);
      expect(year?.temperatures[7]).toBe(19.7);
      expect(year?.comparisonTemperatures[0]).toBe(4.5);
      expect(year?.comparisonTemperatures[5]).toBeCloseTo(100 / 6);
      expect(year?.comparisonTemperatures[11]).toBe(5.5);
    });

    it('falls back to zero comparisons and climatic normals', () => {
      const { result } = renderHook(() => useGasStats([], [month('2026-03', 0)]));
      expect(result.current.yearStats).toEqual({
        totalConsumption: 0,
        maxMonthly: 1,
        months: [month('2026-03', 0)],
        avgMonthly: 0,
        comparisonMonths: [0],
        temperatures: [7.9],
        comparisonTemperatures: [7.9],
      });
    });
  });
});
