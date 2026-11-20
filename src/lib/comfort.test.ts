/** comfort.test — Comfort levels of temperatures and humidities against the user's thresholds. */
import { describe, expect, it } from 'vitest';
import type { HumidityThresholds, TemperatureThresholds } from '../services/user';
import { humidityComfort, temperatureComfort } from './comfort';

const TEMP: TemperatureThresholds = {
  tempIndoorMinRed: 15,
  tempIndoorMinOrange: 18,
  tempIndoorMaxOrange: 25,
  tempIndoorMaxRed: 30,
  tempOutdoorMinRed: 0,
  tempOutdoorMinOrange: 10,
  tempOutdoorMaxOrange: 28,
  tempOutdoorMaxRed: 32,
};
const HUM: HumidityThresholds = {
  humIndoorMinRed: 30,
  humIndoorMinOrange: 40,
  humIndoorMaxOrange: 60,
  humIndoorMaxRed: 70,
  humOutdoorMinRed: 20,
  humOutdoorMinOrange: 30,
  humOutdoorMaxOrange: 85,
  humOutdoorMaxRed: 95,
};

describe('temperatureComfort', () => {
  it.each([
    [21, 'ok'],
    [18, 'warning'],
    [25, 'warning'],
    [14.9, 'alert'],
    [30.1, 'alert'],
  ] as const)('rates %s° indoors as %s', (temp, level) => {
    expect(temperatureComfort(temp, 'RdC', TEMP)).toBe(level);
  });

  it('uses the outdoor thresholds on an outdoor floor', () => {
    expect(temperatureComfort(5, 'Extérieur', TEMP)).toBe('warning');
    expect(temperatureComfort(5, 'RdC', TEMP)).toBe('alert');
  });

  it('is unknown without a reading', () => {
    expect(temperatureComfort(null, 'RdC', TEMP)).toBe('unknown');
  });
});

describe('humidityComfort', () => {
  it('rates indoor and outdoor humidity with their own thresholds', () => {
    expect(humidityComfort(50, undefined, HUM)).toBe('ok');
    expect(humidityComfort(65, undefined, HUM)).toBe('warning');
    expect(humidityComfort(75, undefined, HUM)).toBe('alert');
    expect(humidityComfort(75, 'Exterieur', HUM)).toBe('ok');
    expect(humidityComfort(null, undefined, HUM)).toBe('unknown');
  });
});
