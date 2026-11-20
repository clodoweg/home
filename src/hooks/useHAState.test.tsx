/** useHAState tests — optimistic updates, rollback, delayed invalidation and effective value reads. */
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../lib/logger';
import { API_URL, type HAState } from '../services/client';
import { makeHAState } from '../test/hooks/ha-fixtures';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { groupHAStates, type HAData } from '../lib/ha-groups';
import { useHAState } from './useHAState';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const LIGHT_A = makeHAState('light.a', 'off', { brightness: 10, color: 'red' });
const LIGHT_B = makeHAState('light.b', 'off', { brightness: 20 });
const SWITCH = makeHAState('switch.c', 'on');
const METADATA = { 'light.a': { area: 'Salon', model: 'Hue' } };

interface CallBody {
  domain: string;
  service: string;
  entity_id: string | string[];
  service_data: Record<string, unknown>;
}

let calls: CallBody[] = [];
let pendingResponses: Map<string, (status: number) => void>;

/** Serves /api/ha/call; each call waits until the test answers it with `respond(entityId, status)`. */
function serveDeferredCalls() {
  server.use(
    http.post(`${API_URL}/api/ha/call`, async ({ request }) => {
      const body = (await request.json()) as CallBody;
      calls.push(body);
      return new Promise<Response>((resolve) => {
        pendingResponses.set(JSON.stringify(body.entity_id), (status) =>
          resolve(
            status < 400
              ? HttpResponse.json([])
              : HttpResponse.json({ error: 'ha down' }, { status }),
          ),
        );
      });
    }),
  );
}

/** Answers the pending call that targets the given entity id(s). */
async function respond(entityId: string | string[], status: number) {
  const key = JSON.stringify(entityId);
  await waitFor(() => expect(pendingResponses.has(key)).toBe(true));
  pendingResponses.get(key)?.(status);
  pendingResponses.delete(key);
}

/** Renders useHAState over a client whose ['ha','states'] cache holds the given entities. */
function renderHAState(seed: HAState[] | null = [LIGHT_A, LIGHT_B, SWITCH]) {
  const client = createTestQueryClient();
  if (seed)
    client.setQueryData<HAData>(['ha', 'states'], { ...groupHAStates(seed), metadata: METADATA });
  const view = renderHook(() => useHAState(), { wrapper: createQueryWrapper(client) });
  return { client, ...view };
}

/** Reads an entity from the cached states. */
function cached(client: QueryClient, entityId: string) {
  return client.getQueryData<HAData>(['ha', 'states'])?.all.find((e) => e.entity_id === entityId);
}

beforeEach(() => {
  profile.token = 'jwt';
  calls = [];
  pendingResponses = new Map();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  serveDeferredCalls();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHAState.performAction', () => {
  it('does nothing without an entity', async () => {
    const { result } = renderHAState();

    await act(() => result.current.performAction(undefined, 'light', 'turn_on'));

    expect(calls).toHaveLength(0);
    expect(result.current.loading).toBeNull();
  });

  it('applies the optimistic state at once and keeps it after success', async () => {
    const { result, client } = renderHAState();

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'));

    await waitFor(() => expect(cached(client, 'light.a')?.state).toBe('on'));
    expect(result.current.loading).toBe('light.a');
    expect(result.current.getEffectiveValue(LIGHT_A)).toBe('on');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      domain: 'light',
      service: 'turn_on',
      entity_id: 'light.a',
      service_data: {},
    });
    expect(client.getQueryData<HAData>(['ha', 'states'])?.metadata).toEqual(METADATA);

    await respond('light.a', 200);
    await waitFor(() => expect(result.current.loading).toBeNull());
    expect(cached(client, 'light.a')?.state).toBe('on');
  });

  it('stringifies a non-string optimistic value', async () => {
    const { result, client } = renderHAState();

    await act(() => result.current.performAction(LIGHT_A, 'input_number', 'set', undefined, 42));

    await waitFor(() => expect(cached(client, 'light.a')?.state).toBe('42'));
    expect(result.current.getEffectiveValue(LIGHT_A)).toBe('42');
    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it('merges service data into the attributes without touching the state', async () => {
    const { result, client } = renderHAState();

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', { brightness: 99 }));

    await waitFor(() => expect(cached(client, 'light.a')?.attributes.brightness).toBe(99));
    expect(cached(client, 'light.a')?.state).toBe('off');
    expect(cached(client, 'light.a')?.attributes.color).toBe('red');
    expect(result.current.getEffectiveValue(LIGHT_A, 'brightness')).toBe(99);
    // No optimistic value and an attribute absent from the data: both read the cache.
    expect(result.current.getEffectiveValue(LIGHT_A)).toBe('off');
    expect(result.current.getEffectiveValue(LIGHT_A, 'color')).toBe('red');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].service_data).toEqual({ brightness: 99 });
  });

  it('sends several entities as an array and reports the first one as loading', async () => {
    const { result, client } = renderHAState();

    await act(() =>
      result.current.performAction([LIGHT_A, LIGHT_B], 'light', 'turn_on', undefined, 'on'),
    );

    await waitFor(() => expect(cached(client, 'light.b')?.state).toBe('on'));
    expect(cached(client, 'light.a')?.state).toBe('on');
    expect(cached(client, 'switch.c')?.state).toBe('on');
    expect(calls[0].entity_id).toEqual(['light.a', 'light.b']);
    expect(result.current.loading).toBe('light.a');
  });

  // An empty entity array is not guarded: the call goes out with no target and loading stays null.
  it('sends a call with an empty target for an empty entity array', async () => {
    const { result } = renderHAState();

    await act(() => result.current.performAction([], 'light', 'turn_off', undefined, 'off'));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].entity_id).toEqual([]);
    expect(result.current.loading).toBeNull();
    await respond([], 200);
  });

  it('leaves the cache untouched without optimistic value nor data', async () => {
    const { result, client } = renderHAState();
    const before = client.getQueryData(['ha', 'states']);

    await act(() => result.current.performAction(LIGHT_A, 'light', 'toggle'));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(client.getQueryData(['ha', 'states'])).toBe(before);
  });

  it('rolls back to the snapshot when the backend answers an error', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const { result, client } = renderHAState();

    await act(() =>
      result.current.performAction(LIGHT_A, 'light', 'turn_on', { brightness: 5 }, 'on'),
    );
    await waitFor(() => expect(cached(client, 'light.a')?.state).toBe('on'));

    await respond('light.a', 500);

    await waitFor(() => expect(cached(client, 'light.a')?.state).toBe('off'));
    expect(cached(client, 'light.a')?.attributes.brightness).toBe(10);
    expect(result.current.loading).toBeNull();
    expect(warn).toHaveBeenCalledWith('Rolling back entities', ['light.a']);
  });

  it('warns and writes nothing when it fails without a cached snapshot', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const { result, client } = renderHAState(null);

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'));
    await respond('light.a', 500);

    await waitFor(() => expect(warn).toHaveBeenCalledWith('No previous data to rollback to'));
    expect(client.getQueryData(['ha', 'states'])).toBeUndefined();
  });

  it('fails without any request when there is no token, and rolls back', async () => {
    profile.token = null;
    const { result, client } = renderHAState();

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'));

    await waitFor(() => expect(result.current.loading).toBeNull());
    expect(cached(client, 'light.a')?.state).toBe('off');
    expect(calls).toHaveLength(0);
  });
});

describe('useHAState.getEffectiveValue', () => {
  it('returns null without an entity', () => {
    const { result } = renderHAState();
    expect(result.current.getEffectiveValue(undefined)).toBeNull();
  });

  it('prefers the cached entity over the one passed in', () => {
    const { result } = renderHAState();
    const stale = makeHAState('light.a', 'on', { brightness: 255 });

    expect(result.current.getEffectiveValue(stale)).toBe('off');
    expect(result.current.getEffectiveValue(stale, 'brightness')).toBe(10);
  });

  it('falls back to the entity passed in when it is not cached', () => {
    const { result } = renderHAState(null);
    const lamp = makeHAState('light.z', 'on', { brightness: 3 });

    expect(result.current.getEffectiveValue(lamp)).toBe('on');
    expect(result.current.getEffectiveValue(lamp, 'brightness')).toBe(3);
  });

  it('ignores a pending mutation that targets another entity', async () => {
    const { result } = renderHAState();

    await act(() =>
      result.current.performAction(LIGHT_B, 'light', 'turn_on', { brightness: 1 }, 'on'),
    );
    await waitFor(() => expect(result.current.loading).toBe('light.b'));
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(result.current.getEffectiveValue(LIGHT_A)).toBe('off');
    expect(result.current.getEffectiveValue(LIGHT_A, 'brightness')).toBe(10);
  });
});

describe('useHAState helpers', () => {
  it('keeps its action callbacks between renders, so memoized widgets do not re-render', () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(() => useHAState(), {
      wrapper: createQueryWrapper(client),
    });
    const first = result.current;

    rerender();

    expect(result.current.performAction).toBe(first.performAction);
    expect(result.current.applyOptimisticUpdate).toBe(first.applyOptimisticUpdate);
    expect(result.current.getEffectiveValue).toBe(first.getEffectiveValue);
  });

  it('applyOptimisticUpdate sets states and `<id>_attr_<name>` attributes of listed entities', () => {
    const { result, client } = renderHAState();

    act(() =>
      result.current.applyOptimisticUpdate({
        'light.a': 'on',
        'light.a_attr_brightness': 128,
        'light.b': true,
      }),
    );

    expect(cached(client, 'light.a')).toMatchObject({
      state: 'on',
      attributes: { brightness: 128, color: 'red' },
    });
    expect(cached(client, 'light.b')).toMatchObject({
      state: 'true',
      attributes: { brightness: 20 },
    });
    expect(cached(client, 'switch.c')).toBe(SWITCH);
    expect(client.getQueryData<HAData>(['ha', 'states'])?.lights).toHaveLength(2);
    expect(client.getQueryData<HAData>(['ha', 'states'])?.metadata).toEqual(METADATA);
  });

  it('applyOptimisticUpdate ignores attribute keys of entities without a state update', () => {
    const { result, client } = renderHAState();

    act(() => result.current.applyOptimisticUpdate({ 'light.b_attr_brightness': 1 }));

    expect(cached(client, 'light.b')).toBe(LIGHT_B);
  });

  it('applyOptimisticUpdate does nothing without cached states', () => {
    const { result, client } = renderHAState(null);

    act(() => result.current.applyOptimisticUpdate({ 'light.a': 'on' }));

    expect(client.getQueryData(['ha', 'states'])).toBeUndefined();
  });
});

describe('fixed bugs (regressions)', () => {
  it('B11: a failing action keeps the optimistic state of a later action', async () => {
    const { result, client } = renderHAState();

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'));
    await waitFor(() => expect(cached(client, 'light.a')?.state).toBe('on'));
    await act(() => result.current.performAction(LIGHT_B, 'light', 'turn_on', undefined, 'on'));
    await waitFor(() => expect(cached(client, 'light.b')?.state).toBe('on'));

    await respond('light.a', 500);
    await waitFor(() => expect(cached(client, 'light.a')?.state).toBe('off'));

    expect(cached(client, 'light.b')?.state).toBe('on');
  });

  it('B11: invalidates the states 2 s after the mutation settles', async () => {
    const { result, client } = renderHAState();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'));
    await respond('light.a', 200);
    await waitFor(() => expect(result.current.loading).toBeNull());

    await vi.advanceTimersByTimeAsync(2_100);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ha', 'states'] });
  });
});

describe('useHAState across widgets', () => {
  it("reports as loading only the widget's own action", async () => {
    const client = createTestQueryClient();
    client.setQueryData<HAData>(['ha', 'states'], {
      ...groupHAStates([LIGHT_A, SWITCH]),
      metadata: METADATA,
    });
    const { result } = renderHook(() => ({ lights: useHAState(), alarm: useHAState() }), {
      wrapper: createQueryWrapper(client),
    });

    await act(() =>
      result.current.lights.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'),
    );
    await waitFor(() => expect(result.current.lights.loading).toBe('light.a'));

    expect(result.current.alarm.loading).toBeNull();
    // The optimistic value is shared: every widget shows the pending state.
    expect(result.current.alarm.getEffectiveValue(LIGHT_A)).toBe('on');
    await respond('light.a', 200);
  });

  it('does not refetch the states while another action is still in flight', async () => {
    const { result, client } = renderHAState();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(() => result.current.performAction(LIGHT_A, 'light', 'turn_on', undefined, 'on'));
    await act(() => result.current.performAction(LIGHT_B, 'light', 'turn_on', undefined, 'on'));
    await respond('light.a', 200);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(invalidate).not.toHaveBeenCalled();

    await respond('light.b', 200);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ha', 'states'] });
  });
});
