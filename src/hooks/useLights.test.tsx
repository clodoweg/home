/** useLights tests — 50 ms action queue, batching by service, master/child resolution and scenes. */
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, type HAState } from '../services/client';
import { makeHAState } from '../test/hooks/ha-fixtures';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { groupHAStates, type HAData } from '../lib/ha-groups';
import { guessSceneBrightness, useLights } from './useLights';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const SALON = makeHAState('light.salon', 'on', { friendly_name: 'Salon', brightness: 200 });
const SALON_LAMP = makeHAState('light.salon_lampe', 'off', { friendly_name: 'Lampe' });
const SALON_GROUP = makeHAState('light.salon_grp', 'off', { friendly_name: 'Salon Group' });
const HUE_ROOM = makeHAState('light.chambre_room', 'off', { friendly_name: 'Plafond' });
const CHAMBRE = makeHAState('light.chambre', 'off', {});
const LIGHTS = [SALON, SALON_LAMP, SALON_GROUP, HUE_ROOM, CHAMBRE];
const METADATA = {
  'light.salon': { area: 'Salon', model: 'Hue bridge' },
  'light.salon_lampe': { area: 'Salon', model: 'Hue bulb' },
  'light.salon_grp': { area: 'Salon', model: 'Group' },
  'light.chambre_room': { area: 'Chambre', model: 'Room' },
  'light.chambre': { area: 'Chambre', model: 'Hue bulb' },
};

interface CallBody {
  domain: string;
  service: string;
  entity_id: string | string[];
  service_data: Record<string, unknown>;
}

let calls: CallBody[] = [];

beforeEach(() => {
  profile.token = 'jwt';
  calls = [];
  vi.useFakeTimers({ shouldAdvanceTime: true });
  server.use(
    http.get(`${API_URL}/api/ha/scenes`, () =>
      HttpResponse.json({ 'scene.configured': { brightness: 64 } }),
    ),
    http.post(`${API_URL}/api/ha/call`, async ({ request }) => {
      calls.push((await request.json()) as CallBody);
      return HttpResponse.json([]);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

/** Waits for the scene configuration so no request outlives the test. */
async function waitForScenes(client: QueryClient) {
  await waitFor(() => expect(client.getQueryData(['ha', 'scenes'])).toBeDefined());
}

/** Renders useLights over a states cache seeded with the given lights, once scenes are loaded. */
async function renderLights(
  options: Parameters<typeof useLights>[0] = { lights: LIGHTS, metadata: METADATA },
  seed: HAState[] = LIGHTS,
) {
  const client = createTestQueryClient();
  client.setQueryData<HAData>(['ha', 'states'], groupHAStates(seed));
  const view = renderHook(() => useLights(options), { wrapper: createQueryWrapper(client) });
  await waitForScenes(client);
  return { client, ...view };
}

/** Lets the 50 ms queue flush and waits for the expected number of service calls. */
async function flushQueue(expectedCalls: number) {
  await act(() => vi.advanceTimersByTimeAsync(50));
  await waitFor(() => expect(calls).toHaveLength(expectedCalls));
}

/** Reads an entity from the cached states. */
function cached(client: QueryClient, entityId: string) {
  return client.getQueryData<HAData>(['ha', 'states'])?.all.find((e) => e.entity_id === entityId);
}

describe('guessSceneBrightness', () => {
  it.each([
    ['Veilleuse', 1],
    ['Nuit calme', 1],
    ['Détente', 50],
    ['Relax', 50],
    ['Soirée', 50],
    ['Lecture', 80],
    ['Concentration', 80],
    ['Lumineux', 100],
    ['Jour', 100],
    ['Plein feu', 100],
    ['Cinéma', 50],
  ])('maps "%s" to %i %%', (name, expected) => {
    expect(guessSceneBrightness(name)).toBe(expected);
  });
});

describe('useLights queue', () => {
  it('restarts the 50 ms delay on every new action and sends them together', async () => {
    const { result } = await renderLights();

    // Steps stay well under 50 ms: shouldAdvanceTime also adds the real elapsed time.
    act(() => result.current.handleToggleLight('light.chambre'));
    await act(() => vi.advanceTimersByTimeAsync(20));
    act(() => result.current.handleToggleLight('light.salon_lampe'));
    await act(() => vi.advanceTimersByTimeAsync(20));
    expect(calls).toHaveLength(0);

    await flushQueue(1);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(calls).toEqual([
      {
        domain: 'light',
        service: 'turn_on',
        entity_id: ['light.chambre', 'light.salon_lampe'],
        service_data: {},
      },
    ]);
  });

  it('groups queued actions by service and data, and deduplicates ids', async () => {
    const onProcessed = vi.fn();
    const { result } = await renderLights({ lights: LIGHTS, metadata: METADATA, onProcessed });

    act(() => {
      result.current.handleSetBrightness('light.chambre', 0);
      result.current.handleSetBrightness('light.salon_lampe', 120);
      result.current.handleSetBrightness('light.salon_lampe', 120);
    });
    await flushQueue(2);

    expect(calls).toEqual(
      expect.arrayContaining([
        { domain: 'light', service: 'turn_off', entity_id: 'light.chambre', service_data: {} },
        {
          domain: 'light',
          service: 'turn_on',
          entity_id: 'light.salon_lampe',
          service_data: { brightness: 120 },
        },
      ]),
    );
    expect(onProcessed).toHaveBeenCalledTimes(1);
  });

  it('sends a single id as a string and applies the optimistic state', async () => {
    const { result, client } = await renderLights();

    act(() => result.current.handleSetBrightness('light.chambre', 30));
    await flushQueue(1);

    expect(calls[0].entity_id).toBe('light.chambre');
    expect(cached(client, 'light.chambre')).toMatchObject({
      state: 'on',
      attributes: { brightness: 30 },
    });
  });

  it('applies the action of a Hue room (master) to the lights of its area', async () => {
    const { result } = await renderLights();

    act(() => result.current.handleToggleLight('light.chambre_room'));
    await flushQueue(1);
    expect(calls[0]).toMatchObject({
      service: 'turn_on',
      entity_id: ['light.chambre_room', 'light.chambre'],
    });

    act(() => result.current.handleSetBrightness('light.chambre_room', 0));
    await flushQueue(2);
    expect(calls[1]).toMatchObject({
      service: 'turn_off',
      entity_id: ['light.chambre_room', 'light.chambre'],
    });
  });

  it('calls the latest onProcessed callback', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const client = createTestQueryClient();
    client.setQueryData<HAData>(['ha', 'states'], groupHAStates(LIGHTS));
    const { result, rerender } = renderHook(
      ({ onProcessed }: { onProcessed: () => void }) =>
        useLights({ lights: LIGHTS, metadata: METADATA, onProcessed }),
      { wrapper: createQueryWrapper(client), initialProps: { onProcessed: first } },
    );
    await waitForScenes(client);

    rerender({ onProcessed: second });
    act(() => result.current.handleToggleLight('light.chambre'));
    await flushQueue(1);

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).not.toHaveBeenCalled();
  });
});

describe('useLights high-level handlers', () => {
  it('handleToggleLight toggles from the effective (cached) state', async () => {
    const { result } = await renderLights(undefined, [{ ...SALON_LAMP, state: 'on' }, CHAMBRE]);

    act(() => result.current.handleToggleLight('light.salon_lampe'));
    await flushQueue(1);

    expect(calls[0]).toMatchObject({ service: 'turn_off', entity_id: 'light.salon_lampe' });
  });

  it('handleToggleLight turns on a light that is off', async () => {
    const { result } = await renderLights();

    act(() => result.current.handleToggleLight('light.chambre'));
    await flushQueue(1);

    expect(calls[0]).toMatchObject({ service: 'turn_on', entity_id: 'light.chambre' });
  });

  it('handleToggleLight ignores an unknown light', async () => {
    const { result } = await renderLights();

    act(() => result.current.handleToggleLight('light.unknown'));
    await act(() => vi.advanceTimersByTimeAsync(100));

    expect(calls).toHaveLength(0);
  });

  it('treats a light whose friendly name equals its area as master of the area', async () => {
    const { result } = await renderLights();

    act(() => result.current.handleToggleLight('light.salon'));
    await flushQueue(1);

    expect(calls[0]).toMatchObject({
      service: 'turn_off',
      entity_id: ['light.salon', 'light.salon_lampe', 'light.salon_grp'],
    });
  });

  it('treats "<area> group" and the "Room" model as masters', async () => {
    const { result } = await renderLights();

    act(() => result.current.handleSetBrightness('light.salon_grp', 77));
    await flushQueue(1);
    expect(calls[0]).toMatchObject({
      entity_id: ['light.salon_grp', 'light.salon', 'light.salon_lampe'],
      service_data: { brightness: 77 },
    });

    act(() => result.current.handleSetBrightness('light.chambre_room', 0));
    await flushQueue(2);
    expect(calls[1]).toMatchObject({
      service: 'turn_off',
      entity_id: ['light.chambre_room', 'light.chambre'],
    });
  });

  it('acts on the light alone when it is not a master or has no area', async () => {
    const { result } = await renderLights();

    act(() => result.current.handleSetBrightness('light.salon_lampe', 10));
    act(() => result.current.handleSetBrightness('light.nowhere', 10));
    await flushQueue(1);

    expect(calls[0].entity_id).toEqual(['light.salon_lampe', 'light.nowhere']);
  });

  it('works without options: no light is known and none is a master', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useLights(), { wrapper: createQueryWrapper(client) });
    await waitForScenes(client);

    act(() => result.current.handleToggleLight('light.salon'));
    act(() => result.current.handleSetBrightness('light.salon', 5));
    await flushQueue(1);

    expect(calls[0]).toMatchObject({ entity_id: 'light.salon', service_data: { brightness: 5 } });
  });

  it('reads light state and brightness through the effective value', async () => {
    const { result } = await renderLights();

    expect(result.current.getLightState(SALON)).toBe(true);
    expect(result.current.getLightState(CHAMBRE)).toBe(false);
    expect(result.current.getLightBrightness(SALON)).toBe(200);
  });
});

describe('useLights.handleActivateScene', () => {
  it('uses the configured scene brightness for the optimistic room update', async () => {
    const { result, client } = await renderLights();
    await waitFor(() =>
      expect(client.getQueryData(['ha', 'scenes'])).toEqual({
        'scene.configured': { brightness: 64 },
      }),
    );

    await act(() =>
      result.current.handleActivateScene('scene.configured', 'Nuit', ['light.chambre']),
    );

    expect(cached(client, 'light.chambre')).toMatchObject({
      state: 'on',
      attributes: { brightness: 64 },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      domain: 'scene',
      service: 'turn_on',
      entity_id: 'scene.configured',
      service_data: {},
    });
  });

  it('guesses the brightness from the scene name when it is not configured', async () => {
    const { result, client } = await renderLights();

    await act(() =>
      result.current.handleActivateScene('scene.other', 'Lecture', [
        'light.chambre',
        'light.salon_lampe',
      ]),
    );

    // 80 % of 255, rounded.
    expect(cached(client, 'light.chambre')?.attributes.brightness).toBe(204);
    expect(cached(client, 'light.salon_lampe')).toMatchObject({
      state: 'on',
      attributes: { brightness: 204 },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
  });
});
