/**
 * EnergyHistory — Vue Énergie de l'onglet Historique : électricité, gaz et eau par jour ou par
 * mois face à l'an passé, en quantité ou en euros ; gaz face à la météo (nuage et degrés-jours) ;
 * électricité heure par heure, talon de nuit et calendrier de l'année.
 */
import React, { useMemo } from 'react';
import { addDays } from 'date-fns';
import { CloudSun, Droplets, Flame, Moon, Zap } from 'lucide-react';
import { useGasData } from '../../hooks/useGasData';
import { useSuezData } from '../../hooks/useSuezData';
import { useHistoryElectricity, useLoadCurve } from '../../hooks/history/useHistoryData';
import type { HistoryView } from '../../hooks/history/useHistoryView';
import {
  costDays,
  electricityDays,
  gasDays,
  gasTemperaturePoints,
  gasWeatherSummary,
  hourlyHeatmap,
  nightBaseline,
  periodHasApproximateGasPrice,
  waterDays,
  yearCalendar,
  type EnergyDay,
  type EnergyKind,
} from '../../lib/history/energy';
import {
  aggregateDays,
  comparableDayTotals,
  dayKey,
  percentChange,
  periodBuckets,
  previousYearLabel,
  sumKnown,
  type Period,
  isTwelveMonths,
} from '../../lib/history/period';
import { DEFAULT_WATER_PRICE } from '../../lib/history/tariffs';
import type { Tone } from '../../constants/widgets';
import type { IconComponent } from '../../types/icon';
import { ComparisonBars, GasScatter } from './LazyHistoryCharts';
import { HourHeatmap, SERIES_COLORS, YearCalendar } from './HistoryGrids';
import { ChartSkeleton, EmptyChart, HistoryCard, Stat } from './HistoryParts';

interface EnergyMeta {
  title: string;
  icon: IconComponent;
  tone: Tone;
  color: string;
}

const META: Record<EnergyKind, EnergyMeta> = {
  electricity: { title: 'Électricité', icon: Zap, tone: 'lime', color: SERIES_COLORS.electricity },
  gas: { title: 'Gaz', icon: Flame, tone: 'lime', color: SERIES_COLORS.gas },
  water: { title: 'Eau', icon: Droplets, tone: 'aqua', color: SERIES_COLORS.water },
};

/** Quantity unit of an energy for a period: water in m³ over a year, litres otherwise. */
const quantityUnit = (kind: EnergyKind, period: Period): { unit: string; factor: number } =>
  kind !== 'water'
    ? { unit: 'kWh', factor: 1 }
    : isTwelveMonths(period.granularity)
      ? { unit: 'm³', factor: 1 / 1000 }
      : { unit: 'L', factor: 1 };

interface EnergyCardProps {
  kind: EnergyKind;
  days: EnergyDay[];
  view: HistoryView;
  loading: boolean;
  waterPrice?: number;
}

/**
 * One energy over the period: totals, change against last year and bars.
 *
 * @param props - Energy, its days, the view and the loading state.
 * @returns The card.
 */
const EnergyCard = ({ kind, days, view, loading, waterPrice }: EnergyCardProps) => {
  const { period, previous, compare, unit } = view;
  const meta = META[kind];
  const isCost = unit === 'cost';
  const { unit: qtyUnit, factor } = quantityUnit(kind, period);

  const computed = useMemo(() => {
    const quantities = days.map((d) => ({ date: d.date, value: d.value * factor }));
    const costs = costDays(kind, days, waterPrice);
    const shown = isCost ? costs : quantities;
    const values = aggregateDays(shown, period);
    const previousValues = aggregateDays(shown, previous);
    const qty = sumKnown(aggregateDays(quantities, period));
    const cost = sumKnown(aggregateDays(costs, period));
    const comparable = comparableDayTotals(shown, period, previous);
    // Per known day whatever the view: a month in progress would lower a per-month average.
    const first = dayKey(period.start);
    const last = dayKey(addDays(period.end, -1));
    const knownDays = new Set(
      quantities.filter((d) => d.date >= first && d.date <= last).map((d) => d.date),
    ).size;
    return {
      values,
      previousValues,
      qty,
      cost,
      percent: percentChange(comparable.current, comparable.previous),
      perBucket: qty !== null && knownDays > 0 ? qty / knownDays : null,
    };
  }, [days, factor, kind, waterPrice, isCost, period, previous]);

  const labels = useMemo(() => periodBuckets(period).map((b) => b.label), [period]);
  const comparedTo = `vs ${previousYearLabel(period)}`;
  const approximateGas = kind === 'gas' && isCost && periodHasApproximateGasPrice(period);

  return (
    <HistoryCard
      testId={`history-energy-${kind}`}
      title={meta.title}
      icon={meta.icon}
      tone={meta.tone}
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat
          testId={`history-energy-${kind}-total`}
          label={isCost ? 'Coût' : 'Consommation'}
          value={isCost ? computed.cost : computed.qty}
          unit={isCost ? '€' : qtyUnit}
          approximate={isCost}
          percent={compare ? computed.percent : null}
          comparedTo={comparedTo}
        />
        <Stat
          label={isCost ? 'Consommation' : 'Coût estimé'}
          value={isCost ? computed.qty : computed.cost}
          unit={isCost ? qtyUnit : '€'}
          approximate={!isCost}
        />
        <Stat label="Par jour" value={computed.perBucket} unit={qtyUnit} />
      </div>
      {loading ? (
        <ChartSkeleton />
      ) : computed.qty === null ? (
        <EmptyChart>Aucun relevé sur cette période.</EmptyChart>
      ) : (
        <ComparisonBars
          labels={labels}
          values={computed.values}
          previous={compare ? computed.previousValues : undefined}
          color={meta.color}
          unit={isCost ? '€' : qtyUnit}
          decimals={isCost ? 2 : 1}
          currentLabel="Cette période"
          previousLabel={previousYearLabel(period)}
        />
      )}
      {approximateGas && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Prix du gaz approché pour certains mois de cette période.
        </p>
      )}
    </HistoryCard>
  );
};

/**
 * Gas against the cold: kWh per degree day (equal weather) and one point per day.
 *
 * @param props - Gas days and the view.
 * @returns The card.
 */
const GasWeatherCard = ({ days, view }: { days: EnergyDay[]; view: HistoryView }) => {
  const { period, previous, compare } = view;
  const current = useMemo(() => gasWeatherSummary(days, period), [days, period]);
  const before = useMemo(() => gasWeatherSummary(days, previous), [days, previous]);
  const points = useMemo(() => gasTemperaturePoints(days, period), [days, period]);
  const previousPoints = useMemo(() => gasTemperaturePoints(days, previous), [days, previous]);

  return (
    <HistoryCard
      testId="history-gas-weather"
      title="Gaz et météo"
      subtitle="Degrés-jours base 18 °C : la consommation à météo égale"
      icon={CloudSun}
      tone="lime"
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat
          testId="history-gas-per-dju"
          label="kWh par degré-jour"
          value={current.kwhPerDegreeDay}
          unit="kWh"
          percent={compare ? percentChange(current.kwhPerDegreeDay, before.kwhPerDegreeDay) : null}
          comparedTo={`vs ${previousYearLabel(period)}`}
        />
        <Stat label="Degrés-jours" value={current.degreeDays || null} unit="DJU" />
        <Stat label="Température moyenne" value={current.meanTemp} unit="°C" />
      </div>
      {points.length === 0 ? (
        <EmptyChart>Pas de relevé quotidien de gaz avec température sur cette période.</EmptyChart>
      ) : (
        <GasScatter
          current={points}
          previous={compare ? previousPoints : undefined}
          currentLabel="Cette période"
          previousLabel={previousYearLabel(period)}
        />
      )}
    </HistoryCard>
  );
};

/**
 * Electricity hour by hour (week, month) with the night baseline, or the year as a calendar.
 *
 * @param props - Electricity days and the view.
 * @returns The card.
 */
const ElectricityPatternCard = ({ days, view }: { days: EnergyDay[]; view: HistoryView }) => {
  const { period } = view;
  const isYear = isTwelveMonths(period.granularity);
  const { data, isLoading } = useLoadCurve(period, !isYear);
  const loadCurve = useMemo(() => data?.loadCurve ?? [], [data]);
  const heatmap = useMemo(() => hourlyHeatmap(loadCurve, period), [loadCurve, period]);
  const baseline = useMemo(() => nightBaseline(loadCurve, period), [loadCurve, period]);
  const calendar = useMemo(() => yearCalendar(days, period), [days, period]);
  const known = baseline.filter((v): v is number => v !== null);
  const meanBaseline = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : null;
  const labels = useMemo(() => periodBuckets(period).map((b) => b.label), [period]);

  if (isYear) {
    return (
      <HistoryCard
        testId="history-electricity-pattern"
        title="Électricité jour par jour"
        subtitle="Plus la case est foncée, plus la journée a consommé"
        icon={Zap}
        tone="lime"
      >
        <YearCalendar weeks={calendar.weeks} max={calendar.max} unit="kWh" />
      </HistoryCard>
    );
  }

  return (
    <HistoryCard
      testId="history-electricity-pattern"
      title="Électricité heure par heure"
      subtitle="Courbe de charge Enedis, par pas de 30 minutes"
      icon={Moon}
      tone="lime"
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Stat
          testId="history-night-baseline"
          label="Talon de nuit moyen (1 h – 6 h)"
          value={meanBaseline}
          unit="W"
        />
        <Stat
          label="Talon sur un an (s'il ne change pas)"
          value={meanBaseline === null ? null : (meanBaseline * 24 * 365) / 1000}
          unit="kWh"
        />
      </div>
      {isLoading ? (
        <ChartSkeleton height={160} />
      ) : known.length === 0 ? (
        <EmptyChart>Pas de courbe de charge sur cette période.</EmptyChart>
      ) : (
        <>
          <HourHeatmap days={heatmap.days} cells={heatmap.cells} max={heatmap.max} />
          <p className="mt-4 mb-1 text-xs text-muted-foreground">Talon de nuit par jour (W)</p>
          <ComparisonBars
            labels={labels}
            values={baseline}
            color={SERIES_COLORS.electricity}
            unit="W"
            decimals={0}
            currentLabel="Talon"
            height={140}
          />
        </>
      )}
    </HistoryCard>
  );
};

/** Energies the user sees, as their widgets (rights and hidden widgets). */
export interface EnergyVisibility {
  electricity: boolean;
  gas: boolean;
  water: boolean;
}

/**
 * The energy view of the history tab.
 *
 * @param props - The view and the visible energies.
 * @returns The cards.
 */
export const EnergyHistory = ({
  view,
  visible,
}: {
  view: HistoryView;
  visible: EnergyVisibility;
}) => {
  const electricity = useHistoryElectricity(visible.electricity);
  const gas = useGasData(visible.gas);
  const water = useSuezData(visible.water);

  const elecDays = useMemo(() => electricityDays(electricity.data), [electricity.data]);
  const gasList = useMemo(() => gasDays(gas.data), [gas.data]);
  const waterList = useMemo(() => waterDays(water.data), [water.data]);

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 xl:grid-cols-2">
      {visible.electricity && (
        <EnergyCard
          kind="electricity"
          days={elecDays}
          view={view}
          loading={electricity.isLoading}
        />
      )}
      {visible.gas && <EnergyCard kind="gas" days={gasList} view={view} loading={gas.isLoading} />}
      {visible.water && (
        <EnergyCard
          kind="water"
          days={waterList}
          view={view}
          loading={water.isLoading}
          waterPrice={water.data?.price || DEFAULT_WATER_PRICE}
        />
      )}
      {visible.gas && <GasWeatherCard days={gasList} view={view} />}
      {visible.electricity && <ElectricityPatternCard days={elecDays} view={view} />}
      <p className="text-[11px] text-muted-foreground xl:col-span-2">
        Coûts estimés : part consommation TTC (tarif réglementé Base pour l&apos;électricité, prix
        repère de la CRE pour le gaz, prix Suez pour l&apos;eau), abonnements exclus.
      </p>
    </div>
  );
};
