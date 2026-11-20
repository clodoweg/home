/**
 * home-summary — What the home overview says about the house, derived from the Home Assistant
 * states the dashboard already holds (no request of its own). Pure functions.
 */
import type { HAState } from '../services/api';
import {
  PLUG_ENTITIES,
  PRINTER_LOOKUPS,
  SPA_ENTITIES,
  findPrinterEntity,
  selectPrinterEntities,
  washingMachineEntity,
} from '../constants/entities';
import { OTHER_FLOOR, compareByUserOrder, compareFloors } from './floors';
import { isHueLight } from './ha-groups';
import { calculateRemainingMinutes, formatPrintStatus } from './printer';
import { formatProgramName } from '../components/widgets/washing-machine/labels';

type Metadata = Record<string, { area: string; floor?: string; model: string }>;

export type WasherPhase = 'finished' | 'running' | 'paused' | 'off';

/** A room of lights and the entities to toggle to switch it fully on or off. */
interface LightRoom {
  name: string;
  on: boolean;
  /** Lights (or the room group) to toggle so that the whole room is on. */
  turnOnIds: string[];
  /** Lights (or the room group) to toggle so that the whole room is off. */
  turnOffIds: string[];
}

export interface HomeSummary {
  /** Lights on in the rooms the user shows (room groups excluded) and the rooms they are in. */
  lights: {
    on: number;
    total: number;
    rooms: string[];
    onIds: string[];
    /** Every room the user shows, in the lights widget's order, with what switches it. */
    roomList: LightRoom[];
  };
  weather: {
    condition: string;
    temperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
  } | null;
  spa: {
    current: number;
    target: number | null;
    heating: boolean;
    /** Pump, filtration and bubbles as the spa widget shows them; null when not reported. */
    power: boolean | null;
    filter: boolean | null;
    bubbles: boolean | null;
    hasError: boolean;
    /** The connectivity sensor reports the spa offline (it may still answer). */
    connectionDown: boolean;
  } | null;
  washer: { phase: WasherPhase; remainingMinutes: number; program: string | null } | null;
  printer: {
    active: boolean;
    progress: number;
    /** Status as the printer widget words it (« En cours », « Terminé »…). */
    statusLabel: string;
    remainingMinutes: number;
    filename: string | null;
  } | null;
  /**
   * Each plug as its widget shows it: on or off, and its power when it reports one; `entity` is
   * its switch, for the home tile's on/off button.
   */
  plugs:
    { id: 'pc' | 'tv'; name: string; on: boolean; watts: number | null; entity: HAState }[] | null;
}

interface Input {
  all: HAState[];
  lights: HAState[];
  weather: HAState[];
  metadata: Metadata;
  /** Rooms hidden in the "Réorganiser" screen: the widgets leave them out, so does the summary. */
  isRoomHidden: (room: string) => boolean;
  /** Room and floor order of the "Réorganiser" screen. */
  roomOrder?: string[];
  floorOrder?: string[];
}

const USABLE = (entity: HAState | undefined): entity is HAState =>
  !!entity &&
  // A malformed state (not a string) is as unusable as a missing entity.
  typeof entity.state === 'string' &&
  entity.state !== 'unavailable' &&
  entity.state !== 'unknown';

const toNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Room of an entity without an area, as the widgets name it. */
const OTHER_ROOM = 'Autres';

const WASHER_FINISHED = ['finish', 'finished', 'end', 'completed', 'done'];
const WASHER_OFF = ['off', 'none', 'standby', 'idle', 'stop'];
const PRINTER_ACTIVE = ['printing', 'running', 'prepare', 'preparing', 'paused', 'pause'];

/**
 * Phase of the washing machine, with the precedence of its widget: finished, running, paused, off.
 *
 * @param mode - State of `sensor.washing_machine_mode`.
 * @param status - State of `binary_sensor.washing_machine_status`.
 * @param paused - State of `binary_sensor.washing_machine_paused`.
 * @returns The phase.
 */
export function washerPhase(
  mode: string | undefined,
  status?: string,
  paused?: string,
): WasherPhase {
  const normalized = (mode || 'off').toLowerCase();
  if (WASHER_FINISHED.includes(normalized)) return 'finished';
  if (status === 'off' || WASHER_OFF.includes(normalized)) return 'off';
  if (normalized === 'run' || normalized === 'running' || status === 'on') return 'running';
  if (normalized === 'pause' || normalized === 'paused' || paused === 'on') return 'paused';
  return 'off';
}

/**
 * What to toggle to switch a room. A toggle flips each entity from its own state, so only the
 * entities that are not yet in the wanted state are listed; the room group, when there is one and
 * it is not in the wanted state, switches all its lights at once.
 */
const roomSwitches = (roomLights: HAState[], metadata: Metadata) => {
  const group = roomLights.find((l) => metadata[l.entity_id]?.model === 'Room');
  const bulbs = roomLights.filter((l) => l !== group);
  const ids = (lights: HAState[]) => lights.map((l) => l.entity_id);
  const onBulbs = bulbs.filter((l) => l.state === 'on');
  const offBulbs = bulbs.filter((l) => l.state !== 'on');
  return {
    turnOnIds: group && group.state !== 'on' ? [group.entity_id] : ids(offBulbs),
    turnOffIds: group?.state === 'on' ? [group.entity_id] : ids(onBulbs),
  };
};

const summarizeLights = (
  lights: HAState[],
  metadata: Metadata,
  isRoomHidden: (room: string) => boolean,
  roomOrder: string[],
  floorOrder: string[],
): HomeSummary['lights'] => {
  const roomOf = (light: HAState) => metadata[light.entity_id]?.area || OTHER_ROOM;
  const hue = lights.filter(isHueLight).filter((l) => !isRoomHidden(roomOf(l)));
  const single = hue.filter((l) => metadata[l.entity_id]?.model !== 'Room');
  // A house exposing only room groups still has lights to count.
  const bulbs = single.length > 0 ? single : hue;
  const on = bulbs.filter((l) => l.state === 'on');
  const rooms = [...new Set(on.map((l) => metadata[l.entity_id]?.area).filter(Boolean))];

  const floorOf = (room: string) =>
    hue
      .filter((l) => roomOf(l) === room)
      .map((l) => metadata[l.entity_id]?.floor)
      .find((floor) => !!floor) || OTHER_FLOOR;
  const roomList = [...new Set(hue.map(roomOf))]
    .sort(
      (a, b) =>
        compareFloors(floorOf(a), floorOf(b), floorOrder) ||
        (compareByUserOrder(a, b, roomOrder) ?? a.localeCompare(b)),
    )
    .map((name) => {
      const roomLights = hue.filter((l) => roomOf(l) === name);
      return {
        name,
        on: roomLights.some((l) => l.state === 'on'),
        ...roomSwitches(roomLights, metadata),
      };
    });

  return { on: on.length, total: bulbs.length, rooms, onIds: on.map((l) => l.entity_id), roomList };
};

const summarizeSpa = (all: HAState[]): HomeSummary['spa'] => {
  const climate = all.find((e) => e.entity_id === SPA_ENTITIES.climate);
  if (!USABLE(climate)) return null;
  const current = toNumber(climate.attributes.current_temperature);
  if (current === null) return null;
  const byId = (id: string) => all.find((e) => e.entity_id === id);
  const onOff = (entity: HAState | undefined) => (USABLE(entity) ? entity.state === 'on' : null);
  const bubbles = byId(SPA_ENTITIES.bubbles);
  const connected = byId(SPA_ENTITIES.connected);
  return {
    current,
    target: toNumber(climate.attributes.temperature),
    heating: climate.state === 'heat',
    power: onOff(byId(SPA_ENTITIES.power)),
    filter: onOff(byId(SPA_ENTITIES.filter)),
    bubbles: USABLE(bubbles) ? bubbles.state.toLowerCase() !== 'off' : null,
    hasError: byId(SPA_ENTITIES.error)?.state === 'on',
    connectionDown: !!connected && connected.state !== 'on',
  };
};

const summarizeWasher = (all: HAState[]): HomeSummary['washer'] => {
  const find = (domain: string, key: string) =>
    all.find((e) => e.entity_id === washingMachineEntity(domain, key));
  const mode = find('sensor', 'mode');
  const status = find('binary_sensor', 'status');
  if (!mode && !status) return null;
  const phase = washerPhase(mode?.state, status?.state, find('binary_sensor', 'paused')?.state);
  const remaining = toNumber(find('sensor', 'remaining_time')?.state);
  const program = find('sensor', 'program_name')?.state;
  return {
    phase,
    remainingMinutes: phase === 'running' || phase === 'paused' ? Math.max(0, remaining ?? 0) : 0,
    program: formatProgramName(program || null),
  };
};

const summarizePrinter = (all: HAState[]): HomeSummary['printer'] => {
  const entities = selectPrinterEntities(all);
  const status = findPrinterEntity(entities, PRINTER_LOOKUPS.status);
  if (!USABLE(status)) return null;
  const find = (lookup: (typeof PRINTER_LOOKUPS)[keyof typeof PRINTER_LOOKUPS]) =>
    findPrinterEntity(entities, lookup);
  const progress = toNumber(find(PRINTER_LOOKUPS.progress)?.state) ?? 0;
  const active = PRINTER_ACTIVE.includes(status.state.trim().toLowerCase());
  const remaining = find(PRINTER_LOOKUPS.remainingTime);
  const filename = find(PRINTER_LOOKUPS.filename)?.state;
  return {
    active,
    progress: Math.min(100, Math.max(0, progress)),
    statusLabel: formatPrintStatus(status.state).label,
    remainingMinutes: calculateRemainingMinutes(
      find(PRINTER_LOOKUPS.endTime)?.state,
      remaining?.state,
      remaining?.attributes?.unit_of_measurement as string | undefined,
      status.state,
    ),
    filename: active && USABLE(find(PRINTER_LOOKUPS.filename)) ? (filename ?? null) : null,
  };
};

const summarizePlugs = (all: HAState[]): HomeSummary['plugs'] => {
  const byId = (id: string) => all.find((e) => e.entity_id === id);
  const plugs = [
    {
      id: 'pc' as const,
      name: 'Prise PC',
      plug: byId(PLUG_ENTITIES.plugPC),
      power: byId(PLUG_ENTITIES.powerPC),
    },
    {
      id: 'tv' as const,
      name: 'Prise TV',
      plug: byId(PLUG_ENTITIES.plugTV),
      power: byId(PLUG_ENTITIES.powerTV),
    },
  ].filter((p): p is typeof p & { plug: HAState } => USABLE(p.plug));
  if (plugs.length === 0) return null;
  return plugs.map(({ id, name, plug, power }) => ({
    id,
    entity: plug,
    name,
    on: plug.state === 'on',
    watts: toNumber(power?.state),
  }));
};

/**
 * Summary of the house shown on the home overview.
 *
 * @param input - Home Assistant entities (all and grouped) and their area metadata.
 * @returns One entry per domain; null when the house does not have the device.
 */
export function summarizeHome({
  all,
  lights,
  weather,
  metadata,
  isRoomHidden,
  roomOrder = [],
  floorOrder = [],
}: Input): HomeSummary {
  const forecast = weather[0];
  return {
    lights: summarizeLights(lights, metadata, isRoomHidden, roomOrder, floorOrder),
    weather: USABLE(forecast)
      ? {
          condition: forecast.state,
          temperature: toNumber(forecast.attributes.temperature),
          humidity: toNumber(forecast.attributes.humidity),
          windSpeed: toNumber(forecast.attributes.wind_speed),
        }
      : null,
    spa: summarizeSpa(all),
    washer: summarizeWasher(all),
    printer: summarizePrinter(all),
    plugs: summarizePlugs(all),
  };
}
