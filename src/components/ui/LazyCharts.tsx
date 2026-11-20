/** LazyCharts — Charts loaded on first display: recharts (and its dependencies) stays out of the startup bundle. */
import React, { Suspense } from 'react';
import { Skeleton } from './Skeleton';
import type { BarChartProps } from './BarChart';
import type { WidgetChartProps } from './WidgetChart';

/**
 * Shows a reload offer instead of breaking the whole widget when a chart chunk cannot be loaded
 * (network failure, or files of an older deploy that the service worker has already dropped).
 */
export class ChartLoadBoundary extends React.Component<
  { height: number; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted text-xs text-muted-foreground"
        style={{ height: this.props.height }}
      >
        <span>Graphique indisponible</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-border px-3 py-1 text-foreground hover:bg-muted"
        >
          Recharger
        </button>
      </div>
    );
  }
}

const BarChartImpl = React.lazy(() =>
  import('./BarChart').then((module) => ({ default: module.BarChart })),
);
const WidgetChartImpl = React.lazy(() =>
  import('./WidgetChart').then((module) => ({ default: module.WidgetChart })),
);

/**
 * Bar chart, loaded on first display; a placeholder of the same height shows meanwhile.
 *
 * @param props - See BarChart.
 * @returns The chart.
 */
export const BarChart = (props: BarChartProps) => (
  <ChartLoadBoundary height={props.height ?? 200}>
    <Suspense
      fallback={<Skeleton className="w-full rounded-xl" style={{ height: props.height ?? 200 }} />}
    >
      <BarChartImpl {...props} />
    </Suspense>
  </ChartLoadBoundary>
);

/**
 * History chart, loaded on first display; a placeholder of the same height shows meanwhile.
 *
 * @param props - See WidgetChart.
 * @returns The chart.
 */
export const WidgetChart = (props: WidgetChartProps) => (
  <ChartLoadBoundary height={props.height ?? 160}>
    <Suspense
      fallback={<Skeleton className="w-full rounded-xl" style={{ height: props.height ?? 160 }} />}
    >
      <WidgetChartImpl {...props} />
    </Suspense>
  </ChartLoadBoundary>
);
