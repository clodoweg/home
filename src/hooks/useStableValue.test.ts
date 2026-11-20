/** useStableValue tests — same reference while the content is unchanged, unchanged parts reused. */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStableValue } from './useStableValue';

describe('useStableValue', () => {
  it('keeps the reference of an equal value and shares unchanged items', () => {
    const a = { id: 'a', state: 'on' };
    const { result, rerender } = renderHook(({ value }) => useStableValue(value), {
      initialProps: { value: [a, { id: 'b', state: 'off' }] },
    });
    const first = result.current;

    rerender({ value: [{ ...a }, { id: 'b', state: 'off' }] });
    expect(result.current).toBe(first);

    rerender({ value: [{ ...a }, { id: 'b', state: 'on' }] });
    expect(result.current).not.toBe(first);
    expect(result.current[0]).toBe(first[0]);
    expect(result.current[1]).toEqual({ id: 'b', state: 'on' });
  });
});
