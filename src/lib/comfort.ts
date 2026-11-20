/**
 * comfort — Whether a room's temperature or humidity sits within the user's thresholds (indoor
 * or outdoor ones, by floor). Shared by the temperature widget and its home tile so both judge
 * a reading the same way.
 */
import type { HumidityThresholds, TemperatureThresholds } from '../services/user';
import { isOutdoorFloor } from './floors';

/** `ok` inside the orange bounds, `warning` on or past them, `alert` past the red ones. */
export type ComfortLevel = 'ok' | 'warning' | 'alert' | 'unknown';

/** Text colour of each level, as the widget shows its figures. */
export const COMFORT_TEXT_CLASS: Record<ComfortLevel, string> = {
  ok: 'text-success',
  warning: 'text-warning',
  alert: 'text-destructive',
  unknown: 'text-muted-foreground',
};

const levelOf = (
  value: number | null,
  bounds: { minRed: number; minOrange: number; maxOrange: number; maxRed: number },
): ComfortLevel => {
  if (value === null) return 'unknown';
  if (value < bounds.minRed || value > bounds.maxRed) return 'alert';
  if (value <= bounds.minOrange || value >= bounds.maxOrange) return 'warning';
  return 'ok';
};

/**
 * Comfort of a temperature.
 *
 * @param temp - Reading in °C, or null when unknown.
 * @param floor - Floor of the sensor: an outdoor floor uses the outdoor thresholds.
 * @param t - The user's temperature thresholds.
 * @returns The comfort level.
 */
export function temperatureComfort(
  temp: number | null,
  floor: string | undefined,
  t: TemperatureThresholds,
): ComfortLevel {
  const outdoor = isOutdoorFloor(floor);
  return levelOf(temp, {
    minRed: outdoor ? t.tempOutdoorMinRed : t.tempIndoorMinRed,
    minOrange: outdoor ? t.tempOutdoorMinOrange : t.tempIndoorMinOrange,
    maxOrange: outdoor ? t.tempOutdoorMaxOrange : t.tempIndoorMaxOrange,
    maxRed: outdoor ? t.tempOutdoorMaxRed : t.tempIndoorMaxRed,
  });
}

/**
 * Comfort of a relative humidity.
 *
 * @param hum - Reading in %, or null when unknown.
 * @param floor - Floor of the sensor: an outdoor floor uses the outdoor thresholds.
 * @param h - The user's humidity thresholds.
 * @returns The comfort level.
 */
export function humidityComfort(
  hum: number | null,
  floor: string | undefined,
  h: HumidityThresholds,
): ComfortLevel {
  const outdoor = isOutdoorFloor(floor);
  return levelOf(hum, {
    minRed: outdoor ? h.humOutdoorMinRed : h.humIndoorMinRed,
    minOrange: outdoor ? h.humOutdoorMinOrange : h.humIndoorMinOrange,
    maxOrange: outdoor ? h.humOutdoorMaxOrange : h.humIndoorMaxOrange,
    maxRed: outdoor ? h.humOutdoorMaxRed : h.humIndoorMaxRed,
  });
}
