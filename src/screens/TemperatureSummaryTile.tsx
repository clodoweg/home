/**
 * TemperatureSummaryTile — The wide "temperatures" tile of the home screen: temperature and
 * humidity of every room the temperature widget lists (same sensors, same hidden rooms, same
 * order), grouped by floor, each with a comfort dot judged by the user's thresholds.
 */
import React, { useMemo } from 'react';
import { ArrowUpRight, Droplets } from 'lucide-react';

import { Sparkline } from '../components/ui/Sparkline';
import { widgetDetailHref, widgetHref } from '../constants/sections';
import { useUserProfile } from '../context/UserContext';
import { useWidgetPreferences } from '../context/WidgetPreferencesContext';
import { humidityComfort, temperatureComfort, type ComfortLevel } from '../lib/comfort';
import { groupByFloor } from '../lib/floors';
import { hourlyReadings } from '../lib/hourly-readings';
import { listTemperatureSensors } from '../lib/temperature-sensors';
import { useHABatchHistory } from '../hooks/useHABatchHistory';
import { useNow } from '../hooks/useNow';
import { useResponsive } from '../hooks/useResponsive';
import { cn } from '../lib/utils';
import type { HAState, HistoryPoint } from '../services/api';

const SUMMARY_TILE =
  'col-span-2 flex flex-col justify-start gap-5 rounded-tile p-5 md:col-span-3 md:p-6 xl:col-span-1';

const formatNumber = (value: number, decimals: number) =>
  value.toLocaleString('fr-FR', { maximumFractionDigits: decimals });

const DOT_CLASS: Record<ComfortLevel, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  alert: 'bg-destructive',
  unknown: 'bg-white/40',
};

const COMFORT_WORD: Record<ComfortLevel, string> = {
  ok: 'confortable',
  warning: 'à surveiller',
  alert: 'hors seuil',
  unknown: 'inconnu',
};

/** Coloured dot of a reading's comfort, named for screen readers. */
const ComfortDot = ({ level }: { level: ComfortLevel }) => (
  <>
    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT_CLASS[level])} />
    <span className="sr-only">({COMFORT_WORD[level]})</span>
  </>
);

/**
 * Puts consecutive floors that hold a single sensor (cellar, outside…) side by side under one
 * heading, instead of one half-empty row each.
 *
 * @param floors - Floors in display order, each with its sensors.
 * @returns The display groups: a floor, or a run of single-sensor floors (« Cave · Extérieur »).
 */
function mergeSingleSensorFloors<T>(
  floors: { floor: string; items: T[] }[],
): { floor: string; items: T[] }[] {
  const groups: { floor: string; items: T[]; single: boolean }[] = [];
  for (const { floor, items } of floors) {
    const single = items.length === 1;
    const previous = groups[groups.length - 1];
    if (single && previous?.single) {
      previous.floor = `${previous.floor} · ${floor}`;
      previous.items.push(...items);
    } else {
      groups.push({ floor, items: [...items], single });
    }
  }
  return groups.map(({ floor, items }) => ({ floor, items }));
}

/** Width from which the cards draw their 24 h history (`xl` breakpoint). */
const WIDE_SCREEN_PX = 1280;

const NO_HISTORY: Record<string, HistoryPoint[]> = {};

/** One labelled history line: what it is, its 24 h range, then the chart. */
const HistoryLine = ({
  label,
  values,
  format,
  testId,
  className,
}: {
  label: string;
  values: number[];
  format: (value: number) => string;
  testId: string;
  className?: string;
}) => {
  if (values.length < 2) return null;
  return (
    <span className="block">
      <span className="flex flex-row items-baseline justify-between gap-2 text-xs font-medium text-white/80">
        <span>{label}</span>
        <span data-testid={`${testId}-range`}>
          min {format(Math.min(...values))} · max {format(Math.max(...values))}
        </span>
      </span>
      <Sparkline
        data-testid={testId}
        values={values}
        area
        endDot
        className={cn('mt-1 h-10 w-full', className)}
      />
    </span>
  );
};

/** The last 24 h of a room: temperature, then humidity, on a shared time scale. */
const RoomHistory = ({
  testId,
  temperatures,
  humidities,
}: {
  testId: string;
  temperatures: number[];
  humidities: number[];
}) => {
  if (temperatures.length < 2 && humidities.length < 2) return null;
  return (
    <span className="mt-3 flex flex-col gap-2 border-t border-white/15 pt-3">
      <HistoryLine
        label="Température"
        values={temperatures}
        format={(value) => `${formatNumber(value, 1)}°`}
        testId={`${testId}-temp-history`}
      />
      <HistoryLine
        label="Humidité"
        values={humidities}
        format={(value) => `${Math.round(value)} %`}
        testId={`${testId}-humidity-history`}
        className="text-white/70"
      />
      <span className="flex flex-row justify-between text-[11px] font-medium text-white/60">
        <span>il y a 24 h</span>
        <span>maintenant</span>
      </span>
    </span>
  );
};

/** Whether the card at `index` is the last of an odd count, alone on the last row of two. */
const isAloneOnRow = (index: number, count: number) => count % 2 === 1 && index === count - 1;

type Metadata = Record<string, { area: string; floor?: string; model: string }>;

interface TemperatureSummaryTileProps {
  /** Sensor entities and area metadata, as the temperature widget receives them. */
  sensors: HAState[];
  metadata: Metadata;
}

/**
 * "Temperatures" tile: one card per room sensor with its temperature and humidity, grouped by
 * floor, in the widget's order. The header gives the range and how many readings stray from
 * the comfort thresholds.
 *
 * @param props - Sensor entities and their area metadata.
 * @returns The tile, or nothing when the widget lists no sensor.
 */
export const TemperatureSummaryTile = ({ sensors, metadata }: TemperatureSummaryTileProps) => {
  const { isSensorHidden, isRoomHidden, roomOrder, floorOrder, tempThresholds, humThresholds } =
    useWidgetPreferences();
  const rows = useMemo(
    () =>
      listTemperatureSensors({
        data: sensors,
        metadata,
        isSensorHidden,
        isRoomHidden,
        roomOrder,
        floorOrder,
      }).map((row) => ({
        ...row,
        tempComfort: temperatureComfort(row.temp, row.floor, tempThresholds),
        humComfort: humidityComfort(row.humidity, row.floor, humThresholds),
      })),
    [
      sensors,
      metadata,
      isSensorHidden,
      isRoomHidden,
      roomOrder,
      floorOrder,
      tempThresholds,
      humThresholds,
    ],
  );
  // On a wide screen each card also draws the last 24 h. Same sensors, same order and same period
  // as the temperature widget's trends: both read one cached request. Never loaded on a phone.
  const { canAccessHistory } = useUserProfile();
  const isWide = useResponsive().width >= WIDE_SCREEN_PX;
  // One point per hour on every curve, however often each sensor reports.
  const now = useNow();
  const historyIds = useMemo(
    () => rows.flatMap((row) => (row.humId ? [row.tempId, row.humId] : [row.tempId])),
    [rows],
  );
  const { data: history = NO_HISTORY } = useHABatchHistory({
    entityIds: historyIds,
    hours: 24,
    enabled: canAccessHistory && isWide,
  });
  const showHistory = canAccessHistory && isWide;

  if (rows.length === 0) return null;

  const temps = rows.map((row) => row.temp);
  const strays = rows.filter(
    (row) =>
      row.tempComfort === 'warning' ||
      row.tempComfort === 'alert' ||
      row.humComfort === 'warning' ||
      row.humComfort === 'alert',
  ).length;
  const byFloor = groupByFloor(rows);
  const floors = mergeSingleSensorFloors(byFloor);

  return (
    <section
      data-testid="home-summary-temperature"
      className={cn(SUMMARY_TILE, 'bg-cobalt text-white')}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Températures</p>
          <p className="mt-0.5 text-xs font-medium text-white/80">
            {rows.length > 1
              ? `De ${formatNumber(Math.min(...temps), 1)}° à ${formatNumber(Math.max(...temps), 1)}°`
              : `${formatNumber(temps[0], 1)}°`}
            {' · '}
            {strays > 0
              ? `${strays} ${strays > 1 ? 'pièces' : 'pièce'} à surveiller`
              : 'tout est confortable'}
          </p>
        </div>
        <a
          href={widgetHref('temperature')}
          aria-label="Ouvrir les températures"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-ink focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cobalt focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      <div className="flex flex-col gap-4">
        {floors.map(({ floor, items }) => (
          <div key={floor} className="flex flex-col gap-2">
            {byFloor.length > 1 && (
              <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">{floor}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {items.map((row, index) => (
                <a
                  key={row.tempId}
                  href={widgetDetailHref('temperature', row.tempId)}
                  data-testid={`home-room-${row.tempId}`}
                  className={cn(
                    'block min-w-0 rounded-2xl bg-white/10 p-3.5 transition-transform focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden active:scale-[0.99]',
                    // A room alone on its row takes the whole row rather than leave a hole.
                    isAloneOnRow(index, items.length) && 'col-span-2',
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-2">
                    <span className="truncate text-sm font-semibold">{row.name}</span>
                    <span className="flex flex-row items-center gap-2">
                      <span
                        data-testid={`home-room-${row.tempId}-temp`}
                        className="font-display text-3xl leading-none font-bold tracking-tight"
                      >
                        {formatNumber(row.temp, 1)}°
                      </span>
                      <ComfortDot level={row.tempComfort} />
                    </span>
                    {row.humidity !== null && (
                      <span className="flex flex-row items-center gap-1.5 text-sm font-medium">
                        <Droplets size={14} aria-hidden="true" className="shrink-0" />
                        <span data-testid={`home-room-${row.tempId}-humidity`}>
                          {row.humidity} %
                        </span>
                        <ComfortDot level={row.humComfort} />
                      </span>
                    )}
                  </span>
                  {showHistory && (
                    <RoomHistory
                      testId={`home-room-${row.tempId}`}
                      temperatures={hourlyReadings(history[row.tempId], now)}
                      humidities={row.humId ? hourlyReadings(history[row.humId], now) : []}
                    />
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
