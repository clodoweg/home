/**
 * BarChart — Bars with optional previous-period comparison bars and an
 * overlay line (used for temperature context in energy widgets).
 */
import React, { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BarChartProps {
  values: number[];
  labels: string[];
  maxValue: number;
  barColor: string;
  unit?: string;
  yAxisDecimals?: number;
  comparisonValues?: number[];
  comparisonLabel?: string;
  currentLabel?: string;
  lineValues?: number[];
  lineColor?: string;
  lineMax?: number;
  lineAxisLabels?: [string, string, string];
  comparisonLineValues?: number[];
  comparisonLineColor?: string;
  lineLabel?: string;
  showCurrentIndicator?: boolean;
  currentIndex?: number;
  width?: number;
  height?: number;
  className?: string;
  title?: string;
}

/**
 * Bar chart with optional comparison bars and overlay line.
 *
 * @param props - Values, labels, colors and comparison series.
 * @returns The chart.
 */
export const BarChart = ({
  values,
  labels,
  maxValue,
  barColor,
  unit,
  yAxisDecimals = 1,
  comparisonValues,
  comparisonLabel,
  currentLabel,
  lineValues,
  lineColor,
  comparisonLineValues,
  height = 200,
}: BarChartProps) => {
  const data = useMemo(() => {
    return values.map((v, i) => ({
      label: labels[i] ?? '',
      value: v,
      comparison: comparisonValues?.[i] ?? null,
      line: lineValues?.[i] ?? null,
      compLine: comparisonLineValues?.[i] ?? null,
    }));
  }, [values, labels, comparisonValues, lineValues, comparisonLineValues]);

  const hasLine = !!lineValues?.length || !!comparisonLineValues?.length;
  const yMax = Math.max(maxValue, ...values, ...(comparisonValues ?? []));

  const showLegend = !!(currentLabel && comparisonLabel && comparisonValues?.length);

  return (
    <div className="w-full">
      {showLegend && (
        <div className="mb-1 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block size-2 rounded-xs"
              style={{ backgroundColor: barColor }}
            />
            {currentLabel}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block size-2 rounded-xs"
              style={{ backgroundColor: barColor, opacity: 0.35 }}
            />
            {comparisonLabel}
          </span>
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              minTickGap={0}
            />
            <YAxis
              yAxisId="left"
              domain={[0, yMax * 1.05]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v: number) => v.toFixed(yAxisDecimals)}
            />
            {hasLine && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={28}
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
              formatter={(v) =>
                typeof v === 'number'
                  ? `${v.toFixed(yAxisDecimals)}${unit ? ` ${unit}` : ''}`
                  : String(v ?? '')
              }
            />
            {comparisonValues && comparisonValues.length > 0 && (
              <Bar
                yAxisId="left"
                dataKey="comparison"
                name={comparisonLabel || 'Comparaison'}
                fill={barColor}
                fillOpacity={0.25}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            )}
            <Bar
              yAxisId="left"
              dataKey="value"
              fill={barColor}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            {hasLine && lineValues && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="line"
                stroke={lineColor || 'hsl(var(--info))'}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {hasLine && comparisonLineValues && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="compLine"
                stroke={lineColor || 'hsl(var(--info))'}
                strokeOpacity={0.4}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
