/** useElectricityStats tests — daily load curve, 7-day, 12-month and header aggregates of Enedis data. */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnedisData } from '../services/api';
import { useElectricityStats } from './useElectricityStats';

type Point = { date: string; value: number };

/** 48 half-hour points of a local (Europe/Paris) day, serialized in UTC like the backend does. */
const localDayCurve = (day: string, value: number): Point[] =>
  Array.from({ length: 48 }, (_, i) => {
    const local = new Date(`${day}T00:00:00`);
    local.setMinutes(i * 30);
    return { date: local.toISOString().replace('.000Z', 'Z'), value };
  });

const enedis = (partial: Partial<EnedisData>): EnedisData => ({
  dailyConsumption: [],
  dailyMaxPower: [],
  loadCurve: [],
  ...partial,
});

const days = (from: string, count: number, valueOf: (i: number) => number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    return { date: iso, value: valueOf(i) };
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T12:00:00+01:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useElectricityStats', () => {
  it('returns only nulls without data', () => {
    const { result } = renderHook(() => useElectricityStats(null));
    expect(result.current).toEqual({
      dailyStats: null,
      weekStats: null,
      yearStats: null,
      headerStats: null,
    });
  });

  it('returns null aggregates for empty series', () => {
    const { result } = renderHook(() => useElectricityStats(enedis({})));
    expect(result.current.dailyStats).toBeNull();
    expect(result.current.weekStats).toBeNull();
    expect(result.current.yearStats).toBeNull();
    expect(result.current.headerStats).toBeNull();
  });

  describe('daily view (load curve)', () => {
    it('aggregates yesterday into hourly kWh with a capitalized French weekday label', () => {
      const loadCurve = [
        ...localDayCurve('2026-03-13', 100),
        ...localDayCurve('2026-03-14', 1000),
        ...localDayCurve('2026-03-15', 5000),
      ].reverse();

      const { result } = renderHook(() => useElectricityStats(enedis({ loadCurve })));
      const daily = result.current.dailyStats;

      expect(daily?.date).toBe('2026-03-14');
      expect(daily?.label).toBe('Samedi');
      expect(daily?.hourlyData).toEqual(new Array(24).fill(1));
      expect(daily?.maxPower).toBe(1000);
      expect(daily?.avgPower).toBe(1000);
      expect(daily?.totalConsumption).toBe(24);
    });

    it('walks back day by day until it finds a full day (48 points)', () => {
      const loadCurve = [
        ...localDayCurve('2026-03-12', 2000),
        { date: '2026-03-14T10:00:00Z', value: 999 },
      ];

      const { result } = renderHook(() => useElectricityStats(enedis({ loadCurve })));

      expect(result.current.dailyStats?.date).toBe('2026-03-12');
      expect(result.current.dailyStats?.label).toBe('Jeudi');
      expect(result.current.dailyStats?.maxPower).toBe(2000);
    });

    it('stops after 5 days back and keeps a partial day', () => {
      const loadCurve = [
        { date: '2026-03-10T10:30:00Z', value: 0 },
        { date: '2026-03-10T10:00:00Z', value: 400 },
      ];

      const { result } = renderHook(() => useElectricityStats(enedis({ loadCurve })));

      expect(result.current.dailyStats).toMatchObject({
        date: '2026-03-10',
        label: 'Mardi',
        maxPower: 400,
        avgPower: 200,
      });
      expect(result.current.dailyStats?.totalConsumption).toBeCloseTo(0.2);
    });

    it('returns null when no point falls in the last 5 days', () => {
      const loadCurve = [{ date: '2026-03-01T10:00:00Z', value: 400 }];
      const { result } = renderHook(() => useElectricityStats(enedis({ loadCurve })));
      expect(result.current.dailyStats).toBeNull();
    });
  });

  describe('week view', () => {
    it('keeps the last 7 days, compares with the 7 before and reads max power in range', () => {
      const dailyConsumption = days('2026-03-01', 14, (i) => (i + 1) * 1000).reverse();
      const dailyMaxPower = [
        { date: '2026-03-07', value: 9000 },
        { date: '2026-03-08', value: 3000 },
        { date: '2026-03-12', value: 4500 },
        { date: '2026-03-15', value: 8000 },
      ];

      const { result } = renderHook(() =>
        useElectricityStats(enedis({ dailyConsumption, dailyMaxPower })),
      );
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
      expect(week?.comparisonDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(week?.maxDailyConsumption).toBe(14000);
      expect(week?.avgDailyConsumption).toBe(11000);
      expect(week?.totalConsumption).toBe(77000);
      expect(week?.maxPowerPeriod).toBe(4500);
    });

    it('has no comparison and zero max power with fewer than 8 days', () => {
      const dailyConsumption = days('2026-03-12', 3, () => 0);
      const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));

      expect(result.current.weekStats).toEqual({
        days: dailyConsumption,
        comparisonDays: [],
        maxDailyConsumption: 0,
        avgDailyConsumption: 0,
        totalConsumption: 0,
        maxPowerPeriod: 0,
      });
    });
  });

  describe('year view', () => {
    it('sums days per month and compares the last 12 months with the 12 before', () => {
      // One day per month from 2024-03 to 2026-02: 24 complete months.
      const dailyConsumption: Point[] = [];
      for (let m = 0; m < 24; m++) {
        const d = new Date(2024, 2 + m, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        dailyConsumption.push({ date: `${month}-01`, value: (m + 1) * 1000 });
        dailyConsumption.push({ date: `${month}-02`, value: 1000 });
      }
      const dailyMaxPower = [
        { date: '2024-01-01', value: 99000 },
        { date: '2025-06-01', value: 7000 },
      ];

      const { result } = renderHook(() =>
        useElectricityStats(
          enedis({ dailyConsumption: dailyConsumption.reverse(), dailyMaxPower }),
        ),
      );
      const year = result.current.yearStats;

      expect(year?.months).toHaveLength(12);
      expect(year?.months[0]).toEqual({ date: '2025-03-01', value: 14000 });
      expect(year?.months[11]).toEqual({ date: '2026-02-01', value: 25000 });
      expect(year?.comparisonMonths).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
      expect(year?.maxMonthlyConsumption).toBe(25000);
      expect(year?.avgMonthlyConsumption).toBe(19500);
      expect(year?.totalConsumption).toBe(234000);
      expect(year?.maxPowerPeriod).toBe(7000);
    });

    it('compares each month with the same month a year earlier, 0 when it is missing', () => {
      const dailyConsumption: Point[] = [];
      for (let m = 0; m < 14; m++) {
        const d = new Date(2025, m, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        dailyConsumption.push({ date: `${month}-15`, value: (m + 1) * 1000 });
      }

      const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));
      const year = result.current.yearStats;

      expect(year?.months[0].date).toBe('2025-03-01');
      expect(year?.comparisonMonths).toEqual([...new Array(10).fill(0), 1, 2]);
      expect(year?.maxPowerPeriod).toBe(0);
    });

    it('returns zeros for a year of empty consumption', () => {
      const dailyConsumption = [{ date: '2026-03-01', value: 0 }];
      const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));
      expect(result.current.yearStats).toMatchObject({
        maxMonthlyConsumption: 0,
        avgMonthlyConsumption: 0,
        totalConsumption: 0,
        maxPowerPeriod: 0,
      });
    });
  });

  describe('header stats', () => {
    it.each([
      [10000, 12000, 'up'],
      [10000, 9000, 'down'],
      [10000, 10100, 'same'],
    ] as const)('prev %i Wh → last %i Wh is trend %s', (prev, last, trend) => {
      const dailyConsumption = [
        { date: '2026-03-14', value: last },
        { date: '2026-03-13', value: prev },
        { date: '2026-03-12', value: 0 },
      ];
      const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));

      expect(result.current.headerStats).toEqual({
        lastDay: last / 1000,
        lastDayDate: '2026-03-14',
        prevDay: prev / 1000,
        prevDayDate: '2026-03-13',
        avg7days: (last + prev) / 2000,
        trend,
      });
    });

    it('averages only the last 7 non-zero days', () => {
      const dailyConsumption = days('2026-03-01', 10, (i) => (i + 1) * 1000);
      const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));
      expect(result.current.headerStats?.avg7days).toBe(7);
    });

    it('needs two non-zero days', () => {
      const dailyConsumption = [
        { date: '2026-03-14', value: 5000 },
        { date: '2026-03-13', value: 0 },
      ];
      const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));
      expect(result.current.headerStats).toBeNull();
    });
  });

  it('memoizes the results while the data reference is unchanged', () => {
    const data = enedis({ dailyConsumption: days('2026-03-10', 5, () => 1000) });
    const { result, rerender } = renderHook(() => useElectricityStats(data));
    const first = result.current.weekStats;
    rerender();
    expect(result.current.weekStats).toBe(first);
  });
});

describe('fixed bugs (regressions)', () => {
  it('B07: buckets yesterday by its own local hours, midnight included', () => {
    const loadCurve = [
      ...localDayCurve('2026-03-13', 100),
      ...localDayCurve('2026-03-14', 1000),
      ...localDayCurve('2026-03-15', 5000),
    ];
    const { result } = renderHook(() => useElectricityStats(enedis({ loadCurve })));

    expect(result.current.dailyStats?.hourlyData).toEqual(new Array(24).fill(1));
    expect(result.current.dailyStats?.maxPower).toBe(1000);
  });

  it('B06: compares each month with the same month one year earlier', () => {
    const dailyConsumption: Point[] = [];
    for (let m = 0; m < 14; m++) {
      const d = new Date(2025, m, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      dailyConsumption.push({ date: `${month}-15`, value: (m + 1) * 1000 });
    }
    const { result } = renderHook(() => useElectricityStats(enedis({ dailyConsumption })));
    const comparison = result.current.yearStats?.comparisonMonths;

    // 2026-01 faces 2025-01 (1 kWh), 2026-02 faces 2025-02 (2 kWh).
    expect(comparison).toHaveLength(12);
    expect(comparison?.[10]).toBe(1);
    expect(comparison?.[11]).toBe(2);
  });
});
