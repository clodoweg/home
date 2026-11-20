/**
 * LazyHistoryCharts — Graphiques de l'onglet Historique chargés au premier affichage : recharts
 * reste hors du démarrage, et l'écran lui-même reste dans le bundle principal (en chunk à la
 * demande, il séparait UserContext dans un chunk partagé où l'auth simulée survivait au build,
 * détecté par check:dist).
 */
import React, { Suspense } from 'react';
import { ChartLoadBoundary } from '../../components/ui/LazyCharts';
import type * as Charts from './HistoryCharts';
import { ChartSkeleton } from './HistoryParts';

const load = () => import('./HistoryCharts');
const ComparisonBarsImpl = React.lazy(() => load().then((m) => ({ default: m.ComparisonBars })));
const RangeChartImpl = React.lazy(() => load().then((m) => ({ default: m.RangeChart })));
const GasScatterImpl = React.lazy(() => load().then((m) => ({ default: m.GasScatter })));
const CrossChartImpl = React.lazy(() => load().then((m) => ({ default: m.CrossChart })));

const lazyChart =
  <P extends { height?: number }>(Impl: React.ComponentType<P>, defaultHeight: number) =>
  (props: P) => (
    <ChartLoadBoundary height={props.height ?? defaultHeight}>
      <Suspense fallback={<ChartSkeleton height={props.height ?? defaultHeight} />}>
        <Impl {...props} />
      </Suspense>
    </ChartLoadBoundary>
  );

export type CrossSeries = Charts.CrossSeries;

/** Bars of the period with last year's behind (see HistoryCharts), loaded on first display. */
export const ComparisonBars = lazyChart<React.ComponentProps<typeof Charts.ComparisonBars>>(
  ComparisonBarsImpl,
  200,
);
/** Daily range and mean (see HistoryCharts), loaded on first display. */
export const RangeChart = lazyChart<React.ComponentProps<typeof Charts.RangeChart>>(
  RangeChartImpl,
  180,
);
/** Gas against temperature (see HistoryCharts), loaded on first display. */
export const GasScatter = lazyChart<React.ComponentProps<typeof Charts.GasScatter>>(
  GasScatterImpl,
  220,
);
/** Crossed series (see HistoryCharts), loaded on first display. */
export const CrossChart = lazyChart<React.ComponentProps<typeof Charts.CrossChart>>(
  CrossChartImpl,
  260,
);
