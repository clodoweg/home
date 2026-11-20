/** useWeatherForecast tests — forecast read from the back, attribute fallback when it fails. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { makeHAState } from '../test/hooks/ha-fixtures';
import { useWeatherForecast } from './useWeatherForecast';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const FORECAST_URL = `${API_URL}/api/ha/forecast`;
const DAY = { datetime: '2026-10-27T00:00:00Z', condition: 'sunny', temperature: 18 };

const render = (attributes: Record<string, unknown> = {}, type: 'daily' | 'hourly' = 'daily') =>
  renderHook(() => useWeatherForecast(makeHAState('weather.home', 'sunny', attributes), type), {
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

beforeEach(() => {
  profile.token = 'jwt';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useWeatherForecast', () => {
  it('asks the back for the entity and granularity', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(FORECAST_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json([DAY]);
      }),
    );

    const { result } = render();

    await waitFor(() => expect(result.current.data).toEqual([DAY]));
    expect(query?.get('entity_id')).toBe('weather.home');
    expect(query?.get('type')).toBe('daily');
  });

  it('falls back to the forecast attribute when the back fails', async () => {
    server.use(http.get(FORECAST_URL, () => HttpResponse.json({ error: 'HA' }, { status: 502 })));

    const { result } = render({ forecast: [DAY] });

    await waitFor(() => expect(result.current.data).toEqual([DAY]));
  });

  it('fails when the back fails and the entity has no forecast', async () => {
    server.use(http.get(FORECAST_URL, () => HttpResponse.json({ error: 'HA' }, { status: 502 })));

    const { result } = render({ forecast: [] });

    // Two retries (1 s then 2 s apart) before the error shows.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
  });

  it('never serves the daily attribute as an hourly forecast', async () => {
    server.use(http.get(FORECAST_URL, () => HttpResponse.json({ error: 'HA' }, { status: 502 })));

    const { result } = render({ forecast: [DAY] }, 'hourly');

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBeUndefined();
  });

  it('does not ask while the widget is collapsed', () => {
    const requested = vi.fn();
    server.use(http.get(FORECAST_URL, requested));

    const { result } = renderHook(
      () => useWeatherForecast(makeHAState('weather.home', 'sunny'), 'daily', false),
      { wrapper: createQueryWrapper(createTestQueryClient()) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).not.toHaveBeenCalled();
  });

  it('does not ask without a session', () => {
    profile.token = null;
    const { result } = render();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
