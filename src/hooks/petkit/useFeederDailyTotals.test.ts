/** useFeederDailyTotals tests — consumed rations, schedule plan totals and today's colour class. */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PetKitData, PetkitRecord } from '../../services/api';
import { useFeederDailyTotals } from './useFeederDailyTotals';

// Friday 2026-10-23, 12:00 in Paris (weekday 5).
const FRIDAY_NOON = new Date('2026-10-23T12:00:00+02:00');

/** Unix seconds for a Paris wall-clock time. */
const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

type FeedRecord = Record<string, unknown>;

/** Wraps records into the PetKitData shape the hook reads. */
const withRecords = (records: FeedRecord[]) => ({ devices: [], records }) as unknown as PetKitData;

beforeEach(() => {
  vi.useFakeTimers({ now: FRIDAY_NOON });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFeederDailyTotals consumed rations', () => {
  it('sums real amounts of past feed events of today and yesterday', () => {
    const data = withRecords([
      {
        type: 4,
        deviceId: 1,
        time: at('2026-10-23T08:00:00+02:00'),
        state: { realAmount1: 2, realAmount2: 1 },
      },
      {
        type: 5,
        deviceId: 1,
        time: at('2026-10-23T09:00:00+02:00'),
        amount1: 1,
        amount2: 1,
        state: 3,
      },
      {
        type: 4,
        deviceId: 1,
        time: at('2026-10-23T10:00:00+02:00'),
        state: { realAmount1: 1 },
        amount2: 4,
      },
      { type: 4, deviceId: 1, time: at('2026-10-23T11:00:00+02:00') },
      { type: 3, deviceId: 1, time: at('2026-10-23T09:30:00+02:00'), amount1: 9 },
      { type: 4, deviceId: 1, time: at('2026-10-23T18:00:00+02:00'), amount1: 9 },
      { type: 4, deviceId: 1, time: at('2026-10-22T20:00:00+02:00'), amount1: 2, amount2: 2 },
      {
        type: 5,
        deviceId: 1,
        time: at('2026-10-22T21:00:00+02:00'),
        state: { realAmount2: 3 },
        amount1: 1,
      },
      { type: 4, deviceId: 1, time: at('2026-10-22T22:00:00+02:00') },
      { type: 4, deviceId: 1, time: at('2026-10-21T20:00:00+02:00'), amount1: 7 },
    ]);

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data, device: undefined, pendingFeedings: [] }),
    );

    // 3 (state) + 2 (amounts, numeric state) + 5 (realAmount1 + amount2) + 0 (no amounts).
    expect(result.current.todayTotalRations).toBe(10);
    expect(result.current.yesterdayTotalRations).toBe(4 + 4);
  });

  it('merges pending feedings and drops duplicates on type, device, time and id', () => {
    const time = at('2026-10-23T08:00:00+02:00');
    const real = { type: 4, deviceId: 1, time, eventId: 'e1', amount1: 1 };
    const pending = [
      { type: 4, deviceId: 1, time, eventId: 'e1', amount1: 1 },
      { type: 4, deviceId: 1, time: at('2026-10-23T11:00:00+02:00'), id: 'opt_1', amount1: 2 },
      { type: 4, deviceId: 1, time: at('2026-10-23T11:00:00+02:00'), amount1: 2 },
      { type: 4, deviceId: 1, time: at('2026-10-23T11:00:00+02:00'), amount1: 2 },
    ];

    const { result } = renderHook(() =>
      useFeederDailyTotals({
        data: withRecords([real]),
        device: undefined,
        pendingFeedings: pending as unknown as PetkitRecord[],
      }),
    );

    expect(result.current.todayTotalRations).toBe(1 + 2 + 2);
  });

  it("falls back to the device's daily feed totals when today has no event", () => {
    const device = { dailyFeed: { realAmountTotal1: 3, realAmountTotal2: 2 } };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayTotalRations).toBe(5);
    expect(result.current.yesterdayTotalRations).toBe(0);
  });

  it('counts zero when there is neither event nor daily feed', () => {
    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device: { dailyFeed: {} }, pendingFeedings: [] }),
    );

    expect(result.current.todayTotalRations).toBe(0);
    expect(result.current.todayColorClass).toBe('text-destructive');
  });
});

describe('useFeederDailyTotals plan totals', () => {
  const items = (n: number) => [{ amount1: n, amount2: 1 }, { amount1: 1 }];

  it('picks the first non-suspended schedule whose weekday bit is set', () => {
    const device = {
      status: {
        feedSchedule: [
          { repeats: 1 << 4, suspended: true, items: items(100) },
          { repeats: 1 << 4, items: items(2) },
          { repeats: 1 << 3, items: items(9) },
        ],
      },
    };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(4);
    // Thursday is bit 3.
    expect(result.current.yesterdayPlanTotal).toBe(11);
  });

  it('matches a weekday bitmask and reads the top-level feedSchedule', () => {
    const device = {
      feedSchedule: [
        { repeats: 0, items: items(50) },
        { repeats: 1 << 4, items: items(3) },
        { repeats: 1 << 3 },
      ],
    };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(5);
    expect(result.current.yesterdayPlanTotal).toBe(0);
  });

  it('matches the every-day mask 127', () => {
    const device = { feedSchedule: [{ repeats: 127, items: [{ amount2: 6 }] }] };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(6);
    expect(result.current.yesterdayPlanTotal).toBe(6);
  });

  it('maps Sunday to bit 6 for today', () => {
    vi.setSystemTime(new Date('2026-10-25T12:00:00+01:00'));
    const device = { feedSchedule: [{ repeats: 1 << 6, items: [{ amount1: 4 }] }] };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(4);
    expect(result.current.yesterdayPlanTotal).toBe(0);
  });

  it('maps Sunday to bit 6 for yesterday', () => {
    vi.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    const device = { feedSchedule: [{ repeats: 1 << 6, items: [{ amount1: 4 }] }] };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(0);
    expect(result.current.yesterdayPlanTotal).toBe(4);
  });

  // The back sends a weekday bit mask (127 = every day): 7 is Monday to Wednesday, not Sunday.
  it('B26: reads repeats as a weekday bit mask only', () => {
    vi.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    const device = { feedSchedule: [{ repeats: 7, items: [{ amount1: 4 }] }] };

    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(4);
    expect(result.current.yesterdayPlanTotal).toBe(0);
  });

  it('is zero without any schedule', () => {
    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device: undefined, pendingFeedings: [] }),
    );

    expect(result.current.todayPlanTotal).toBe(0);
    expect(result.current.yesterdayPlanTotal).toBe(0);
  });
});

describe('useFeederDailyTotals colour class', () => {
  const plan = { feedSchedule: [{ repeats: 127, items: [{ amount1: 4 }] }] };

  it('is green once the plan is met', () => {
    const device = { ...plan, dailyFeed: { realAmountTotal1: 4 } };
    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );
    expect(result.current.todayColorClass).toBe('text-success');
  });

  it('is orange while something was eaten but the plan is not met', () => {
    const device = { ...plan, dailyFeed: { realAmountTotal2: 1 } };
    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );
    expect(result.current.todayColorClass).toBe('text-warning');
  });

  it('is orange, not green, when food was served without any plan', () => {
    const device = { dailyFeed: { realAmountTotal1: 2 } };
    const { result } = renderHook(() =>
      useFeederDailyTotals({ data: null, device, pendingFeedings: [] }),
    );
    expect(result.current.todayColorClass).toBe('text-warning');
  });
});

describe('fixed bugs (regressions)', () => {
  it('B29: moves to the new day when the app stays open past midnight', async () => {
    const data = withRecords([
      { type: 4, deviceId: 1, time: at('2026-10-23T08:00:00+02:00'), amount1: 1, amount2: 1 },
    ]);
    const { result, rerender } = renderHook(() =>
      useFeederDailyTotals({ data, device: undefined, pendingFeedings: [] }),
    );
    expect(result.current.todayTotalRations).toBe(2);

    await vi.advanceTimersByTimeAsync(13 * 60 * 60 * 1000);
    rerender();

    expect(result.current.todayTotalRations).toBe(0);
    expect(result.current.yesterdayTotalRations).toBe(2);
  });
});
