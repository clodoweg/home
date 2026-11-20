/**
 * HomeOverview — Home screen: a bento grid of summary tiles (today, security, lights, pets,
 * devices, energy, temperatures, plugs). A tile, or a part of one, only shows for a widget the
 * user can see, and only shows figures that widget shows too (same sensors, same rooms: what the
 * user hid stays hidden). Each tile links to its widgets, unfolded alone in their section.
 */
import React, { useMemo, useRef } from 'react';

import { listArloCameras, type ArloCamera } from '../lib/arlo';
import type { HomeSummary } from '../lib/home-summary';
import { useMasonryRows } from '../hooks/useMasonryRows';
import { useNow } from '../hooks/useNow';
import type { HAState, PetKitData } from '../services/api';
import { EnergySummaryTile } from './EnergySummaryTile';
import {
  DevicesSummaryTile,
  LightsSummaryTile,
  PetsSummaryTile,
  SecuritySummaryTile,
  TodayTile,
} from './HomeSummaryTiles';
import { PlugsSummaryTile } from './PlugsSummaryTile';
import { TemperatureSummaryTile } from './TemperatureSummaryTile';

type Metadata = Record<string, { area: string; floor?: string; model: string }>;

const NO_SENSORS: HAState[] = [];
const NO_CAMERAS: ArloCamera[] = [];
/** Two columns of tiles from the `xl` breakpoint: they pile up as a masonry, without holes. */
const MASONRY_QUERY = '(min-width: 1280px)';

interface HomeOverviewProps {
  summary: HomeSummary;
  /** Ids of the widgets the user can see: a tile, or a part of one, only shows for them. */
  widgetIds: readonly string[];
  /** Sensor entities and area metadata, for the "today" and "temperatures" tiles. */
  sensors: HAState[];
  metadata: Metadata;
  petkit: PetKitData | null;
  /** Petkit's first answer has not arrived yet. */
  petkitLoading?: boolean;
  firstName?: string | null;
  /** Alarm panel and Arlo entities, for the "security" tile. */
  alarmEntity?: HAState;
  arloEntities: HAState[];
  /** Weather entity, for the forecast of the "today" tile. */
  weatherEntity?: HAState;
  /** Toggles each of the given lights (or room groups). */
  onToggleLights: (entityIds: string[]) => void;
}

/**
 * Home screen: the summary tiles of the widgets the user can see.
 *
 * @param props - House summary, visible widgets, sensors, Petkit data, first name, alarm,
 *   cameras, weather and the lights action.
 * @returns The bento grid.
 */
export const HomeOverview = ({
  summary,
  widgetIds,
  sensors,
  metadata,
  petkit,
  petkitLoading = false,
  firstName,
  weatherEntity,
  alarmEntity,
  arloEntities,
  onToggleLights,
}: HomeOverviewProps) => {
  const now = new Date(useNow());
  const cameraList = useMemo(() => listArloCameras(arloEntities), [arloEntities]);
  const { lights, weather, spa, washer, printer, plugs } = summary;
  const gridRef = useRef<HTMLDivElement>(null);
  useMasonryRows(gridRef, MASONRY_QUERY);

  return (
    <div
      ref={gridRef}
      data-testid="home-overview"
      // Tiles keep their own height. On a computer, each one spans as many 4 px rows as it is tall
      // (useMasonryRows), so the next tile goes under the shortest column instead of leaving a hole.
      className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 md:gap-4 xl:auto-rows-[4px] xl:grid-cols-2 xl:gap-x-4 xl:gap-y-0"
    >
      <TodayTile
        now={now}
        firstName={firstName}
        weather={widgetIds.includes('weather') ? weather : null}
        weatherEntity={weatherEntity}
        sensors={widgetIds.includes('temperature') ? sensors : NO_SENSORS}
        metadata={metadata}
      />
      <SecuritySummaryTile
        alarm={widgetIds.includes('alarm') ? alarmEntity : undefined}
        cameras={widgetIds.includes('arlo') ? cameraList : NO_CAMERAS}
      />
      {widgetIds.includes('lights') && (
        <LightsSummaryTile lights={lights} onToggleLights={onToggleLights} />
      )}
      <PetsSummaryTile
        petkit={petkit}
        showFeeder={widgetIds.includes('feeder')}
        showFountain={widgetIds.includes('fountain')}
        loading={petkitLoading}
        now={now}
      />
      <DevicesSummaryTile
        spa={spa}
        washer={washer}
        printer={printer}
        showSpa={widgetIds.includes('spa')}
        showWasher={widgetIds.includes('washing_machine')}
        showPrinter={widgetIds.includes('bambu_lab')}
      />
      <EnergySummaryTile
        showElectricity={widgetIds.includes('electricity')}
        showGas={widgetIds.includes('gas')}
        showWater={widgetIds.includes('water')}
      />
      {widgetIds.includes('temperature') && (
        <TemperatureSummaryTile sensors={sensors} metadata={metadata} />
      )}
      {widgetIds.includes('plugs') && <PlugsSummaryTile plugs={plugs} />}
    </div>
  );
};
