/** ha-groups — Home Assistant entities grouped by use (lights, sensors, scenes…), pure functions shared by the data hook and the cache persister. */
import type { HAState } from '../services/api';
import { PRINTER_LIGHT_PATTERN } from '../constants/entities';

/** Home Assistant states as the dashboard reads them: every entity, plus groups derived from it. */
export interface HAData {
  all: HAState[];
  lights: HAState[];
  sensors: HAState[];
  scenes: HAState[];
  weather: HAState[];
  alarms: HAState[];
  metadata: Record<string, { area: string; floor?: string; model: string }>;
}

/**
 * Sorts array of alarm entities, prioritizing Somfy alarms.
 *
 * @param alarms - Array of alarm control panel entities.
 * @returns Sorted array.
 */
export const sortAlarms = (alarms: HAState[]) => {
  return [...alarms].sort((a, b) => {
    const isSomfyA =
      a.entity_id.includes('somfy') || a.attributes.friendly_name?.toLowerCase().includes('somfy');
    const isSomfyB =
      b.entity_id.includes('somfy') || b.attributes.friendly_name?.toLowerCase().includes('somfy');
    return isSomfyA && !isSomfyB ? -1 : !isSomfyA && isSomfyB ? 1 : 0;
  });
};

/**
 * Determines whether a light entity is a standard home light (e.g. Philips Hue)
 * and not an appliance/printer light (e.g. Bambu Lab 3D printer chamber light).
 *
 * @param {HAState} entity - Home Assistant state entity
 * @returns {boolean} True if the entity is a standard home light
 */
export const isHueLight = (entity: HAState): boolean => {
  if (!entity || typeof entity.entity_id !== 'string' || !entity.entity_id.startsWith('light.')) {
    return false;
  }
  return !PRINTER_LIGHT_PATTERN.test(entity.entity_id.toLowerCase());
};

/**
 * Derives grouped HAData (lights, sensors, scenes, weather, alarms) from a flat
 * entity array. Single source of truth for entity-domain filters used by both
 * the query cache and optimistic update paths.
 *
 * @param all - All HA entities returned by getStates().
 * @returns HAData with derived arrays and an empty metadata map (callers merge theirs).
 */
export const groupHAStates = (all: HAState[]): HAData => ({
  all,
  lights: all.filter(isHueLight),
  sensors: all.filter(
    (s) => s.entity_id.startsWith('sensor.') || s.entity_id.startsWith('binary_sensor.'),
  ),
  scenes: all.filter((s) => s.entity_id.startsWith('scene.')),
  weather: all.filter((s) => s.entity_id.startsWith('weather.')),
  alarms: sortAlarms(all.filter((s) => s.entity_id.startsWith('alarm_control_panel.'))),
  metadata: {},
});
