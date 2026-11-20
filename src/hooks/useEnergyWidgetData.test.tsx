/** useGasWidgetData / useWaterWidgetData tests — series built from the back answers and the last-day trend. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useGasWidgetData } from './useGasStats';
import { useWaterWidgetData } from './useWaterStats';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const wrapper = () => createQueryWrapper(createTestQueryClient());

beforeEach(() => {
  profile.token = 'jwt';
});

describe('useGasWidgetData', () => {
  it('builds the trend from measured days only', async () => {
    server.use(
      http.get(`${API_URL}/api/grdf`, () =>
        HttpResponse.json({
          dailyConsumption: [
            { date: '2026-10-20T00:00:00Z', value: 10, temp: 12 },
            { date: '2026-10-21T00:00:00Z', value: 20, temp: 11 },
            { date: '2026-10-22T00:00:00Z', value: 99, isEstimate: true },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useGasWidgetData(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.dayTrend).not.toBeNull());
    expect(result.current.dayTrend).toMatchObject({
      lastDay: 20,
      lastDayDate: '2026-10-21',
      prevDay: 10,
      trend: 'up',
    });
    expect(result.current.yearStats?.months).toEqual([
      { date: '2026-10', value: 129, label: 'oct.' },
    ]);
  });

  it('has no trend before the data arrives', () => {
    profile.token = null;
    const { result } = renderHook(() => useGasWidgetData(), { wrapper: wrapper() });
    expect(result.current.dayTrend).toBeNull();
    expect(result.current.weekStats).toBeNull();
  });
});

describe('useWaterWidgetData', () => {
  it('prices each day and builds the trend from days with a reading', async () => {
    server.use(
      http.get(`${API_URL}/api/suez`, () =>
        HttpResponse.json({
          price: 4,
          dailyConsumption: [
            { date: '2026-10-20T00:00:00Z', value: 200 },
            { date: '2026-10-21T00:00:00Z', value: 100 },
            { date: '2026-10-22T00:00:00Z', value: 0 },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useWaterWidgetData(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.dayTrend).not.toBeNull());
    expect(result.current.price).toBe(4);
    expect(result.current.yesterdayStats).toEqual({
      consumption: 100,
      date: '2026-10-21',
      cost: 0.4,
    });
    expect(result.current.dayTrend).toMatchObject({ lastDay: 100, prevDay: 200, trend: 'down' });
  });

  it('uses the default price when Suez sends none', async () => {
    server.use(
      http.get(`${API_URL}/api/suez`, () =>
        HttpResponse.json({ dailyConsumption: [{ date: '2026-10-20', value: 1000 }] }),
      ),
    );

    const { result } = renderHook(() => useWaterWidgetData(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.yesterdayStats).not.toBeNull());
    expect(result.current.price).toBe(2.74);
    expect(result.current.yesterdayStats?.cost).toBeCloseTo(2.74);
  });
});
