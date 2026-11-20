/**
 * WidgetGrid — Responsive masonry layout for dashboard widgets.
 * A CSS grid of thin rows: each widget spans as many rows as it is tall (useMasonryRows), so an
 * expanded widget never leaves empty space in the other columns, and a wide widget (Lumières,
 * Température, Caméras) takes two columns. Dense placement lets a later widget fill a hole
 * left beside a wide one.
 * Breakpoints: 1 col (mobile), 2 cols (≥800 px), 3 cols (≥1300 px), from the grid's own width.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';

import { useMasonryRows } from '../../hooks/useMasonryRows';

interface WidgetGridItem {
  key: string;
  node: React.ReactNode;
  /** Spans two columns when the grid has at least two. */
  wide?: boolean;
}

interface WidgetGridProps {
  items: WidgetGridItem[];
}

const columnsForWidth = (width: number) => (width >= 1300 ? 3 : width >= 800 ? 2 : 1);

/**
 * Column count of the grid, measured before the first paint and on every resize.
 *
 * @param ref - The grid container.
 * @returns 1, 2 or 3.
 */
function useColumnCount(ref: React.RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(1);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setCols(columnsForWidth(node.offsetWidth));
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(node);
    return () => obs.disconnect();
  }, [ref]);

  return cols;
}

/**
 * Masonry layout of the widgets over 1 to 3 columns. Widgets live in a single list, so a change
 * of column count moves them without remounting them (no request is cancelled and restarted).
 *
 * @param props - Widgets to lay out, in order, each with its stable key and width.
 * @returns The grid.
 */
export const WidgetGrid = ({ items }: WidgetGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cols = useColumnCount(containerRef);
  useMasonryRows(containerRef, 'all');

  return (
    <div
      ref={containerRef}
      data-columns={cols}
      className="grid w-full grid-flow-row-dense auto-rows-[4px] items-start gap-x-3 gap-y-0 md:gap-x-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          data-widget-slot={item.key}
          className="min-w-0"
          style={item.wide && cols > 1 ? { gridColumn: 'span 2' } : undefined}
        >
          {item.node}
        </div>
      ))}
    </div>
  );
};
