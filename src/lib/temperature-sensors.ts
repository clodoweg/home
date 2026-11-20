/**
 * temperature-sensors — The temperature sensors the dashboard shows, as the temperature widget
 * lists them: hidden sensors and rooms left out, each paired with its humidity sensor, in the
 * user's floor and room order. Shared by the widget and its home tile so both show the same rows.
 */
import type { HAState } from '../services/api';
import { compareByUserOrder, compareFloors } from './floors';

export interface TemperatureSensorRow {
  /** Display name: the sensor's own label, or its room. */
  name: string;
  area: string;
  floor: string;
  temp: number;
  humidity: number | null;
  tempId: string;
  humId: string | null;
}

interface Args {
  /** Sensor entities (any device class: the others are ignored). */
  data: HAState[];
  metadata: Record<string, { area: string; floor?: string; model: string }>;
  isSensorHidden: (entityId: string) => boolean;
  isRoomHidden: (room: string) => boolean;
  roomOrder: string[];
  floorOrder: string[];
}

/**
 * Builds a flat list of sensor entries — one entry per temperature sensor.
 * Humidity pairing is done by matching area + model (same physical device).
 * No averaging: the displayed value matches the exact HA sensor state.
 *
 * @param args - Sensor entities, their metadata and the user's visibility and order preferences.
 * @returns The visible rows, sorted by floor then room.
 */
export function listTemperatureSensors({
  data,
  metadata,
  isSensorHidden,
  isRoomHidden,
  roomOrder,
  floorOrder,
}: Args): TemperatureSensorRow[] {
  const sensors = data.filter((d) => {
    const dc = d.attributes.device_class;
    return dc && (dc === 'temperature' || dc === 'humidity') && !isSensorHidden(d.entity_id);
  });
  const tempSensors = sensors.filter((s) => s.attributes.device_class === 'temperature');
  const humSensors = sensors.filter((s) => s.attributes.device_class === 'humidity');

  const entries = tempSensors
    .map((s) => {
      const val = parseFloat(s.state);
      // Skip unavailable/unknown/zero states
      if (isNaN(val) || val === 0) return null;

      const meta = metadata[s.entity_id];
      const area = meta?.area || 'Autres';
      const floor = meta?.floor || '';
      const model = meta?.model || '';

      // Pair with humidity sensor from the same device (same area + same model)
      const pairedHum = humSensors.find((h) => {
        const hMeta = metadata[h.entity_id];
        return hMeta?.area === area && hMeta?.model === model;
      });
      const isHumHidden = pairedHum ? isSensorHidden(pairedHum.entity_id) : false;
      const humVal = pairedHum && !isHumHidden ? parseFloat(pairedHum.state) : NaN;

      const areaSensors = tempSensors.filter(
        (ts) => (metadata[ts.entity_id]?.area || 'Autres') === area,
      );
      // Clean the friendly name of the sensor to make it elegant
      const selfFriendly = s.attributes.friendly_name || s.entity_id;
      let selfClean = selfFriendly
        .replace(new RegExp(`température`, 'gi'), '')
        .replace(new RegExp(`temperature`, 'gi'), '')
        .trim();
      if (selfClean) {
        selfClean = selfClean.charAt(0).toUpperCase() + selfClean.slice(1);
      }
      const selfLabel = selfClean || area;

      // Check if there are other sensors in the same area with the same cleaned label
      const hasDuplicateLabel = areaSensors.some((ts) => {
        if (ts.entity_id === s.entity_id) return false;
        const otherFriendly = ts.attributes.friendly_name || ts.entity_id;
        let otherClean = otherFriendly
          .replace(new RegExp(`température`, 'gi'), '')
          .replace(new RegExp(`temperature`, 'gi'), '')
          .trim();
        if (otherClean) {
          otherClean = otherClean.charAt(0).toUpperCase() + otherClean.slice(1);
        }
        const otherLabel = otherClean || area;
        return otherLabel.toLowerCase() === selfLabel.toLowerCase();
      });

      const displayName = hasDuplicateLabel && model ? `${selfLabel} (${model})` : selfLabel;

      return {
        // Use friendly_name as display label; falls back to area name
        name: displayName,
        area,
        floor,
        temp: Math.round(val * 10) / 10,
        humidity: !isNaN(humVal) ? Math.round(humVal) : null,
        tempId: s.entity_id,
        humId: pairedHum?.entity_id ?? null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .filter((e) => !isRoomHidden(e.area))
    .sort(
      (a, b) =>
        compareFloors(a.floor, b.floor, floorOrder) ||
        (compareByUserOrder(a.area, b.area, roomOrder) ?? a.name.localeCompare(b.name)),
    );

  return entries;
}
