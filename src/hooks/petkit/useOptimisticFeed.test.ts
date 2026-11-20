/** useOptimisticFeed tests — optimistic feed entry, rollback on failure and absorption by the real record. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../../services/client';
import type { PetKitData } from '../../services/api';
import { server } from '../../test/msw-server';
import { useOptimisticFeed } from './useOptimisticFeed';

const NOW = new Date('2026-10-23T12:00:00+02:00');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const DEVICE = { id: 100000001, deviceType: 'D4sh' };

interface FeedBody {
  deviceId: number;
  amount1: number;
  amount2: number;
}

let bodies: FeedBody[] = [];

/** Serves the manual feed endpoint with the given response. */
function serveFeed(response: () => Response | Promise<Response>) {
  server.use(
    http.post(`${API_URL}/api/petkit/feed`, async ({ request }) => {
      bodies.push((await request.json()) as FeedBody);
      return response();
    }),
  );
}

type Args = Parameters<typeof useOptimisticFeed>[0];

/** Renders the hook with rerenderable props. */
function renderFeed(initial: Args) {
  return renderHook((props: Args) => useOptimisticFeed(props), { initialProps: initial });
}

const withRecords = (records: unknown[]) => ({ devices: [], records }) as unknown as PetKitData;

beforeEach(() => {
  bodies = [];
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useOptimisticFeed', () => {
  it('does nothing without device or token', async () => {
    serveFeed(() => HttpResponse.json({ success: true }));
    const noDevice = renderFeed({ device: undefined, token: 'jwt', data: null });
    const noToken = renderFeed({ device: DEVICE, token: null, data: null });

    await act(() => noDevice.result.current.handleFeed());
    await act(() => noToken.result.current.handleFeed());

    expect(bodies).toHaveLength(0);
    expect(noDevice.result.current.pendingFeedings).toEqual([]);
    expect(noToken.result.current.isFeeding).toBe(false);
  });

  it('shows an optimistic one-plus-one ration while feeding and keeps it on success', async () => {
    let release: (() => void) | undefined;
    serveFeed(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(HttpResponse.json({ success: true }));
        }),
    );
    const { result } = renderFeed({ device: DEVICE, token: 'jwt', data: null });

    let feeding: Promise<void> | undefined;
    act(() => {
      feeding = result.current.handleFeed();
    });

    expect(result.current.isFeeding).toBe(true);
    expect(result.current.pendingFeedings).toHaveLength(1);
    expect(result.current.pendingFeedings[0]).toMatchObject({
      deviceId: DEVICE.id,
      deviceType: 'D4sh',
      day: 20261023,
      amount1: 1,
      amount2: 1,
      time: NOW_SEC,
      type: 4,
      state: { realAmount1: 1, realAmount2: 1 },
    });
    expect(result.current.pendingFeedings[0].id).toMatch(new RegExp(`^opt_${NOW_SEC}_`));

    await waitFor(() => expect(release).toBeDefined());
    await act(async () => {
      release?.();
      await feeding;
    });

    expect(bodies).toEqual([{ deviceId: DEVICE.id, amount1: 1, amount2: 1 }]);
    expect(result.current.isFeeding).toBe(false);
    expect(result.current.pendingFeedings).toHaveLength(1);
  });

  it('removes the optimistic entry when the backend answers an error', async () => {
    serveFeed(() => HttpResponse.json({ error: 'offline' }, { status: 502 }));
    const { result } = renderFeed({ device: DEVICE, token: 'jwt', data: null });

    await act(() => result.current.handleFeed());

    expect(bodies).toHaveLength(1);
    expect(result.current.pendingFeedings).toEqual([]);
    expect(result.current.isFeeding).toBe(false);
  });

  it('absorbs the optimistic entry once a matching real record shows up', async () => {
    serveFeed(() => HttpResponse.json({ success: true }));
    const { result, rerender } = renderFeed({ device: DEVICE, token: 'jwt', data: null });
    await act(() => result.current.handleFeed());
    expect(result.current.pendingFeedings).toHaveLength(1);

    rerender({
      device: DEVICE,
      token: 'jwt',
      data: withRecords([
        { type: 3, time: NOW_SEC, amount1: 1, amount2: 1 },
        { type: 4, time: NOW_SEC + 400, amount1: 1, amount2: 1 },
        { type: 5, time: NOW_SEC + 60, amount1: 2, amount2: 1 },
      ]),
    });
    expect(result.current.pendingFeedings).toHaveLength(1);

    rerender({
      device: DEVICE,
      token: 'jwt',
      data: withRecords([{ type: 5, time: NOW_SEC + 299, amount1: 1, amount2: 1 }]),
    });
    await waitFor(() => expect(result.current.pendingFeedings).toEqual([]));
  });

  describe('fixed bugs (regressions)', () => {
    it('B32: does not bring back a confirmed feed once its record leaves the data window', async () => {
      serveFeed(() => HttpResponse.json({ success: true }));
      const { result, rerender } = renderFeed({ device: DEVICE, token: 'jwt', data: null });
      await act(() => result.current.handleFeed());
      rerender({
        device: DEVICE,
        token: 'jwt',
        data: withRecords([{ type: 4, time: NOW_SEC + 10, amount1: 1, amount2: 1 }]),
      });
      await waitFor(() => expect(result.current.pendingFeedings).toEqual([]));

      // Days later, the back's rolling window no longer holds the real record.
      await act(() => vi.advanceTimersByTimeAsync(8 * 24 * 60 * 60 * 1000));
      rerender({ device: DEVICE, token: 'jwt', data: withRecords([]) });

      expect(result.current.pendingFeedings).toEqual([]);
    });

    it('B02: keeps the optimistic entry when the backend answers { message }', async () => {
      serveFeed(() => HttpResponse.json({ message: 'Feed triggered' }));
      const { result } = renderFeed({ device: DEVICE, token: 'jwt', data: null });

      await act(() => result.current.handleFeed());

      expect(result.current.pendingFeedings).toHaveLength(1);
    });
  });
});
