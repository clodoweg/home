/**
 * EnergySummaryTile — The wide "energy" tile of the home screen: for electricity, gas and water,
 * the last 7 days against the week before and the last known day against the day before. The
 * figures are those of each widget's week view and subtitle (same hooks, same exclusions).
 */
import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Skeleton } from '../components/ui/Skeleton';
import { widgetHref } from '../constants/sections';
import { WIDGET_CONFIG } from '../constants/widgets';
import type { DailyPoint, DayTrend } from '../hooks/energy-series';
import { useElectricityStats } from '../hooks/useElectricityStats';
import { useEnedisData } from '../hooks/useEnedisData';
import { useGasWidgetData } from '../hooks/useGasStats';
import { useWaterWidgetData } from '../hooks/useWaterStats';
import { summarizeEnergy, type EnergySummary } from '../lib/energy-summary';
import { cn } from '../lib/utils';

const SUMMARY_TILE =
  'col-span-2 flex flex-col justify-between gap-5 rounded-tile p-5 md:col-span-3 md:p-6 xl:col-span-1';

const formatNumber = (value: number, decimals: number) =>
  value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const dayOf = (date: string) => parseISO(date.slice(0, 10));

/** Changes within ±2 % read as stable, as in the widgets' subtitle. */
const directionOf = (change: number | null): DayTrend['trend'] =>
  change === null || Math.abs(change) <= 2 ? 'same' : change > 0 ? 'up' : 'down';

const TREND_ICON = { up: TrendingUp, down: TrendingDown, same: Minus } as const;
const TREND_WORD = { up: 'en hausse', down: 'en baisse', same: 'stable' } as const;

/** A change in %, with its arrow; "stable" within ±2 %. */
const Change = ({
  change,
  trend,
  against,
  testId,
}: {
  change: number | null;
  trend: DayTrend['trend'];
  /** What the value is compared with ("veille", "sem. préc."). */
  against: string;
  testId: string;
}) => {
  const Icon = TREND_ICON[trend];
  return (
    <span
      data-testid={testId}
      data-trend={trend}
      className="inline-flex items-center gap-1 text-xs font-semibold"
    >
      {change !== null && (
        <>
          <Icon size={14} aria-hidden="true" />
          <span className="sr-only">{TREND_WORD[trend]}, </span>
        </>
      )}
      {change === null
        ? `${against} inconnue`
        : trend === 'same'
          ? `stable vs ${against}`
          : `${change > 0 ? '+' : '−'}${formatNumber(Math.abs(change), 0)} % vs ${against}`}
    </span>
  );
};

/** Pairs of bars, one per day: the week before (light) behind this week (solid). */
const WeekBars = ({ summary, label }: { summary: EnergySummary; label: string }) => {
  const max = Math.max(1, ...summary.days.flatMap((day) => [day.value, day.previous]));
  const height = (value: number) => `${value > 0 ? Math.max(6, (value / max) * 100) : 0}%`;
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-1">
      <div className="flex h-14 flex-row items-end gap-1.5">
        {summary.days.map((day) => (
          <span key={day.date} className="flex h-full flex-1 flex-row items-end gap-0.5">
            <span
              className="flex-1 rounded-sm bg-ink/25"
              style={{ height: height(day.previous) }}
            />
            <span className="flex-1 rounded-sm bg-ink" style={{ height: height(day.value) }} />
          </span>
        ))}
      </div>
      <div className="flex flex-row gap-1.5" aria-hidden="true">
        {summary.days.map((day) => (
          <span key={day.date} className="flex-1 text-center text-xs font-medium capitalize">
            {format(dayOf(day.date), 'EEEEE', { locale: fr })}
          </span>
        ))}
      </div>
    </div>
  );
};

/** One supply: last known day with its trend, then the week against the week before. */
const EnergyRow = ({
  id,
  summary,
  unit,
  decimals,
  isLoading,
}: {
  /** Widget id: gives the row its name and icon. */
  id: 'electricity' | 'gas' | 'water';
  summary: EnergySummary | null;
  unit: string;
  decimals: number;
  isLoading: boolean;
}) => {
  const { title, icon: Icon } = WIDGET_CONFIG[id];
  const lastDay = summary?.lastDay;

  return (
    <a
      href={widgetHref(id)}
      data-testid={`home-energy-${id}`}
      className="flex flex-col gap-3 rounded-2xl bg-ink/10 p-4 transition-transform focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-hidden active:scale-[0.99]"
    >
      <div className="flex flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs font-medium">
            {lastDay
              ? `Relevé du ${format(dayOf(lastDay.date), 'EEE d MMM', { locale: fr })}`
              : isLoading
                ? 'Chargement…'
                : 'Aucune donnée'}
          </span>
        </span>
        {lastDay && (
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span
              data-testid={`home-energy-${id}-last`}
              className="font-display text-2xl leading-none font-bold tracking-tight md:text-3xl"
            >
              {formatNumber(lastDay.value, decimals)}
              <span className="text-sm font-semibold"> {unit}</span>
            </span>
            <Change
              change={lastDay.change}
              trend={lastDay.trend}
              against="veille"
              testId={`home-energy-${id}-day-trend`}
            />
          </span>
        )}
      </div>

      {!summary && isLoading && <Skeleton className="h-24 rounded-xl bg-ink/10" />}
      {summary && (
        <>
          <WeekBars
            summary={summary}
            label={`${title} : 7 derniers jours, en ${unit}, comparés à la semaine précédente`}
          />
          <div className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-medium">
              7 jours :{' '}
              <span data-testid={`home-energy-${id}-week`} className="font-bold">
                {formatNumber(summary.total, decimals)} {unit}
              </span>
            </span>
            <Change
              change={summary.weekChange}
              trend={directionOf(summary.weekChange)}
              against="sem. préc."
              testId={`home-energy-${id}-week-trend`}
            />
          </div>
        </>
      )}
    </a>
  );
};

const ElectricityRow = () => {
  const { data, isLoading } = useEnedisData();
  const { weekStats, headerStats } = useElectricityStats(data || null);
  const summary = useMemo(
    () =>
      weekStats &&
      summarizeEnergy(
        // The week's days are in Wh, its comparison values already in kWh.
        weekStats.days.map((day): DailyPoint => ({ date: day.date, value: day.value / 1000 })),
        weekStats.comparisonDays,
        headerStats,
      ),
    [weekStats, headerStats],
  );
  return (
    <EnergyRow id="electricity" summary={summary} unit="kWh" decimals={1} isLoading={isLoading} />
  );
};

const GasRow = () => {
  const { isLoading, weekStats, dayTrend } = useGasWidgetData();
  const summary = useMemo(
    () => weekStats && summarizeEnergy(weekStats.days, weekStats.comparisonDays, dayTrend),
    [weekStats, dayTrend],
  );
  return <EnergyRow id="gas" summary={summary} unit="kWh" decimals={1} isLoading={isLoading} />;
};

const WaterRow = () => {
  const { isLoading, weekStats, dayTrend } = useWaterWidgetData();
  const summary = useMemo(
    () => weekStats && summarizeEnergy(weekStats.days, weekStats.comparisonDays, dayTrend),
    [weekStats, dayTrend],
  );
  return <EnergyRow id="water" summary={summary} unit="L" decimals={0} isLoading={isLoading} />;
};

interface EnergySummaryTileProps {
  /** Whether each supply's widget is visible to the user (history right included). */
  showElectricity: boolean;
  showGas: boolean;
  showWater: boolean;
}

/**
 * "Energy" tile: electricity, gas and water, each with its last known day (and its change
 * against the day before) and the last 7 days against the week before. A supply's data is only
 * loaded when its widget is visible.
 *
 * @param props - Which energy widgets are visible.
 * @returns The tile, or nothing when none of the three widgets is visible.
 */
export const EnergySummaryTile = ({
  showElectricity,
  showGas,
  showWater,
}: EnergySummaryTileProps) => {
  if (!showElectricity && !showGas && !showWater) return null;

  return (
    <section
      data-testid="home-summary-energy"
      className={cn(SUMMARY_TILE, 'justify-start bg-lime text-ink')}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Énergie</p>
          <p className="mt-0.5 text-xs font-medium">
            7 derniers jours, comparés à la semaine d’avant
          </p>
        </div>
        <a
          href={widgetHref('electricity', 'gas', 'water')}
          aria-label="Ouvrir l’énergie"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-lime focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      <div className="flex flex-col gap-2">
        {showElectricity && <ElectricityRow />}
        {showGas && <GasRow />}
        {showWater && <WaterRow />}
      </div>
    </section>
  );
};
