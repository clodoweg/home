/** usePushSubscription tests — key decoding, detected status, and the enable / disable switch. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { urlBase64ToUint8Array, usePushSubscription } from './usePushSubscription';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null, isAdmin: true }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const ENDPOINT = 'https://push.example/abc';

/** A fake browser with service worker, PushManager and Notification. */
const installPush = ({
  permission = 'default' as NotificationPermission,
  granted = 'granted' as NotificationPermission,
  subscribed = false,
} = {}) => {
  let current: PushSubscription | null = null;
  const makeSubscription = () =>
    ({
      endpoint: ENDPOINT,
      toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }),
      unsubscribe: vi.fn(async () => {
        current = null;
        return true;
      }),
    }) as unknown as PushSubscription;
  if (subscribed) current = makeSubscription();
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = makeSubscription();
      return current;
    }),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager }) },
    configurable: true,
  });
  Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true });
  const NotificationStub = {
    permission,
    requestPermission: vi.fn(async () => {
      NotificationStub.permission = granted;
      return granted;
    }),
  };
  Object.defineProperty(window, 'Notification', { value: NotificationStub, configurable: true });
  return { pushManager, NotificationStub };
};

const calls: [string, unknown][] = [];

beforeEach(() => {
  profile.token = 'jwt';
  profile.isAdmin = true;
  calls.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.get(`${API_URL}/api/push/public-key`, () => HttpResponse.json({ publicKey: 'AQID' })),
    http.post(`${API_URL}/api/push/subscription`, async ({ request }) => {
      calls.push(['subscription', await request.json()]);
      return HttpResponse.json({ subscribed: true }, { status: 201 });
    }),
    http.post(`${API_URL}/api/push/unsubscribe`, async ({ request }) => {
      calls.push(['unsubscribe', await request.json()]);
      return HttpResponse.json({ removed: 1 });
    }),
  );
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(window, 'PushManager');
  Reflect.deleteProperty(window, 'Notification');
});

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url key without padding', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([0xfb, 0xff]);
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3]);
  });
});

describe('usePushSubscription', () => {
  it('is unsupported without the push APIs', () => {
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.status).toBe('unsupported');
  });

  it('is denied when the site is blocked', () => {
    installPush({ permission: 'denied' });
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.status).toBe('denied');
  });

  it('detects an existing subscription', async () => {
    installPush({ permission: 'granted', subscribed: true });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('subscribed'));
  });

  it('subscribes this browser and registers it with the back', async () => {
    const { pushManager } = installPush();
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('unsubscribed'));

    await act(() => result.current.enable());

    expect(result.current.status).toBe('subscribed');
    expect(result.current.busy).toBe(false);
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(calls).toEqual([
      ['subscription', { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }],
    ]);
  });

  it('stays off when the user refuses the permission', async () => {
    const { pushManager } = installPush({ granted: 'denied' });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('unsubscribed'));
    await act(() => result.current.enable());
    expect(result.current.status).toBe('denied');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('stays off when the permission prompt is dismissed', async () => {
    installPush({ granted: 'default' });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('unsubscribed'));
    await act(() => result.current.enable());
    expect(result.current.status).toBe('unsubscribed');
  });

  it('is unsupported when the back has no push key', async () => {
    installPush();
    server.use(
      http.get(`${API_URL}/api/push/public-key`, () => HttpResponse.json({ publicKey: null })),
    );
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('unsubscribed'));
    await act(() => result.current.enable());
    expect(result.current.status).toBe('unsupported');
  });

  it('keeps its status when the subscription fails', async () => {
    const { pushManager } = installPush();
    pushManager.subscribe.mockRejectedValueOnce(new Error('push service down'));
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('unsubscribed'));
    await act(() => result.current.enable());
    expect(result.current).toMatchObject({ status: 'unsubscribed', busy: false });
  });

  it('unsubscribes this browser and tells the back', async () => {
    installPush({ permission: 'granted', subscribed: true });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('subscribed'));

    await act(() => result.current.disable());

    expect(result.current.status).toBe('unsubscribed');
    expect(calls).toEqual([['unsubscribe', { endpoint: ENDPOINT }]]);
  });

  it('keeps its status when unsubscribing fails', async () => {
    installPush({ permission: 'granted', subscribed: true });
    server.use(
      http.post(`${API_URL}/api/push/unsubscribe`, () =>
        HttpResponse.json({ error: 'down' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    await act(() => result.current.disable());
    expect(result.current).toMatchObject({ status: 'subscribed', busy: false });
  });

  it('does nothing without a token', async () => {
    profile.token = null;
    const { pushManager, NotificationStub } = installPush();
    const { result } = renderHook(() => usePushSubscription());
    await act(() => result.current.enable());
    await act(() => result.current.disable());
    expect(NotificationStub.requestPermission).not.toHaveBeenCalled();
    expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
  });
});
