/**
 * HistoryScreen — Onglet Historique : choix de la période (semaine, mois, année), comparaison
 * avec l'an passé, unité (quantité ou euros) et vues par domaine (Énergie, Appareils, Climat,
 * Animaux, Sécurité) ou croisées. Chaque vue ne montre que les domaines dont le widget est
 * visible pour l'utilisateur (droits, widgets masqués). Chargé à la demande avec recharts.
 */
import React, { useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';
import { useDailyUsage } from '../../hooks/history/useHistoryData';
import {
  useHistoryView,
  type HistoryTab,
  type HistoryUnit,
} from '../../hooks/history/useHistoryView';
import { listTemperatureSensors } from '../../lib/temperature-sensors';
import { periodLabel, previousYearLabel, type Granularity } from '../../lib/history/period';
import type { HAState } from '../../services/api';
import { cn } from '../../lib/utils';
import { ClimateHistory } from './ClimateHistory';
import { CrossHistory } from './CrossHistory';
import { DevicesHistory } from './DevicesHistory';
import { EnergyHistory } from './EnergyHistory';
import { Segmented } from './HistoryParts';
import { PetsHistory, SecurityHistory } from './PetsSecurityHistory';

const GRANULARITY_OPTIONS: readonly { value: Granularity; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'rolling', label: '12 mois' },
];

const UNIT_OPTIONS: readonly { value: HistoryUnit; label: string }[] = [
  { value: 'quantity', label: 'kWh, L' },
  { value: 'cost', label: '€' },
];

const TAB_LABELS: Record<HistoryTab, string> = {
  energie: 'Énergie',
  appareils: 'Appareils',
  climat: 'Climat',
  animaux: 'Animaux',
  securite: 'Sécurité',
  croiser: 'Croiser',
};

/** Tabs that read the daily usage counters. */
const USAGE_TABS: readonly HistoryTab[] = ['appareils', 'animaux', 'securite', 'croiser'];

export interface HistoryScreenProps {
  /** Widgets shown to the user (rights and hidden widgets applied). */
  visibleWidgets: ReadonlySet<string>;
  sensors: HAState[];
  metadata: Record<string, { area: string; floor?: string; model: string }>;
  /** Alerts are the admins' (as the bell). */
  isAdmin: boolean;
}

/**
 * The history tab.
 *
 * @param props - Visible widgets, sensors, metadata and admin flag.
 * @returns The screen.
 */
export const HistoryScreen = ({
  visibleWidgets,
  sensors,
  metadata,
  isAdmin,
}: HistoryScreenProps) => {
  const view = useHistoryView();
  const { isRoomHidden, isSensorHidden, roomOrder, floorOrder } = useWidgetPreferences();
  const has = useCallback((id: string) => visibleWidgets.has(id), [visibleWidgets]);

  const visible = useMemo(
    () => ({
      energy: { electricity: has('electricity'), gas: has('gas'), water: has('water') },
      devices: {
        plugs: has('plugs'),
        spa: has('spa'),
        washer: has('washing_machine'),
        printer: has('bambu_lab'),
        lights: has('lights'),
      },
      climate: has('temperature'),
      pets: { feeder: has('feeder'), fountain: has('fountain') },
      security: { alarm: has('alarm'), cameras: has('arlo'), alerts: isAdmin },
    }),
    [has, isAdmin],
  );

  const tabs = useMemo(() => {
    const list: HistoryTab[] = [];
    if (Object.values(visible.energy).some(Boolean)) list.push('energie');
    if (Object.values(visible.devices).some(Boolean)) list.push('appareils');
    if (visible.climate) list.push('climat');
    if (Object.values(visible.pets).some(Boolean)) list.push('animaux');
    if (Object.values(visible.security).some(Boolean)) list.push('securite');
    list.push('croiser');
    return list;
  }, [visible]);
  const tab = tabs.includes(view.tab) ? view.tab : tabs[0];

  const usage = useDailyUsage(view.previous, view.period, USAGE_TABS.includes(tab));
  const rooms = useMemo(
    () =>
      listTemperatureSensors({
        data: sensors,
        metadata,
        isSensorHidden,
        isRoomHidden,
        roomOrder,
        floorOrder,
      }),
    [sensors, metadata, isSensorHidden, isRoomHidden, roomOrder, floorOrder],
  );
  const areaOf = useCallback(
    (entityId: string) => metadata[entityId]?.area || 'Autres',
    [metadata],
  );
  const isLightShown = useCallback(
    (entityId: string) => !isRoomHidden(areaOf(entityId)),
    [isRoomHidden, areaOf],
  );
  const showsUnit = tab === 'energie' || (tab === 'appareils' && visible.devices.plugs);

  return (
    <div data-testid="history-screen" className="flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-col gap-3 px-2 pt-2 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Historique
        </h1>
        <Segmented
          label="Granularité"
          testIdPrefix="history-granularity"
          options={GRANULARITY_OPTIONS}
          value={view.granularity}
          onChange={view.setGranularity}
          className="w-full lg:w-[26rem]"
        />
      </div>

      <div className="flex flex-row items-center gap-2 rounded-tile bg-card p-2">
        <button
          type="button"
          data-testid="history-previous"
          aria-label="Période précédente"
          onClick={() => view.shift(-1)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="min-w-0 flex-1 text-center">
          <span
            data-testid="history-period-label"
            className="block truncate font-display text-lg font-semibold text-foreground"
          >
            {periodLabel(view.period)}
          </span>
          {view.compare && (
            <span className="block truncate text-xs text-muted-foreground">
              comparé à {previousYearLabel(view.period)}
            </span>
          )}
        </p>
        <button
          type="button"
          data-testid="history-next"
          aria-label="Période suivante"
          disabled={view.isCurrent}
          onClick={() => view.shift(1)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <nav
          aria-label="Vues de l'historique"
          className="flex min-w-0 flex-1 flex-row flex-wrap gap-1"
        >
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`history-tab-${id}`}
              aria-pressed={id === tab}
              onClick={() => view.setTab(id)}
              className={cn(
                'h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                id === tab
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'bg-card font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </nav>
        <div className="flex flex-row items-center justify-end gap-2">
          {showsUnit && (
            <Segmented
              label="Unité"
              testIdPrefix="history-unit"
              options={UNIT_OPTIONS}
              value={view.unit}
              onChange={view.setUnit}
            />
          )}
          <label className="flex h-11 cursor-pointer flex-row items-center gap-2 rounded-full bg-card px-4 text-sm text-foreground">
            <input
              type="checkbox"
              data-testid="history-compare"
              checked={view.compare}
              onChange={(event) => view.setCompare(event.target.checked)}
              className="size-4 accent-current"
            />
            N-1
          </label>
        </div>
      </div>

      {tab === 'energie' && <EnergyHistory view={view} visible={visible.energy} />}
      {tab === 'appareils' && (
        <DevicesHistory
          view={view}
          visible={visible.devices}
          usage={usage.data}
          usageLoading={usage.isLoading}
          usageFailed={usage.isError}
          areaOf={areaOf}
          isRoomHidden={isRoomHidden}
        />
      )}
      {tab === 'climat' && <ClimateHistory view={view} sensors={sensors} metadata={metadata} />}
      {tab === 'animaux' && (
        <PetsHistory
          view={view}
          visible={visible.pets}
          usage={usage.data}
          usageLoading={usage.isLoading}
          usageFailed={usage.isError}
        />
      )}
      {tab === 'securite' && (
        <SecurityHistory
          view={view}
          visible={visible.security}
          usage={usage.data}
          usageLoading={usage.isLoading}
          usageFailed={usage.isError}
        />
      )}
      {tab === 'croiser' && (
        <CrossHistory
          view={view}
          rooms={visible.climate ? rooms : []}
          usage={usage.data}
          isLightShown={isLightShown}
          visible={{
            ...visible.energy,
            plugs: visible.devices.plugs,
            usage: visible.devices.spa || visible.devices.lights || visible.devices.washer,
          }}
        />
      )}
    </div>
  );
};
