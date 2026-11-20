/** ArloWidget tests — automatic snapshots happen on open and on refresh only, never on a poll. */
import { act, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw-server';
import { API_URL, type HAState } from '../../services/client';
import { ArloWidget } from './ArloWidget';

vi.mock('../../context/UserContext', () => ({
  useUserProfile: () => ({ token: 'jwt', refreshToken: async () => 'jwt' }),
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}));

vi.mock('../../context/WidgetPreferencesContext', () => ({
  useWidgetPreferences: () => ({ isCollapsed: () => false, setCollapsed: () => {} }),
}));

const camera = (lastUpdated: string): HAState => ({
  entity_id: 'camera.aarlo_jardin',
  state: 'idle',
  attributes: { friendly_name: 'Jardin' },
  last_changed: lastUpdated,
  last_updated: lastUpdated,
  context: {},
});

const sensor = (value: number): HAState => ({
  entity_id: 'sensor.temperature_salon',
  state: String(value),
  attributes: {},
  last_changed: '2026-10-23T10:00:00Z',
  last_updated: '2026-10-23T10:00:00Z',
  context: {},
});

let snapshots: string[];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  snapshots = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:cam', revokeObjectURL: vi.fn() }),
  );
  server.use(
    http.post(`${API_URL}/api/arlo/snapshot/:entityId`, ({ params }) => {
      snapshots.push(String(params.entityId));
      return HttpResponse.json({ success: true });
    }),
    http.get(`${API_URL}/api/camera_proxy_image/:entityId`, () =>
      HttpResponse.arrayBuffer(new ArrayBuffer(4), { headers: { 'Content-Type': 'image/jpeg' } }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ArloWidget automatic snapshots', () => {
  it('takes one snapshot on open and none on later polls (B03)', async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <ArloWidget entities={[camera('t0'), sensor(20)]} onRefresh={onRefresh} refreshTrigger={0} />,
    );
    await vi.waitFor(() => expect(snapshots).toHaveLength(1));

    // Ten 30 s polls, each with a changed entity (a new `entities` array).
    for (let poll = 1; poll <= 10; poll++) {
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      rerender(
        <ArloWidget
          entities={[camera('t0'), sensor(20 + poll)]}
          onRefresh={onRefresh}
          refreshTrigger={0}
        />,
      );
    }
    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(snapshots).toHaveLength(1);
  });

  it('takes a new snapshot when the dashboard is refreshed', async () => {
    const entities = [camera('t0')];
    const { rerender } = render(
      <ArloWidget entities={entities} onRefresh={vi.fn()} refreshTrigger={0} />,
    );
    await vi.waitFor(() => expect(snapshots).toHaveLength(1));

    await act(() => vi.advanceTimersByTimeAsync(31_000));
    rerender(<ArloWidget entities={entities} onRefresh={vi.fn()} refreshTrigger={1} />);

    await vi.waitFor(() => expect(snapshots).toHaveLength(2));
  });

  it('refreshes the images even when one camera fails to take its snapshot', async () => {
    server.use(
      http.post(`${API_URL}/api/arlo/snapshot/:entityId`, ({ params }) =>
        params.entityId === 'camera.aarlo_garage'
          ? HttpResponse.json({ error: 'Failed to trigger snapshot' }, { status: 502 })
          : HttpResponse.json({ success: true }),
      ),
    );
    const onRefresh = vi.fn();
    const garage = { ...camera('t0'), entity_id: 'camera.aarlo_garage' };

    render(
      <ArloWidget entities={[camera('t0'), garage]} onRefresh={onRefresh} refreshTrigger={0} />,
    );

    await act(() => vi.advanceTimersByTimeAsync(3_500));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
