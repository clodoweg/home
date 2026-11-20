/**
 * DevicesHistory — Vue Appareils de l'onglet Historique : prises (kWh, coût et part de
 * l'électricité de la maison), spa, lave-linge, imprimante et lumières par pièce.
 */
import React, { useMemo } from 'react';
import { Lightbulb, Plug, Printer, WashingMachine, Waves } from 'lucide-react';
import { PLUG_ENTITIES } from '../../constants/entities';
import { useHAStatistics, useHistoryElectricity } from '../../hooks/history/useHistoryData';
import type { HistoryView } from '../../hooks/history/useHistoryView';
import type { UsageResponse } from '../../services/history';
import { costDays, electricityDays } from '../../lib/history/energy';
import {
  aggregateDays,
  comparableDayTotals,
  comparableTotals,
  dayKey,
  percentChange,
  periodBuckets,
  previousYearLabel,
  sumKnown,
  type DayValue,
  type Period,
  isTwelveMonths,
} from '../../lib/history/period';
import { lightHoursByRoom, statisticDays, usageDays } from '../../lib/history/series';
import { addDays } from 'date-fns';
import { ComparisonBars } from './LazyHistoryCharts';
import { SERIES_COLORS } from './HistoryGrids';
import { ChartSkeleton, EmptyChart, HistoryCard, Stat } from './HistoryParts';
import { formatNumber } from './format';
import { UsageCard, NO_USAGE_YET, USAGE_FAILED } from './UsageCard';

const PLUGS = [
  { id: PLUG_ENTITIES.energyPC, name: 'PC' },
  { id: PLUG_ENTITIES.energyTV, name: 'TV' },
] as const;
const PLUG_IDS = PLUGS.map((p) => p.id);

/** Statistic rows of a period: a day each, a month each over a year. */
const statPeriodOf = (period: Period) => (isTwelveMonths(period.granularity) ? 'month' : 'day');

/**
 * Energy of the plugs (HA long-term statistics of their meters), its cost and its share of the
 * house's electricity.
 *
 * @param props - The view.
 * @returns The card.
 */
const PlugsCard = ({ view }: { view: HistoryView }) => {
  const { period, previous, compare, unit } = view;
  const current = useHAStatistics(PLUG_IDS, period, statPeriodOf(period), ['change']);
  const before = useHAStatistics(PLUG_IDS, previous, statPeriodOf(previous), ['change'], compare);
  const house = useHistoryElectricity();
  const isCost = unit === 'cost';

  const computed = useMemo(() => {
    const daysOf = (id: string): DayValue[] => {
      const days = [
        ...statisticDays(current.data?.[id], 'change'),
        ...statisticDays(before.data?.[id], 'change'),
      ];
      return isCost ? costDays('electricity', days) : days;
    };
    const plugs = PLUGS.map((plug) => {
      const days = daysOf(plug.id);
      const values = aggregateDays(days, period);
      const previousValues = aggregateDays(days, previous);
      const comparable = comparableDayTotals(days, period, previous);
      return {
        ...plug,
        values,
        previousValues,
        total: sumKnown(values),
        percent: percentChange(comparable.current, comparable.previous),
      };
    });
    const sum = (key: 'values' | 'previousValues') =>
      plugs[0][key].map((v, i) =>
        v === null && plugs[1][key][i] === null ? null : (v ?? 0) + (plugs[1][key][i] ?? 0),
      );
    const values = sum('values');
    // Enedis lags a day or two behind the plugs: only the bars known on both sides count.
    const shared = comparableTotals(
      aggregateDays(
        PLUGS.flatMap((p) => statisticDays(current.data?.[p.id], 'change')),
        period,
      ),
      aggregateDays(electricityDays(house.data), period),
    );
    return {
      plugs,
      values,
      previousValues: sum('previousValues'),
      share:
        shared.current !== null && shared.previous
          ? (shared.current / shared.previous) * 100
          : null,
    };
  }, [current.data, before.data, house.data, isCost, period, previous]);

  const labels = useMemo(() => periodBuckets(period).map((b) => b.label), [period]);
  const shownUnit = isCost ? '€' : 'kWh';
  const hasData = computed.plugs.some((p) => p.total !== null);

  return (
    <HistoryCard
      testId="history-devices-plugs"
      title="Prises"
      subtitle="Compteurs d'énergie des prises"
      icon={Plug}
      tone="lime"
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        {computed.plugs.map((plug) => (
          <Stat
            key={plug.id}
            label={`Prise ${plug.name}`}
            value={plug.total}
            unit={shownUnit}
            approximate={isCost}
            percent={compare ? plug.percent : null}
            comparedTo={`vs ${previousYearLabel(period)}`}
          />
        ))}
        <Stat label="Part de la maison" value={computed.share} unit="%" />
      </div>
      {current.isLoading ? (
        <ChartSkeleton height={160} />
      ) : !hasData ? (
        <EmptyChart>Pas de statistiques pour les prises sur cette période.</EmptyChart>
      ) : (
        <ComparisonBars
          labels={labels}
          values={computed.values}
          previous={compare ? computed.previousValues : undefined}
          color={SERIES_COLORS.electricity}
          unit={shownUnit}
          decimals={2}
          currentLabel="PC + TV"
          previousLabel={previousYearLabel(period)}
          height={160}
        />
      )}
    </HistoryCard>
  );
};

/**
 * Light hours per room over the period (hidden rooms left out).
 *
 * @param props - Usage, view, room of a light and hidden rooms.
 * @returns The card.
 */
const LightsCard = ({
  usage,
  loading,
  failed,
  view,
  areaOf,
  isRoomHidden,
}: {
  usage: UsageResponse | undefined;
  loading: boolean;
  failed: boolean;
  view: HistoryView;
  areaOf: (entityId: string) => string;
  isRoomHidden: (room: string) => boolean;
}) => {
  const { period } = view;
  const rooms = useMemo(
    () =>
      lightHoursByRoom(
        usage,
        areaOf,
        isRoomHidden,
        dayKey(period.start),
        dayKey(addDays(period.end, -1)),
      ),
    [usage, areaOf, isRoomHidden, period],
  );
  const total = rooms.reduce((sum, r) => sum + r.hours, 0);
  const max = Math.max(0, ...rooms.map((r) => r.hours));

  return (
    <HistoryCard
      testId="history-devices-lights"
      title="Lumières"
      subtitle="Heures d'allumage par pièce"
      icon={Lightbulb}
      tone="sun"
    >
      {loading ? (
        <ChartSkeleton height={160} />
      ) : failed ? (
        <EmptyChart>{USAGE_FAILED}</EmptyChart>
      ) : rooms.length === 0 || total === 0 ? (
        <EmptyChart>{NO_USAGE_YET}</EmptyChart>
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map(({ room, hours }) => (
            <li key={room} className="flex flex-row items-center gap-3 text-sm">
              <span className="w-28 shrink-0 truncate text-foreground">{room}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-sun"
                  style={{ width: `${max ? (hours / max) * 100 : 0}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-muted-foreground tabular-nums">
                {formatNumber(hours, 1)} h
              </span>
            </li>
          ))}
        </ul>
      )}
    </HistoryCard>
  );
};

/** Device widgets the user sees. */
interface DevicesVisibility {
  plugs: boolean;
  spa: boolean;
  washer: boolean;
  printer: boolean;
  lights: boolean;
}

interface DevicesHistoryProps {
  view: HistoryView;
  visible: DevicesVisibility;
  usage: UsageResponse | undefined;
  usageLoading: boolean;
  usageFailed: boolean;
  areaOf: (entityId: string) => string;
  isRoomHidden: (room: string) => boolean;
}

/**
 * The devices view of the history tab.
 *
 * @param props - View, visible devices, usage counters and rooms.
 * @returns The cards.
 */
export const DevicesHistory = ({
  view,
  visible,
  usage,
  usageLoading,
  usageFailed,
  areaOf,
  isRoomHidden,
}: DevicesHistoryProps) => {
  const metrics = useMemo(
    () => ({
      spa: [
        { label: 'Heures de chauffe', unit: 'h', days: usageDays(usage, 'spa_heating_hours') },
        {
          label: 'Température moyenne',
          unit: '°C',
          days: usageDays(usage, 'spa_temperature'),
          mode: 'mean' as const,
        },
      ],
      washer: [
        { label: 'Cycles', unit: '', days: usageDays(usage, 'washer_cycles') },
        { label: 'Heures de lavage', unit: 'h', days: usageDays(usage, 'washer_hours') },
      ],
      printer: [
        { label: "Heures d'impression", unit: 'h', days: usageDays(usage, 'printer_hours') },
        { label: 'Impressions', unit: '', days: usageDays(usage, 'printer_jobs') },
      ],
    }),
    [usage],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 xl:grid-cols-2">
      {visible.plugs && <PlugsCard view={view} />}
      {visible.spa && (
        <UsageCard
          testId="history-devices-spa"
          title="Spa"
          icon={Waves}
          tone="aqua"
          metrics={metrics.spa}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.temperature}
        />
      )}
      {visible.washer && (
        <UsageCard
          testId="history-devices-washer"
          title="Lave-linge"
          icon={WashingMachine}
          tone="aqua"
          metrics={metrics.washer}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.water}
        />
      )}
      {visible.printer && (
        <UsageCard
          testId="history-devices-printer"
          title="Imprimante 3D"
          icon={Printer}
          tone="aqua"
          metrics={metrics.printer}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
        />
      )}
      {visible.lights && (
        <LightsCard
          usage={usage}
          loading={usageLoading}
          failed={usageFailed}
          view={view}
          areaOf={areaOf}
          isRoomHidden={isRoomHidden}
        />
      )}
    </div>
  );
};
