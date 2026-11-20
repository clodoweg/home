/**
 * CrossHistory — Vue Croiser de l'onglet Historique : jusqu'à trois séries au choix
 * (énergies, températures et humidités des pièces, prises, usages), superposées sur la période.
 */
import React, { useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { PLUG_ENTITIES } from '../../constants/entities';
import { useGasData } from '../../hooks/useGasData';
import { useSuezData } from '../../hooks/useSuezData';
import { useHAStatistics, useHistoryElectricity } from '../../hooks/history/useHistoryData';
import type { HistoryView } from '../../hooks/history/useHistoryView';
import { electricityDays, gasDays, waterDays } from '../../lib/history/energy';
import { aggregateDays, periodBuckets, type DayValue } from '../../lib/history/period';
import { statisticDays, usageDays } from '../../lib/history/series';
import type { TemperatureSensorRow } from '../../lib/temperature-sensors';
import type { UsageResponse } from '../../services/history';
import { CrossChart, type CrossSeries } from './LazyHistoryCharts';
import { CROSS_COLORS } from './HistoryGrids';
import { EmptyChart, HistoryCard } from './HistoryParts';

/** A series offered in the free comparison. */
interface CrossOption {
  id: string;
  label: string;
  unit: string;
  /** Temperatures and humidities are averaged per bar, quantities summed. */
  mode: 'sum' | 'mean';
  /** Statistic id to load (sensors), if any. */
  statisticId?: string;
}

const NONE = '';
const MAX_SERIES = 3;

interface CrossHistoryProps {
  view: HistoryView;
  rooms: TemperatureSensorRow[];
  usage: UsageResponse | undefined;
  visible: { electricity: boolean; gas: boolean; water: boolean; plugs: boolean; usage: boolean };
  /** Lights of hidden rooms are left out, as everywhere. */
  isLightShown: (entityId: string) => boolean;
}

/**
 * The free comparison of the history tab.
 *
 * @param props - View, rooms, usage counters and visible sources.
 * @returns The card.
 */
export const CrossHistory = ({ view, rooms, usage, visible, isLightShown }: CrossHistoryProps) => {
  const options = useMemo<CrossOption[]>(() => {
    const list: CrossOption[] = [];
    if (visible.electricity)
      list.push({ id: 'electricity', label: 'Électricité', unit: 'kWh', mode: 'sum' });
    if (visible.gas) {
      list.push({ id: 'gas', label: 'Gaz', unit: 'kWh', mode: 'sum' });
      list.push({
        id: 'gas_temp',
        label: 'Température extérieure (GRDF)',
        unit: '°C',
        mode: 'mean',
      });
    }
    if (visible.water) list.push({ id: 'water', label: 'Eau', unit: 'L', mode: 'sum' });
    for (const room of rooms) {
      list.push({
        id: `temp:${room.tempId}`,
        label: `Température ${room.name}`,
        unit: '°C',
        mode: 'mean',
        statisticId: room.tempId,
      });
      if (room.humId) {
        list.push({
          id: `hum:${room.humId}`,
          label: `Humidité ${room.name}`,
          unit: '%',
          mode: 'mean',
          statisticId: room.humId,
        });
      }
    }
    if (visible.plugs) {
      list.push({
        id: `plug:${PLUG_ENTITIES.energyPC}`,
        label: 'Prise PC',
        unit: 'kWh',
        mode: 'sum',
        statisticId: PLUG_ENTITIES.energyPC,
      });
      list.push({
        id: `plug:${PLUG_ENTITIES.energyTV}`,
        label: 'Prise TV',
        unit: 'kWh',
        mode: 'sum',
        statisticId: PLUG_ENTITIES.energyTV,
      });
    }
    if (visible.usage) {
      list.push({ id: 'usage:spa_heating_hours', label: 'Chauffe du spa', unit: 'h', mode: 'sum' });
      list.push({ id: 'usage:light_hours', label: 'Lumières allumées', unit: 'h', mode: 'sum' });
      list.push({
        id: 'usage:washer_cycles',
        label: 'Cycles de lave-linge',
        unit: 'cycles',
        mode: 'sum',
      });
    }
    return list;
  }, [rooms, visible]);

  const [chosen, setChosen] = useState<string[]>(() => [
    options.find((o) => o.id === 'gas')?.id ?? options[0]?.id ?? NONE,
    options.find((o) => o.id === 'gas_temp')?.id ?? NONE,
    NONE,
  ]);
  const selected = useMemo(
    () => chosen.map((id) => options.find((o) => o.id === id)).filter((o): o is CrossOption => !!o),
    [chosen, options],
  );

  const { period } = view;
  const statisticIds = useMemo(
    () => selected.map((o) => o.statisticId).filter((id): id is string => !!id),
    [selected],
  );
  // One row per day over a year at most: 366 rows, under the back's 400-day cap.
  const statistics = useHAStatistics(statisticIds, period, 'day', ['mean', 'change']);
  const needs = (id: string) => selected.some((o) => o.id === id || o.id === `${id}_temp`);
  const electricity = useHistoryElectricity(needs('electricity'));
  const gas = useGasData(needs('gas'));
  const water = useSuezData(needs('water'));

  const series = useMemo<CrossSeries[]>(() => {
    const daysOf = (option: CrossOption): DayValue[] => {
      if (option.id === 'electricity') return electricityDays(electricity.data);
      if (option.id === 'gas') return gasDays(gas.data).filter((d) => !d.isEstimate);
      if (option.id === 'gas_temp')
        return gasDays(gas.data)
          .filter((d) => typeof d.temp === 'number')
          .map((d) => ({ date: d.date, value: d.temp as number }));
      if (option.id === 'water') return waterDays(water.data).filter((d) => !d.isEstimate);
      if (option.id.startsWith('usage:'))
        return usageDays(usage, option.id.slice('usage:'.length), isLightShown);
      const rows = statistics.data?.[option.statisticId as string];
      return statisticDays(rows, option.id.startsWith('plug:') ? 'change' : 'mean');
    };
    return selected.map((option, i) => ({
      name: option.label,
      unit: option.unit,
      values: aggregateDays(daysOf(option), period, option.mode),
      color: CROSS_COLORS[i],
    }));
  }, [
    selected,
    electricity.data,
    gas.data,
    water.data,
    usage,
    isLightShown,
    statistics.data,
    period,
  ]);

  const labels = useMemo(() => periodBuckets(period).map((b) => b.label), [period]);
  const hasData = series.some((s) => s.values.some((v) => v !== null));

  return (
    <HistoryCard
      testId="history-cross"
      title="Croiser des données"
      subtitle="Jusqu'à trois séries sur la même période (deux axes quand les unités diffèrent)"
      icon={Shuffle}
      tone="lilac"
    >
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {Array.from({ length: MAX_SERIES }, (_, i) => (
          <label key={i} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Série {i + 1}
            <select
              data-testid={`history-cross-select-${i}`}
              value={chosen[i] ?? NONE}
              onChange={(event) => {
                const next = [...chosen];
                next[i] = event.target.value;
                setChosen(next);
              }}
              className="h-11 w-full min-w-0 rounded-xl bg-muted px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              <option value={NONE}>{i === 0 ? 'Choisir une série' : 'Aucune'}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.unit})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {selected.length === 0 || !hasData ? (
        <EmptyChart>
          {selected.length === 0
            ? 'Choisis au moins une série.'
            : 'Pas de données pour ces séries sur cette période.'}
        </EmptyChart>
      ) : (
        <CrossChart labels={labels} series={series} />
      )}
    </HistoryCard>
  );
};
