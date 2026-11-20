/** entities tests — Arlo and printer entity selection. */
import { describe, expect, it } from 'vitest';
import { isArloEntity, selectPrinterEntities } from './entities';

const entity = (entity_id: string) => ({ entity_id });

describe('isArloEntity', () => {
  it.each([
    ['camera.aarlo_jardin', true],
    ['binary_sensor.aarlo_motion_jardin', true],
    ['sensor.aarlo_last_jardin', true],
    ['camera.salon', false],
  ])('%s → %s', (id, expected) => {
    expect(isArloEntity(id)).toBe(expected);
  });
});

describe('selectPrinterEntities', () => {
  it('keeps the entities a printer lookup can match, in order', () => {
    const all = [
      entity('sensor.p1s_print_progress'),
      entity('sensor.temperature_salon'),
      entity('light.p1s_chamber_light'),
      entity('sensor.washing_machine_status'),
      entity('select.p1s_printing_speed'),
      entity('switch.p1s_speed'),
    ];
    expect(selectPrinterEntities(all).map((e) => e.entity_id)).toEqual([
      'sensor.p1s_print_progress',
      'light.p1s_chamber_light',
      // Matches a suffix: the widget itself still prefers printer ids over it.
      'sensor.washing_machine_status',
      'select.p1s_printing_speed',
    ]);
  });
});
