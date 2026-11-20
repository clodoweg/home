/**
 * PetsSecurityHistory — Vues Animaux et Sécurité de l'onglet Historique, bâties sur les
 * compteurs d'usage quotidiens : repas, distributions et boissons ; armements de l'alarme,
 * détections par caméra et alertes par catégorie.
 */
import React, { useMemo } from 'react';
import { BellRing, Camera, Cat, Droplet, ShieldCheck } from 'lucide-react';
import type { HistoryView } from '../../hooks/history/useHistoryView';
import type { UsageResponse } from '../../services/history';
import { usageDays, usageEntities } from '../../lib/history/series';
import { SERIES_COLORS } from './HistoryGrids';
import { UsageCard } from './UsageCard';

interface UsageViewProps {
  view: HistoryView;
  usage: UsageResponse | undefined;
  usageLoading: boolean;
  usageFailed: boolean;
}

/**
 * The pets view: the feeder's meals and portions, the fountain's drinks.
 *
 * @param props - View, visible widgets and usage counters.
 * @returns The cards.
 */
export const PetsHistory = ({
  view,
  usage,
  usageLoading,
  usageFailed,
  visible,
}: UsageViewProps & { visible: { feeder: boolean; fountain: boolean } }) => {
  const metrics = useMemo(
    () => ({
      feeder: [
        { label: 'Repas', unit: '', days: usageDays(usage, 'feeder_meals') },
        { label: 'Distributions', unit: '', days: usageDays(usage, 'feeder_distributions') },
        { label: 'Portions', unit: '', days: usageDays(usage, 'feeder_portions') },
      ],
      fountain: [
        { label: 'Passages à la fontaine', unit: '', days: usageDays(usage, 'fountain_drinks') },
      ],
    }),
    [usage],
  );
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 xl:grid-cols-2">
      {visible.feeder && (
        <UsageCard
          testId="history-pets-feeder"
          title="Croquettes"
          icon={Cat}
          tone="tangerine"
          metrics={metrics.feeder}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.electricity}
        />
      )}
      {visible.fountain && (
        <UsageCard
          testId="history-pets-fountain"
          title="Fontaine"
          icon={Droplet}
          tone="tangerine"
          metrics={metrics.fountain}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.water}
        />
      )}
    </div>
  );
};

/** Name of a camera from its motion sensor: `binary_sensor.aarlo_motion_jardin` → « Jardin ». */
const cameraName = (entityId: string): string => {
  const name = entityId.replace('binary_sensor.aarlo_motion_', '').replace(/_/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** French titles of the alert categories, as the back writes them (CATEGORY_TITLES). */
const ALERT_LABELS: Record<string, string> = {
  alarm: 'Alarme',
  lights: 'Lumières',
  spa: 'Spa',
  fountain: 'Fontaine',
  feeder: 'Croquettes',
  humidity: 'Humidité',
  motion: 'Mouvement',
  temperature: 'Température',
  washingMachine: 'Lave-linge',
  printer: 'Imprimante 3D',
};

/**
 * The security view: alarm, camera detections (cameras right) and alerts (admins).
 *
 * @param props - View, visible parts and usage counters.
 * @returns The cards.
 */
export const SecurityHistory = ({
  view,
  usage,
  usageLoading,
  usageFailed,
  visible,
}: UsageViewProps & { visible: { alarm: boolean; cameras: boolean; alerts: boolean } }) => {
  const metrics = useMemo(() => {
    const cameras = usageEntities(usage, 'motion');
    const categories = Object.keys(usage ?? {})
      .filter((metric) => metric.startsWith('alerts:'))
      .map((metric) => metric.slice('alerts:'.length))
      .sort();
    return {
      alarm: [
        { label: 'Activations', unit: '', days: usageDays(usage, 'alarm_arms') },
        { label: 'Déclenchements', unit: '', days: usageDays(usage, 'alarm_triggers') },
      ],
      cameras: [
        { label: 'Toutes caméras', unit: '', days: usageDays(usage, 'motion') },
        ...cameras.slice(0, 2).map((camera) => ({
          label: cameraName(camera),
          unit: '',
          days: usageDays(usage, 'motion', (entity) => entity === camera),
        })),
      ],
      alerts: [
        { label: 'Toutes alertes', unit: '', days: usageDays(usage, 'alerts') },
        ...categories.slice(0, 2).map((category) => ({
          label: ALERT_LABELS[category] ?? category,
          unit: '',
          days: usageDays(usage, 'alerts', (entity) => entity === category),
        })),
      ],
    };
  }, [usage]);

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 xl:grid-cols-2">
      {visible.alarm && (
        <UsageCard
          testId="history-security-alarm"
          title="Alarme"
          icon={ShieldCheck}
          tone="coral"
          metrics={metrics.alarm}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.temperature}
        />
      )}
      {visible.cameras && (
        <UsageCard
          testId="history-security-cameras"
          title="Détections des caméras"
          icon={Camera}
          tone="coral"
          metrics={metrics.cameras}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.temperature}
        />
      )}
      {visible.alerts && (
        <UsageCard
          testId="history-security-alerts"
          title="Alertes"
          icon={BellRing}
          tone="coral"
          metrics={metrics.alerts}
          view={view}
          loading={usageLoading}
          failed={usageFailed}
          color={SERIES_COLORS.electricity}
        />
      )}
    </div>
  );
};
