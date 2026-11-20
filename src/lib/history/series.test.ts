/** history/series tests — statistiques HA par jour, compteurs d'usage, confort, lumières par pièce. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HUM_THRESHOLDS,
  DEFAULT_TEMP_THRESHOLDS,
} from '../../context/WidgetPreferencesContext';
import { comfortHours, lightHoursByRoom, statisticDays, usageDays, usageEntities } from './series';

const rows = [
  { start: '2026-11-18T10:00:00Z', mean: 20, min: 19, max: 21, change: 0.5 },
  { start: '2026-11-18T11:00:00Z', mean: 22, min: 21, max: 24, change: 0.25 },
  { start: '2026-11-19T10:00:00Z', mean: 18, min: null, max: 18, change: 1 },
];

describe('statisticDays', () => {
  it('gathers the rows per local day', () => {
    expect(statisticDays(rows, 'mean')).toEqual([
      { date: '2026-11-18', value: 21 },
      { date: '2026-11-19', value: 18 },
    ]);
    expect(statisticDays(rows, 'min')).toEqual([{ date: '2026-11-18', value: 19 }]);
    expect(statisticDays(rows, 'max')[0].value).toBe(24);
    expect(statisticDays(rows, 'change')[0].value).toBe(0.75);
    expect(statisticDays(undefined, 'mean')).toEqual([]);
  });
});

describe('usage', () => {
  const usage = {
    washer_cycles: [{ date: '2026-11-18', value: 1 }],
    'motion:binary_sensor.aarlo_motion_jardin': [{ date: '2026-11-18', value: 3 }],
    'motion:binary_sensor.aarlo_motion_entree': [
      { date: '2026-11-17', value: 1 },
      { date: '2026-11-18', value: 2 },
    ],
    'light_hours:light.salon': [{ date: '2026-11-18', value: 4 }],
    'light_hours:light.cuisine': [{ date: '2026-11-18', value: 2 }],
    'light_hours:light.chambre': [
      { date: '2026-11-18', value: 1 },
      { date: '2026-12-01', value: 9 },
    ],
  };

  it('sums the metrics of a kind, with an entity filter', () => {
    expect(usageDays(usage, 'washer_cycles')).toEqual([{ date: '2026-11-18', value: 1 }]);
    expect(usageDays(usage, 'motion')).toEqual([
      { date: '2026-11-17', value: 1 },
      { date: '2026-11-18', value: 5 },
    ]);
    expect(usageDays(usage, 'motion', (e) => e.endsWith('jardin'))).toEqual([
      { date: '2026-11-18', value: 3 },
    ]);
    expect(usageDays(undefined, 'motion')).toEqual([]);
    expect(usageEntities(usage, 'motion')).toEqual([
      'binary_sensor.aarlo_motion_entree',
      'binary_sensor.aarlo_motion_jardin',
    ]);
    expect(usageEntities(undefined, 'motion')).toEqual([]);
  });

  it('sums the light hours per visible room over the range', () => {
    const areas: Record<string, string> = {
      'light.salon': 'Salon',
      'light.cuisine': 'Salon',
      'light.chambre': 'Chambre',
    };
    expect(
      lightHoursByRoom(
        usage,
        (id) => areas[id],
        () => false,
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual([
      { room: 'Salon', hours: 6 },
      { room: 'Chambre', hours: 1 },
    ]);
    expect(
      lightHoursByRoom(
        usage,
        (id) => areas[id],
        (room) => room === 'Salon',
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual([{ room: 'Chambre', hours: 1 }]);
    expect(
      lightHoursByRoom(
        undefined,
        () => 'X',
        () => false,
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual([]);
  });
});

describe('comfortHours', () => {
  const thresholds = { temp: DEFAULT_TEMP_THRESHOLDS, hum: DEFAULT_HUM_THRESHOLDS };

  it('counts the hours at each comfort level', () => {
    const hourly = [20, 26, 31, 14, 21].map((mean, i) => ({
      start: `2026-11-18T0${i}:00:00Z`,
      mean,
    }));
    expect(
      comfortHours([...hourly, { start: 'x', mean: null }], 'temperature', 'RdC', thresholds),
    ).toEqual({ ok: 2, warning: 1, alert: 2 });
    expect(comfortHours([{ start: 'x', mean: 50 }], 'humidity', 'RdC', thresholds)).toEqual({
      ok: 1,
      warning: 0,
      alert: 0,
    });
    expect(comfortHours(undefined, 'humidity', 'RdC', thresholds)).toEqual({
      ok: 0,
      warning: 0,
      alert: 0,
    });
  });
});
