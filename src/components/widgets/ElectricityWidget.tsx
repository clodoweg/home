/**
 * ElectricityWidget — Enedis daily/weekly/yearly consumption stats with bar charts.
 */
import React, { memo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget } from './BaseWidget';
import { BarChart } from '../ui/LazyCharts';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { useElectricityStats } from '../../hooks/useElectricityStats';
import { useEnedisData } from '../../hooks/useEnedisData';
import {
  EnergyHeadline,
  EnergyViewTabs,
  dayTrendSubtitle,
  type EnergyView,
} from './energy/EnergyParts';

const AMBER = 'hsl(var(--warning))';
const BLUE = 'hsl(var(--info))';
const EMERALD = 'hsl(var(--success))';

/**
 * Enedis electricity consumption widget.
 *
 * @returns The widget.
 */
export const ElectricityWidget = memo(function ElectricityWidget() {
  const { data, isLoading: loading } = useEnedisData();
  const [viewMode, setViewMode] = useState<EnergyView>('week');

  const {
    dailyStats: dailyViewStats,
    weekStats,
    yearStats,
    headerStats,
  } = useElectricityStats(data || null);

  return (
    <BaseWidget
      id="electricity"
      title={WIDGET_CONFIG.electricity.title}
      subtitle={
        headerStats
          ? dayTrendSubtitle(headerStats, { unit: 'kWh', decimals: 1 })
          : ['Enedis', 'Linky']
      }
      icon={WIDGET_CONFIG.electricity.icon}
    >
      {loading && !data ? (
        <div className="p-4">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <div>
          <EnergyViewTabs widgetId="electricity" value={viewMode} onChange={setViewMode} />

          {viewMode === 'yesterday' && dailyViewStats ? (
            <div>
              <EnergyHeadline
                label="Consommation"
                value={dailyViewStats.totalConsumption.toFixed(1)}
                unit="kWh"
              />
              <BarChart
                values={dailyViewStats.hourlyData}
                labels={dailyViewStats.hourlyData.map((_, i) => (i % 4 === 0 ? `${i}h` : ''))}
                maxValue={Math.max(...dailyViewStats.hourlyData)}
                barColor={AMBER}
                unit="kWh"
              />
            </div>
          ) : viewMode === 'week' && weekStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label="Total 7 Jours"
                value={(weekStats.totalConsumption / 1000).toFixed(1)}
                unit="kWh"
                aside={{
                  label: 'Moy. Journalière',
                  value: `${(weekStats.avgDailyConsumption / 1000).toFixed(1)} kWh`,
                }}
              />
              <BarChart
                values={weekStats.days.map((d) => d.value / 1000)}
                labels={weekStats.days.map((d) => {
                  try {
                    return format(parseISO(d.date), 'EEE', { locale: fr });
                  } catch {
                    return d.date?.slice(5, 10) || '?';
                  }
                })}
                maxValue={Math.max(
                  weekStats.maxDailyConsumption / 1000,
                  ...(weekStats.comparisonDays?.length ? weekStats.comparisonDays : [0]),
                )}
                barColor={BLUE}
                unit="kWh"
                currentLabel="Semaine en cours"
                comparisonValues={weekStats.comparisonDays}
                comparisonLabel="Semaine précédente"
              />
            </div>
          ) : viewMode === 'year' && yearStats ? (
            <div>
              <EnergyHeadline
                className="mb-4"
                label="Total Annuel"
                value={(yearStats.totalConsumption / 1000).toFixed(1)}
                unit="kWh"
                aside={{
                  label: 'Moy. Mensuelle',
                  value: `${(yearStats.avgMonthlyConsumption / 1000).toFixed(1)} kWh`,
                }}
              />
              <BarChart
                values={yearStats.months.map((m) => m.value / 1000)}
                labels={yearStats.months.map((m) => {
                  try {
                    return format(parseISO(m.date), 'MMM', { locale: fr });
                  } catch {
                    return m.date?.slice(5, 7) || '?';
                  }
                })}
                maxValue={Math.max(
                  yearStats.maxMonthlyConsumption / 1000,
                  ...(yearStats.comparisonMonths?.length ? yearStats.comparisonMonths : [0]),
                )}
                barColor={EMERALD}
                unit="kWh"
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
