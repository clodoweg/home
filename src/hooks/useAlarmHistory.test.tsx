/** useAlarmHistory tests — alarm states mapped to timeline levels, sorted, and gated by token and rights. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { alarmLevel, useAlarmHistory } from './useAlarmHistory';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const render = (enabled = true) =>
  renderHook(() => useAlarmHistory('alarm_control_panel.maison', enabled), {
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

beforeEach(() => {
  profile.token = 'jwt';
});

describe('alarmLevel', () => {
  it.each([
    ['triggered', 3],
    ['armed_night', 2],
    ['armed_home', 2],
    ['armed_away', 1],
    ['disarmed', 0],
    ['arming', 0],
    ['unavailable', -1],
    ['unknown', -1],
  ])('%s → %i', (state, level) => {
    expect(alarmLevel(state)).toBe(level);
  });
});

describe('useAlarmHistory', () => {
  it('returns the 24 h of steps, oldest first', async () => {
    let entityId: string | null = null;
    server.use(
      http.get(`${API_URL}/api/ha/history`, ({ request }) => {
        entityId = new URL(request.url).searchParams.get('entity_id');
        return HttpResponse.json([
          [
            { state: 'armed_away', last_changed: '2026-10-26T10:00:00Z' },
            { state: 'disarmed', last_changed: '2026-10-26T08:00:00Z' },
          ],
        ]);
      }),
    );

    const { result } = render();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(entityId).toBe('alarm_control_panel.maison');
    expect(result.current.data).toEqual([
      { timestamp: Date.parse('2026-10-26T08:00:00Z'), state: 0 },
      { timestamp: Date.parse('2026-10-26T10:00:00Z'), state: 1 },
    ]);
  });

  it.each([
    ['without a session', null, true],
    ['without the history right', 'jwt', false],
  ])('does not ask %s', (_, token, enabled) => {
    profile.token = token;
    const requested = vi.fn();
    server.use(http.get(`${API_URL}/api/ha/history`, requested));

    const { result } = render(enabled);

    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).not.toHaveBeenCalled();
  });
});
