/**
 * Mock Home Assistant states for testing.
 * Covers all entity types used across the dashboard widgets.
 */

export interface MockHAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

// ── Lights ───────────────────────────────────────────────────────────────────────

export const LIGHT_STATES: MockHAState[] = [
  {
    entity_id: 'light.salon',
    state: 'on',
    attributes: {
      friendly_name: 'Salon',
      brightness: 200,
      color_mode: 'brightness',
      supported_features: 1,
    },
    last_changed: '2026-02-25T06:00:00Z',
    last_updated: '2026-02-25T06:00:00Z',
  },
  {
    entity_id: 'light.chambre',
    state: 'off',
    attributes: {
      friendly_name: 'Chambre',
      brightness: 0,
      color_mode: 'brightness',
      supported_features: 1,
    },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'light.cuisine',
    state: 'on',
    attributes: {
      friendly_name: 'Cuisine',
      brightness: 255,
      color_mode: 'brightness',
      supported_features: 1,
    },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
];

// ── Alarm ────────────────────────────────────────────────────────────────────────

export const ALARM_STATES: MockHAState[] = [
  {
    entity_id: 'alarm_control_panel.alarme_maison',
    state: 'armed_away',
    attributes: {
      friendly_name: 'Alarme Maison',
      code_arm_required: false,
      supported_features: 3,
    },
    last_changed: '2026-02-25T00:00:00Z',
    last_updated: '2026-02-25T00:00:00Z',
  },
];

// ── Temperature / Climate ────────────────────────────────────────────────────────

const CLIMATE_STATES: MockHAState[] = [
  {
    entity_id: 'climate.salon',
    state: 'heat',
    attributes: {
      friendly_name: 'Thermostat Salon',
      temperature: 21,
      current_temperature: 20.5,
      hvac_modes: ['heat', 'off'],
      min_temp: 7,
      max_temp: 30,
    },
    last_changed: '2026-02-25T06:00:00Z',
    last_updated: '2026-02-25T06:00:00Z',
  },
  {
    entity_id: 'climate.chambre',
    state: 'heat',
    attributes: {
      friendly_name: 'Thermostat Chambre',
      temperature: 19,
      current_temperature: 18.8,
      hvac_modes: ['heat', 'off'],
      min_temp: 7,
      max_temp: 30,
    },
    last_changed: '2026-02-25T05:30:00Z',
    last_updated: '2026-02-25T05:30:00Z',
  },
];

// ── Sensors ──────────────────────────────────────────────────────────────────────

const SENSOR_STATES: MockHAState[] = [
  {
    entity_id: 'sensor.temperature_salon',
    state: '20.5',
    attributes: {
      friendly_name: 'Température Salon',
      unit_of_measurement: '°C',
      device_class: 'temperature',
    },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
  {
    entity_id: 'sensor.temperature_chambre',
    state: '18.8',
    attributes: {
      friendly_name: 'Température Chambre',
      unit_of_measurement: '°C',
      device_class: 'temperature',
    },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
  {
    entity_id: 'sensor.humidity_salon',
    state: '45',
    attributes: {
      friendly_name: 'Humidité Salon',
      unit_of_measurement: '%',
      device_class: 'humidity',
    },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
  {
    entity_id: 'sensor.prise_pc_puissance',
    state: '120',
    attributes: { friendly_name: 'Puissance PC', unit_of_measurement: 'W', device_class: 'power' },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
  {
    entity_id: 'sensor.prise_tv_puissance',
    state: '0',
    attributes: { friendly_name: 'Puissance TV', unit_of_measurement: 'W', device_class: 'power' },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
  {
    entity_id: 'sensor.prise_pc_consommation',
    state: '1.5',
    attributes: { friendly_name: 'Conso PC', unit_of_measurement: 'kWh', device_class: 'energy' },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
  {
    entity_id: 'sensor.prise_tv_consommation',
    state: '0.2',
    attributes: { friendly_name: 'Conso TV', unit_of_measurement: 'kWh', device_class: 'energy' },
    last_changed: '2026-02-25T06:30:00Z',
    last_updated: '2026-02-25T06:30:00Z',
  },
];

// ── Plugs (switches) ────────────────────────────────────────────────────────────

const SWITCH_STATES: MockHAState[] = [
  {
    entity_id: 'switch.prise_pc',
    state: 'on',
    attributes: {
      friendly_name: 'Prise Bureau',
      current_power_w: 120,
    },
    last_changed: '2026-02-25T06:00:00Z',
    last_updated: '2026-02-25T06:00:00Z',
  },
  {
    entity_id: 'switch.prise_tv',
    state: 'off',
    attributes: {
      friendly_name: 'Prise TV',
      current_power_w: 0,
    },
    last_changed: '2026-02-25T04:00:00Z',
    last_updated: '2026-02-25T04:00:00Z',
  },
];

// ── Weather ──────────────────────────────────────────────────────────────────────

export const WEATHER_STATES: MockHAState[] = [
  {
    entity_id: 'weather.maison',
    state: 'cloudy',
    attributes: {
      friendly_name: 'Météo Maison',
      temperature: 8,
      humidity: 72,
      pressure: 1013,
      wind_speed: 15,
      wind_bearing: 230,
      forecast: [
        { datetime: '2026-02-25T12:00:00Z', condition: 'cloudy', temperature: 10, templow: 3 },
        { datetime: '2026-02-26T12:00:00Z', condition: 'sunny', temperature: 12, templow: 4 },
        { datetime: '2026-02-27T12:00:00Z', condition: 'rainy', temperature: 9, templow: 5 },
      ],
    },
    last_changed: '2026-02-25T06:00:00Z',
    last_updated: '2026-02-25T06:00:00Z',
  },
];

// ── Washing machine (not in ALL_HA_STATES: opt-in per spec) ─────────────────────

const washingMachineState = (entity_id: string, state: string): MockHAState => ({
  entity_id,
  state,
  attributes: {},
  last_changed: '2026-02-25T06:00:00Z',
  last_updated: '2026-02-25T06:00:00Z',
});

export const WASHING_MACHINE_STATES: MockHAState[] = [
  washingMachineState('binary_sensor.washing_machine_status', 'on'),
  washingMachineState('sensor.washing_machine_mode', 'run'),
  washingMachineState('sensor.washing_machine_program_name', 'Coton'),
  washingMachineState('sensor.washing_machine_remaining_time', '45'),
  washingMachineState('button.washing_machine_get_programs_details', 'unknown'),
  washingMachineState('button.washing_machine_get_settings_details', 'unknown'),
];

// ── Camera ───────────────────────────────────────────────────────────────────────

const CAMERA_STATES: MockHAState[] = [
  {
    entity_id: 'camera.aarlo_jardin',
    state: 'idle',
    attributes: {
      friendly_name: 'Arlo Jardin',
      entity_picture: '/api/camera_proxy/camera.aarlo_jardin',
    },
    last_changed: '2026-02-25T06:00:00Z',
    last_updated: '2026-02-25T06:00:00Z',
  },
];

// ── Spa ──────────────────────────────────────────────────────────────────────────

const SPA_STATES: MockHAState[] = [
  {
    entity_id: 'climate.spa_thermostat',
    state: 'heat',
    attributes: {
      friendly_name: 'Spa Thermostat',
      temperature: 38,
      current_temperature: 36.5,
      hvac_modes: ['heat', 'off'],
    },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'switch.spa_power',
    state: 'on',
    attributes: { friendly_name: 'Spa Power' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'switch.spa_filter',
    state: 'on',
    attributes: { friendly_name: 'Spa Filter' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'select.spa_bubbles',
    state: 'off',
    attributes: { friendly_name: 'Spa Bubbles', options: ['off', 'low', 'high'] },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'binary_sensor.spa_errors',
    state: 'off',
    attributes: { friendly_name: 'Spa Errors' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'binary_sensor.spa_connected',
    state: 'on',
    attributes: { friendly_name: 'Spa Connected' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
];

// ── Bambu Lab ────────────────────────────────────────────────────────────────────

const BAMBU_LAB_STATES: MockHAState[] = [
  {
    entity_id: 'sensor.p1s_01p00c000000001_print_status',
    state: 'printing',
    attributes: { friendly_name: 'P1S Print Status' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_print_progress',
    state: '65',
    attributes: { friendly_name: 'P1S Print Progress', unit_of_measurement: '%' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_current_layer',
    state: '180',
    attributes: { friendly_name: 'P1S Current Layer' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_total_layer_count',
    state: '250',
    attributes: { friendly_name: 'P1S Total Layer Count' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_remaining_time',
    state: '15',
    attributes: { friendly_name: 'P1S Remaining Time', unit_of_measurement: 'min' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_gcode_filename',
    state: 'benchie_boat.gcode',
    attributes: { friendly_name: 'P1S Gcode Filename' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_nozzle_temperature',
    state: '220',
    attributes: { friendly_name: 'P1S Nozzle Temperature', unit_of_measurement: '°C' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_nozzle_target_temperature',
    state: '220',
    attributes: { friendly_name: 'P1S Nozzle Target Temperature', unit_of_measurement: '°C' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_bed_temperature',
    state: '60',
    attributes: { friendly_name: 'P1S Bed Temperature', unit_of_measurement: '°C' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_bed_target_temperature',
    state: '60',
    attributes: { friendly_name: 'P1S Bed Target Temperature', unit_of_measurement: '°C' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'sensor.p1s_01p00c000000001_chamber_temperature',
    state: '38',
    attributes: { friendly_name: 'P1S Chamber Temperature', unit_of_measurement: '°C' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'light.p1s_01p00c000000001_chamber_light',
    state: 'on',
    attributes: { friendly_name: 'P1S Chamber Light' },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
  {
    entity_id: 'select.p1s_01p00c000000001_printing_speed',
    state: 'standard',
    attributes: {
      friendly_name: 'P1S Printing Speed',
      options: ['silent', 'standard', 'sport', 'ludicrous'],
    },
    last_changed: '2026-02-25T05:00:00Z',
    last_updated: '2026-02-25T05:00:00Z',
  },
];

// ── Combined ─────────────────────────────────────────────────────────────────────

export const ALL_HA_STATES: MockHAState[] = [
  ...LIGHT_STATES,
  ...ALARM_STATES,
  ...CLIMATE_STATES,
  ...SENSOR_STATES,
  ...SWITCH_STATES,
  ...WEATHER_STATES,
  ...CAMERA_STATES,
  ...SPA_STATES,
  ...BAMBU_LAB_STATES,
];
