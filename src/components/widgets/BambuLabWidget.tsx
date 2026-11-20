/**
 * BambuLabWidget — Monitoring & control widget for Bambu Lab 3D Printers (P1S, X1C, P1P, etc.)
 */
import React, { memo } from 'react';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { HAState } from '../../services/api';
import { useHAState } from '../../hooks/useHAState';
import { cn } from '../../lib/utils';
import { Thermometer, Gauge, Lightbulb, Clock, Layers, FileText } from 'lucide-react';
import { formatMinutes } from '../../lib/format';
import { PRINTER_LOOKUPS, findPrinterEntity } from '../../constants/entities';
import { calculateRemainingMinutes, formatPrintStatus } from '../../lib/printer';

interface BambuLabWidgetProps {
  data?: HAState[];
}

/**
 * Bambu Lab 3D printer status and controls.
 *
 * @param props - Home Assistant entities.
 * @returns The widget.
 */
export const BambuLabWidget = memo(function BambuLabWidget({ data = [] }: BambuLabWidgetProps) {
  const { getEffectiveValue, performAction } = useHAState();

  const getEntity = (candidateSuffixes: readonly string[], domain: string) =>
    findPrinterEntity(data, { suffixes: candidateSuffixes, domain });

  const statusEntity = getEntity(PRINTER_LOOKUPS.status.suffixes, PRINTER_LOOKUPS.status.domain);
  const progressEntity = getEntity(
    PRINTER_LOOKUPS.progress.suffixes,
    PRINTER_LOOKUPS.progress.domain,
  );
  const currentLayerEntity = getEntity(
    PRINTER_LOOKUPS.currentLayer.suffixes,
    PRINTER_LOOKUPS.currentLayer.domain,
  );
  const totalLayersEntity = getEntity(
    PRINTER_LOOKUPS.totalLayers.suffixes,
    PRINTER_LOOKUPS.totalLayers.domain,
  );
  const endTimeEntity = getEntity(PRINTER_LOOKUPS.endTime.suffixes, PRINTER_LOOKUPS.endTime.domain);
  const remainingTimeEntity = getEntity(
    PRINTER_LOOKUPS.remainingTime.suffixes,
    PRINTER_LOOKUPS.remainingTime.domain,
  );
  const filenameEntity = getEntity(
    PRINTER_LOOKUPS.filename.suffixes,
    PRINTER_LOOKUPS.filename.domain,
  );
  const nozzleTempEntity = getEntity(
    PRINTER_LOOKUPS.nozzleTemp.suffixes,
    PRINTER_LOOKUPS.nozzleTemp.domain,
  );
  const nozzleTargetEntity = getEntity(
    PRINTER_LOOKUPS.nozzleTarget.suffixes,
    PRINTER_LOOKUPS.nozzleTarget.domain,
  );
  const bedTempEntity = getEntity(PRINTER_LOOKUPS.bedTemp.suffixes, PRINTER_LOOKUPS.bedTemp.domain);
  const bedTargetEntity = getEntity(
    PRINTER_LOOKUPS.bedTarget.suffixes,
    PRINTER_LOOKUPS.bedTarget.domain,
  );
  const chamberTempEntity = getEntity(
    PRINTER_LOOKUPS.chamberTemp.suffixes,
    PRINTER_LOOKUPS.chamberTemp.domain,
  );
  const lightEntity = getEntity(PRINTER_LOOKUPS.light.suffixes, PRINTER_LOOKUPS.light.domain);
  const speedEntity = getEntity(PRINTER_LOOKUPS.speed.suffixes, PRINTER_LOOKUPS.speed.domain);

  const rawStatus = statusEntity?.state;
  const statusInfo = formatPrintStatus(rawStatus);

  const progress = Math.min(100, Math.max(0, Number(progressEntity?.state || 0)));
  const currentLayer = Number(currentLayerEntity?.state || 0);
  const totalLayers = Number(totalLayersEntity?.state || 0);

  const remainingMinutes = calculateRemainingMinutes(
    endTimeEntity?.state,
    remainingTimeEntity?.state,
    remainingTimeEntity?.attributes?.unit_of_measurement as string | undefined,
    rawStatus,
  );

  const filename =
    typeof filenameEntity?.state === 'string' ? filenameEntity.state : 'Aucun fichier';

  const nozzleTemp = Math.round(Number(nozzleTempEntity?.state || 0));
  const nozzleTarget = Math.round(Number(nozzleTargetEntity?.state || 0));
  const bedTemp = Math.round(Number(bedTempEntity?.state || 0));
  const bedTarget = Math.round(Number(bedTargetEntity?.state || 0));
  const chamberTemp = Math.round(Number(chamberTempEntity?.state || 0));

  const effectiveLightState = lightEntity ? (getEffectiveValue(lightEntity) as string) : 'off';
  const isLightOn = (effectiveLightState || 'off') === 'on';

  const rawEffectiveSpeed = speedEntity
    ? (getEffectiveValue(speedEntity) as string) || speedEntity.state || 'standard'
    : 'standard';
  const effectiveSpeedState =
    typeof rawEffectiveSpeed === 'string' ? rawEffectiveSpeed : 'standard';

  const handleToggleLight = () => {
    if (!lightEntity) return;
    performAction(
      lightEntity,
      'light',
      isLightOn ? 'turn_off' : 'turn_on',
      undefined,
      isLightOn ? 'off' : 'on',
    );
  };

  const handleSetSpeed = (profile: string) => {
    if (!speedEntity) return;
    performAction(speedEntity, 'select', 'select_option', { option: profile }, profile);
  };

  const isPrintingOrActive =
    typeof rawStatus === 'string' &&
    ['printing', 'running', 'prepare', 'preparing', 'paused', 'pause'].includes(
      rawStatus.trim().toLowerCase(),
    );

  return (
    <BaseWidget
      id="bambu_lab"
      testID="widget-bambu-lab"
      title={WIDGET_CONFIG.bambu_lab.title}
      subtitle={[
        <span key="status">
          Statut{' '}
          <WidgetHighlight colorClass={statusInfo.textClass}>{statusInfo.label}</WidgetHighlight>
        </span>,
        isPrintingOrActive && remainingMinutes > 0 && (
          <span key="remaining" className="text-muted-foreground">
            {formatMinutes(remainingMinutes)} restantes
          </span>
        ),
        isPrintingOrActive && filename && filename !== 'Aucun fichier' && (
          <span key="file" className="text-muted-foreground">
            {filename}
          </span>
        ),
      ].filter(Boolean)}
      icon={WIDGET_CONFIG.bambu_lab.icon}
    >
      <div className="flex flex-col gap-4">
        {/* Status & Progress Container */}
        <div className="rounded-2xl bg-muted p-4">
          <div className="mb-3 flex items-center justify-between">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                statusInfo.bgClass,
                statusInfo.textClass,
              )}
            >
              {statusInfo.label}
            </span>
            {remainingMinutes > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={14} />
                <span>{formatMinutes(remainingMinutes)} restantes</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="relative mb-3 h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-lime transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText size={14} />
              <span className="max-w-[200px] truncate font-medium text-foreground" title={filename}>
                {filename}
              </span>
            </div>
            <div className="flex items-center gap-1 font-medium">
              <Layers size={14} />
              <span>
                {currentLayer} / {totalLayers > 0 ? totalLayers : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Temperatures Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Nozzle */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-muted p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Thermometer size={14} className="text-warning" />
              <span>Buse</span>
            </div>
            <span className="text-base font-bold text-foreground">{nozzleTemp}°C</span>
            {nozzleTarget > 0 && (
              <span className="text-[10px] text-muted-foreground">/ {nozzleTarget}°C</span>
            )}
          </div>

          {/* Bed */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-muted p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Thermometer size={14} className="text-warning" />
              <span>Plateau</span>
            </div>
            <span className="text-base font-bold text-foreground">{bedTemp}°C</span>
            {bedTarget > 0 && (
              <span className="text-[10px] text-muted-foreground">/ {bedTarget}°C</span>
            )}
          </div>

          {/* Chamber */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-muted p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Thermometer size={14} className="text-info" />
              <span>Chambre</span>
            </div>
            <span className="text-base font-bold text-foreground">
              {chamberTemp > 0 ? `${chamberTemp}°C` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center justify-between rounded-2xl bg-muted p-3">
          {/* Speed Selector */}
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-muted-foreground" />
            <div className="flex items-center gap-1">
              {['silent', 'standard', 'sport', 'ludicrous'].map((speed) => (
                <button
                  key={speed}
                  data-testid={`bambu-speed-${speed}`}
                  onClick={() => handleSetSpeed(speed)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-semibold uppercase transition-colors',
                    effectiveSpeedState.toLowerCase() === speed
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  {speed === 'ludicrous' ? 'Ludic' : speed}
                </button>
              ))}
            </div>
          </div>

          {/* Light Toggle */}
          {lightEntity && (
            <button
              data-testid="bambu-light-switch"
              onClick={handleToggleLight}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                isLightOn
                  ? 'bg-warning/15 text-warning'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              <Lightbulb size={14} className={isLightOn ? 'fill-current' : ''} />
              <span>LED</span>
            </button>
          )}
        </div>
      </div>
    </BaseWidget>
  );
});
