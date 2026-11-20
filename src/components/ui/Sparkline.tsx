/** Sparkline — Small line chart of a series in the current text colour, with an optional shaded area and a dot on the latest value (no axes, no chart library). */
import React from 'react';

import { cn } from '../../lib/utils';

interface SparklineProps {
  /** Values in time order; fewer than two draws nothing. */
  values: number[];
  /** Shades the area under the line, which makes the shape easier to read. */
  area?: boolean;
  /** Marks the latest value with a dot at the right end. */
  endDot?: boolean;
  className?: string;
  'data-testid'?: string;
}

/** Vertical position (0 top, 100 bottom) of each value, scaled to the series' own range. */
const yPositions = (values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series is drawn mid-height rather than divided by zero.
  if (max === min) return values.map(() => 50);
  return values.map((value) => 96 - ((value - min) / (max - min)) * 92);
};

/**
 * Draws the series as a polyline filling its box. Decorative: the figures it follows (current,
 * minimum, maximum) are written next to it, so it is hidden from screen readers.
 *
 * @param props - Values, area and end-dot options, classes (size, colour) and test id.
 * @returns The chart, or nothing without enough points.
 */
export const Sparkline = ({
  values,
  area = false,
  endDot = false,
  className,
  'data-testid': testId,
}: SparklineProps) => {
  if (values.length < 2) return null;
  const ys = yPositions(values);
  const coords = ys.map((y, index) => [(index / (values.length - 1)) * 100, y] as const);
  const points = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const lastY = ys[ys.length - 1];

  return (
    <span aria-hidden="true" data-testid={testId} className={cn('relative block', className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block size-full">
        {area && (
          <polygon points={`0,100 ${points} 100,100`} fill="currentColor" fillOpacity={0.18} />
        )}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Drawn in HTML: an SVG circle would be squashed by the stretched viewBox. */}
      {endDot && (
        <span
          className="absolute right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
          style={{ top: `${lastY}%` }}
        />
      )}
    </span>
  );
};
