/**
 * WashingMachineWidget — Monitoring and stats for the smart washing machine.
 * Displays current state, program info, remaining time, detergent level,
 * door locking status, and real-time utilities consumption (water & electricity).
 */
import React, { memo, useState } from 'react';
import {
  WashingMachine,
  Lock,
  Unlock,
  Timer,
  Droplet,
  Zap,
  Info,
  ShieldAlert,
  Moon,
  Wind,
  Smartphone,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
} from 'lucide-react';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState } from '../../services/api';
import { cn } from '../../lib/utils';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { Panel } from '../ui/Panel';

import { useHAState } from '../../hooks/useHAState';
import { formatMinutes } from '../../lib/format';
import { washingMachineEntity } from '../../constants/entities';
import {
  formatDryLevel,
  formatMode,
  formatProgramName,
  formatProgramPhase,
  formatWaterHardness,
} from './washing-machine/labels';

interface WashingMachineWidgetProps {
  data: HAState[];
}

/**
 * Washing machine cycle, settings and counters.
 *
 * @param props - Washing machine entities.
 * @returns The widget.
 */
export const WashingMachineWidget = memo(function WashingMachineWidget({
  data,
}: WashingMachineWidgetProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { performAction } = useHAState();

  // Find all washing machine entities
  const getEntity = (domain: string, key: string) =>
    data.find((e) => e.entity_id === washingMachineEntity(domain, key));

  const statusEntity = getEntity('binary_sensor', 'status');
  const doorStatusEntity = getEntity('binary_sensor', 'door_status');
  const doorLockEntity = getEntity('binary_sensor', 'door_lock');
  const childLockEntity = getEntity('binary_sensor', 'child_lock');
  const pausedEntity = getEntity('binary_sensor', 'paused');
  const remoteControlEntity = getEntity('binary_sensor', 'remote_control');
  const nightWashEntity = getEntity('binary_sensor', 'night_wash');
  const steamEntity = getEntity('binary_sensor', 'steam');

  const modeEntity = getEntity('sensor', 'mode');
  const programNameEntity = getEntity('sensor', 'program_name');
  const temperatureEntity = getEntity('sensor', 'temperature');
  const remainingTimeEntity = getEntity('sensor', 'remaining_time');
  const detergentEntity = getEntity('sensor', 'detergent_level');
  const spinSpeedEntity = getEntity('sensor', 'spin_speed');
  const currentWaterEntity = getEntity('sensor', 'current_water_used');
  const currentElectricEntity = getEntity('sensor', 'current_electricity_used');
  const errorEntity = getEntity('sensor', 'error');
  const endTimeEntity = getEntity('sensor', 'end_time');

  // Additional stats and settings
  const rinseIterationsEntity = getEntity('sensor', 'remaining_rinse_iterations');
  const dryLevelEntity = getEntity('sensor', 'dry_level');
  const waterHardnessEntity = getEntity('sensor', 'water_hardness');
  const programPhaseEntity = getEntity('sensor', 'program_phase');
  const delayTimeEntity = getEntity('sensor', 'delay_time');
  const totalWashCyclesEntity = getEntity('sensor', 'total_wash_cycle');
  const totalWaterEntity = getEntity('sensor', 'total_water_used');
  const totalElectricEntity = getEntity('sensor', 'total_electricity_used');

  const currentModeRaw = modeEntity?.state || 'Off';
  const modeLower = currentModeRaw.toLowerCase();

  const isFinished = ['finish', 'finished', 'end', 'completed', 'done'].includes(modeLower);
  const isOff =
    statusEntity?.state === 'off' || ['off', 'none', 'standby', 'idle', 'stop'].includes(modeLower);

  // Interpret state
  const isRunning =
    !isOff &&
    !isFinished &&
    (modeLower === 'run' || modeLower === 'running' || statusEntity?.state === 'on');
  const isPaused =
    !isOff &&
    !isFinished &&
    (modeLower === 'pause' ||
      modeLower === 'paused' ||
      (pausedEntity?.state === 'on' && statusEntity?.state !== 'off'));
  const isDoorOpen = doorStatusEntity?.state === 'on';
  const isDoorLocked = doorLockEntity?.state === 'on';
  const isChildLockActive = childLockEntity?.state === 'on';
  const isRemoteActive = remoteControlEntity?.state === 'on';
  const isNightWashActive = nightWashEntity?.state === 'on';
  const isSteamActive = steamEntity?.state === 'on';

  const formattedMode = formatMode(currentModeRaw);
  const rawProgramName = programNameEntity?.state || null;
  const programName = formatProgramName(rawProgramName);
  const rawTemp = temperatureEntity?.state || null;
  const tempVal =
    rawTemp && rawTemp !== '0' ? (rawTemp.includes('°') ? rawTemp : `${rawTemp}°C`) : null;
  const rawSpin = spinSpeedEntity?.state || null;
  const spinSpeed =
    rawSpin &&
    rawSpin !== '0' &&
    rawSpin.toLowerCase() !== 'no_spin' &&
    rawSpin.toLowerCase() !== 'off'
      ? `${rawSpin.replace(/rpm|tr\/min/i, '').trim()} tr/min`
      : rawSpin === '0' || rawSpin?.toLowerCase() === 'no_spin'
        ? 'Sans essorage'
        : null;

  const remainingMin = remainingTimeEntity?.state ? parseInt(remainingTimeEntity.state, 10) : 0;
  const detergentLevel = detergentEntity?.state ? parseInt(detergentEntity.state, 10) : null;
  const errorVal = errorEntity?.state && errorEntity.state !== '00' ? errorEntity.state : null;

  const currentWater = currentWaterEntity?.state ? parseFloat(currentWaterEntity.state) : 0;
  const currentElectric = currentElectricEntity?.state
    ? parseFloat(currentElectricEntity.state)
    : 0;

  // Format status message
  let statusText = 'Arrêt';
  let statusColor = 'text-muted-foreground';
  if (isFinished) {
    statusText = 'Terminé';
    statusColor = 'text-success';
  } else if (isRunning) {
    statusText = 'En cours';
    statusColor = 'text-primary';
  } else if (isPaused) {
    statusText = 'En pause';
    statusColor = 'text-warning';
  }

  // Parse estimated end time
  let endFormatted = '';
  if (endTimeEntity?.state && isRunning) {
    try {
      const endDate = new Date(endTimeEntity.state);
      if (!isNaN(endDate.getTime())) {
        endFormatted = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // Fallback if date parsing fails
    }
  }

  // Tambour spinner icon animation when running
  const iconClass = cn(
    'transition-all duration-300',
    isRunning && !isPaused && 'animate-[spin_10s_linear_infinite]',
  );

  return (
    <BaseWidget
      id="washing_machine"
      testID="widget-washing-machine"
      title={WIDGET_CONFIG.washing_machine.title}
      subtitle={[
        <span key="status">
          Statut <WidgetHighlight colorClass={statusColor}>{statusText}</WidgetHighlight>
        </span>,
        (isRunning || isPaused) && remainingMin > 0 && (
          <span key="remaining" className="text-muted-foreground">
            {formatMinutes(remainingMin)} restantes
          </span>
        ),
        programName && (
          <span key="prog" className="text-muted-foreground">
            {programName}
          </span>
        ),
      ].filter(Boolean)}
      icon={WIDGET_CONFIG.washing_machine.icon}
      muted={!isRunning || isPaused}
    >
      <div className="flex flex-col gap-y-4 py-2">
        {/* Error notification */}
        {errorVal && (
          <div className="flex flex-row items-center gap-2 rounded-lg bg-destructive/15 p-3 text-destructive">
            <ShieldAlert size={18} />
            <span className="text-xs font-semibold">Anomalie détectée (Code {errorVal})</span>
          </div>
        )}

        {/* Running Progress Panel */}
        {(isRunning || isPaused) && (
          <Panel className="bg-muted p-4">
            <div className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer size={16} className="animate-pulse text-primary" />
                <span className="text-xs font-semibold text-foreground">Cycle en cours</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-foreground">{remainingMin}</span>
                <span className="text-xs text-muted-foreground"> min restantes</span>
              </div>
            </div>

            {/* Simulated progress bar since smart washers don't always provide absolute percentage */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full rounded-full bg-primary transition-all duration-1000',
                  isPaused ? 'animate-pulse bg-warning' : 'animate-[pulse_2s_infinite]',
                )}
                style={{
                  width:
                    remainingMin > 0 ? `${Math.max(10, Math.min(95, 100 - remainingMin))}%` : '0%',
                }}
              />
            </div>

            {endFormatted && (
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Fin estimée</span>
                <span className="font-medium text-foreground">{endFormatted}</span>
              </div>
            )}
          </Panel>
        )}

        {/* Main stats layout */}
        <div className="grid grid-cols-2 gap-3">
          {/* Program Config */}
          <Panel className="flex flex-col justify-between bg-muted p-3.5">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Programme
            </span>
            <div className="mt-2 flex flex-col gap-1">
              <span className="truncate text-sm font-bold text-foreground">
                {programName || 'Aucun'}
              </span>
              <span className="text-xs text-muted-foreground">
                {[tempVal, spinSpeed].filter(Boolean).join(' / ')}
              </span>
            </div>
          </Panel>

          {/* Detergent Level */}
          <Panel className="flex flex-col justify-between bg-muted p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Détergent
              </span>
              {detergentLevel !== null && detergentLevel < 15 && (
                <span className="animate-pulse rounded-full bg-destructive/15 px-1.5 py-0.5 text-[8px] font-semibold text-destructive">
                  Bas
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-foreground">
                  {detergentLevel !== null ? detergentLevel : '—'}
                </span>
                {detergentLevel !== null && (
                  <span className="text-xs text-muted-foreground">%</span>
                )}
              </div>
              {detergentLevel !== null && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      detergentLevel < 15 ? 'bg-destructive' : 'bg-success',
                    )}
                    style={{ width: `${detergentLevel}%` }}
                  />
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Grid of indicators */}
        <div className="grid grid-cols-3 gap-2">
          {/* Door Status */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-muted p-3 text-center transition-all hover:bg-secondary">
            {isDoorOpen ? (
              <Unlock size={18} className="text-warning" />
            ) : isDoorLocked ? (
              <Lock size={18} className="text-success" />
            ) : (
              <Unlock size={18} className="text-muted-foreground" />
            )}
            <span className="mt-1.5 text-[10px] font-medium text-muted-foreground">Hublot</span>
            <span className="mt-0.5 text-[10px] font-semibold text-foreground">
              {isDoorOpen ? 'Ouvert' : isDoorLocked ? 'Verrouillé' : 'Fermé'}
            </span>
          </div>

          {/* Child Lock */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-muted p-3 text-center transition-all hover:bg-secondary">
            <ShieldAlert
              size={18}
              className={
                isChildLockActive ? 'animate-pulse text-primary' : 'text-muted-foreground/60'
              }
            />
            <span className="mt-1.5 text-[10px] font-medium text-muted-foreground">
              Sécu. Enfant
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-foreground">
              {isChildLockActive ? 'Activée' : 'Désactivée'}
            </span>
          </div>

          {/* Mode */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-muted p-3 text-center transition-all hover:bg-secondary">
            <WashingMachine size={18} className={iconClass} />
            <span className="mt-1.5 text-[10px] font-medium text-muted-foreground">Tambour</span>
            <span className="mt-0.5 text-[10px] font-semibold text-foreground capitalize">
              {formattedMode}
            </span>
          </div>
        </div>

        {/* Real-time consumption */}
        {(currentWater > 0 || currentElectric > 0 || isRunning) && (
          <div className="flex flex-row justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Droplet size={12} className="text-info" />
              <span>Eau cycle:</span>
              <span className="font-semibold text-foreground">{currentWater.toFixed(1)} L</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-warning" />
              <span>Élec cycle:</span>
              <span className="font-semibold text-foreground">
                {currentElectric.toFixed(2)} kWh
              </span>
            </div>
          </div>
        )}

        {/* Expandable Section Toggle */}
        <button
          type="button"
          data-testid="wash-details-toggle"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((prev) => !prev)}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-muted py-1.5 text-center text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          {showDetails ? (
            <>
              Masquer les détails <ChevronUp size={14} />
            </>
          ) : (
            <>
              Détails & Statistiques <ChevronDown size={14} />
            </>
          )}
        </button>

        {/* Collapsible details content */}
        {showDetails && (
          <div className="flex animate-[fadeIn_0.2s_ease-out] flex-col gap-3 border-t border-border pt-3">
            {/* Options Badges */}
            <div className="flex flex-wrap gap-1.5">
              {isRemoteActive && (
                <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                  <Smartphone size={10} /> À distance
                </span>
              )}
              {isSteamActive && (
                <span className="flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-[9px] font-medium text-info">
                  <Wind size={10} /> Vapeur active
                </span>
              )}
              {isNightWashActive && (
                <span className="flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-[9px] font-medium text-info">
                  <Moon size={10} /> Lavage nuit
                </span>
              )}
            </div>

            {/* Action Buttons to fetch details */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="wash-btn-programs"
                onClick={() => {
                  const btn = getEntity('button', 'get_programs_details');
                  if (btn) performAction(btn, 'button', 'press');
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-muted py-2 text-[10px] font-semibold text-foreground transition-all hover:bg-secondary active:scale-95"
              >
                <RefreshCcw size={12} className="text-primary" /> Actualiser cycles
              </button>
              <button
                type="button"
                data-testid="wash-btn-settings"
                onClick={() => {
                  const btn = getEntity('button', 'get_settings_details');
                  if (btn) performAction(btn, 'button', 'press');
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-muted py-2 text-[10px] font-semibold text-foreground transition-all hover:bg-secondary active:scale-95"
              >
                <RefreshCcw size={12} className="text-success" /> Actualiser réglages
              </button>
            </div>

            {/* Program Details */}
            <Panel className="flex flex-col gap-2 bg-muted p-3">
              <span className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                <Sliders size={10} /> Réglages & Phase
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {rinseIterationsEntity?.state && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rinçages restants:</span>
                    <span className="font-semibold text-foreground">
                      {rinseIterationsEntity.state}
                    </span>
                  </div>
                )}
                {dryLevelEntity?.state &&
                  dryLevelEntity.state !== '0' &&
                  formatDryLevel(dryLevelEntity.state) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Niveau séchage:</span>
                      <span className="font-semibold text-foreground">
                        {formatDryLevel(dryLevelEntity.state)}
                      </span>
                    </div>
                  )}
                {waterHardnessEntity?.state && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dureté de l'eau:</span>
                    <span className="font-semibold text-foreground">
                      {formatWaterHardness(waterHardnessEntity.state)}
                    </span>
                  </div>
                )}
                {programPhaseEntity?.state &&
                  programPhaseEntity.state !== '0' &&
                  formatProgramPhase(programPhaseEntity.state) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phase programme:</span>
                      <span className="font-semibold text-foreground">
                        {formatProgramPhase(programPhaseEntity.state)}
                      </span>
                    </div>
                  )}
                {delayTimeEntity?.state && delayTimeEntity.state !== '0' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Départ différé:</span>
                    <span className="font-semibold text-foreground">
                      {delayTimeEntity.state} min
                    </span>
                  </div>
                )}
              </div>
            </Panel>

            {/* Lifetime Stats */}
            <Panel className="flex flex-col gap-2 bg-muted p-3">
              <span className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                <Info size={10} /> Statistiques historiques
              </span>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {totalWashCyclesEntity?.state && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total cycles effectués:</span>
                    <span className="font-semibold text-foreground">
                      {totalWashCyclesEntity.state}
                    </span>
                  </div>
                )}
                {totalWaterEntity?.state && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume d'eau total:</span>
                    <span className="font-semibold text-foreground">
                      {parseFloat(totalWaterEntity.state).toFixed(0)} L
                    </span>
                  </div>
                )}
                {totalElectricEntity?.state && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Électricité totale consommée:</span>
                    <span className="font-semibold text-foreground">
                      {parseFloat(totalElectricEntity.state).toFixed(1)} kWh
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </BaseWidget>
  );
});
