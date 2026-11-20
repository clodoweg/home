/** useHeldValue tests — a held value expires after its duration, each change restarts it. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeldValue } from './useHeldValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHeldValue', () => {
  it('holds each new value for the whole duration', () => {
    const { result } = renderHook(() => useHeldValue<number>(3000));
    expect(result.current[0]).toBeNull();

    act(() => result.current[1](21));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current[1](22));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current[0]).toBe(22);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current[0]).toBeNull();
  });

  it('unmounts cleanly when nothing was held', () => {
    const { unmount } = renderHook(() => useHeldValue<number>(3000));
    expect(() => unmount()).not.toThrow();
  });

  it('clears its timer on unmount', () => {
    const { result, unmount } = renderHook(() => useHeldValue<number>(3000));
    act(() => result.current[1](21));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
