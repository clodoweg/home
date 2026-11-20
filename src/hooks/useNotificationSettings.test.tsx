/** useNotificationSettings tests — saved settings land in the cache; no save without a session. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { queryKeys } from '../lib/query-keys';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useSaveNotificationSettings } from './useNotificationSettings';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const SETTINGS = { telegramChatId: '42', notificationPreferences: { spa: false } };

beforeEach(() => {
  profile.token = 'jwt';
});

describe('useSaveNotificationSettings', () => {
  it('puts the saved settings in the cache', async () => {
    server.use(http.post(`${API_URL}/api/user/preferences`, () => HttpResponse.json({})));
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSaveNotificationSettings(), {
      wrapper: createQueryWrapper(client),
    });

    await act(() => result.current.mutateAsync(SETTINGS));

    expect(client.getQueryData(queryKeys.user.notifications)).toEqual(SETTINGS);
  });

  it('refuses to save without a session', async () => {
    profile.token = null;
    const { result } = renderHook(() => useSaveNotificationSettings(), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });

    await act(() => expect(result.current.mutateAsync(SETTINGS)).rejects.toThrow('No token'));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
