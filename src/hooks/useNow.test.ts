/** useNow tests — the reference time keeps moving (B15: alarm windows frozen at load time). */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

afterEach(() => {
  vi.useRealTimers();
});

describe('useNow', () => {
  it('starts at the current time and follows the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    const { result } = renderHook(() => useNow(60_000));
    expect(result.current).toBe(Date.parse('2026-10-23T10:00:00Z'));

    act(() => vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000));

    expect(result.current).toBe(Date.parse('2026-10-25T10:00:00Z'));
  });

  it('stops its timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useNow(1_000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
