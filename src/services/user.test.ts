/** user tests — profile and preferences client: requests sent, defaults and error propagation. */
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../test/msw-server';
import { type FreshServices, loadFreshServices, silenceConsole } from '../test/services/helpers';
import { API_URL } from './client';

let client: FreshServices['client'];
let user: FreshServices['user'];

beforeEach(async () => {
  ({ client, user } = await loadFreshServices());
  silenceConsole();
});

const bearer = (request: Request) => request.headers.get('Authorization');
const PROFILE = {
  email: 'a@b.fr',
  group: 'admin',
  permissions: ['history'],
  widgetPreferences: {},
  theme: 'dark',
};
const forbidden = () => HttpResponse.json({ error: 'nope' }, { status: 403 });

describe('getUserProfile', () => {
  it('throws "No token" without calling the back', async () => {
    await expect(user.getUserProfile('')).rejects.toThrow('No token');
  });

  it('returns the profile', async () => {
    server.use(
      http.get(`${API_URL}/api/user/me`, ({ request }) => {
        expect(bearer(request)).toBe('Bearer jwt');
        expect(request.headers.get('X-Request-Id')).toBeTruthy();
        return HttpResponse.json(PROFILE);
      }),
    );
    await expect(user.getUserProfile('jwt')).resolves.toEqual(PROFILE);
  });

  it('throws an ApiError carrying the backend code', async () => {
    server.use(
      http.get(`${API_URL}/api/user/me`, () =>
        HttpResponse.json(
          { error: 'Utilisateur non autorisé', code: 'USER_NOT_FOUND' },
          { status: 403 },
        ),
      ),
    );
    await expect(user.getUserProfile('jwt')).rejects.toMatchObject({
      status: 403,
      code: 'USER_NOT_FOUND',
    });
  });

  it('refreshes the token and retries on a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.get(`${API_URL}/api/user/me`, ({ request }) =>
        bearer(request) === 'Bearer fresh'
          ? HttpResponse.json(PROFILE)
          : new HttpResponse(null, { status: 401 }),
      ),
    );
    await expect(user.getUserProfile('stale')).resolves.toEqual(PROFILE);
  });
});

describe('getNotificationSettings', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(user.getNotificationSettings('')).rejects.toThrow('No token');
  });

  it('keeps only the notification fields', async () => {
    server.use(
      http.get(`${API_URL}/api/user/preferences`, () =>
        HttpResponse.json({
          telegramChatId: '42',
          notificationPreferences: { alarm: true },
          preferences: { order: [] },
        }),
      ),
    );
    await expect(user.getNotificationSettings('jwt')).resolves.toEqual({
      telegramChatId: '42',
      notificationPreferences: { alarm: true },
    });
  });

  it('defaults missing fields', async () => {
    server.use(http.get(`${API_URL}/api/user/preferences`, () => HttpResponse.json({})));
    await expect(user.getNotificationSettings('jwt')).resolves.toEqual({
      telegramChatId: null,
      notificationPreferences: {},
    });
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(http.get(`${API_URL}/api/user/preferences`, forbidden));
    await expect(user.getNotificationSettings('jwt')).rejects.toMatchObject({ status: 403 });
  });
});

describe('updatePreferences', () => {
  it('throws "No token" without calling the back', async () => {
    await expect(user.updatePreferences('', { theme: 'dark' })).rejects.toThrow('No token');
  });

  it('posts the preferences as JSON', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/api/user/preferences`, async ({ request }) => {
        body = await request.json();
        expect(request.headers.get('Content-Type')).toBe('application/json');
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(
      user.updatePreferences('jwt', { theme: 'light', telegramChatId: null }),
    ).resolves.toBeUndefined();
    expect(body).toEqual({ theme: 'light', telegramChatId: null });
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(http.post(`${API_URL}/api/user/preferences`, forbidden));
    await expect(user.updatePreferences('jwt', {})).rejects.toMatchObject({ status: 403 });
  });
});

describe('saveWidgetPreference', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(user.saveWidgetPreference('', { hiddenRooms: [] })).rejects.toThrow('No token');
  });

  it('posts the body and resolves true, whatever the answer body', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/api/user/preferences`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse('not json', { status: 200 });
      }),
    );

    await expect(user.saveWidgetPreference('jwt', { widgetOrder: ['a'] })).resolves.toBe(true);
    expect(body).toEqual({ widgetOrder: ['a'] });
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(http.post(`${API_URL}/api/user/preferences`, forbidden));
    await expect(user.saveWidgetPreference('jwt', {})).rejects.toMatchObject({ status: 403 });
  });
});
