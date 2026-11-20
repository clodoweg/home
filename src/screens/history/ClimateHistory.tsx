/**
 * ClimateHistory — Vue Climat de l'onglet Historique : température et humidité de chaque pièce
 * du widget Température (mêmes capteurs et pièces masqués), jour par jour face à l'an passé, et
 * temps passé dans la zone de confort de l'utilisateur.
 */
import React, { useMemo, useState } from 'react';
import { Droplets, Smile, Thermometer } from 'lucide-react';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';
import { useHAStatistics } from '../../hooks/history/useHistoryData';
import type { HistoryView } from '../../hooks/history/useHistoryView';
import { listTemperatureSensors, type TemperatureSensorRow } from '../../lib/temperature-sensors';
import {
  aggregateDays,
  periodBuckets,
  previousYearLabel,
  type Period,
  isTwelveMonths,
} from '../../lib/history/period';
import { comfortHours, statisticDays } from '../../lib/history/series';
import type { HAState, StatisticRow } from '../../services/api';
import { cn } from '../../lib/utils';
import { RangeChart } from './LazyHistoryCharts';
import { SERIES_COLORS } from './HistoryGrids';
import { ChartSkeleton, EmptyChart, HistoryCard, Stat } from './HistoryParts';
import { formatNumber } from './format';

/** Hourly rows up to a month (the back's cap is 32 days), daily rows over a year. */
const statPeriodOf = (period: Period) => (isTwelveMonths(period.granularity) ? 'day' : 'hour');

const meanOf = (values: (number | null)[]): number | null => {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0) / known.length;
};

interface SeriesProps {
  rows: StatisticRow[] | undefined;
  previousRows: StatisticRow[] | undefined;
  period: Period;
  previous: Period;
}

/** Daily mean, min and max of a sensor over the period, and last year's daily mean. */
const useDailyRange = ({ rows, previousRows, period, previous }: SeriesProps) =>
  useMemo(
    () => ({
      mean: aggregateDays(statisticDays(rows, 'mean'), period, 'mean'),
      min: aggregateDays(statisticDays(rows, 'min'), period, 'mean'),
      max: aggregateDays(statisticDays(rows, 'max'), period, 'mean'),
      previousMean: aggregateDays(statisticDays(previousRows, 'mean'), previous, 'mean'),
      lowest: (() => {
        const values = statisticDays(rows, 'min').map((d) => d.value);
        return values.length ? Math.min(...values) : null;
      })(),
      highest: (() => {
        const values = statisticDays(rows, 'max').map((d) => d.value);
        return values.length ? Math.max(...values) : null;
      })(),
    }),
    [rows, previousRows, period, previous],
  );

/**
 * A measure of a room (temperature or humidity): figures and daily range chart.
 *
 * @param props - Rows, unit, colour and view.
 * @returns The block.
 */
const MeasureBlock = ({
  label,
  unit,
  color,
  rows,
  previousRows,
  view,
}: {
  label: string;
  unit: string;
  color: string;
  rows: StatisticRow[] | undefined;
  previousRows: StatisticRow[] | undefined;
  view: HistoryView;
}) => {
  const { period, previous, compare } = view;
  const range = useDailyRange({ rows, previousRows, period, previous });
  const labels = useMemo(() => periodBuckets(period).map((b) => b.label), [period]);
  const mean = meanOf(range.mean);
  const previousMean = meanOf(range.previousMean);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={`${label} moyenne`} value={mean} unit={unit} />
        <Stat label="Minimum" value={range.lowest} unit={unit} />
        <Stat label="Maximum" value={range.highest} unit={unit} />
        <Stat label={previousYearLabel(period)} value={compare ? previousMean : null} unit={unit} />
      </div>
      {mean === null ? (
        <EmptyChart>Pas de statistiques pour ce capteur sur cette période.</EmptyChart>
      ) : (
        <RangeChart
          labels={labels}
          mean={range.mean}
          min={range.min}
          max={range.max}
          previousMean={compare ? range.previousMean : undefined}
          color={color}
          unit={unit}
          previousLabel={previousYearLabel(period)}
        />
      )}
    </div>
  );
};

/**
 * Share of the time at each comfort level, as a stacked bar.
 *
 * @param props - Hours (or days) per level.
 * @returns The bar, or a dash when unknown.
 */
const ComfortBar = ({ hours }: { hours: { ok: number; warning: number; alert: number } }) => {
  const total = hours.ok + hours.warning + hours.alert;
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = (v: number) => (v / total) * 100;
  return (
    <span
      className="flex h-3 w-full flex-row overflow-hidden rounded-full bg-muted"
      title={`${formatNumber(pct(hours.ok), 0)} % dans la zone de confort`}
    >
      <span className="bg-success" style={{ width: `${pct(hours.ok)}%` }} />
      <span className="bg-warning" style={{ width: `${pct(hours.warning)}%` }} />
      <span className="bg-destructive" style={{ width: `${pct(hours.alert)}%` }} />
    </span>
  );
};

interface ClimateHistoryProps {
  view: HistoryView;
  sensors: HAState[];
  metadata: Record<string, { area: string; floor?: string; model: string }>;
}

/**
 * The climate view of the history tab.
 *
 * @param props - View, sensor entities and their metadata.
 * @returns The cards.
 */
export const ClimateHistory = ({ view, sensors, metadata }: ClimateHistoryProps) => {
  const { isSensorHidden, isRoomHidden, roomOrder, floorOrder, tempThresholds, humThresholds } =
    useWidgetPreferences();
  const rows: TemperatureSensorRow[] = useMemo(
    () =>
      listTemperatureSensors({
        data: sensors,
        metadata,
        isSensorHidden,
        isRoomHidden,
        roomOrder,
        floorOrder,
      }),
    [sensors, metadata, isSensorHidden, isRoomHidden, roomOrder, floorOrder],
  );
  const ids = useMemo(
    () => rows.flatMap((r) => (r.humId ? [r.tempId, r.humId] : [r.tempId])),
    [rows],
  );
  const { period, previous, compare } = view;
  const current = useHAStatistics(ids, period, statPeriodOf(period), ['mean', 'min', 'max']);
  const before = useHAStatistics(
    ids,
    previous,
    statPeriodOf(previous),
    ['mean', 'min', 'max'],
    compare,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.tempId === selectedId) ?? rows[0];
  const timeUnit = isTwelveMonths(period.granularity) ? 'jours' : 'heures';
  const thresholds = useMemo(
    () => ({ temp: tempThresholds, hum: humThresholds }),
    [tempThresholds, humThresholds],
  );

  if (rows.length === 0) {
    return <EmptyChart>Aucun capteur de température visible.</EmptyChart>;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 xl:grid-cols-2">
      <HistoryCard
        testId="history-climate-rooms"
        title="Par pièce"
        subtitle="Moyenne du jour, et plage du minimum au maximum"
        icon={Thermometer}
        tone="cobalt"
      >
        <div role="tablist" aria-label="Pièce" className="mb-4 flex flex-row flex-wrap gap-1">
          {rows.map((row) => (
            <button
              key={row.tempId}
              type="button"
              role="tab"
              data-testid={`history-climate-room-${row.tempId}`}
              aria-selected={row.tempId === selected.tempId}
              onClick={() => setSelectedId(row.tempId)}
              className={cn(
                'h-9 shrink-0 rounded-full px-4 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                row.tempId === selected.tempId
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'bg-muted font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {row.name}
            </button>
          ))}
        </div>
        {current.isLoading ? (
          <ChartSkeleton height={260} />
        ) : (
          <div className="flex flex-col gap-6">
            <MeasureBlock
              label="Température"
              unit="°C"
              color={SERIES_COLORS.temperature}
              rows={current.data?.[selected.tempId]}
              previousRows={before.data?.[selected.tempId]}
              view={view}
            />
            {selected.humId && (
              <MeasureBlock
                label="Humidité"
                unit="%"
                color={SERIES_COLORS.humidity}
                rows={current.data?.[selected.humId]}
                previousRows={before.data?.[selected.humId]}
                view={view}
              />
            )}
          </div>
        )}
      </HistoryCard>

      <HistoryCard
        testId="history-climate-comfort"
        title="Confort"
        subtitle={`Part des ${timeUnit} dans la zone de confort, d'après tes seuils`}
        icon={Smile}
        tone="cobalt"
      >
        {current.isLoading ? (
          <ChartSkeleton height={200} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Pièce</th>
                <th className="pb-2 font-medium">
                  <Thermometer size={12} className="mr-1 inline" aria-hidden="true" />
                  Température
                </th>
                <th className="pb-2 pl-3 font-medium">
                  <Droplets size={12} className="mr-1 inline" aria-hidden="true" />
                  Humidité
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const temp = comfortHours(
                  current.data?.[row.tempId],
                  'temperature',
                  row.floor,
                  thresholds,
                );
                const hum = row.humId
                  ? comfortHours(current.data?.[row.humId], 'humidity', row.floor, thresholds)
                  : null;
                return (
                  <tr
                    key={row.tempId}
                    data-testid={`history-comfort-${row.tempId}`}
                    className="border-t border-border"
                  >
                    <td className="max-w-28 truncate py-2 pr-2 text-foreground">{row.name}</td>
                    <td className="w-2/5 py-2">
                      <ComfortBar hours={temp} />
                    </td>
                    <td className="w-2/5 py-2 pl-3">
                      {hum ? (
                        <ComfortBar hours={hum} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-3 flex flex-row flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-success" />
            Confort
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-warning" />
            Limite
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-destructive" />
            Hors zone
          </span>
        </p>
      </HistoryCard>
    </div>
  );
};
