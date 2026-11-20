/** useHistoryView tests — choix gardés sur l'appareil, navigation bornée à la période en cours. */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dayKey } from '../../lib/history/period';
import { HISTORY_VIEW_STORAGE_KEY, useHistoryView } from './useHistoryView';

const NOW = new Date('2026-11-19T10:00:00');

beforeEach(() => {
  window.localStorage.clear();
});

describe('useHistoryView', () => {
  it('starts on the current month, compared with last year', () => {
    const { result } = renderHook(() => useHistoryView(NOW));
    expect(result.current).toMatchObject({
      tab: 'energie',
      granularity: 'month',
      compare: true,
      unit: 'quantity',
      isCurrent: true,
    });
    expect(dayKey(result.current.period.start)).toBe('2026-11-01');
    expect(dayKey(result.current.previous.start)).toBe('2025-11-01');
  });

  it('moves back, but never past the current period', () => {
    const { result } = renderHook(() => useHistoryView(NOW));
    act(() => result.current.shift(1));
    expect(dayKey(result.current.period.start)).toBe('2026-11-01');
    act(() => result.current.shift(-1));
    expect(dayKey(result.current.period.start)).toBe('2026-10-01');
    expect(result.current.isCurrent).toBe(false);
    act(() => result.current.setGranularity('year'));
    expect(dayKey(result.current.period.start)).toBe('2026-01-01');
  });

  it('shows the last 12 complete months for a sliding year, and never the month in progress', () => {
    const { result } = renderHook(() => useHistoryView(NOW));
    act(() => result.current.setGranularity('rolling'));
    expect(dayKey(result.current.period.start)).toBe('2025-11-01');
    expect(result.current.isCurrent).toBe(true);
    act(() => result.current.shift(1));
    expect(dayKey(result.current.period.end)).toBe('2026-11-01');
    act(() => result.current.shift(-1));
    expect(dayKey(result.current.period.start)).toBe('2025-10-01');
    expect(result.current.isCurrent).toBe(false);
    act(() => result.current.shift(1));
    expect(dayKey(result.current.period.end)).toBe('2026-11-01');
  });

  it('keeps the end of the period shown when the granularity changes', () => {
    const { result } = renderHook(() => useHistoryView(NOW));
    act(() => result.current.setGranularity('year'));
    act(() => result.current.shift(-1));
    act(() => result.current.setGranularity('rolling'));
    expect([dayKey(result.current.period.start), dayKey(result.current.period.end)]).toEqual([
      '2025-01-01',
      '2026-01-01',
    ]);
    act(() => result.current.setGranularity('month'));
    expect(dayKey(result.current.period.start)).toBe('2025-12-01');
  });

  it('remembers the choices on the device', () => {
    const first = renderHook(() => useHistoryView(NOW));
    act(() => {
      first.result.current.setTab('climat');
      first.result.current.setGranularity('week');
      first.result.current.setCompare(false);
      first.result.current.setUnit('cost');
    });
    const second = renderHook(() => useHistoryView(NOW));
    expect(second.result.current).toMatchObject({
      tab: 'climat',
      granularity: 'week',
      compare: false,
      unit: 'cost',
    });
  });

  it('ignores an unreadable or invalid memory', () => {
    window.localStorage.setItem(HISTORY_VIEW_STORAGE_KEY, '{oops');
    expect(renderHook(() => useHistoryView(NOW)).result.current.tab).toBe('energie');
    window.localStorage.setItem(
      HISTORY_VIEW_STORAGE_KEY,
      JSON.stringify({ tab: 'x', granularity: 'day', compare: 'yes', unit: 'x' }),
    );
    expect(renderHook(() => useHistoryView(NOW)).result.current).toMatchObject({
      tab: 'energie',
      granularity: 'month',
      compare: true,
      unit: 'quantity',
    });
  });

  it('survives a storage that refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useHistoryView(NOW));
    act(() => result.current.setTab('croiser'));
    expect(result.current.tab).toBe('croiser');
  });
});
