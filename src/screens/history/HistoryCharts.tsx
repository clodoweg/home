/**
 * HistoryCharts — Graphiques recharts de l'onglet Historique : barres avec la période de l'an
 * passé, plage min-max avec sa moyenne, nuage gaz/température, courbes croisées. Chargé au
 * premier affichage par LazyHistoryCharts, comme les graphiques des widgets.
 */
import React, { useMemo } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { formatNumber } from './format';
import { SERIES_COLORS } from './HistoryGrids';

const AXIS_TICK = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    color: 'hsl(var(--popover-foreground))',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
};

const formatter = (unit: string, decimals: number) => (value: unknown) =>
  typeof value === 'number' ? `${formatNumber(value, decimals)} ${unit}`.trim() : '—';

interface ComparisonBarsProps {
  labels: string[];
  values: (number | null)[];
  previous?: (number | null)[];
  color: string;
  unit: string;
  decimals?: number;
  currentLabel: string;
  previousLabel?: string;
  height?: number;
}

/**
 * Bars of the period, with the same period a year earlier as paler bars behind.
 *
 * @param props - Labels, values, comparison, colour and unit.
 * @returns The chart.
 */
export const ComparisonBars = ({
  labels,
  values,
  previous,
  color,
  unit,
  decimals = 1,
  currentLabel,
  previousLabel,
  height = 200,
}: ComparisonBarsProps) => {
  const data = useMemo(
    () =>
      labels.map((label, i) => ({ label, current: values[i], previous: previous?.[i] ?? null })),
    [labels, values, previous],
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={1}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={4}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => formatNumber(v, v < 10 ? 1 : 0)}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            cursor={{ fill: 'hsl(var(--muted))' }}
            formatter={formatter(unit, decimals)}
          />
          {previous && (
            <Bar
              dataKey="previous"
              name={previousLabel}
              fill={color}
              fillOpacity={0.3}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          )}
          <Bar
            dataKey="current"
            name={currentLabel}
            fill={color}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface RangeChartProps {
  labels: string[];
  mean: (number | null)[];
  min: (number | null)[];
  max: (number | null)[];
  previousMean?: (number | null)[];
  color: string;
  unit: string;
  previousLabel?: string;
  height?: number;
}

/**
 * Daily range (min to max) as a band, the mean as a line, last year's mean dashed.
 *
 * @param props - Labels, series, colour and unit.
 * @returns The chart.
 */
export const RangeChart = ({
  labels,
  mean,
  min,
  max,
  previousMean,
  color,
  unit,
  previousLabel,
  height = 180,
}: RangeChartProps) => {
  const data = useMemo(
    () =>
      labels.map((label, i) => ({
        label,
        mean: mean[i],
        range: min[i] !== null && max[i] !== null ? [min[i], max[i]] : null,
        previous: previousMean?.[i] ?? null,
      })),
    [labels, mean, min, max, previousMean],
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={4}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => formatNumber(v, 0)}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown) =>
              Array.isArray(value)
                ? `${formatNumber(value[0], 1)} – ${formatNumber(value[1], 1)} ${unit}`
                : formatter(unit, 1)(value)
            }
          />
          <Area
            dataKey="range"
            name="Min – max"
            stroke="none"
            fill={color}
            fillOpacity={0.18}
            isAnimationActive={false}
            connectNulls
          />
          {previousMean && (
            <Line
              dataKey="previous"
              name={previousLabel}
              stroke={color}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            dataKey="mean"
            name="Moyenne"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ScatterPoint {
  temp: number;
  kwh: number;
  date: string;
}

interface GasScatterProps {
  current: ScatterPoint[];
  previous?: ScatterPoint[];
  currentLabel: string;
  previousLabel?: string;
  height?: number;
}

/**
 * One point per day: outdoor temperature against gas. A house that heats better uses less
 * gas at the same temperature: this year's cloud sits under last year's.
 *
 * @param props - Points of the period and of last year.
 * @returns The chart.
 */
export const GasScatter = ({
  current,
  previous,
  currentLabel,
  previousLabel,
  height = 220,
}: GasScatterProps) => (
  <div style={{ height }}>
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
        <XAxis
          type="number"
          dataKey="temp"
          name="Température"
          unit=" °C"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          domain={['auto', 'auto']}
        />
        <YAxis
          type="number"
          dataKey="kwh"
          name="Gaz"

          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <ZAxis range={[28, 28]} />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(value: unknown, name: unknown) =>
            name === 'Température'
              ? `${formatNumber(value as number, 1)} °C`
              : `${formatNumber(value as number, 1)} kWh`
          }
        />
        {previous && previous.length > 0 && (
          <Scatter
            name={previousLabel}
            data={previous}
            fill={SERIES_COLORS.gas}
            fillOpacity={0.3}
            isAnimationActive={false}
          />
        )}
        <Scatter
          name={currentLabel}
          data={current}
          fill={SERIES_COLORS.gas}
          isAnimationActive={false}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </ScatterChart>
    </ResponsiveContainer>
  </div>
);

export interface CrossSeries {
  name: string;
  unit: string;
  values: (number | null)[];
  color: string;
}

/**
 * Up to three series over the same buckets: the first on the left axis, the others on the
 * right one when their unit differs.
 *
 * @param props - Labels and series.
 * @returns The chart.
 */
export const CrossChart = ({
  labels,
  series,
  height = 260,
}: {
  labels: string[];
  series: CrossSeries[];
  height?: number;
}) => {
  const data = useMemo(
    () =>
      labels.map((label, i) =>
        Object.fromEntries([['label', label], ...series.map((s, j) => [`s${j}`, s.values[i]])]),
      ),
    [labels, series],
  );
  const leftUnit = series[0]?.unit;
  const hasRight = series.some((s) => s.unit !== leftUnit);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={4}
          />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={['auto', 'auto']}
          />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={['auto', 'auto']}
            />
          )}
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: unknown, _name: unknown, item: { dataKey?: unknown }) => {
              const index = Number(String(item?.dataKey ?? 's0').slice(1));
              return formatter(series[index]?.unit ?? '', 1)(value);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, j) => (
            <Line
              key={s.name}
              yAxisId={s.unit === leftUnit ? 'left' : 'right'}
              dataKey={`s${j}`}
              name={`${s.name} (${s.unit})`}
              stroke={s.color}
              strokeWidth={2}
              dot={labels.length <= 12}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
