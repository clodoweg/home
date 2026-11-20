/**
 * SpaWidget — Climate, power, heat, filter, bubbles controls with 24h temperature history.
 */
import React, { memo } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState } from '../../services/api';
import { cn } from '../../lib/utils';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { WidgetChart } from '../ui/LazyCharts';
import { useHAState } from '../../hooks/useHAState';
import { useHAHistory } from '../../hooks/useHAHistory';
import { SpaTemperature } from './spa/SpaTemperature';
import { SpaControls } from './spa/SpaControls';
import { useElementWidth } from '../../hooks/useElementWidth';
import { useHeldValue } from '../../hooks/useHeldValue';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';

interface SpaWidgetProps {
  climate?: HAState;
  power?: HAState;
  filter?: HAState;
  bubbles?: HAState;
  error?: HAState;
  connected?: HAState;
  showHistory?: boolean;
}

const ORANGE = 'hsl(var(--warning))';

/**
 * Spa temperature, controls and temperature history.
 *
 * @param props - Spa entities and history right.
 * @returns The widget.
 */
export const SpaWidget = memo(function SpaWidget({
  climate,
  power,
  filter,
  bubbles,
  error,
  connected,
  showHistory = true,
}: SpaWidgetProps) {
  const { getEffectiveValue, performAction } = useHAState();
  const [chartContainerRef, chartWidth] = useElementWidth();
  // The spa heater reports its new setpoint slowly: the chosen value is held longer than for a climate.
  const [heldTargetTemp, holdTargetTemp] = useHeldValue<number>(15000);

  const isConnected = getEffectiveValue(connected) === 'on';
  const hasError = getEffectiveValue(error) === 'on';
  const isPowerOn = getEffectiveValue(power) === 'on';
  const isHeatOn = getEffectiveValue(climate) === 'heat';
  const isFilterOn = getEffectiveValue(filter) === 'on';
  const bubblesState = getEffectiveValue(bubbles) || 'off';
  const currentTemp = climate?.attributes.current_temperature || 0;

  const targetTempFromHA = Number(getEffectiveValue(climate, 'temperature')) || 20;
  const effectiveTargetTemp = heldTargetTemp ?? targetTempFromHA;

  // The chart only shows in the widget body: no history while it is collapsed.
  const expanded = !useWidgetPreferences().isCollapsed('spa');
  const { series, labels } = useHAHistory({
    entityId: climate?.entity_id,
    showHistory: showHistory && expanded,
    attribute: 'current_temperature',
    currentValue: currentTemp,
  });

  // The connectivity sensor can stay off while the spa keeps reporting (seen after a power cycle):
  // only an unusable thermostat hides the widget, a reported disconnection is merely a warning.
  const isThermostatUnusable =
    !climate || climate.state === 'unavailable' || climate.state === 'unknown';
  const isConnectionReportedDown = !!connected && !isConnected;

  if (isThermostatUnusable) {
    return (
      <BaseWidget id="spa" title={WIDGET_CONFIG.spa.title} icon={WIDGET_CONFIG.spa.icon} muted>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <WifiOff size={32} className="text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Spa non disponible</p>
          <p className="mt-1 text-xs text-muted-foreground">
            En attente des données Home Assistant (intégration Bestway inactive ?)
          </p>
        </div>
      </BaseWidget>
    );
  }

  const toggleBubbles = () => {
    if (!bubbles) return;
    const options = (bubbles.attributes.options as string[]) || ['OFF', 'MEDIUM', 'MAX'];
    const currentIndex = options.indexOf(bubblesState as string);
    const nextIndex = (currentIndex + 1) % options.length;
    const target = options[nextIndex];
    performAction(bubbles, 'select', 'select_option', { option: target }, target);
  };

  return (
    <BaseWidget
      id="spa"
      title={WIDGET_CONFIG.spa.title}
      subtitle={[
        <span key="1">
          Température{' '}
          <WidgetHighlight colorClass={currentTemp < 36 ? 'text-destructive' : 'text-success'}>
            {currentTemp}°
          </WidgetHighlight>
        </span>,
        hasError ? (
          <WidgetHighlight key="2" colorClass="text-destructive">
            Erreur
          </WidgetHighlight>
        ) : null,
        isConnectionReportedDown ? (
          <WidgetHighlight key="3" colorClass="text-warning">
            Connexion coupée
          </WidgetHighlight>
        ) : null,
      ].filter(Boolean)}
      icon={WIDGET_CONFIG.spa.icon}
      tone={hasError ? 'coral' : undefined}
    >
      <div className="flex flex-col gap-y-6 px-2 py-4">
        {hasError && (
          <div className="flex flex-row items-center gap-2 rounded-lg bg-destructive/15 p-3">
            <AlertTriangle size={20} className="text-destructive" />
            <span className="text-sm font-medium text-destructive">
              Anomalie détectée sur le système
            </span>
          </div>
        )}

        {isConnectionReportedDown && (
          <div className="flex flex-row items-center gap-2 rounded-lg border border-transparent bg-sun p-3 text-ink">
            <WifiOff size={20} className="shrink-0 text-warning" />
            <span className="text-sm font-medium text-warning">
              Connexion signalée coupée : les valeurs peuvent dater et les commandes ne pas aboutir
            </span>
          </div>
        )}

        <SpaTemperature
          current={currentTemp}
          target={effectiveTargetTemp}
          isPowerOn={isPowerOn}
          hasError={hasError}
          onSetTemperature={(val) => {
            holdTargetTemp(val);

            if (climate) {
              performAction(
                climate,
                'climate',
                'set_temperature',
                { temperature: val },
                climate.state,
              );
            }
          }}
        />

        <SpaControls
          isPowerOn={isPowerOn}
          isHeatOn={isHeatOn}
          isFilterOn={isFilterOn}
          bubblesState={bubblesState}
          onTogglePower={() =>
            performAction(
              power,
              'switch',
              isPowerOn ? 'turn_off' : 'turn_on',
              {},
              isPowerOn ? 'off' : 'on',
            )
          }
          onToggleHeat={() => {
            const nextMode = isHeatOn ? 'off' : 'heat';
            performAction(climate, 'climate', 'set_hvac_mode', { hvac_mode: nextMode }, nextMode);
          }}
          onToggleFilter={() => {
            const nextState = isFilterOn ? 'off' : 'on';
            performAction(filter, 'switch', isFilterOn ? 'turn_off' : 'turn_on', {}, nextState);
            if (nextState === 'on' && climate) {
              performAction(climate, 'climate', 'set_hvac_mode', { hvac_mode: 'heat' });
            }
          }}
          onToggleBubbles={() => {
            if (bubbles) toggleBubbles();
          }}
        />

        {showHistory && (
          <div ref={chartContainerRef} className="mt-3">
            {series.length > 0 && chartWidth > 0 && (
              <>
                <p className={cn('mb-2 text-xs font-medium text-muted-foreground')}>
                  Historique 24h
                </p>
                <WidgetChart
                  series={[{ data: series, color: ORANGE, label: 'Température', unit: '°C' }]}
                  labels={labels}
                  width={chartWidth}
                  yUnit="°C"
                  yLabel="Temp. (°C)"
                  xLabel="Heure"
                />
              </>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
});
