/** useHAData tests — entity grouping helpers, states/metadata merge, token gating, polling and focus refetch. */
import { focusManager } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_HA_STATES } from '../../e2e/fixtures/mock-data/ha-states';
import { API_URL, type HAState } from '../services/client';
import { makeHAState } from '../test/hooks/ha-fixtures';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useHAData } from './useHAData';
import { groupHAStates, isHueLight, sortAlarms } from '../lib/ha-groups';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const STATES: HAState[] = [
  makeHAState('light.salon', 'on'),
  makeHAState('sensor.temp', '21'),
  makeHAState('binary_sensor.door', 'off'),
  makeHAState('scene.soir', 'scening'),
  makeHAState('weather.maison', 'sunny'),
  makeHAState('alarm_control_panel.garage', 'disarmed'),
  makeHAState('alarm_control_panel.somfy_home', 'armed_away'),
  makeHAState('switch.prise', 'on'),
];

const METADATA = { 'light.salon': { area: 'Salon', model: 'Hue' } };

let statesRequests = 0;
let metadataRequests = 0;

/** Serves the states and metadata endpoints and counts the requests. */
function serveHA(states: HAState[] = STATES, metadata: object = METADATA) {
  server.use(
    http.get(`${API_URL}/api/ha/states`, () => {
      statesRequests += 1;
      return HttpResponse.json(states);
    }),
    http.get(`${API_URL}/api/ha/metadata`, () => {
      metadataRequests += 1;
      return HttpResponse.json(metadata);
    }),
  );
}

beforeEach(() => {
  profile.token = 'jwt';
  statesRequests = 0;
  metadataRequests = 0;
});

afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

describe('sortAlarms', () => {
  it('puts Somfy alarms first, matched by entity id or friendly name', () => {
    const plain = makeHAState('alarm_control_panel.garage', 'disarmed');
    const byId = makeHAState('alarm_control_panel.somfy', 'disarmed');
    const byName = makeHAState('alarm_control_panel.x', 'disarmed', { friendly_name: 'My SOMFY' });

    expect(sortAlarms([plain, byId]).map((a) => a.entity_id)).toEqual([
      'alarm_control_panel.somfy',
      'alarm_control_panel.garage',
    ]);
    expect(sortAlarms([byName, plain])[0]).toBe(byName);
    expect(sortAlarms([byId, byName])).toEqual([byId, byName]);
  });

  it('returns a new array and leaves the input untouched', () => {
    const input = [makeHAState('alarm_control_panel.a', 'x')];
    const output = sortAlarms(input);
    expect(output).not.toBe(input);
    expect(output).toEqual(input);
  });
});

describe('isHueLight', () => {
  it('accepts plain lights', () => {
    expect(isHueLight(makeHAState('light.salon', 'on'))).toBe(true);
  });

  it.each([
    'light.bambu_lab',
    'light.p1s_123',
    'light.x1c_123',
    'light.p1p_123',
    'light.a1_mini',
    'light.foo_chamber_light',
    'light.foo_lumiere_de_la_chambre',
    'light.foo_printer_light',
    'light.P1S_UPPER',
  ])('rejects the printer light %s', (entityId) => {
    expect(isHueLight(makeHAState(entityId, 'on'))).toBe(false);
  });

  it.each(['light.a1lampe_salon', 'light.p1pendant_cuisine'])(
    'B30: keeps the home light %s whose name starts like a printer model',
    (entityId) => {
      expect(isHueLight(makeHAState(entityId, 'on'))).toBe(true);
    },
  );

  it('rejects non-light entities and malformed input', () => {
    expect(isHueLight(makeHAState('switch.salon', 'on'))).toBe(false);
    expect(isHueLight(undefined as unknown as HAState)).toBe(false);
    expect(isHueLight({ entity_id: 42 } as unknown as HAState)).toBe(false);
  });
});

describe('groupHAStates', () => {
  it('splits entities by domain with an empty metadata map', () => {
    const grouped = groupHAStates(STATES);

    expect(grouped.all).toBe(STATES);
    expect(grouped.lights.map((s) => s.entity_id)).toEqual(['light.salon']);
    expect(grouped.sensors.map((s) => s.entity_id)).toEqual(['sensor.temp', 'binary_sensor.door']);
    expect(grouped.scenes.map((s) => s.entity_id)).toEqual(['scene.soir']);
    expect(grouped.weather.map((s) => s.entity_id)).toEqual(['weather.maison']);
    expect(grouped.alarms.map((s) => s.entity_id)).toEqual([
      'alarm_control_panel.somfy_home',
      'alarm_control_panel.garage',
    ]);
    expect(grouped.metadata).toEqual({});
  });

  it('excludes the Bambu Lab chamber light of the E2E fixture from lights', () => {
    const grouped = groupHAStates(ALL_HA_STATES as HAState[]);

    expect(grouped.lights.map((s) => s.entity_id)).toEqual([
      'light.salon',
      'light.chambre',
      'light.cuisine',
    ]);
  });
});

describe('useHAData', () => {
  it('returns grouped states merged with entity metadata', async () => {
    serveHA();
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.data?.metadata).toEqual(METADATA));
    expect(result.current.data?.lights.map((s) => s.entity_id)).toEqual(['light.salon']);
    expect(result.current.data).toBeDefined();
    expect(client.getQueryData(['ha', 'states'])).toMatchObject({ metadata: {} });
  });

  it('exposes the states with an empty metadata map while metadata is still loading', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/states`, () => HttpResponse.json(STATES)),
      http.get(`${API_URL}/api/ha/metadata`, () => new Promise<Response>(() => {})),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAData(), { wrapper: createQueryWrapper(client) });

    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.metadata).toEqual({});
  });

  it('fetches nothing without a token', () => {
    profile.token = null;
    serveHA();
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAData(), { wrapper: createQueryWrapper(client) });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(statesRequests).toBe(0);
    expect(metadataRequests).toBe(0);
  });

  it('surfaces a states error', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/states`, () =>
        HttpResponse.json({ error: 'boom', code: 'X' }, { status: 500 }),
      ),
      http.get(`${API_URL}/api/ha/metadata`, () => HttpResponse.json({})),
    );
    const client = createTestQueryClient();

    const { result } = renderHook(() => useHAData(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error?.message).toBe('Error 500: boom');
    expect(result.current.data).toBeUndefined();
  });

  it('polls states every 30 s, but not metadata, when autoRefresh is on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveHA();
    const client = createTestQueryClient();

    renderHook(() => useHAData(true), { wrapper: createQueryWrapper(client) });
    await waitFor(() => expect(statesRequests).toBe(1));

    await vi.advanceTimersByTimeAsync(30_000);
    await waitFor(() => expect(statesRequests).toBe(2));
    await vi.advanceTimersByTimeAsync(30_000);
    await waitFor(() => expect(statesRequests).toBe(3));
    expect(metadataRequests).toBe(1);
  });

  it('does not poll when autoRefresh is off and it is the only observer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveHA();
    const client = createTestQueryClient();

    renderHook(() => useHAData(false), { wrapper: createQueryWrapper(client) });
    await waitFor(() => expect(statesRequests).toBe(1));

    await vi.advanceTimersByTimeAsync(90_000);
    expect(statesRequests).toBe(1);
  });

  // TanStack semantics: each observer keeps its own interval. Bug B05 is a consumer mounting
  // useHAData(true) next to the dashboard's manual mode (SecurityMonitor, removed in lot 4).
  it('keeps polling for an autoRefresh=false observer when another observer polls', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveHA();
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useHAData(true), { wrapper });
    const quiet = renderHook(() => useHAData(false), { wrapper });
    await waitFor(() => expect(statesRequests).toBe(1));
    const firstUpdate = quiet.result.current.dataUpdatedAt;

    await vi.advanceTimersByTimeAsync(30_000);
    await waitFor(() => expect(statesRequests).toBe(2));
    await waitFor(() => expect(quiet.result.current.dataUpdatedAt).toBeGreaterThan(firstUpdate));
  });

  describe('fixed bugs (regressions)', () => {
    it('B20: does not refetch states on window focus', async () => {
      serveHA();
      const client = createTestQueryClient();

      const { result } = renderHook(() => useHAData(false), {
        wrapper: createQueryWrapper(client),
      });
      await waitFor(() => expect(result.current.data).toBeDefined());
      const query = client.getQueryCache().find({ queryKey: ['ha', 'states'] });

      expect(query?.observers[0].options.refetchOnWindowFocus).toBe(false);
    });
  });
});
