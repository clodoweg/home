/** useHistoryData tests — fenêtres demandées au back (électricité, courbe de charge, statistiques, usages) et garde du jeton. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../../services/client';
import { server } from '../../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../../test/query-wrapper';
import { periodContaining, previousYearPeriod } from '../../lib/history/period';
import {
  useDailyUsage,
  useHAStatistics,
  useHistoryElectricity,
  useLoadCurve,
} from './useHistoryData';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));
vi.mock('../../context/UserContext', () => ({ useUserProfile: () => profile }));

const EMPTY_ENEDIS = { dailyConsumption: [], dailyMaxPower: [], loadCurve: [] };
const MONTH = periodContaining('month', new Date('2026-11-10T12:00:00'));

beforeEach(() => {
  profile.token = 'jwt';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T10:00:00+01:00'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const render = <T,>(hook: () => T) =>
  renderHook(hook, { wrapper: createQueryWrapper(createTestQueryClient()) });

describe('useHistoryData', () => {
  it('reads three years of electricity, and the load curve of a month', async () => {
    const calls: Record<string, string>[] = [];
    server.use(
      http.get(`${API_URL}/api/enedis/data`, ({ request }) => {
        calls.push(Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json(EMPTY_ENEDIS);
      }),
    );
    const electricity = render(() => useHistoryElectricity());
    const curve = render(() => useLoadCurve(MONTH));
    await waitFor(() =>
      expect(electricity.result.current.isSuccess && curve.result.current.isSuccess).toBe(true),
    );
    expect(calls).toContainEqual({
      start: '2023-11-19',
      end: '2026-11-19',
      loadCurveStart: '2026-11-19',
    });
    expect(calls).toContainEqual({
      start: '2026-11-01',
      end: '2026-12-02',
      loadCurveStart: '2026-11-01',
    });
  });

  it('never reads a load curve for a year, nor anything without a token', () => {
    const requested = vi.fn();
    server.use(
      http.get(`${API_URL}/api/enedis/data`, requested),
      http.get(`${API_URL}/api/history/usage`, requested),
    );
    render(() => useLoadCurve(periodContaining('year', new Date())));
    profile.token = null;
    render(() => useHistoryElectricity());
    render(() => useDailyUsage(MONTH, MONTH));
    expect(requested).not.toHaveBeenCalled();
  });

  it('reads the statistics of a period, and nothing without ids', async () => {
    let received: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/ha/statistics`, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.json({});
      }),
    );
    const none = render(() => useHAStatistics([], MONTH, 'day', ['mean']));
    expect(none.result.current.fetchStatus).toBe('idle');
    const stats = render(() => useHAStatistics(['sensor.a'], MONTH, 'hour', ['mean', 'max']));
    await waitFor(() => expect(stats.result.current.isSuccess).toBe(true));
    expect(received?.searchParams.get('period')).toBe('hour');
    expect(received?.searchParams.get('start')).toBe(MONTH.start.toISOString());
  });

  it('reads the usage from last year to the period shown', async () => {
    let received: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/history/usage`, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.json({});
      }),
    );
    const usage = render(() => useDailyUsage(previousYearPeriod(MONTH), MONTH));
    await waitFor(() => expect(usage.result.current.isSuccess).toBe(true));
    expect(Object.fromEntries(received?.searchParams ?? [])).toEqual({
      start: '2025-11-01',
      end: '2026-11-30',
    });
  });
});
