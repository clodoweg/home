/** useAlertNotifications tests — admin gating, push refresh and the optimistic "mark all read". */
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUSH_RECEIVED_MESSAGE } from '../lib/alert-notifications';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useAlertNotifications } from './useAlertNotifications';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null, isAdmin: true }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const LIST_URL = `${API_URL}/api/notifications`;
const READ_URL = `${API_URL}/api/notifications/read`;

const alert = (id: number, read: boolean) => ({
  id,
  category: 'alarm',
  title: 'Alarme',
  body: `Alerte ${id}`,
  createdAt: '2026-11-16T08:00:00.000Z',
  read,
});

const serviceWorker = new EventTarget();

beforeEach(() => {
  profile.isAdmin = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

const renderAlerts = () =>
  renderHook(() => useAlertNotifications(), {
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

describe('useAlertNotifications', () => {
  it('lists the alerts and the unread count for an admin', async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json({ notifications: [alert(2, false), alert(1, true)], unread: 1 }),
      ),
    );
    const { result } = renderAlerts();
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current).toMatchObject({ enabled: true, unread: 1, isLoading: false });
  });

  it('asks nothing for a non-admin', () => {
    profile.isAdmin = false;
    const requested = vi.fn();
    server.use(http.get(LIST_URL, requested));
    const { result } = renderAlerts();
    expect(result.current).toMatchObject({
      enabled: false,
      notifications: [],
      unread: 0,
      isLoading: false,
    });
    expect(requested).not.toHaveBeenCalled();
  });

  it('refreshes when the service worker reports a push', async () => {
    let list = { notifications: [alert(1, true)], unread: 0 };
    server.use(http.get(LIST_URL, () => HttpResponse.json(list)));
    const { result } = renderAlerts();
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    list = { notifications: [alert(2, false), alert(1, true)], unread: 1 };
    act(() => {
      serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'other' } }));
      serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: PUSH_RECEIVED_MESSAGE } }),
      );
    });
    await waitFor(() => expect(result.current.unread).toBe(1));
  });

  it('marks everything read at once', async () => {
    let list = { notifications: [alert(2, false)], unread: 1 };
    server.use(
      http.get(LIST_URL, () => HttpResponse.json(list)),
      http.post(READ_URL, () => {
        list = { notifications: [alert(2, true)], unread: 0 };
        return HttpResponse.json({ updated: 1 });
      }),
    );
    const { result } = renderAlerts();
    await waitFor(() => expect(result.current.unread).toBe(1));

    act(() => result.current.markAllRead());
    await waitFor(() => expect(result.current.unread).toBe(0));
    expect(result.current.notifications[0].read).toBe(true);
  });

  it('puts the unread alerts back when saving fails', async () => {
    let saveAttempts = 0;
    server.use(
      http.get(LIST_URL, () => HttpResponse.json({ notifications: [alert(2, false)], unread: 1 })),
      http.post(READ_URL, () => {
        saveAttempts += 1;
        return HttpResponse.json({ error: 'down' }, { status: 500 });
      }),
    );
    const { result } = renderAlerts();
    await waitFor(() => expect(result.current.unread).toBe(1));

    act(() => result.current.markAllRead());
    await waitFor(() => expect(saveAttempts).toBe(1));
    await waitFor(() => expect(result.current.unread).toBe(1));
    expect(result.current.notifications[0].read).toBe(false);
  });
});
