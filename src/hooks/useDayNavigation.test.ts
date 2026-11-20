/** useDayNavigation tests — starts today, moves back freely, never goes past today. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDayNavigation } from './useDayNavigation';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-10-23T15:00:00+02:00') });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDayNavigation', () => {
  it('moves one day at a time and stops at today', () => {
    const { result } = renderHook(() => useDayNavigation());
    expect(result.current.selectedDate).toEqual(new Date('2026-10-23T00:00:00+02:00'));

    act(() => result.current.goToNextDay());
    expect(result.current.selectedDate).toEqual(new Date('2026-10-23T00:00:00+02:00'));

    act(() => result.current.goToPreviousDay());
    act(() => result.current.goToPreviousDay());
    expect(result.current.selectedDate).toEqual(new Date('2026-10-21T00:00:00+02:00'));

    act(() => result.current.goToNextDay());
    expect(result.current.selectedDate).toEqual(new Date('2026-10-22T00:00:00+02:00'));
  });
});

describe('useDayNavigation after midnight', () => {
  it('moves "today" on with the clock', async () => {
    const { result } = renderHook(() => useDayNavigation());

    await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 60 * 1000));

    expect(result.current.selectedDate).toEqual(new Date('2026-10-24T00:00:00+02:00'));
  });
});
