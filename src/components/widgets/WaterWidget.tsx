/**
 * WaterWidget — Suez daily/weekly/yearly water consumption stats with bar charts.
 */
import React, { memo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget } from './BaseWidget';
import { BarChart } from '../ui/LazyCharts';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { useWaterWidgetData } from '../../hooks/useWaterStats';
import {
  EnergyHeadline,
  EnergyViewTabs,
  dayTrendSubtitle,
  type EnergyView,
} from './energy/EnergyParts';

const config = WIDGET_CONFIG.water;
const CYAN = 'hsl(var(--info))';
const EMERALD = 'hsl(var(--success))';

/**
 * Suez water consumption widget.
 *
 * @returns The widget.
 */
export const WaterWidget = memo(function WaterWidget() {
  const { data, isLoading, price, dayTrend, yesterdayStats, weekStats, yearStats } =
    useWaterWidgetData();
  const [viewMode, setViewMode] = useState<EnergyView>('week');

  return (
    <BaseWidget
      id="water"
      title={config.title}
      subtitle={
        dayTrend
          ? dayTrendSubtitle(dayTrend, { unit: 'L', decimals: 0 })
          : ['Suez', 'Tout sur mon eau']
      }
      icon={config.icon}
    >
      {isLoading || !data ? (
        <div className="p-4">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <div>
          <EnergyViewTabs widgetId="water" value={viewMode} onChange={setViewMode} />

          {viewMode === 'yesterday' && yesterdayStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label="Consommation Veille"
                value={yesterdayStats.consumption.toFixed(0)}
                unit="L"
                aside={{ label: 'Coût Estimé', value: `${yesterdayStats.cost.toFixed(2)} €` }}
              />
              <p className="text-xs text-muted-foreground">
                Basé sur un tarif de {price.toFixed(2)} €/m³ (
                {format(parseISO(yesterdayStats.date), 'd MMMM yyyy', { locale: fr })})
              </p>
            </div>
          ) : viewMode === 'week' && weekStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label="Total 7 Jours"
                value={weekStats.totalConsumption.toFixed(0)}
                unit="L"
                aside={{
                  label: 'Moyenne',
                  value: `${weekStats.avgConsumption.toFixed(0)} L / jour`,
                }}
              />
              <BarChart
                values={weekStats.days.map((d) => d.value)}
                labels={weekStats.days.map((d) => format(parseISO(d.date), 'EEE', { locale: fr }))}
                maxValue={weekStats.maxConsumption}
                barColor={CYAN}
                unit="L"
                yAxisDecimals={0}
                currentLabel="Semaine en cours"
                comparisonValues={weekStats.comparisonDays}
                comparisonLabel="Semaine précédente"
              />
            </div>
          ) : viewMode === 'year' && yearStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label="Total Annuel (12 mois)"
                value={yearStats.totalConsumption.toFixed(0)}
                unit="L"
                aside={{ label: 'Moy. Mensuelle', value: `${yearStats.avgMonthly.toFixed(0)} L` }}
              />
              <BarChart
                values={yearStats.months.map((m) => m.value)}
                labels={yearStats.months.map((m) => m.label.substring(0, 3))}
                maxValue={yearStats.maxMonthly}
                barColor={EMERALD}
                unit="L"
                yAxisDecimals={0}
                currentLabel="Année en cours"
                comparisonValues={yearStats.comparisonMonths}
                comparisonLabel="Année précédente"
              />
            </div>
          ) : null}
        </div>
      )}
    </BaseWidget>
  );
});
