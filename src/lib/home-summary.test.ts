import { describe, expect, it } from 'vitest';

import type { HAState } from '../services/api';
import { groupHAStates } from './ha-groups';
import { summarizeHome, washerPhase } from './home-summary';

const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HAState =>
  ({ entity_id, state, attributes, last_changed: '', last_updated: '', context: {} }) as HAState;

const summarize = (
  states: HAState[],
  metadata: Record<string, { area: string; floor?: string; model: string }> = {},
  hiddenRooms: string[] = [],
) => {
  const groups = groupHAStates(states);
  return summarizeHome({
    ...groups,
    metadata,
    isRoomHidden: (room) => hiddenRooms.includes(room),
  });
};

describe('washerPhase', () => {
  it('follows the precedence finished, off, running, paused', () => {
    expect(washerPhase('Finished', 'on')).toBe('finished');
    expect(washerPhase('run', 'off')).toBe('off');
    expect(washerPhase('idle', 'on')).toBe('off');
    expect(washerPhase('run', 'on')).toBe('running');
    expect(washerPhase('wash', 'on')).toBe('running');
    expect(washerPhase('pause')).toBe('paused');
    expect(washerPhase('wash', undefined, 'on')).toBe('paused');
    expect(washerPhase('wash')).toBe('off');
    expect(washerPhase(undefined)).toBe('off');
  });
});

describe('summarizeHome', () => {
  it('describes an empty house without inventing devices', () => {
    expect(summarize([])).toEqual({
      lights: { on: 0, total: 0, rooms: [], onIds: [], roomList: [] },
      weather: null,
      spa: null,
      washer: null,
      printer: null,
      plugs: null,
    });
  });

  it('counts single lights, not their room group, and names the lit rooms', () => {
    const summary = summarize(
      [
        entity('light.salon', 'on'),
        entity('light.salon_lampe', 'on'),
        entity('light.salon_plafond', 'on'),
        entity('light.chambre_chevet', 'off'),
        entity('light.p1s_chamber_light', 'on'),
      ],
      {
        'light.salon': { area: 'Salon', model: 'Room' },
        'light.salon_lampe': { area: 'Salon', model: 'Bulb' },
        'light.salon_plafond': { area: 'Salon', model: 'Bulb' },
        'light.chambre_chevet': { area: 'Chambre', model: 'Bulb' },
      },
    );
    expect(summary.lights).toMatchObject({
      on: 2,
      total: 3,
      rooms: ['Salon'],
      onIds: ['light.salon_lampe', 'light.salon_plafond'],
    });
  });

  it('counts the room groups when the house exposes nothing else', () => {
    const summary = summarize([entity('light.salon', 'on'), entity('light.chambre', 'off')], {
      'light.salon': { area: 'Salon', model: 'Room' },
      'light.chambre': { area: 'Chambre', model: 'Room' },
    });
    expect(summary.lights).toMatchObject({ on: 1, total: 2, rooms: ['Salon'] });
  });

  it('lists the rooms in the user order, with what switches each fully on or off', () => {
    const groups = groupHAStates([
      // Room group off although a bulb is on: the group switches the room on, the bulb switches it off.
      entity('light.salon', 'off'),
      entity('light.salon_lampe', 'on'),
      entity('light.salon_plafond', 'off'),
      // Room group on: it switches the room off; only the dark bulb is left to light.
      entity('light.cuisine', 'on'),
      entity('light.cuisine_spot', 'on'),
      entity('light.cuisine_hotte', 'off'),
      // No group: each bulb is switched on its own.
      entity('light.bureau_a', 'on'),
      entity('light.bureau_b', 'off'),
      entity('light.cave', 'off'),
    ]);
    const { roomList } = summarizeHome({
      ...groups,
      metadata: {
        'light.salon': { area: 'Salon', floor: 'RdC', model: 'Room' },
        'light.salon_lampe': { area: 'Salon', floor: 'RdC', model: 'Bulb' },
        'light.salon_plafond': { area: 'Salon', floor: 'RdC', model: 'Bulb' },
        'light.cuisine': { area: 'Cuisine', floor: 'RdC', model: 'Room' },
        'light.cuisine_spot': { area: 'Cuisine', floor: 'RdC', model: 'Bulb' },
        'light.cuisine_hotte': { area: 'Cuisine', floor: 'RdC', model: 'Bulb' },
        'light.bureau_a': { area: 'Bureau', floor: '1er', model: 'Bulb' },
        'light.bureau_b': { area: 'Bureau', floor: '1er', model: 'Bulb' },
        'light.cave': { area: 'Cave', model: 'Bulb' },
      },
      isRoomHidden: (room) => room === 'Cave',
      roomOrder: ['Salon', 'Cuisine'],
      floorOrder: ['1er', 'RdC'],
    }).lights;

    expect(roomList).toEqual([
      { name: 'Bureau', on: true, turnOnIds: ['light.bureau_b'], turnOffIds: ['light.bureau_a'] },
      { name: 'Salon', on: true, turnOnIds: ['light.salon'], turnOffIds: ['light.salon_lampe'] },
      {
        name: 'Cuisine',
        on: true,
        turnOnIds: ['light.cuisine_hotte'],
        turnOffIds: ['light.cuisine'],
      },
    ]);
  });

  it('leaves out the lights of a room the user hid', () => {
    const summary = summarize(
      [
        entity('light.salon_lampe', 'on'),
        entity('light.garage_neon', 'on'),
        entity('light.sans_piece', 'on'),
      ],
      {
        'light.salon_lampe': { area: 'Salon', model: 'Bulb' },
        'light.garage_neon': { area: 'Garage', model: 'Bulb' },
      },
      ['Garage', 'Autres'],
    );
    expect(summary.lights).toMatchObject({
      on: 1,
      total: 1,
      rooms: ['Salon'],
      onIds: ['light.salon_lampe'],
    });
    expect(summary.lights.roomList.map((room) => room.name)).toEqual(['Salon']);
  });

  it('reads the weather', () => {
    const summary = summarize([entity('weather.home', 'cloudy', { temperature: 8 })]);
    expect(summary.weather).toEqual({
      condition: 'cloudy',
      temperature: 8,
      humidity: null,
      windSpeed: null,
    });
  });

  it('ignores a weather entity that is unavailable or malformed', () => {
    expect(summarize([entity('weather.home', 'unavailable')]).weather).toBeNull();
    expect(summarize([entity('weather.home', {} as unknown as string)]).weather).toBeNull();
    expect(summarize([entity('weather.home', 'sunny')]).weather).toEqual({
      condition: 'sunny',
      temperature: null,
      humidity: null,
      windSpeed: null,
    });
    expect(
      summarize([entity('weather.home', 'windy', { humidity: 72, wind_speed: 15 })]).weather,
    ).toMatchObject({ humidity: 72, windSpeed: 15 });
  });

  it('reads the spa thermostat and its functions', () => {
    const spa = (state: string, attributes: Record<string, unknown>, others: HAState[] = []) =>
      summarize([entity('climate.spa_thermostat', state, attributes), ...others]).spa;
    expect(spa('heat', { current_temperature: 36.5, temperature: 38 })).toEqual({
      current: 36.5,
      target: 38,
      heating: true,
      power: null,
      filter: null,
      bubbles: null,
      hasError: false,
      connectionDown: false,
    });
    expect(
      spa('off', { current_temperature: 30 }, [
        entity('switch.spa_power', 'on'),
        entity('switch.spa_filter', 'off'),
        entity('select.spa_bubbles', 'MEDIUM'),
        entity('binary_sensor.spa_errors', 'on'),
        entity('binary_sensor.spa_connected', 'off'),
      ]),
    ).toEqual({
      current: 30,
      target: null,
      heating: false,
      power: true,
      filter: false,
      bubbles: true,
      hasError: true,
      connectionDown: true,
    });
    expect(
      spa('off', { current_temperature: 30 }, [
        entity('select.spa_bubbles', 'OFF'),
        entity('switch.spa_power', 'unavailable'),
      ]),
    ).toMatchObject({ bubbles: false, power: null });
    expect(spa('unavailable', { current_temperature: 30 })).toBeNull();
    expect(spa('heat', {})).toBeNull();
  });

  it('reads the washing machine, with its remaining time while it runs', () => {
    const running = summarize([
      entity('binary_sensor.washing_machine_status', 'on'),
      entity('sensor.washing_machine_mode', 'run'),
      entity('sensor.washing_machine_remaining_time', '45'),
    ]);
    expect(running.washer).toEqual({ phase: 'running', remainingMinutes: 45, program: null });

    const withProgram = summarize([
      entity('binary_sensor.washing_machine_status', 'on'),
      entity('sensor.washing_machine_mode', 'run'),
      entity('sensor.washing_machine_program_name', 'Coton'),
    ]);
    expect(withProgram.washer?.program).toBeTruthy();

    const finished = summarize([
      entity('sensor.washing_machine_mode', 'finished'),
      entity('sensor.washing_machine_remaining_time', '3'),
    ]);
    expect(finished.washer).toEqual({ phase: 'finished', remainingMinutes: 0, program: null });

    // Without a mode the machine is off, as in its widget.
    const withoutMode = summarize([entity('binary_sensor.washing_machine_status', 'on')]);
    expect(withoutMode.washer).toEqual({ phase: 'off', remainingMinutes: 0, program: null });
  });

  it('reads the printer, without taking another appliance for it', () => {
    const printing = summarize([
      entity('sensor.p1s_print_status', 'Printing'),
      entity('sensor.p1s_print_progress', '150'),
      entity('sensor.washing_machine_status', 'run'),
    ]);
    expect(printing.printer).toEqual({
      active: true,
      progress: 100,
      statusLabel: 'En cours',
      remainingMinutes: 0,
      filename: null,
    });

    const detailed = summarize([
      entity('sensor.p1s_print_status', 'printing'),
      entity('sensor.p1s_print_progress', '65'),
      entity('sensor.p1s_remaining_time', '15', { unit_of_measurement: 'min' }),
      entity('sensor.p1s_gcode_filename', 'benchie.gcode'),
    ]);
    expect(detailed.printer).toEqual({
      active: true,
      progress: 65,
      statusLabel: 'En cours',
      remainingMinutes: 15,
      filename: 'benchie.gcode',
    });

    const idle = summarize([entity('sensor.p1s_print_status', 'idle')]);
    expect(idle.printer).toEqual({
      active: false,
      progress: 0,
      statusLabel: 'En attente',
      remainingMinutes: 0,
      filename: null,
    });

    expect(summarize([entity('sensor.p1s_print_status', 'unavailable')]).printer).toBeNull();
    expect(summarize([entity('sensor.washing_machine_status', 'run')]).printer).toBeNull();
  });

  it('lists the plugs as their widget shows them', () => {
    const summary = summarize([
      entity('switch.prise_pc', 'on'),
      entity('switch.prise_tv', 'off'),
      entity('sensor.prise_pc_puissance', '120.4'),
      entity('sensor.prise_tv_puissance', 'unavailable'),
    ]);
    expect(summary.plugs).toEqual([
      expect.objectContaining({ id: 'pc', name: 'Prise PC', on: true, watts: 120.4 }),
      expect.objectContaining({ id: 'tv', name: 'Prise TV', on: false, watts: null }),
    ]);
    expect(summary.plugs?.[0].entity.entity_id).toBe('switch.prise_pc');
    expect(summarize([entity('switch.prise_pc', 'unavailable')]).plugs).toBeNull();
  });
});
