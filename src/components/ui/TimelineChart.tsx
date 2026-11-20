/**
 * TimelineChart — Horizontal 24h band of discrete states (e.g. alarm, light).
 * Renders SVG rects for each segment between consecutive points.
 */
import React, { useMemo, useId } from 'react';

interface TimelineChartProps {
  data: { timestamp: number; state: number }[];
  width: number;
  height?: number;
  getColor?: (state: number, isToday: boolean) => string;
  hours?: number;
  tickInterval?: number;
}

const DEFAULT_COLOR = (s: number) => {
  if (s === 1) return '#10b981';
  if (s === 0) return 'transparent'; // Change to transparent to let background segments show through when off
  return '#6b7280';
};

/**
 * Renders a horizontal band of discrete state segments (e.g. alarm on/off) over time.
 * Supports dividing the background into day segments using midnight markers, shading
 * older day segments darker to visually differentiate days.
 *
 * @param {TimelineChartProps} props - The properties for the timeline chart.
 * @param {{ timestamp: number; state: number }[]} props.data - Historical state change points.
 * @param {number} props.width - Width of the timeline band in pixels.
 * @param {number} [props.height=28] - Total height including labels.
 * @param {(state: number, isToday: boolean) => string} [props.getColor] - Function mapping state code to hex/HSL color.
 * @param {number} [props.hours=24] - Time range shown by the timeline in hours (e.g. 24 or 48).
 * @param {number} [props.tickInterval=4] - Interval between vertical timeline ticks in hours.
 * @returns {React.JSX.Element | null} The rendered timeline component.
 */
export const TimelineChart = ({
  data,
  width,
  height = 28,
  getColor = DEFAULT_COLOR,
  hours = 24,
  tickInterval = 4,
}: TimelineChartProps) => {
  const clipId = useId();
  /* eslint-disable react-hooks/purity -- Timeline inherently needs current time to render relative positions */
  const segments = useMemo(() => {
    if (data.length === 0 || !width) return null;

    const now = Date.now();
    const windowMs = hours * 60 * 60 * 1000;
    const start = now - windowMs;
    const todayStart = new Date().setHours(0, 0, 0, 0);

    // Compute all midnight timestamps within our history window
    const midnights: number[] = [];
    const firstMidnight = new Date(start);
    firstMidnight.setHours(24, 0, 0, 0);
    let currentMidnight = firstMidnight.getTime();
    while (currentMidnight < now) {
      midnights.push(currentMidnight);
      currentMidnight += 24 * 60 * 60 * 1000;
    }

    // Segment the background into individual calendar days
    const daySegs: { x: number; w: number; color: string; opacity: number }[] = [];
    const dayBoundaries = [start, ...midnights, now];
    for (let i = 0; i < dayBoundaries.length - 1; i++) {
      const dStart = dayBoundaries[i];
      const dEnd = dayBoundaries[i + 1];
      const x = ((dStart - start) / windowMs) * width;
      const w = ((dEnd - dStart) / windowMs) * width;
      const relativeIndex = dayBoundaries.length - 2 - i; // 0 = today, 1 = yesterday, etc.

      let opacity = 0.02; // Very subtle overlay for today
      if (relativeIndex === 1) {
        // Opacity set to 0.08 to clearly differentiate yesterday from today
        opacity = 0.08;
      } else if (relativeIndex >= 2) {
        // Opacity set to 0.16 to emphasize visual contrast for older day segments
        opacity = 0.16;
      }

      daySegs.push({
        x,
        w: Math.max(0, w),
        color: 'hsl(var(--foreground))',
        opacity,
      });
    }

    const clamped = data
      .filter((p) => p.timestamp >= start - windowMs)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (clamped.length === 0) return null;

    const segs: { x: number; w: number; color: string }[] = [];
    for (let i = 0; i < clamped.length; i++) {
      const p = clamped[i];
      const next = clamped[i + 1];
      const segStart = Math.max(p.timestamp, start);
      const segEnd = Math.min(next ? next.timestamp : now, now);
      if (segEnd <= segStart) continue;
      const x = ((segStart - start) / windowMs) * width;
      const w = ((segEnd - segStart) / windowMs) * width;
      const isToday = segStart >= todayStart;
      segs.push({ x, w: Math.max(1, w), color: getColor(p.state, isToday) });
    }

    // Align ticks to exact multiples of tickInterval on the calendar (e.g. 0h, 4h, 8h, 12h...)
    const firstTickDate = new Date(start);
    firstTickDate.setMinutes(0, 0, 0);
    const remainder = firstTickDate.getHours() % tickInterval;
    if (remainder !== 0) {
      firstTickDate.setHours(firstTickDate.getHours() + (tickInterval - remainder));
    } else {
      if (firstTickDate.getTime() < start) {
        firstTickDate.setHours(firstTickDate.getHours() + tickInterval);
      }
    }

    const hourTicks: { h: number; x: number; label: string; isFirst: boolean; isLast: boolean }[] =
      [];
    let tickTime = firstTickDate.getTime();
    while (tickTime <= now) {
      const date = new Date(tickTime);
      const hoursVal = date.getHours();

      let label = `${hoursVal}h`;
      if (hoursVal === 0) {
        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
        label = `${dayName} 00h`;
      }

      const x = ((tickTime - start) / windowMs) * width;
      const isFirst = hourTicks.length === 0;
      const isLast = tickTime + tickInterval * 60 * 60 * 1000 > now;

      hourTicks.push({
        h: hoursVal,
        x,
        label,
        isFirst,
        isLast,
      });

      tickTime += tickInterval * 60 * 60 * 1000;
    }

    return { segs, hourTicks, midnights, daySegs, start, windowMs };
  }, [data, width, getColor, hours, tickInterval]);
  /* eslint-enable react-hooks/purity */

  if (!segments) return null;

  const bandHeight = height - 16;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <clipPath id={`timeline-clip-${clipId}`}>
          <rect x={0} y={0} width={width} height={bandHeight} rx={6} />
        </clipPath>
      </defs>

      {/* Background areas for each day */}
      <g clipPath={`url(#timeline-clip-${clipId})`}>
        {segments.daySegs.map((ds) => (
          <rect
            key={`bg-${ds.x}`}
            x={ds.x}
            y={0}
            width={ds.w}
            height={bandHeight}
            fill={ds.color}
            fillOpacity={ds.opacity}
          />
        ))}
      </g>

      {/* Discrete State Segments */}
      {segments.segs.map((s) => (
        <rect key={s.x} x={s.x} y={0} width={s.w} height={bandHeight} fill={s.color} rx={2} />
      ))}

      {/* Midnight separator lines */}
      {segments.midnights.map((m) => {
        const x = ((m - segments.start) / segments.windowMs) * width;
        return (
          <line
            key={`mid-line-${m}`}
            x1={x}
            y1={0}
            x2={x}
            y2={bandHeight}
            stroke="hsl(var(--border))"
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.6}
          />
        );
      })}

      {/* Hour ticks & labels */}
      {segments.hourTicks.map(({ h, x, label, isFirst, isLast }) => (
        <g key={`${h}-${x}`}>
          <line x1={x} y1={bandHeight} x2={x} y2={bandHeight + 3} stroke="hsl(var(--border))" />
          <text
            x={x}
            y={height - 2}
            textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
            fontSize={9}
            fill="hsl(var(--muted-foreground))"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
};
