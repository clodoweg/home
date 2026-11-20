/** EnergyParts — Pieces shared by the electricity, gas and water widgets: period tabs, key figure, trend subtitle. */
import React from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { DayTrend } from '../../../hooks/energy-series';

export type EnergyView = 'yesterday' | 'week' | 'year';

const TABS: { id: EnergyView; label: string }[] = [
  { id: 'yesterday', label: 'Hier' },
  { id: 'week', label: '7j' },
  { id: 'year', label: '1A' },
];

interface EnergyViewTabsProps {
  /** Widget id, used in the test ids (`<widgetId>-view-<view>`). */
  widgetId: string;
  value: EnergyView;
  onChange: (view: EnergyView) => void;
}

/**
 * Period selector of an energy widget.
 *
 * @param props - Widget id, selected period and change handler.
 */
export const EnergyViewTabs = ({ widgetId, value, onChange }: EnergyViewTabsProps) => (
  <div className="mb-4 flex justify-end">
    <div className="flex flex-row rounded-full bg-muted p-1">
      {TABS.map((tab) => (
        <button
          type="button"
          key={tab.id}
          data-testid={`${widgetId}-view-${tab.id}`}
          aria-pressed={value === tab.id}
          onClick={(e) => {
            e.stopPropagation();
            onChange(tab.id);
          }}
          className={cn(
            'h-8 rounded-full px-3.5 text-xs font-medium transition-colors',
            value === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary/50',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

interface EnergyHeadlineProps {
  label: string;
  value: string;
  unit: string;
  /** Secondary figure shown on the right (average, cost…). */
  aside?: { label: string; value: string };
  className?: string;
}

/**
 * Key figure of a period, with an optional secondary figure.
 *
 * @param props - Labels, formatted values and unit.
 */
export const EnergyHeadline = ({ label, value, unit, aside, className }: EnergyHeadlineProps) => (
  <div className={cn('flex flex-row justify-between', className)}>
    <div>
      <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-row items-baseline">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <span className="ml-1 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
    {aside && (
      <div className="flex flex-col items-end">
        <p className="mb-0.5 text-[9px] text-muted-foreground uppercase">{aside.label}</p>
        <p className="text-sm font-semibold text-foreground">{aside.value}</p>
      </div>
    )}
  </div>
);

/**
 * Colour of the last day against the day before: green within ±20 %, orange beyond, red above +50 %.
 *
 * @param current - Last day.
 * @param prev - Day before.
 * @param withoutComparison - Class used when there is no previous value.
 * @returns A Tailwind text colour class.
 */
const dayVsPrevColor = (current: number, prev: number, withoutComparison: string) => {
  if (!prev || prev <= 0) return withoutComparison;
  const ratio = current / prev;
  if (ratio > 1.5) return 'text-destructive';
  if (ratio < 0.8 || ratio > 1.2) return 'text-warning';
  return 'text-success';
};

const weekday = (date: string) =>
  format(parseISO(date), 'EEEE', { locale: fr }).replace(/^\w/, (c) => c.toUpperCase());

/**
 * Subtitle of an energy widget: last day (coloured against the day before), the day before with
 * the trend arrow, and the 7-day average.
 *
 * @param trend - Last-day trend.
 * @param options - Unit, decimals and colour when there is nothing to compare with.
 * @returns The subtitle parts for BaseWidget.
 */
export function dayTrendSubtitle(
  trend: DayTrend,
  {
    unit,
    decimals,
    withoutComparison = 'text-warning',
  }: { unit: string; decimals: number; withoutComparison?: string },
): React.ReactNode[] {
  return [
    <span key="last">
      <span className="text-muted-foreground">{weekday(trend.lastDayDate)} </span>
      <span
        className={cn('font-bold', dayVsPrevColor(trend.lastDay, trend.prevDay, withoutComparison))}
      >
        {trend.lastDay.toFixed(decimals)} {unit}
      </span>
    </span>,
    <span key="prev" className="inline-flex items-center gap-0.5">
      <span className="text-muted-foreground">
        {weekday(trend.prevDayDate)} {trend.prevDay.toFixed(decimals)}
      </span>
      {trend.trend === 'up' ? (
        <TrendingUp size={12} className="text-destructive" />
      ) : trend.trend === 'down' ? (
        <TrendingDown size={12} className="text-success" />
      ) : (
        <Minus size={12} className="text-muted-foreground" />
      )}
    </span>,
    <span key="avg" className="text-muted-foreground">
      {`moy. ${trend.avg7days.toFixed(decimals)} ${unit}`}
    </span>,
  ];
}
