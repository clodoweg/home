/**
 * useDashboardWidgets — Builds the id → JSX map for every widget rendered
 * on the dashboard. Wraps each one in a WidgetErrorBoundary so a single
 * misbehaving widget can't crash the grid, and gates cameras/history/energy
 * widgets by permission.
 */
import React, { useMemo } from 'react';
import { AlarmWidget } from '../components/widgets/AlarmWidget';
import { ElectricityWidget } from '../components/widgets/ElectricityWidget';
import { GasWidget } from '../components/widgets/GasWidget';
import { WaterWidget } from '../components/widgets/WaterWidget';
import { SpaWidget } from '../components/widgets/SpaWidget';
import { ClimateWidget } from '../components/widgets/ClimateWidget';
import { PlugsWidget } from '../components/widgets/PlugsWidget';
import { LightsWidget } from '../components/widgets/LightsWidget';
import { TemperatureWidget } from '../components/widgets/TemperatureWidget';
import { WeatherWidget } from '../components/widgets/WeatherWidget';
import { ArloWidget } from '../components/widgets/ArloWidget';
import { FeederWidget } from '../components/widgets/petkit/FeederWidget';
import { FountainWidget } from '../components/widgets/petkit/FountainWidget';
import { WashingMachineWidget } from '../components/widgets/WashingMachineWidget';
import { BambuLabWidget } from '../components/widgets/BambuLabWidget';
import { WidgetErrorBoundary } from '../components/ui/WidgetErrorBoundary';
import { HAState, PetKitData } from '../services/api';
import {
  ALARM_SIREN,
  PLUG_ENTITIES,
  SPA_ENTITIES,
  WASHING_MACHINE_MARKER,
  isArloEntity,
  selectPrinterEntities,
} from '../constants/entities';
import { useStableValue } from './useStableValue';

interface StableRights {
  history: boolean;
  cameras: boolean;
}

interface LightsActions {
  onToggle: (entityId: string) => void;
  onSetBrightness: (entityId: string, value: number) => void;
  onActivateScene: (
    sceneId: string,
    sceneName: string,
    activeRoomLightIds: string[],
  ) => Promise<void>;
  getLightState: (entity: HAState) => boolean;
  getLightBrightness: (entity: HAState) => number;
}

interface Args {
  haAll: HAState[] | undefined;
  all: HAState[];
  lights: HAState[];
  sensors: HAState[];
  scenes: HAState[];
  alarms: HAState[];
  weather: HAState[];
  metadata: Record<string, { area: string; model: string }>;
  petkit: PetKitData | null;
  petkitLoading: boolean;
  profileLoading: boolean;
  stableRights: StableRights;
  lightsActions: LightsActions;
  refreshAll: () => void;
  refreshTrigger: number;
}

/**
 * Builds every dashboard widget from the Home Assistant data; a widget the user may not see is null.
 *
 * @param args - Home Assistant data, rights, light actions and refresh callbacks.
 * @returns Widget element (or null) per widget id.
 */
export function useDashboardWidgets({
  haAll,
  all,
  lights,
  sensors,
  scenes,
  alarms,
  weather,
  metadata,
  petkit,
  petkitLoading,
  profileLoading,
  stableRights,
  lightsActions,
  refreshAll,
  refreshTrigger,
}: Args): Record<string, React.ReactNode> {
  // Each widget gets only its own entities, with a reference that survives polls where they do
  // not change: a memoized widget then skips the re-render. Unchanged entities already keep their
  // reference through React Query's structural sharing; the filtered arrays need the same.
  const arloEntities = useStableValue(
    useMemo(() => all.filter((e) => isArloEntity(e.entity_id)), [all]),
  );
  const climateEntities = useStableValue(
    useMemo(() => all.filter((e) => e.entity_id.startsWith('climate.')), [all]),
  );
  const printerEntities = useStableValue(useMemo(() => selectPrinterEntities(all), [all]));
  const washingMachineEntities = useStableValue(
    useMemo(
      () => (haAll ?? []).filter((e) => e.entity_id.includes(WASHING_MACHINE_MARKER)),
      [haAll],
    ),
  );

  return useMemo(
    () => ({
      alarm:
        alarms.length > 0 ? (
          <WidgetErrorBoundary widgetName="Alarm">
            <AlarmWidget
              entity={alarms[0]}
              showHistory={stableRights.history}
              siren={all.find((e) => e.entity_id === ALARM_SIREN)}
            />
          </WidgetErrorBoundary>
        ) : null,
      electricity: stableRights.history ? (
        <WidgetErrorBoundary widgetName="Electricity">
          <ElectricityWidget />
        </WidgetErrorBoundary>
      ) : null,
      gas: stableRights.history ? (
        <WidgetErrorBoundary widgetName="Gas">
          <GasWidget />
        </WidgetErrorBoundary>
      ) : null,
      water: stableRights.history ? (
        <WidgetErrorBoundary widgetName="Water">
          <WaterWidget />
        </WidgetErrorBoundary>
      ) : null,
      spa: (
        <WidgetErrorBoundary widgetName="Spa">
          <SpaWidget
            climate={all.find((e) => e.entity_id === SPA_ENTITIES.climate)}
            power={all.find((e) => e.entity_id === SPA_ENTITIES.power)}
            filter={all.find((e) => e.entity_id === SPA_ENTITIES.filter)}
            bubbles={all.find((e) => e.entity_id === SPA_ENTITIES.bubbles)}
            error={all.find((e) => e.entity_id === SPA_ENTITIES.error)}
            connected={haAll?.find((e) => e.entity_id === SPA_ENTITIES.connected)}
            showHistory={stableRights.history}
          />
        </WidgetErrorBoundary>
      ),
      plugs: (
        <WidgetErrorBoundary widgetName="Plugs">
          <PlugsWidget
            plugPC={haAll?.find((e) => e.entity_id === PLUG_ENTITIES.plugPC)}
            plugTV={haAll?.find((e) => e.entity_id === PLUG_ENTITIES.plugTV)}
            powerPC={haAll?.find((e) => e.entity_id === PLUG_ENTITIES.powerPC)}
            powerTV={haAll?.find((e) => e.entity_id === PLUG_ENTITIES.powerTV)}
            energyPC={haAll?.find((e) => e.entity_id === PLUG_ENTITIES.energyPC)}
            energyTV={haAll?.find((e) => e.entity_id === PLUG_ENTITIES.energyTV)}
          />
        </WidgetErrorBoundary>
      ),
      lights: (
        <WidgetErrorBoundary widgetName="Lights">
          <LightsWidget
            lights={lights}
            scenes={scenes}
            metadata={metadata}
            onToggle={lightsActions.onToggle}
            onSetBrightness={lightsActions.onSetBrightness}
            onActivateScene={lightsActions.onActivateScene}
            getLightState={lightsActions.getLightState}
            getLightBrightness={lightsActions.getLightBrightness}
            showHistory={stableRights.history}
          />
        </WidgetErrorBoundary>
      ),
      temperature: (
        <WidgetErrorBoundary widgetName="Temperature">
          <TemperatureWidget
            data={sensors}
            metadata={metadata}
            showHistory={stableRights.history}
          />
        </WidgetErrorBoundary>
      ),
      weather:
        weather.length > 0 ? (
          <WidgetErrorBoundary widgetName="Weather">
            <WeatherWidget entity={weather[0]} />
          </WidgetErrorBoundary>
        ) : null,
      arlo: stableRights.cameras ? (
        <WidgetErrorBoundary widgetName="Arlo">
          <ArloWidget
            entities={arloEntities}
            onRefresh={refreshAll}
            refreshTrigger={refreshTrigger}
          />
        </WidgetErrorBoundary>
      ) : null,
      feeder: (
        <WidgetErrorBoundary widgetName="PetKit Feeder">
          <FeederWidget
            data={petkit}
            loading={profileLoading || petkitLoading}
            onRefresh={refreshAll}
          />
        </WidgetErrorBoundary>
      ),
      fountain: (
        <WidgetErrorBoundary widgetName="PetKit Fountain">
          <FountainWidget data={petkit} loading={profileLoading || petkitLoading} />
        </WidgetErrorBoundary>
      ),
      climate: (
        <WidgetErrorBoundary widgetName="Climate">
          <ClimateWidget
            entities={climateEntities}
            metadata={metadata}
            showHistory={stableRights.history}
          />
        </WidgetErrorBoundary>
      ),
      washing_machine: (
        <WidgetErrorBoundary widgetName="Lave-linge">
          {/* Sensors and the `button.*` that ask the machine for its programs / settings. */}
          <WashingMachineWidget data={washingMachineEntities} />
        </WidgetErrorBoundary>
      ),
      bambu_lab: (
        <WidgetErrorBoundary widgetName="Imprimante 3D">
          <BambuLabWidget data={printerEntities} />
        </WidgetErrorBoundary>
      ),
    }),
    [
      alarms,
      stableRights,
      all,
      haAll,
      lights,
      scenes,
      metadata,
      sensors,
      weather,
      arloEntities,
      climateEntities,
      washingMachineEntities,
      printerEntities,
      petkit,
      profileLoading,
      petkitLoading,
      lightsActions,
      refreshAll,
      refreshTrigger,
    ],
  );
}
