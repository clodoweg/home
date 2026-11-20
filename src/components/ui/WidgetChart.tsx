/**
 * WidgetChart — Unified 24h area/line chart for Spa, Temperature, Plugs widgets.
 * Features: gradient area fill per series, dual Y-axes, unit labels on both axes,
 * and a ReferenceArea that visually separates yesterday from today at midnight.
 */
import React, { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { YAxisTickContentProps } from 'recharts';
import { cn } from '../../lib/utils';

interface ChartSeries {
  data: number[];
  color: string;
  strokeWidth?: number;
  label?: string;
  yAxis?: 'left' | 'right';
  /** If set, renders as a gradient area instead of a plain line. */
  gradientFill?: boolean;
  unit?: string;
}

export interface WidgetChartProps {
  series: ChartSeries[];
  labels: string[];
  height?: number;
  width: number;
  /** Unit appended to left Y-axis ticks (e.g. "°C", "W"). */
  yUnit?: string;
  /** Unit appended to right Y-axis ticks (e.g. "%"). */
  yUnitRight?: string;
  /** Label shown along the left Y-axis. */
  yLabel?: string;
  /** Label shown along the right Y-axis. */
  yLabelRight?: string;
  /** Label shown below the X-axis. */
  xLabel?: string;
  decimals?: number;
  className?: string;
  /** Optional interval (in hours) to place fixed X-axis ticks (e.g., 4) */
  xTickInterval?: number;
}

/**
 * Unified area/line chart component to display history data (e.g. 24h or 48h).
 * Renders multiple series with gradient fill or solid line on single/dual Y-axes.
 * Dynamically divides the timeline into day segments relative to midnight markers,
 * shading older days darker to visually differentiate days.
 *
 * @param {WidgetChartProps} props - The properties for the chart.
 * @param {ChartSeries[]} props.series - Array of series to render.
 * @param {string[]} props.labels - X-axis tick label values (e.g. hours '00', '04').
 * @param {number} [props.height=160] - Height of the chart in pixels.
 * @param {number} props.width - Width of the chart in pixels.
 * @param {string} [props.yUnit=''] - Unit of measurement for left Y-axis.
 * @param {string} [props.yUnitRight=''] - Unit of measurement for right Y-axis.
 * @param {string} [props.yLabel] - Label for left Y-axis.
 * @param {string} [props.yLabelRight] - Label for right Y-axis.
 * @param {string} [props.xLabel] - Label below X-axis.
 * @param {number} [props.decimals=1] - Number of decimals for formatting values.
 * @param {string} [props.className] - Extra class names for styling.
 * @param {number} [props.xTickInterval] - Fixed hour interval for horizontal ticks.
 * @returns {React.JSX.Element | null} The rendered chart element.
 */
export const WidgetChart = ({
  series,
  labels,
  height = 160,
  width,
  yUnit = '',
  yUnitRight = '',
  yLabel,
  yLabelRight,
  xLabel: _xLabel,
  decimals = 1,
  className,
  xTickInterval,
}: WidgetChartProps) => {
  const data = useMemo(() => {
    const len = Math.max(...series.map((s) => s.data.length), labels.length);
    return Array.from({ length: len }, (_, i) => {
      // Use index as a unique category key to prevent Recharts from grouping duplicate hours
      const row: Record<string, number | string | null> = { key: i };
      series.forEach((s, idx) => {
        row[`s${idx}`] = s.data[i] ?? null;
      });
      return row;
    });
  }, [series, labels]);

  // Extract all indices where midnight starts to draw vertical separation boundaries
  const midnightIndices = useMemo(() => {
    const indices: number[] = [];
    labels.forEach((label, idx) => {
      if (label === '00') {
        indices.push(idx);
      }
    });
    return indices;
  }, [labels]);

  // Divide the timeline into day-long segments using the midnight boundaries
  const daySegments = useMemo(() => {
    const segments: { start: number; end: number; dayIndex: number }[] = [];
    const N = labels.length;
    if (N === 0) return segments;

    const boundaries = [0, ...midnightIndices, N - 1];
    const uniqueBoundaries = Array.from(new Set(boundaries)).sort((a, b) => a - b);

    for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
      segments.push({
        start: uniqueBoundaries[i],
        end: uniqueBoundaries[i + 1],
        dayIndex: i,
      });
    }
    return segments;
  }, [labels, midnightIndices]);

  // Determines dynamic background opacity depending on the age of the day segment
  const getDayFill = (dayIndex: number, totalDays: number) => {
    const relativeIndex = totalDays - 1 - dayIndex; // 0 = today, 1 = yesterday, 2 = day before, etc.
    if (relativeIndex === 0) {
      return { fill: 'transparent', opacity: 0 };
    }
    if (relativeIndex === 1) {
      // Use theme-agnostic foreground color with low opacity for visible contrast (white overlay in dark, black in light)
      return { fill: 'hsl(var(--foreground))', opacity: 0.07 };
    }
    // Increase opacity to 0.15 for older day segments to make the shading progression distinct
    return { fill: 'hsl(var(--foreground))', opacity: 0.15 };
  };

  // Find index bounds for fixed X-axis ticks if an interval is specified
  const xAxisTicks = useMemo(() => {
    if (!xTickInterval) return undefined;
    const ticks: number[] = [];
    labels.forEach((label, idx) => {
      const hour = parseInt(label);
      if (!isNaN(hour) && hour % xTickInterval === 0) {
        ticks.push(idx);
      }
    });
    return ticks;
  }, [labels, xTickInterval]);

  const leftDecimals = yUnit === '°C' ? 0 : decimals;

  const leftTicks = useMemo(() => {
    if (yUnit !== '°C') return undefined;

    const values = series
      .filter((s) => s.yAxis !== 'right')
      .flatMap((s) => s.data)
      .filter((v) => typeof v === 'number' && Number.isFinite(v));

    if (values.length === 0) return undefined;

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    let min = Math.floor(rawMin);
    let max = Math.ceil(rawMax);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const range = max - min;
    let step: number;
    if (range > 25) {
      step = 10;
    } else if (range > 10) {
      step = 5;
    } else if (range > 5) {
      step = 2;
    } else {
      step = 1;
    }

    const ticks: number[] = [];
    const start = Math.floor(min / step) * step;
    for (let val = start; val <= max; val += step) {
      if (val >= min) {
        ticks.push(val);
      }
    }

    if (ticks.length > 0) {
      if (ticks[0] > min) ticks.unshift(ticks[0] - step);
      if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    }

    return ticks;
  }, [series, yUnit]);

  const leftDomain = useMemo<[number, number] | ['dataMin', 'dataMax']>(() => {
    if (yUnit === '°C' && leftTicks && leftTicks.length > 0) {
      return [leftTicks[0], leftTicks[leftTicks.length - 1]];
    }
    return ['dataMin', 'dataMax'];
  }, [yUnit, leftTicks]);

  if (!width || series.every((s) => s.data.length === 0)) return null;

  const hasRightAxis = series.some((s) => s.yAxis === 'right');

  return (
    <div className={cn('w-full', className)}>
      {(yLabel || yLabelRight) && (
        <div
          className="mb-1 flex items-center"
          style={{ paddingLeft: 4, paddingRight: hasRightAxis ? 4 : 4 }}
        >
          {yLabel && (
            <span className="text-[9px] tracking-wide text-muted-foreground uppercase">
              {yLabel}
            </span>
          )}
          {yLabelRight && (
            <span className="ml-auto text-[9px] tracking-wide text-muted-foreground uppercase">
              {yLabelRight}
            </span>
          )}
        </div>
      )}
      <ComposedChart
        width={width}
        height={height}
        data={data}
        margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
      >
        <defs>
          {series.map((s, idx) =>
            s.gradientFill ? (
              // The series index is its identity: its dataKey is `s${idx}`.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <linearGradient key={idx} id={`grad${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ) : null,
          )}
        </defs>

        {/* Day segments backgrounds (shading differences) */}
        {daySegments.map((seg) => {
          const fillConfig = getDayFill(seg.dayIndex, daySegments.length);
          if (fillConfig.opacity === 0) return null;
          return (
            <ReferenceArea
              key={`day-bg-${seg.start}`}
              yAxisId="left"
              x1={seg.start}
              x2={seg.end}
              fill={fillConfig.fill}
              fillOpacity={fillConfig.opacity}
              strokeOpacity={0}
            />
          );
        })}

        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />

        <XAxis
          dataKey="key"
          ticks={xAxisTicks}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          interval={xAxisTicks ? 0 : 'preserveStartEnd'}
          minTickGap={16}
          tickFormatter={(v: number) => {
            const label = labels[v] ?? '';
            return label ? `${label}h` : '';
          }}
        />

        <YAxis
          yAxisId="left"
          domain={leftDomain}
          ticks={leftTicks}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v: number) => `${v.toFixed(leftDecimals)}${yUnit}`}
        />

        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={['dataMin', 'dataMax']}
            tick={(props: YAxisTickContentProps) => (
              <text
                x={Number(props.x) + 32}
                y={props.y}
                dy={3}
                textAnchor="end"
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
              >
                {`${Number(props.payload.value).toFixed(0)}${yUnitRight}`}
              </text>
            )}
            axisLine={false}
            tickLine={false}
            width={36}
          />
        )}

        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 11,
          }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          labelFormatter={(v) => {
            const label = labels[v as number] ?? '';
            return label ? `${label}h` : '';
          }}
          formatter={(val, name) => {
            const idx = series.findIndex((s) => s.label === name);
            const s = idx >= 0 ? series[idx] : null;
            const unit = s?.unit ?? yUnit;
            const seriesDecimals = unit === '°C' ? 0 : decimals;
            return typeof val === 'number'
              ? [`${val.toFixed(seriesDecimals)}${unit}`, name]
              : [String(val ?? ''), name];
          }}
        />

        {series.map((s, idx) =>
          s.gradientFill ? (
            <Area
              // eslint-disable-next-line @eslint-react/no-array-index-key -- series identity is its index (dataKey s<idx>)
              key={idx}
              type="monotone"
              dataKey={`s${idx}`}
              name={s.label || `Série ${idx + 1}`}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              fill={`url(#grad${idx})`}
              dot={false}
              activeDot={{ r: 3 }}
              yAxisId={s.yAxis === 'right' ? 'right' : 'left'}
              connectNulls
              isAnimationActive={false}
            />
          ) : (
            <Line
              // eslint-disable-next-line @eslint-react/no-array-index-key -- series identity is its index (dataKey s<idx>)
              key={idx}
              type="monotone"
              dataKey={`s${idx}`}
              name={s.label || `Série ${idx + 1}`}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              dot={false}
              activeDot={{ r: 3 }}
              yAxisId={s.yAxis === 'right' ? 'right' : 'left'}
              connectNulls
              isAnimationActive={false}
            />
          ),
        )}

        {/* Midnight boundary line(s) */}
        {midnightIndices.map((idx) => {
          if (idx === 0 || idx === labels.length - 1) return null;
          return (
            <ReferenceArea
              key={`midnight-line-${idx}`}
              yAxisId="left"
              x1={idx}
              x2={idx}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          );
        })}
      </ComposedChart>
    </div>
  );
};
