/**
 * UsageCard — Carte d'un appareil de l'onglet Historique bâtie sur les compteurs d'usage
 * quotidiens du back (heures, cycles, détections…) : chiffres clés face à l'an passé et barres.
 */
import React, { useMemo } from 'react';
import { addDays } from 'date-fns';
import type { Tone } from '../../constants/widgets';
import type { HistoryView } from '../../hooks/history/useHistoryView';
import {
  aggregateDays,
  comparableDayTotals,
  dayKey,
  percentChange,
  periodBuckets,
  previousYearLabel,
  sumKnown,
  type DayValue,
  type Period,
} from '../../lib/history/period';
import type { IconComponent } from '../../types/icon';
import { ComparisonBars } from './LazyHistoryCharts';
import { SERIES_COLORS } from './HistoryGrids';
import { ChartSkeleton, EmptyChart, HistoryCard, Stat } from './HistoryParts';

/** One counter of a card; the first one is drawn. */
interface UsageMetric {
  label: string;
  unit: string;
  days: DayValue[];
  /** `mean` for a level (a temperature): averaged over the days, no change in percent. */
  mode?: 'sum' | 'mean';
}

/** Mean of the days of a period, each day counting once. */
const meanOverPeriod = (days: readonly DayValue[], period: Period): number | null => {
  const first = dayKey(period.start);
  const last = dayKey(addDays(period.end, -1));
  const values = days.filter((d) => d.date >= first && d.date <= last).map((d) => d.value);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
};

interface UsageCardProps {
  testId: string;
  title: string;
  subtitle?: string;
  icon: IconComponent;
  tone: Tone;
  metrics: UsageMetric[];
  view: HistoryView;
  loading: boolean;
  /** The counters could not be read (server error). */
  failed?: boolean;
  color?: string;
  children?: React.ReactNode;
}

/** Shown when the server could not send the counters: not to be taken for an empty period. */
export const USAGE_FAILED =
  "Compteurs indisponibles : le serveur n'a pas pu les lire. Réessaie dans un moment.";

/** Shown when the counters have no day in the period (they start with the nightly sync). */
export const NO_USAGE_YET =
  "Pas encore de relevé sur cette période : ces compteurs sont enregistrés chaque nuit depuis la mise en service de l'historique.";

/**
 * Counters of a device over the period, against the same period a year earlier.
 *
 * @param props - Title, icon, tone, counters, view and loading state.
 * @returns The card.
 */
export const UsageCard = ({
  testId,
  title,
  subtitle,
  icon,
  tone,
  metrics,
  view,
  loading,
  failed = false,
  color = SERIES_COLORS.neutral,
  children,
}: UsageCardProps) => {
  const { period, previous, compare } = view;
  const rows = useMemo(
    () =>
      metrics.map((metric) => {
        const mode = metric.mode ?? 'sum';
        const values = aggregateDays(metric.days, period, mode);
        const previousValues = aggregateDays(metric.days, previous, mode);
        const comparable = comparableDayTotals(metric.days, period, previous);
        return {
          ...metric,
          values,
          previousValues,
          total: mode === 'mean' ? meanOverPeriod(metric.days, period) : sumKnown(values),
          percent: mode === 'mean' ? null : percentChange(comparable.current, comparable.previous),
        };
      }),
    [metrics, period, previous],
  );
  const labels = useMemo(() => periodBuckets(period).map((b) => b.label), [period]);
  const main = rows[0];
  const comparedTo = `vs ${previousYearLabel(period)}`;

  return (
    <HistoryCard testId={testId} title={title} subtitle={subtitle} icon={icon} tone={tone}>
      <div
        className={rows.length > 2 ? 'mb-4 grid grid-cols-3 gap-2' : 'mb-4 grid grid-cols-2 gap-2'}
      >
        {rows.map((row) => (
          <Stat
            key={row.label}
            label={row.label}
            value={row.total}
            unit={row.unit}
            percent={compare ? row.percent : null}
            lowerIsBetter={false}
            comparedTo={comparedTo}
          />
        ))}
      </div>
      {loading ? (
        <ChartSkeleton height={160} />
      ) : failed ? (
        <EmptyChart>{USAGE_FAILED}</EmptyChart>
      ) : !main || main.total === null ? (
        <EmptyChart>{NO_USAGE_YET}</EmptyChart>
      ) : (
        <ComparisonBars
          labels={labels}
          values={main.values}
          previous={compare ? main.previousValues : undefined}
          color={color}
          unit={main.unit}
          currentLabel="Cette période"
          previousLabel={previousYearLabel(period)}
          height={160}
        />
      )}
      {children}
    </HistoryCard>
  );
};
