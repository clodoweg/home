/**
 * PlugsWidget — Smart plug control widget (PC + TV) with power/energy charts.
 */
import React, { memo, useMemo, useState } from 'react';
import { Activity, Monitor, Plug, Tv, Zap } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget } from './BaseWidget';
import { WidgetHighlight } from './WidgetHighlight';
import { HAState } from '../../services/api';
import { useEnergyBaseline } from '../../hooks/useEnergyBaseline';
import { useUserProfile } from '../../context/UserContext';
import { cn } from '../../lib/utils';
import { PowerButton } from '../../components/ui/PowerButton';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { useHAState } from '../../hooks/useHAState';
import { useHAHistory } from '../../hooks/useHAHistory';
import { useResponsive } from '../../hooks/useResponsive';
import { WidgetChart } from '../ui/LazyCharts';
import type { IconComponent } from '../../types/icon';
import { useElementWidth } from '../../hooks/useElementWidth';

interface PlugConfig {
  id: string;
  name: string;
  icon: IconComponent;
  switchEntity?: HAState;
  powerSensor?: HAState;
  energySensor?: HAState;
}

interface PlugsWidgetProps {
  plugPC?: HAState;
  plugTV?: HAState;
  powerPC?: HAState;
  powerTV?: HAState;
  energyPC?: HAState;
  energyTV?: HAState;
}

/**
 * Smart plugs: switch, power and today's energy.
 *
 * @param props - Plug, power and energy entities.
 * @returns The widget.
 */
export const PlugsWidget = memo(function PlugsWidget({
  plugPC,
  plugTV,
  powerPC,
  powerTV,
  energyPC,
  energyTV,
}: PlugsWidgetProps) {
  const { canAccessHistory } = useUserProfile();
  const { isSmall } = useResponsive();
  const { getEffectiveValue, performAction } = useHAState();
  const [selectedPlugId, setSelectedPlugId] = useState<string | null>(null);
  // The chart is drawn inside the panel padding.
  const [chartContainerRef, chartWidth] = useElementWidth(32);

  const plugs: PlugConfig[] = [
    {
      id: 'pc',
      name: 'Prise PC',
      icon: Monitor,
      switchEntity: plugPC,
      powerSensor: powerPC,
      energySensor: energyPC,
    },
    {
      id: 'tv',
      name: 'Prise TV',
      icon: Tv,
      switchEntity: plugTV,
      powerSensor: powerTV,
      energySensor: energyTV,
    },
  ].filter((p) => p.switchEntity);

  const plug = plugs.find((p) => p.id === selectedPlugId);
  const powerHistory = useHAHistory({
    entityId: plug?.powerSensor?.entity_id,
    hours: 48,
    showHistory: !!selectedPlugId && canAccessHistory,
    currentValue: plug?.powerSensor?.state ? parseFloat(plug.powerSensor.state) : undefined,
  });

  const energyHistory = useHAHistory({
    entityId: plug?.energySensor?.entity_id,
    hours: 48,
    showHistory: !!selectedPlugId && canAccessHistory,
    currentValue: plug?.energySensor?.state ? parseFloat(plug.energySensor.state) : undefined,
  });

  const chartData = useMemo(() => {
    if (!selectedPlugId || !canAccessHistory || powerHistory.loading || energyHistory.loading) {
      return { power: [], energy: [], hours: [] };
    }
    return { power: powerHistory.series, energy: energyHistory.series, hours: powerHistory.labels };
  }, [
    selectedPlugId,
    canAccessHistory,
    powerHistory.series,
    energyHistory.series,
    powerHistory.loading,
    energyHistory.loading,
    powerHistory.labels,
  ]);

  // Today's energy = live counter - counter at midnight (fetched once per plug and per day).
  const energyBaseline = useEnergyBaseline(
    selectedPlugId ? plug?.energySensor?.entity_id : undefined,
    canAccessHistory,
  ).data;
  const currentEnergy = parseFloat(plug?.energySensor?.state ?? '');
  const dailyEnergy =
    energyBaseline != null && !isNaN(currentEnergy)
      ? Math.max(0, currentEnergy - energyBaseline)
      : null;

  const getState = (entity: HAState | undefined) => (entity ? getEffectiveValue(entity) : null);

  const togglePlug = (entity: HAState | undefined) => {
    if (!entity) return;
    const current = getState(entity);
    const action = current === 'on' ? 'turn_off' : 'turn_on';
    const optimisticValue = action === 'turn_on' ? 'on' : 'off';
    performAction(entity, 'switch', action, {}, optimisticValue);
  };

  const handlePlugSelect = (plugId: string) => {
    if (!canAccessHistory) return;
    setSelectedPlugId(selectedPlugId === plugId ? null : plugId);
  };

  const activeCount = plugs.filter((p) => getState(p.switchEntity) === 'on').length;

  const itemsPerRow = isSmall ? 1 : 2;
  const rows: PlugConfig[][] = [];
  for (let i = 0; i < plugs.length; i += itemsPerRow) {
    rows.push(plugs.slice(i, i + itemsPerRow));
  }

  return (
    <BaseWidget
      id="plugs"
      title={WIDGET_CONFIG.plugs.title}
      subtitle={[
        <span key="1">
          <WidgetHighlight colorClass="text-info">{activeCount}</WidgetHighlight> prise
          {activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
        </span>,
      ]}
      icon={WIDGET_CONFIG.plugs.icon}
    >
      <div className="flex flex-col gap-y-3">
        {rows.map((rowPlugs) => {
          const isExpandedInRow = rowPlugs.find((p) => p.id === selectedPlugId);
          return (
            <div key={rowPlugs.map((p) => p.id).join('+')}>
              <div className="flex flex-row gap-3">
                {rowPlugs.map((p) => {
                  const Icon = p.icon;
                  const isOn = getState(p.switchEntity) === 'on';
                  const isSelected = selectedPlugId === p.id;
                  const power = p.powerSensor ? parseFloat(p.powerSensor.state) : null;

                  return (
                    // The card is a mouse target only: a button around it would swallow the
                    // plug's switch. Keyboard and screen readers expand it through the name
                    // button below, whose click bubbles up to the card.
                    <div
                      key={p.id}
                      data-testid={`plug-card-${p.id}`}
                      onClick={() => handlePlugSelect(p.id)}
                      className={cn(
                        'cursor-pointer',
                        'flex-1 basis-0 rounded-2xl border p-4 text-left transition-all',
                        isSelected ? 'border-primary bg-muted' : 'border-transparent bg-muted',
                      )}
                    >
                      <div className="mb-2 flex flex-row items-center justify-between">
                        <span className={isSelected ? 'opacity-100' : 'opacity-70'}>
                          <Icon
                            size={24}
                            className={isOn ? 'text-success' : 'text-muted-foreground'}
                          />
                        </span>
                        <PowerButton
                          isOn={isOn}
                          aria-label={`${isOn ? 'Éteindre' : 'Allumer'} ${p.name}`}
                          data-testid={`plug-toggle-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlug(p.switchEntity);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        aria-expanded={isSelected}
                        className="block w-full cursor-pointer text-left"
                      >
                        <span className="mb-0.5 block text-sm font-medium text-foreground">
                          {p.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {isOn
                            ? power !== null && !isNaN(power)
                              ? `${power.toFixed(1)} W`
                              : 'Allumé'
                            : 'Éteint'}
                        </span>
                      </button>
                    </div>
                  );
                })}
                {itemsPerRow === 2 && rowPlugs.length === 1 && (
                  <div className="flex-1 border border-transparent p-4" />
                )}
              </div>

              {isExpandedInRow &&
                canAccessHistory &&
                (() => {
                  if (!plug) return null;
                  const power = plug.powerSensor ? parseFloat(plug.powerSensor.state) : null;
                  const energyTotal = plug.energySensor
                    ? parseFloat(plug.energySensor.state)
                    : null;

                  return (
                    <div ref={chartContainerRef} className="mt-3 rounded-xl bg-muted p-4">
                      <div className="mb-4 flex flex-row gap-4">
                        <div className="flex flex-1 flex-col items-center">
                          <div className="flex flex-row items-center gap-1">
                            <Zap size={16} className="text-success" />
                            <span className="text-[10px] text-muted-foreground">PUISSANCE</span>
                          </div>
                          <div className="flex flex-row items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">
                              {power !== null && !isNaN(power) ? power.toFixed(1) : '-'}
                            </span>
                            <span className="text-lg font-medium text-muted-foreground">W</span>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col items-center">
                          <div className="flex flex-row items-center gap-1">
                            <Activity size={16} className="text-info" />
                            <span className="text-[10px] text-muted-foreground">CONSO JOUR</span>
                          </div>
                          <div className="flex flex-row items-baseline gap-1">
                            <span className="text-3xl font-bold text-info">
                              {dailyEnergy !== null ? dailyEnergy.toFixed(2) : '-'}
                            </span>
                            <span className="text-lg font-medium text-muted-foreground">kWh</span>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col items-center">
                          <div className="flex flex-row items-center gap-1">
                            <Plug size={16} className="text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">TOTAL</span>
                          </div>
                          <div className="flex flex-row items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">
                              {energyTotal !== null && !isNaN(energyTotal)
                                ? energyTotal.toFixed(1)
                                : '-'}
                            </span>
                            <span className="text-lg font-medium text-muted-foreground">kWh</span>
                          </div>
                        </div>
                      </div>

                      {powerHistory.loading || energyHistory.loading ? (
                        <Skeleton className="h-32 w-full rounded-md" />
                      ) : chartData.power.length > 0 && chartWidth > 0 ? (
                        <WidgetChart
                          series={[
                            {
                              data: chartData.power,
                              color: 'hsl(var(--success))',
                              label: 'Puissance',
                              unit: 'W',
                              gradientFill: true,
                            },
                          ]}
                          labels={chartData.hours}
                          width={chartWidth}
                          yUnit="W"
                          yLabel="Puissance (W)"
                          xLabel="Heure"
                          decimals={0}
                          xTickInterval={4}
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center">
                          <span className="text-sm text-muted-foreground">Aucune donnée</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </BaseWidget>
  );
});
