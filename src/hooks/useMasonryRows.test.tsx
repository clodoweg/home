/** useMasonryRows tests — row spans from heights, media query on and off, children changes. */
import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { masonryRowSpan, useMasonryRows } from './useMasonryRows';

type Listener = () => void;

let mediaMatches = true;
let mediaListeners: Listener[] = [];
let resizeCallbacks: Listener[] = [];

const Grid = ({ count, gap = '16px' }: { count: number; gap?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useMasonryRows(ref, '(min-width: 1280px)');
  return (
    <div ref={ref} data-testid="grid" style={{ columnGap: gap }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} data-testid={`tile-${index}`} data-height={100 * (index + 1)} />
      ))}
    </div>
  );
};

beforeEach(() => {
  mediaMatches = true;
  mediaListeners = [];
  resizeCallbacks = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return mediaMatches;
      },
      addEventListener: (_: string, listener: Listener) => mediaListeners.push(listener),
      removeEventListener: (_: string, listener: Listener) => {
        mediaListeners = mediaListeners.filter((other) => other !== listener);
      },
    })),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: Listener) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return { height: Number(this.dataset.height ?? 0) } as DOMRect;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('masonryRowSpan', () => {
  it('counts 4 px rows, gap included, at least one', () => {
    expect(masonryRowSpan(100, 16)).toBe(29);
    expect(masonryRowSpan(101, 16)).toBe(30);
    expect(masonryRowSpan(0, 0)).toBe(1);
  });
});

describe('useMasonryRows', () => {
  it('makes each child span its height while the query matches', () => {
    const { getByTestId } = render(<Grid count={2} />);
    expect(getByTestId('tile-0').style.gridRowEnd).toBe('span 29');
    expect(getByTestId('tile-1').style.gridRowEnd).toBe('span 54');
  });

  it('re-measures a child that changes height', () => {
    const { getByTestId } = render(<Grid count={1} />);
    getByTestId('tile-0').dataset.height = '300';
    act(() => resizeCallbacks.forEach((callback) => callback()));
    expect(getByTestId('tile-0').style.gridRowEnd).toBe('span 79');
  });

  it('gives children back their normal rows below the breakpoint', () => {
    const { getByTestId } = render(<Grid count={1} />);
    mediaMatches = false;
    act(() => mediaListeners.forEach((listener) => listener()));
    expect(getByTestId('tile-0').style.gridRowEnd).toBe('');
  });

  it('lays out a child added later', async () => {
    const { getByTestId, rerender } = render(<Grid count={1} />);
    rerender(<Grid count={2} />);
    await vi.waitFor(() => expect(getByTestId('tile-1').style.gridRowEnd).toBe('span 54'));
  });

  it('keeps no space under a child of a grid without gap', () => {
    const { getByTestId } = render(<Grid count={1} gap="" />);
    expect(getByTestId('tile-0').style.gridRowEnd).toBe('span 25');
  });

  it('leaves the grid alone without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { getByTestId } = render(<Grid count={1} />);
    expect(getByTestId('tile-0').style.gridRowEnd).toBe('');
  });

  it('stops listening on unmount', () => {
    const { unmount } = render(<Grid count={1} />);
    unmount();
    expect(mediaListeners).toHaveLength(0);
  });
});
