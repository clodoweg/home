/** useDashboardWidgets tests — id → widget map: permission gating, data wiring and per-widget error isolation. */
import { render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HAState, PetKitData } from '../services/api';
import { crashingWidgets } from '../test/context/widget-stub';
import { useDashboardWidgets } from './useDashboardWidgets';
import { selectPrinterEntities } from '../constants/entities';

// The error card (Card) reads the theme.
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: () => {}, setTheme: () => {} }),
}));

vi.mock('../components/widgets/AlarmWidget', async () => ({
  AlarmWidget: (await import('../test/context/widget-stub')).stubWidget('Alarm'),
}));
vi.mock('../components/widgets/ElectricityWidget', async () => ({
  ElectricityWidget: (await import('../test/context/widget-stub')).stubWidget('Electricity'),
}));
vi.mock('../components/widgets/GasWidget', async () => ({
  GasWidget: (await import('../test/context/widget-stub')).stubWidget('Gas'),
}));
vi.mock('../components/widgets/WaterWidget', async () => ({
  WaterWidget: (await import('../test/context/widget-stub')).stubWidget('Water'),
}));
vi.mock('../components/widgets/SpaWidget', async () => ({
  SpaWidget: (await import('../test/context/widget-stub')).stubWidget('Spa'),
}));
vi.mock('../components/widgets/ClimateWidget', async () => ({
  ClimateWidget: (await import('../test/context/widget-stub')).stubWidget('Climate'),
}));
vi.mock('../components/widgets/PlugsWidget', async () => ({
  PlugsWidget: (await import('../test/context/widget-stub')).stubWidget('Plugs'),
}));
vi.mock('../components/widgets/LightsWidget', async () => ({
  LightsWidget: (await import('../test/context/widget-stub')).stubWidget('Lights'),
}));
vi.mock('../components/widgets/TemperatureWidget', async () => ({
  TemperatureWidget: (await import('../test/context/widget-stub')).stubWidget('Temperature'),
}));
vi.mock('../components/widgets/WeatherWidget', async () => ({
  WeatherWidget: (await import('../test/context/widget-stub')).stubWidget('Weather'),
}));
vi.mock('../components/widgets/ArloWidget', async () => ({
  ArloWidget: (await import('../test/context/widget-stub')).stubWidget('Arlo'),
}));
vi.mock('../components/widgets/petkit/FeederWidget', async () => ({
  FeederWidget: (await import('../test/context/widget-stub')).stubWidget('Feeder'),
}));
vi.mock('../components/widgets/petkit/FountainWidget', async () => ({
  FountainWidget: (await import('../test/context/widget-stub')).stubWidget('Fountain'),
}));
vi.mock('../components/widgets/WashingMachineWidget', async () => ({
  WashingMachineWidget: (await import('../test/context/widget-stub')).stubWidget('WashingMachine'),
}));
vi.mock('../components/widgets/BambuLabWidget', async () => ({
  BambuLabWidget: (await import('../test/context/widget-stub')).stubWidget('BambuLab'),
}));

type Args = Parameters<typeof useDashboardWidgets>[0];
type Element = React.ReactElement<{ widgetName?: string; children?: React.ReactNode }>;

const entity = (entity_id: string, state = 'on'): HAState => ({
  entity_id,
  state,
  attributes: {},
  last_changed: '2026-03-15T10:00:00Z',
  last_updated: '2026-03-15T10:00:00Z',
  context: {},
});

const WIDGET_IDS = [
  'alarm',
  'electricity',
  'gas',
  'water',
  'spa',
  'plugs',
  'lights',
  'temperature',
  'weather',
  'arlo',
  'feeder',
  'fountain',
  'climate',
  'washing_machine',
  'bambu_lab',
];

const buildArgs = (overrides: Partial<Args> = {}): Args => {
  const all = [
    entity('switch.somfy_home_alarm_siren', 'off'),
    entity('climate.spa_thermostat', 'heat'),
    entity('switch.spa_power'),
    entity('switch.spa_filter'),
    entity('select.spa_bubbles', 'low'),
    entity('binary_sensor.spa_errors', 'off'),
    entity('camera.jardin'),
  ];
  return {
    haAll: [
      ...all,
      entity('binary_sensor.spa_connected'),
      entity('switch.prise_pc'),
      entity('switch.prise_tv', 'off'),
      entity('sensor.prise_pc_puissance', '120'),
      entity('sensor.prise_tv_puissance', '0'),
      entity('sensor.prise_pc_consommation', '3.2'),
      entity('sensor.prise_tv_consommation', '1.1'),
      entity('sensor.washing_machine_mode', 'eco'),
      entity('binary_sensor.washing_machine_status', 'on'),
      entity('button.washing_machine_get_programs_details', 'unknown'),
    ],
    all,
    lights: [entity('light.salon')],
    sensors: [entity('sensor.salon_temperature', '21')],
    scenes: [entity('scene.soiree')],
    alarms: [entity('alarm_control_panel.maison', 'disarmed'), entity('alarm_control_panel.b')],
    weather: [entity('weather.maison', 'sunny'), entity('weather.other')],
    metadata: { 'light.salon': { area: 'Salon', model: 'Hue' } },
    petkit: { devices: [] } as unknown as PetKitData,
    petkitLoading: false,
    profileLoading: false,
    stableRights: { history: true, cameras: true },
    lightsActions: {
      onToggle: vi.fn(),
      onSetBrightness: vi.fn(),
      onActivateScene: vi.fn(async () => {}),
      getLightState: vi.fn(() => true),
      getLightBrightness: vi.fn(() => 100),
    },
    refreshAll: vi.fn(),
    refreshTrigger: 3,
    ...overrides,
  };
};

/** Props given to the widget wrapped by the error boundary of `id`. */
const widgetProps = (map: Record<string, React.ReactNode>, id: string) => {
  const boundary = map[id] as Element;
  return (boundary.props.children as React.ReactElement<Record<string, unknown>>).props;
};

const boundaryName = (map: Record<string, React.ReactNode>, id: string) =>
  (map[id] as Element).props.widgetName;

const Grid = ({ args }: { args: Args }) => {
  const widgets = useDashboardWidgets(args);
  return (
    <>
      {Object.entries(widgets).map(([id, node]) => (
        <section key={id}>{node}</section>
      ))}
    </>
  );
};

beforeEach(() => {
  crashingWidgets.clear();
});

afterEach(() => {
  crashingWidgets.clear();
});

describe('useDashboardWidgets', () => {
  it('builds every widget, each in its error boundary, with full rights and data', () => {
    const args = buildArgs();
    const { result } = renderHook(() => useDashboardWidgets(args));
    const map = result.current;

    expect(Object.keys(map)).toEqual(WIDGET_IDS);
    expect(WIDGET_IDS.map((id) => boundaryName(map, id))).toEqual([
      'Alarm',
      'Electricity',
      'Gas',
      'Water',
      'Spa',
      'Plugs',
      'Lights',
      'Temperature',
      'Weather',
      'Arlo',
      'PetKit Feeder',
      'PetKit Fountain',
      'Climate',
      'Lave-linge',
      'Imprimante 3D',
    ]);
  });

  it('keeps the entity lists of the widgets when a poll changes nothing they show', () => {
    const args = buildArgs();
    const { result, rerender } = renderHook((props: Args) => useDashboardWidgets(props), {
      initialProps: args,
    });
    const before = result.current;

    // A new poll: same entities in new arrays, one unrelated entity changed.
    const poll = (list: Args['all']) =>
      list.map((e) => (e.entity_id === 'switch.spa_power' ? { ...e, state: 'off' } : e));
    rerender({ ...args, all: poll(args.all), haAll: poll(args.haAll ?? []) });

    for (const id of ['arlo', 'climate', 'washing_machine', 'bambu_lab']) {
      const key = id === 'washing_machine' || id === 'bambu_lab' ? 'data' : 'entities';
      expect(widgetProps(result.current, id)[key]).toBe(widgetProps(before, id)[key]);
    }
  });

  it('wires each widget to its entities', () => {
    const args = buildArgs();
    const { result } = renderHook(() => useDashboardWidgets(args));
    const map = result.current;
    const byId = (id: string) => args.haAll?.find((e) => e.entity_id === id);

    expect(widgetProps(map, 'alarm')).toEqual({
      entity: args.alarms[0],
      showHistory: true,
      siren: byId('switch.somfy_home_alarm_siren'),
    });
    expect(widgetProps(map, 'spa')).toEqual({
      climate: byId('climate.spa_thermostat'),
      power: byId('switch.spa_power'),
      filter: byId('switch.spa_filter'),
      bubbles: byId('select.spa_bubbles'),
      error: byId('binary_sensor.spa_errors'),
      connected: byId('binary_sensor.spa_connected'),
      showHistory: true,
    });
    expect(widgetProps(map, 'plugs')).toEqual({
      plugPC: byId('switch.prise_pc'),
      plugTV: byId('switch.prise_tv'),
      powerPC: byId('sensor.prise_pc_puissance'),
      powerTV: byId('sensor.prise_tv_puissance'),
      energyPC: byId('sensor.prise_pc_consommation'),
      energyTV: byId('sensor.prise_tv_consommation'),
    });
    expect(widgetProps(map, 'lights')).toEqual({
      lights: args.lights,
      scenes: args.scenes,
      metadata: args.metadata,
      ...args.lightsActions,
      showHistory: true,
    });
    expect(widgetProps(map, 'temperature')).toEqual({
      data: args.sensors,
      metadata: args.metadata,
      showHistory: true,
    });
    expect(widgetProps(map, 'weather')).toEqual({ entity: args.weather[0] });
    // Each widget gets only its entities, so a change elsewhere does not re-render it.
    expect(widgetProps(map, 'arlo')).toEqual({
      entities: args.all.filter((e) => /aarlo_/.test(e.entity_id)),
      onRefresh: args.refreshAll,
      refreshTrigger: 3,
    });
    expect(widgetProps(map, 'feeder')).toEqual({
      data: args.petkit,
      loading: false,
      onRefresh: args.refreshAll,
    });
    expect(widgetProps(map, 'fountain')).toEqual({ data: args.petkit, loading: false });
    expect(widgetProps(map, 'climate')).toEqual({
      entities: args.all.filter((e) => e.entity_id.startsWith('climate.')),
      metadata: args.metadata,
      showHistory: true,
    });
    // B08: the refresh buttons (`button.*`) must reach the widget, not only the sensors.
    expect(widgetProps(map, 'washing_machine')).toEqual({
      data: args.haAll!.filter((e) => e.entity_id.includes('.washing_machine_')),
    });
    expect(
      (widgetProps(map, 'washing_machine').data as { entity_id: string }[]).map((e) => e.entity_id),
    ).toContain('button.washing_machine_get_programs_details');
    expect(widgetProps(map, 'bambu_lab')).toEqual({ data: selectPrinterEntities(args.all) });
    expect(widgetProps(map, 'electricity')).toEqual({});
  });

  it('drops the energy widgets and the history links without the history right', () => {
    const args = buildArgs({ stableRights: { history: false, cameras: true } });
    const { result } = renderHook(() => useDashboardWidgets(args));
    const map = result.current;

    expect(map.electricity).toBeNull();
    expect(map.gas).toBeNull();
    expect(map.water).toBeNull();
    expect(map.arlo).not.toBeNull();
    for (const id of ['alarm', 'spa', 'lights', 'temperature', 'climate']) {
      expect(widgetProps(map, id).showHistory).toBe(false);
    }
  });

  it('drops the cameras without the cameras right', () => {
    const args = buildArgs({ stableRights: { history: true, cameras: false } });
    const { result } = renderHook(() => useDashboardWidgets(args));

    expect(result.current.arlo).toBeNull();
    expect(result.current.electricity).not.toBeNull();
  });

  it('drops the alarm and the weather without their entity', () => {
    const args = buildArgs({ alarms: [], weather: [] });
    const { result } = renderHook(() => useDashboardWidgets(args));

    expect(result.current.alarm).toBeNull();
    expect(result.current.weather).toBeNull();
  });

  it('leaves the spa link and the plugs empty before the first full HA load', () => {
    const args = buildArgs({ haAll: undefined, all: [] });
    const { result } = renderHook(() => useDashboardWidgets(args));

    expect(widgetProps(result.current, 'spa').connected).toBeUndefined();
    expect(widgetProps(result.current, 'spa').power).toBeUndefined();
    expect(Object.values(widgetProps(result.current, 'plugs'))).toEqual(
      new Array(6).fill(undefined),
    );
    expect(widgetProps(result.current, 'alarm').siren).toBeUndefined();
  });

  it.each([
    [true, false, true],
    [false, true, true],
    [false, false, false],
  ])(
    'shows Petkit as loading when profile loading=%s or petkit loading=%s',
    (profileLoading, petkitLoading, loading) => {
      const args = buildArgs({ profileLoading, petkitLoading });
      const { result } = renderHook(() => useDashboardWidgets(args));

      expect(widgetProps(result.current, 'feeder').loading).toBe(loading);
      expect(widgetProps(result.current, 'fountain').loading).toBe(loading);
    },
  );

  it('keeps the same map while the inputs are unchanged', () => {
    const args = buildArgs();
    const { result, rerender } = renderHook((props: Args) => useDashboardWidgets(props), {
      initialProps: args,
    });
    const first = result.current;

    rerender({ ...args });
    expect(result.current).toBe(first);

    rerender({ ...args, refreshTrigger: 4 });
    expect(result.current).not.toBe(first);
    expect(widgetProps(result.current, 'arlo').refreshTrigger).toBe(4);
  });

  it('isolates a crashing widget behind its error boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    crashingWidgets.add('Spa');

    render(<Grid args={buildArgs()} />);

    expect(screen.getByText('Erreur: Spa')).toBeInTheDocument();
    expect(screen.getByText('Spa exploded')).toBeInTheDocument();
    expect(screen.getByTestId('widget-stub-Plugs')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^widget-stub-/)).toHaveLength(14);
  });
});
