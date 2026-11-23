/** WidgetGrid tests — columns follow the width, wide widgets take two, widgets mount once. */
import { act, render, screen } from '@testing-library/react';
import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetGrid } from './WidgetGrid';

let width = 1600;
let resize: () => void = () => {};

beforeEach(() => {
  width = 1600;
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mounts: string[] = [];
const Probe = ({ id }: { id: string }) => {
  useEffect(() => {
    mounts.push(id);
  }, [id]);
  return <span data-testid={`probe-${id}`} />;
};

const grid = () => screen.getByTestId('grid-host').firstElementChild as HTMLElement;
const slot = (id: string) => grid().querySelector<HTMLElement>(`[data-widget-slot="${id}"]`)!;

const renderGrid = () =>
  render(
    <div data-testid="grid-host">
      <WidgetGrid
        items={['a', 'b', 'c', 'd'].map((id) => ({
          key: id,
          node: <Probe id={id} />,
          wide: id === 'b',
        }))}
      />
    </div>,
  );

describe('WidgetGrid', () => {
  beforeEach(() => {
    mounts.length = 0;
  });

  it('B31: mounts each widget once, in order, with the columns measured before paint', () => {
    renderGrid();

    expect(grid().dataset.columns).toBe('3');
    // Read back normalized, as browsers do (jsdom 31+): `0` becomes `0px`.
    expect(grid().style.gridTemplateColumns).toBe('repeat(3, minmax(0px, 1fr))');
    expect(mounts).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives a wide widget two columns, except on a single column', () => {
    renderGrid();
    expect(slot('b').style.gridColumn).toBe('span 2');
    expect(slot('a').style.gridColumn).toBe('');

    width = 400;
    act(() => resize());
    expect(grid().dataset.columns).toBe('1');
    expect(slot('b').style.gridColumn).toBe('');
  });

  it('follows the width across breakpoints without remounting the widgets', () => {
    renderGrid();

    width = 1200;
    act(() => resize());
    expect(grid().dataset.columns).toBe('2');

    width = 400;
    act(() => resize());
    expect(grid().dataset.columns).toBe('1');
    expect(mounts).toEqual(['a', 'b', 'c', 'd']);
  });
});
