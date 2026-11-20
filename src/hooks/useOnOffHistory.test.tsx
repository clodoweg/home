/** useOnOffHistory tests — on/off states as 1/0 steps, sorted, and no request without an entity. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useOnOffHistory } from './useOnOffHistory';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const render = (entityId: string | undefined, enabled = true) =>
  renderHook(() => useOnOffHistory(entityId, enabled), {
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

beforeEach(() => {
  profile.token = 'jwt';
});

describe('useOnOffHistory', () => {
  it('maps "on" to 1 and anything else to 0, oldest first', async () => {
    server.use(
      http.get(`${API_URL}/api/ha/history`, () =>
        HttpResponse.json([
          [
            { state: 'on', last_changed: '2026-10-26T10:00:00Z' },
            { state: 'unavailable', last_changed: '2026-10-26T09:00:00Z' },
            { state: 'off', last_changed: '2026-10-26T08:00:00Z' },
          ],
        ]),
      ),
    );

    const { result } = render('light.salon');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((step) => step.state)).toEqual([0, 0, 1]);
  });

  it.each([
    ['without an entity', undefined, true],
    ['while the chart is hidden', 'light.salon', false],
  ])('does not ask %s', (_, entityId, enabled) => {
    const requested = vi.fn();
    server.use(http.get(`${API_URL}/api/ha/history`, requested));

    const { result } = render(entityId, enabled);

    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).not.toHaveBeenCalled();
  });
});
