import { describe, expect, it } from 'vitest';

import type { HAState } from '../services/api';
import { listTemperatureSensors } from './temperature-sensors';

const sensor = (
  entity_id: string,
  state: string,
  device_class: string,
  friendly_name?: string,
): HAState =>
  ({
    entity_id,
    state,
    attributes: { device_class, friendly_name },
    last_changed: '',
    last_updated: '',
    context: {},
  }) as HAState;

const METADATA = {
  'sensor.salon_t': { area: 'Salon', floor: 'RdC', model: 'Aqara' },
  'sensor.salon_h': { area: 'Salon', floor: 'RdC', model: 'Aqara' },
  'sensor.chambre_t': { area: 'Chambre', floor: '1er', model: 'Aqara' },
  'sensor.garage_t': { area: 'Garage', floor: 'RdC', model: 'Sonoff' },
};

const DATA = [
  sensor('sensor.chambre_t', '18.84', 'temperature', 'Température'),
  sensor('sensor.salon_t', '20.5', 'temperature', 'Température'),
  sensor('sensor.salon_h', '45.4', 'humidity'),
  sensor('sensor.garage_t', '12', 'temperature', 'Température'),
  sensor('sensor.cave_t', '0', 'temperature'),
  sensor('sensor.grenier_t', 'unavailable', 'temperature'),
  sensor('sensor.prise_puissance', '120', 'power'),
];

const list = (overrides: Partial<Parameters<typeof listTemperatureSensors>[0]> = {}) =>
  listTemperatureSensors({
    data: DATA,
    metadata: METADATA,
    isSensorHidden: () => false,
    isRoomHidden: () => false,
    roomOrder: [],
    floorOrder: [],
    ...overrides,
  });

describe('listTemperatureSensors', () => {
  it('lists one row per usable temperature sensor, paired with its humidity', () => {
    const rows = list();
    expect(rows.map((row) => row.tempId).sort()).toEqual([
      'sensor.chambre_t',
      'sensor.garage_t',
      'sensor.salon_t',
    ]);
    expect(rows.find((row) => row.tempId === 'sensor.salon_t')).toEqual({
      name: 'Salon',
      area: 'Salon',
      floor: 'RdC',
      temp: 20.5,
      humidity: 45,
      tempId: 'sensor.salon_t',
      humId: 'sensor.salon_h',
    });
    expect(rows.find((row) => row.tempId === 'sensor.chambre_t')).toMatchObject({
      temp: 18.8,
      humidity: null,
      humId: null,
    });
  });

  it('leaves out a hidden sensor and a hidden room', () => {
    const rows = list({
      isSensorHidden: (id) => id === 'sensor.chambre_t',
      isRoomHidden: (room) => room === 'Garage',
    });
    expect(rows.map((row) => row.tempId)).toEqual(['sensor.salon_t']);
  });

  it('keeps the temperature but drops the humidity when only the humidity sensor is hidden', () => {
    const rows = list({ isSensorHidden: (id) => id === 'sensor.salon_h' });
    expect(rows.find((row) => row.tempId === 'sensor.salon_t')?.humidity).toBeNull();
  });

  it("follows the user's floor and room order", () => {
    const rows = list({ floorOrder: ['1er', 'RdC'], roomOrder: ['Garage', 'Salon'] });
    expect(rows.map((row) => row.area)).toEqual(['Chambre', 'Garage', 'Salon']);
  });

  it('names a sensor after itself and tells two alike apart by their model', () => {
    const rows = listTemperatureSensors({
      data: [
        sensor('sensor.a', '20', 'temperature', 'Température fenêtre'),
        sensor('sensor.b', '21', 'temperature', 'Temperature'),
        sensor('sensor.c', '22', 'temperature', 'Température'),
        sensor('sensor.d', '23', 'temperature'),
      ],
      metadata: {
        'sensor.a': { area: 'Salon', model: 'Aqara' },
        'sensor.b': { area: 'Salon', model: 'Aqara' },
        'sensor.c': { area: 'Salon', model: 'Sonoff' },
      },
      isSensorHidden: () => false,
      isRoomHidden: () => false,
      roomOrder: [],
      floorOrder: [],
    });
    const names = Object.fromEntries(rows.map((row) => [row.tempId, row.name]));
    expect(names).toEqual({
      'sensor.a': 'Fenêtre',
      'sensor.b': 'Salon (Aqara)',
      'sensor.c': 'Salon (Sonoff)',
      'sensor.d': 'Sensor.d',
    });
  });
});
