/** notifications tests — the bell's list, "mark read" and the push subscription endpoints. */
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../test/msw-server';
import { silenceConsole } from '../test/services/helpers';
import { API_URL } from './client';
import {
  getNotifications,
  getPushPublicKey,
  markNotificationsRead,
  subscribePush,
  unsubscribePush,
} from './notifications';

beforeEach(() => {
  silenceConsole();
});

const LIST = {
  notifications: [
    {
      id: 1,
      category: 'alarm',
      title: 'Alarme',
      body: 'Activée',
      createdAt: '2026-11-16T08:00:00.000Z',
      read: false,
    },
  ],
  unread: 1,
};

describe('notifications client', () => {
  it('reads the alerts with the bearer token', async () => {
    server.use(
      http.get(`${API_URL}/api/notifications`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer jwt');
        return HttpResponse.json(LIST);
      }),
    );
    await expect(getNotifications('jwt')).resolves.toEqual(LIST);
  });

  it('marks every alert read, or only the given ones', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/api/notifications/read`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ updated: 1 });
      }),
    );
    await markNotificationsRead('jwt');
    await markNotificationsRead('jwt', [3, 4]);
    expect(bodies).toEqual([{}, { ids: [3, 4] }]);
  });

  it('rejects when the back refuses (non-admin)', async () => {
    server.use(
      http.get(`${API_URL}/api/notifications`, () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
      ),
    );
    await expect(getNotifications('jwt')).rejects.toThrow();
  });

  it('returns the VAPID key, null when push is off', async () => {
    let key: string | null = 'BKey';
    server.use(
      http.get(`${API_URL}/api/push/public-key`, () => HttpResponse.json({ publicKey: key })),
    );
    await expect(getPushPublicKey('jwt')).resolves.toBe('BKey');
    key = null;
    await expect(getPushPublicKey('jwt')).resolves.toBeNull();
  });

  it('subscribes and unsubscribes this browser', async () => {
    const calls: [string, unknown][] = [];
    server.use(
      http.post(`${API_URL}/api/push/subscription`, async ({ request }) => {
        calls.push(['subscription', await request.json()]);
        return HttpResponse.json({ subscribed: true }, { status: 201 });
      }),
      http.post(`${API_URL}/api/push/unsubscribe`, async ({ request }) => {
        calls.push(['unsubscribe', await request.json()]);
        return HttpResponse.json({ removed: 1 });
      }),
    );
    const subscription = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p', auth: 'a' },
    };
    await subscribePush('jwt', subscription);
    await unsubscribePush('jwt', subscription.endpoint);
    expect(calls).toEqual([
      ['subscription', subscription],
      ['unsubscribe', { endpoint: subscription.endpoint }],
    ]);
  });
});
