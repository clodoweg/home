/** useElementWidth tests — measures on attach and on resize, minus the inset, and stops on detach. */
import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementWidth } from './useElementWidth';

let resize: () => void = () => {};
const disconnect = vi.fn();
let width = 300;

beforeEach(() => {
  width = 300;
  disconnect.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width }) as DOMRect,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const Probe = ({ inset, shown = true }: { inset?: number; shown?: boolean }) => {
  const [ref, measured] = useElementWidth(inset);
  return (
    <>
      <span data-testid="width">{measured}</span>
      {shown && <div ref={ref} />}
    </>
  );
};

describe('useElementWidth', () => {
  it('measures the element at once and after each resize', () => {
    const { getByTestId } = render(<Probe inset={32} />);
    expect(getByTestId('width')).toHaveTextContent('268');

    width = 20;
    act(() => resize());
    expect(getByTestId('width')).toHaveTextContent('0');
  });

  it('stops observing when the element goes away', () => {
    const { rerender } = render(<Probe />);
    rerender(<Probe shown={false} />);
    expect(disconnect).toHaveBeenCalled();
  });
});
