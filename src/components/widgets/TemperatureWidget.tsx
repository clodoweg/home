/**
 * TemperatureWidget — Room-based temperature & humidity sensors grid.
 * Displays a summary table of sensors and trends at the top, and room cards below.
 * Per-room expansion opens a 24h WidgetChart with dual axes.
 *
 * @param props - Component props containing live data and entity metadata.
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState } from '../../services/api';
import { WidgetChart } from '../ui/LazyCharts';
import {
  clearWidgetDetail,
  useWidgetDetailRequest,
  type WidgetDetailRequest,
} from '../../lib/widget-detail';
import { useUserProfile } from '../../context/UserContext';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';
import { useHAHistory } from '../../hooks/useHAHistory';
import { useHABatchHistory } from '../../hooks/useHABatchHistory';
import { Panel } from '../ui/Panel';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useElementWidth } from '../../hooks/useElementWidth';
import { toggleProps } from '../../lib/a11y';
import { COMFORT_TEXT_CLASS, humidityComfort, temperatureComfort } from '../../lib/comfort';
import { groupByFloor } from '../../lib/floors';
import { listTemperatureSensors } from '../../lib/temperature-sensors';
import { AreaIcon } from '../ui/AreaIcon';

interface TemperatureWidgetProps {
  data?: HAState[];
  metadata?: Record<string, { area: string; floor?: string; model: string }>;
  showHistory?: boolean;
}

const TEMP_COLOR = 'hsl(var(--warning))';
const HUM_COLOR = 'hsl(var(--info))';

/**
 * Calculates whether the current value is rising, falling, or stable compared to a recent historical point.
 *
 * @param current - Current sensor numerical state.
 * @param historyPoints - Array of past history points.
 * @param isTemp - Whether this sensor is a temperature sensor.
 * @returns Trend state string.
 */
const getTrend = (
  current: number | null,
  historyPoints: { state: string; last_changed?: string }[] | undefined,
  isTemp: boolean,
): 'up' | 'down' | 'stable' => {
  if (current === null || !historyPoints || historyPoints.length === 0) return 'stable';

  // Compare to the state from 2 hours ago to capture recent trend rather than daily differences
  const now = Date.now();
  const targetTime = now - 2 * 60 * 60 * 1000;
  let comparisonValue: number | null = null;

  for (let i = historyPoints.length - 1; i >= 0; i--) {
    const pt = historyPoints[i];
    const ptTime = pt.last_changed ? new Date(pt.last_changed).getTime() : 0;
    if (ptTime && ptTime <= targetTime) {
      const val = parseFloat(pt.state);
      if (!isNaN(val)) {
        comparisonValue = val;
        break;
      }
    }
  }

  // Fallback to the oldest point if all available history points are within the last 2 hours
  if (comparisonValue === null) {
    const oldestStr = historyPoints[0].state;
    const oldest = parseFloat(oldestStr);
    if (!isNaN(oldest)) {
      comparisonValue = oldest;
    }
  }

  if (comparisonValue === null) return 'stable';

  const diff = current - comparisonValue;
  const threshold = isTemp ? 0.1 : 0.5;
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
};

/**
 * Retrieves the sensor value from yesterday at the exact same hour (first valid point in the 24h history).
 *
 * @param historyPoints - Array of past history points.
 * @param isTemp - Whether this sensor is a temperature sensor.
 * @returns Value from 24h ago, or null if no valid points.
 */
const getYesterdayValueAtSameHour = (
  historyPoints: { state: string }[] | undefined,
  isTemp: boolean,
): number | null => {
  if (!historyPoints || historyPoints.length === 0) return null;
  // The historyPoints array spans the last 24h, sorted chronologically.
  // The first point represents the state at the start of the 24h window (yesterday at the same hour).
  for (const pt of historyPoints) {
    const val = parseFloat(pt.state);
    if (!isNaN(val) && (!isTemp || val !== 0)) {
      return val;
    }
  }
  return null;
};

/**
 * Renders the trend icon with appropriate color classes.
 *
 * @param trend - Trend direction.
 * @param type - Sensor type: temperature or humidity.
 * @returns React element representing the trend icon.
 */
const renderTrendIcon = (trend: 'up' | 'down' | 'stable', type: 'temp' | 'hum') => {
  if (trend === 'up') {
    const colorClass = type === 'temp' ? 'text-primary' : 'text-info';
    return <TrendingUp size={14} className={cn('ml-1 inline', colorClass)} />;
  }
  if (trend === 'down') {
    const colorClass = type === 'temp' ? 'text-info' : 'text-primary';
    return <TrendingDown size={14} className={cn('ml-1 inline', colorClass)} />;
  }
  return <Minus size={14} className="ml-1 inline text-muted-foreground" />;
};

/**
 * Temperature and humidity per room, grouped by floor, with history charts.
 *
 * @param props - Sensors and metadata.
 * @returns The widget.
 */
export const TemperatureWidget = memo(function TemperatureWidget({
  data = [],
  metadata = {},
  showHistory = true,
}: TemperatureWidgetProps) {
  const { canAccessHistory } = useUserProfile();
  const {
    roomOrder,
    floorOrder,
    isRoomHidden,
    isSensorHidden,
    tempThresholds,
    humThresholds,
    roomIcons,
    isCollapsed,
  } = useWidgetPreferences();
  // Keyed by tempId (entity_id) so two sensors in the same area can be expanded independently
  const [expandedSensorId, setExpandedSensorId] = useState<string | null>(null);
  // A home card links to `#maison/temperature/<sensor>`: that sensor opens, as if clicked.
  const detailRequest = useWidgetDetailRequest('temperature');
  const [handledDetailRequest, setHandledDetailRequest] = useState<WidgetDetailRequest | null>(
    null,
  );
  if (detailRequest && detailRequest !== handledDetailRequest) {
    setHandledDetailRequest(detailRequest);
    if (canAccessHistory) setExpandedSensorId(detailRequest.detail);
  }
  useEffect(() => {
    if (detailRequest) clearWidgetDetail(detailRequest);
  }, [detailRequest]);
  // The chart is drawn inside the panel padding.
  const [tableChartRef, tableChartWidth] = useElementWidth(32);

  const sensorList = useMemo(
    () =>
      listTemperatureSensors({
        data,
        metadata,
        isSensorHidden,
        isRoomHidden,
        roomOrder,
        floorOrder,
      }),
    [data, metadata, roomOrder, floorOrder, isRoomHidden, isSensorHidden],
  );

  const sensorsByFloor = useMemo(() => groupByFloor(sensorList), [sensorList]);

  const historyEntityIds = useMemo(() => {
    const ids: string[] = [];
    sensorList.forEach((s) => {
      ids.push(s.tempId);
      if (s.humId) ids.push(s.humId);
    });
    return ids;
  }, [sensorList]);

  // Trends only show in the widget body: no history while it is collapsed.
  const { data: batchHistory = {} } = useHABatchHistory({
    entityIds: historyEntityIds,
    hours: 24,
    enabled: canAccessHistory && !isCollapsed('temperature'),
  });

  const activeSensor = sensorList.find((s) => s.tempId === expandedSensorId);
  const tempHistory = useHAHistory({
    entityId: activeSensor?.tempId || undefined,
    hours: 48,
    showHistory: !!expandedSensorId,
    currentValue: activeSensor?.temp ?? undefined,
  });
  const humHistory = useHAHistory({
    entityId: activeSensor?.humId || undefined,
    hours: 48,
    showHistory: !!expandedSensorId,
    currentValue: activeSensor?.humidity ?? undefined,
  });

  const getTempColor = (temp: number | null, floor?: string) =>
    COMFORT_TEXT_CLASS[temperatureComfort(temp, floor, tempThresholds)];
  const getHumColor = (hum: number | null, floor?: string) =>
    COMFORT_TEXT_CLASS[humidityComfort(hum, floor, humThresholds)];

  const subtitle = sensorList
    .filter((s) => s.humidity !== null)
    .slice(0, 2)
    .map((s) => (
      <React.Fragment key={s.tempId}>
        {s.name}{' '}
        <WidgetHighlight colorClass={getTempColor(s.temp, s.floor)}>{s.temp}°</WidgetHighlight>
        {s.humidity !== null && (
          <WidgetHighlight colorClass={getHumColor(s.humidity, s.floor)}>
            {' '}
            {s.humidity}%
          </WidgetHighlight>
        )}
      </React.Fragment>
    ));

  return (
    <BaseWidget
      id="temperature"
      testID="widget-temperature"
      title={WIDGET_CONFIG.temperature.title}
      subtitle={subtitle}
      icon={WIDGET_CONFIG.temperature.icon}
    >
      {/* Floors side by side once the widget is wide (two section columns on a computer). */}
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-3 @3xl:grid-cols-2">
          {sensorsByFloor.map(({ floor, items: floorSensors }) => (
            <Panel
              key={floor}
              className="overflow-hidden bg-muted p-4"
              data-testid={`temp-summary-table-${floor.toLowerCase()}`}
            >
              <div className="mb-3 text-xs font-bold tracking-wider text-primary uppercase">
                {floor}
              </div>
              <div className="overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <th className="w-2/5 pb-2 pl-3 font-medium">Capteur</th>
                      <th className="w-[30%] pb-2 text-right font-medium">Température</th>
                      <th className="w-[30%] pr-3 pb-2 text-right font-medium">Humidité</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {floorSensors.map((item) => {
                      const tempTrend = getTrend(item.temp, batchHistory[item.tempId], true);
                      const humTrend = getTrend(
                        item.humidity,
                        batchHistory[item.humId || ''],
                        false,
                      );
                      const tempYesterday = getYesterdayValueAtSameHour(
                        batchHistory[item.tempId],
                        true,
                      );
                      const humYesterday = getYesterdayValueAtSameHour(
                        batchHistory[item.humId || ''],
                        false,
                      );
                      const isExpanded = expandedSensorId === item.tempId;

                      return (
                        <React.Fragment key={item.tempId}>
                          <tr
                            data-testid={`temp-row-${item.tempId}`}
                            data-widget-detail={item.tempId}
                            className={cn('group', canAccessHistory && 'cursor-pointer')}
                            {...(canAccessHistory
                              ? toggleProps(isExpanded, () =>
                                  setExpandedSensorId((prev) =>
                                    prev === item.tempId ? null : item.tempId,
                                  ),
                                )
                              : {})}
                          >
                            <td
                              className={cn(
                                'border-b border-border py-2.5 pl-3 font-medium text-foreground transition-all group-hover:rounded-l-xl group-hover:bg-secondary',
                                isExpanded ? 'rounded-l-xl bg-secondary' : '',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <AreaIcon
                                  area={item.area}
                                  roomIcons={roomIcons}
                                  size={16}
                                  className="text-muted-foreground/75"
                                />
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td
                              className={cn(
                                'border-b border-border py-2.5 text-right whitespace-nowrap transition-all group-hover:bg-secondary',
                                isExpanded ? 'bg-secondary' : '',
                              )}
                            >
                              <div className="flex items-baseline justify-end gap-1.5">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 font-semibold',
                                    getTempColor(item.temp, item.floor),
                                  )}
                                >
                                  {item.temp.toFixed(1)}°C
                                  {renderTrendIcon(tempTrend, 'temp')}
                                </span>
                                {tempYesterday !== null && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({tempYesterday.toFixed(1)}°C)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className={cn(
                                'border-b border-border py-2.5 pr-3 text-right whitespace-nowrap transition-all group-hover:rounded-r-xl group-hover:bg-secondary',
                                isExpanded ? 'rounded-r-xl bg-secondary' : '',
                              )}
                            >
                              <div className="flex items-baseline justify-end gap-1.5">
                                {item.humidity !== null ? (
                                  <>
                                    <span
                                      className={cn(
                                        'inline-flex items-center gap-1 font-semibold',
                                        getHumColor(item.humidity, item.floor),
                                      )}
                                    >
                                      {item.humidity}%{renderTrendIcon(humTrend, 'hum')}
                                    </span>
                                    {humYesterday !== null && (
                                      <span className="text-[10px] text-muted-foreground">
                                        ({Math.round(humYesterday)}%)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && showHistory && (
                            <tr>
                              <td colSpan={3} className="border-b border-border p-3">
                                <div ref={tableChartRef}>
                                  {tempHistory.loading || humHistory.loading ? (
                                    <Skeleton className="h-32 w-full rounded-lg" />
                                  ) : (
                                    <WidgetChart
                                      series={[
                                        {
                                          data: tempHistory.series,
                                          color: TEMP_COLOR,
                                          label: 'Température',
                                          yAxis: 'left',
                                          unit: '°C',
                                        },
                                        {
                                          data: humHistory.series,
                                          color: HUM_COLOR,
                                          label: 'Humidité',
                                          yAxis: 'right',
                                          unit: '%',
                                        },
                                      ]}
                                      labels={tempHistory.labels}
                                      width={tableChartWidth}
                                      yUnit="°C"
                                      yUnitRight="%"
                                      yLabel="Temp. (°C)"
                                      yLabelRight="Humidité (%)"
                                      xLabel="Heure"
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
});
