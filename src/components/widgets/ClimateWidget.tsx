/**
 * ClimateWidget — Controls for Home Assistant climate entities (AC units, heat pumps).
 * Each climate entity gets its own card with power toggle, HVAC mode buttons,
 * temperature slider, and optional 24h history chart.
 */
import React, { memo, useState } from 'react';
import { Power, Snowflake, Flame, RefreshCcw, Droplets, Fan, ThermometerSun } from 'lucide-react';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState } from '../../services/api';
import { cn } from '../../lib/utils';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { WidgetChart } from '../ui/LazyCharts';
import { useHAState } from '../../hooks/useHAState';
import { useHAHistory } from '../../hooks/useHAHistory';
import { Panel } from '../ui/Panel';
import { Slider } from '../ui/Slider';
import { Skeleton } from '../ui/Skeleton';
import { useUserProfile } from '../../context/UserContext';
import { useElementWidth } from '../../hooks/useElementWidth';
import { useHeldValue } from '../../hooks/useHeldValue';
import { toggleProps } from '../../lib/a11y';

interface ClimateWidgetProps {
  entities: HAState[];
  metadata?: Record<string, { area: string; floor?: string; model: string }>;
  showHistory?: boolean;
}

/**
 * Maps an HVAC mode string to its icon and French label.
 *
 * Available modes: off, heat, cool, heat_cool, auto, dry, fan_only
 */
const HVAC_MODE_META: Record<
  string,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    activeColor: string;
  }
> = {
  heat: {
    icon: Flame,
    label: 'Chauffage',
    activeColor: 'border-transparent bg-coral text-ink',
  },
  cool: {
    icon: Snowflake,
    label: 'Froid',
    activeColor: 'border-transparent bg-cobalt text-white',
  },
  heat_cool: {
    icon: RefreshCcw,
    label: 'Auto',
    activeColor: 'border-transparent bg-lime text-ink',
  },
  auto: {
    icon: RefreshCcw,
    label: 'Auto',
    activeColor: 'border-transparent bg-lime text-ink',
  },
  dry: {
    icon: Droplets,
    label: 'Sec',
    activeColor: 'border-transparent bg-sun text-ink',
  },
  fan_only: {
    icon: Fan,
    label: 'Ventilation',
    activeColor: 'border-transparent bg-lilac text-ink',
  },
};

const CHART_COLOR = 'hsl(var(--info))';

/**
 * Checks whether a climate entity is active/on (heating, cooling, fan, etc.).
 * Returns false for 'off', 'unavailable', 'unknown', or undefined.
 *
 * @param {HAState | undefined} entity Home Assistant state object
 * @returns {boolean} True if active, false otherwise
 */
function isClimateOn(entity: HAState | undefined): boolean {
  if (!entity || !entity.state) return false;
  const state = entity.state.toLowerCase();
  return ['cool', 'heat', 'heat_cool', 'auto', 'dry', 'fan_only', 'on'].includes(state);
}

/**
 * Card for a single climate entity — power, mode, temperature slider, history.
 */
const ClimateCard = memo(function ClimateCard({
  entity,
  areaName,
  showHistory,
}: {
  entity: HAState;
  areaName: string;
  showHistory: boolean;
}) {
  const { canAccessHistory } = useUserProfile();
  const { getEffectiveValue, performAction } = useHAState();

  const [heldTargetTemp, holdTargetTemp] = useHeldValue<number>(3000);
  const [showChart, setShowChart] = useState(false);
  const [chartContainerRef, chartWidth] = useElementWidth();

  const effectiveState = getEffectiveValue(entity) || entity.state;
  const isUnavailable = effectiveState === 'unavailable' || effectiveState === 'unknown';
  const isOn = isClimateOn({ ...entity, state: effectiveState });
  const currentTemp = entity.attributes.current_temperature ?? null;

  // Extract target setpoint temperature from HA with fallbacks for different integrations
  const targetTempFromHA =
    getEffectiveValue(entity, 'temperature') ??
    getEffectiveValue(entity, 'target_temperature') ??
    entity.attributes.temperature ??
    entity.attributes.target_temperature ??
    entity.attributes.target_temp_low ??
    20;
  const effectiveTargetTemp = heldTargetTemp ?? Number(targetTempFromHA);

  const minTemp = entity.attributes.min_temp ?? 16;
  const maxTemp = entity.attributes.max_temp ?? 30;
  const tempStep = entity.attributes.target_temp_step ?? 0.5;
  const availableModes: string[] = (entity.attributes.hvac_modes ?? []).filter(
    (m: string) => m !== 'off',
  );

  const hvacAction = entity.attributes.hvac_action;

  const {
    series,
    labels,
    loading: historyLoading,
  } = useHAHistory({
    entityId: entity.entity_id,
    showHistory: showChart && showHistory,
    attribute: 'current_temperature',
    currentValue: currentTemp ?? undefined,
  });

  const handlePowerToggle = () => {
    if (isOn) {
      performAction(entity, 'climate', 'set_hvac_mode', { hvac_mode: 'off' }, 'off');
    } else {
      const resumeMode = availableModes[0] || 'cool';
      performAction(entity, 'climate', 'set_hvac_mode', { hvac_mode: resumeMode }, resumeMode);
    }
  };

  const handleSetMode = (mode: string) => {
    performAction(entity, 'climate', 'set_hvac_mode', { hvac_mode: mode }, mode);
  };

  const handleSetTemperature = (val: number | number[]) => {
    const targetVal = Array.isArray(val) ? val[0] : val;
    holdTargetTemp(targetVal);

    performAction(entity, 'climate', 'set_temperature', { temperature: targetVal }, entity.state);
  };

  const getActionLabel = (): string | null => {
    if (!isOn || !hvacAction) return null;
    switch (hvacAction) {
      case 'heating':
        return 'Chauffe';
      case 'cooling':
        return 'Refroidit';
      case 'drying':
        return 'Déshumidifie';
      case 'fan':
        return 'Ventile';
      case 'idle':
        return 'En attente';
      default:
        return null;
    }
  };

  const actionLabel = getActionLabel();

  return (
    <Panel
      className="overflow-hidden bg-secondary p-4"
      data-testid={`climate-card-${entity.entity_id}`}
    >
      <div
        className={cn('flex items-center justify-between', canAccessHistory && 'cursor-pointer')}
        {...(canAccessHistory
          ? { role: 'button', ...toggleProps(showChart, () => setShowChart((prev) => !prev)) }
          : {})}
      >
        <div className="flex items-center gap-2">
          <ThermometerSun size={16} className="text-muted-foreground/75" />
          <span className="text-sm font-semibold text-foreground">{areaName}</span>
          {isUnavailable ? (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
              Débranché / Hors ligne
            </span>
          ) : (
            actionLabel && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {actionLabel}
              </span>
            )
          )}
        </div>
        <div className="flex flex-row items-baseline gap-3">
          {currentTemp !== null && (
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-medium text-muted-foreground">Ambiante</span>
              <span className="text-xl font-bold tracking-tight text-foreground">
                {Number(currentTemp).toFixed(1)}°C
              </span>
            </div>
          )}
          {isOn && (
            <div className="flex items-baseline gap-1 text-xs">
              <span className="text-muted-foreground">Consigne</span>
              <span className="font-bold text-info">{effectiveTargetTemp.toFixed(1)}°C</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={`climate-power-${entity.entity_id}`}
            onClick={handlePowerToggle}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
              isOn
                ? 'border-transparent bg-lime text-ink'
                : 'border-transparent bg-secondary text-muted-foreground',
            )}
          >
            <Power size={14} />
            {isOn ? 'ON' : 'OFF'}
          </button>

          {availableModes.map((mode) => {
            const meta = HVAC_MODE_META[mode] || {
              icon: RefreshCcw,
              label: mode,
              activeColor: 'border-transparent bg-primary text-primary-foreground',
            };
            const IconComp = meta.icon;
            const isModeActive =
              isOn && (entity.state === mode || getEffectiveValue(entity) === mode);

            return (
              <button
                key={mode}
                type="button"
                data-testid={`climate-mode-${mode}-${entity.entity_id}`}
                onClick={() => handleSetMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                  isModeActive
                    ? meta.activeColor
                    : 'border-transparent bg-secondary text-muted-foreground hover:border-border hover:bg-secondary',
                )}
              >
                <IconComp size={14} />
                {meta.label}
              </button>
            );
          })}
        </div>

        {isOn && (
          <div className="flex flex-col gap-2 rounded-xl bg-secondary p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Consigne</span>
              <span className="font-bold text-foreground">{effectiveTargetTemp.toFixed(1)}°C</span>
            </div>
            <Slider
              value={effectiveTargetTemp}
              onValueChange={handleSetTemperature}
              min={minTemp}
              max={maxTemp}
              step={tempStep}
              testID={`climate-temp-slider-${entity.entity_id}`}
            />
          </div>
        )}

        {showChart && showHistory && (
          <div ref={chartContainerRef} className="pt-2">
            {historyLoading ? (
              <Skeleton className="h-36 w-full rounded-xl" />
            ) : (
              <WidgetChart
                series={[
                  {
                    data: series,
                    color: CHART_COLOR,
                    label: 'Température',
                    unit: '°C',
                    gradientFill: true,
                  },
                ]}
                labels={labels}
                width={chartWidth}
                height={140}
                yUnit="°C"
              />
            )}
          </div>
        )}
      </div>
    </Panel>
  );
});

/**
 * ClimateWidget — Main widget displaying climate cards for Home Assistant entities.
 *
 * @param {ClimateWidgetProps} props - Component properties including entities, metadata, and history flags.
 * @returns {React.ReactElement | null} The rendered widget or null if no climate entities exist.
 */
export const ClimateWidget = memo(function ClimateWidget({
  entities,
  metadata = {},
  showHistory = true,
}: ClimateWidgetProps) {
  const climateEntities = entities.filter(
    (e) => e.entity_id.startsWith('climate.') && !e.entity_id.includes('spa'),
  );

  if (climateEntities.length === 0) return null;

  const activeCount = climateEntities.filter(isClimateOn).length;
  const isAnyOn = activeCount > 0;

  const subtitle = [
    <span key="status">
      <WidgetHighlight colorClass={isAnyOn ? 'text-info' : 'text-muted-foreground'}>
        {activeCount}
      </WidgetHighlight>{' '}
      climatisation{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
    </span>,
  ];

  return (
    <BaseWidget
      id="climate"
      testID="widget-climate"
      title={WIDGET_CONFIG.climate.title}
      subtitle={subtitle}
      icon={WIDGET_CONFIG.climate.icon}
      muted={!isAnyOn}
    >
      <div className="flex flex-col gap-y-3">
        {climateEntities.map((entity) => {
          const area =
            metadata[entity.entity_id]?.area || entity.attributes.friendly_name || entity.entity_id;
          return (
            <ClimateCard
              key={entity.entity_id}
              entity={entity}
              areaName={area}
              showHistory={showHistory}
            />
          );
        })}
      </div>
    </BaseWidget>
  );
});
