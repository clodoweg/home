/**
 * GasWidget — GRDF daily/weekly/yearly gas consumption with temperature overlay.
 */
import React, { memo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget } from './BaseWidget';
import { BarChart } from '../ui/LazyCharts';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { useGasWidgetData } from '../../hooks/useGasStats';
import {
  EnergyHeadline,
  EnergyViewTabs,
  dayTrendSubtitle,
  type EnergyView,
} from './energy/EnergyParts';

const config = WIDGET_CONFIG.gas;
const BLUE = 'hsl(var(--info))';
const GREEN = '#22c55e';
const UNIT = 'kWh';

/**
 * GRDF gas consumption widget.
 *
 * @returns The widget.
 */
export const GasWidget = memo(function GasWidget() {
  const { data, isLoading, dayTrend, yesterdayStats, weekStats, yearStats } = useGasWidgetData();
  const [viewMode, setViewMode] = useState<EnergyView>('week');

  return (
    <BaseWidget
      id="gas"
      title={config.title}
      subtitle={
        dayTrend
          ? dayTrendSubtitle(dayTrend, {
              unit: UNIT,
              decimals: 1,
              withoutComparison: 'text-success',
            })
          : ['Gazpar', 'GRDF']
      }
      icon={config.icon}
    >
      {isLoading || !data ? (
        <div className="p-4">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <div>
          <EnergyViewTabs widgetId="gas" value={viewMode} onChange={setViewMode} />

          {viewMode === 'yesterday' && yesterdayStats ? (
            <div>
              <EnergyHeadline
                label="Dernière Consommation"
                value={yesterdayStats.consumption.toFixed(1)}
                unit={UNIT}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {format(parseISO(yesterdayStats.date), 'EEEE d MMMM', { locale: fr })}
              </p>
            </div>
          ) : viewMode === 'week' && weekStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label="7 Derniers Jours"
                value={weekStats.totalConsumption.toFixed(1)}
                unit={UNIT}
                aside={{
                  label: 'Moyenne',
                  value: `${weekStats.avgConsumption.toFixed(1)} ${UNIT}`,
                }}
              />
              <BarChart
                values={weekStats.days.map((d) => d.value)}
                labels={weekStats.days.map((d) => format(parseISO(d.date), 'EEE', { locale: fr }))}
                maxValue={weekStats.maxConsumption}
                barColor={BLUE}
                unit={UNIT}
                yAxisDecimals={0}
                currentLabel="Semaine en cours"
                comparisonValues={weekStats.comparisonDays}
                comparisonLabel="Semaine précédente"
                lineValues={weekStats.temperatures}
                lineColor={BLUE}
                comparisonLineValues={weekStats.comparisonTemperatures}
              />
            </div>
          ) : viewMode === 'year' && yearStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label={`Année ${new Date().getFullYear()}`}
                value={yearStats.totalConsumption.toFixed(0)}
                unit={UNIT}
                aside={{
                  label: 'Moy. Mensuelle',
                  value: `${yearStats.avgMonthly.toFixed(1)} ${UNIT}`,
                }}
              />
              <BarChart
                values={yearStats.months.map((m) => m.value)}
                labels={yearStats.months.map((m) => m.label.substring(0, 3))}
                maxValue={yearStats.maxMonthly}
                barColor={GREEN}
                unit={UNIT}
                yAxisDecimals={0}
                currentLabel="Année en cours"
                comparisonValues={yearStats.comparisonMonths}
                comparisonLabel="Année précédente"
                lineValues={yearStats.temperatures}
                lineColor={GREEN}
                comparisonLineValues={yearStats.comparisonTemperatures}
              />
            </div>
          ) : null}
        </div>
      )}
    </BaseWidget>
  );
});
