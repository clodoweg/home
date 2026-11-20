/** petkit tests — PetKit client: data retrieval and manual feed, including its error swallowing. */
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { PETKIT_DATA } from '../../e2e/fixtures/mock-data/petkit-data';
import { server } from '../test/msw-server';
import { type FreshServices, loadFreshServices, silenceConsole } from '../test/services/helpers';
import { API_URL } from './client';

let client: FreshServices['client'];
let petkit: FreshServices['petkit'];

beforeEach(async () => {
  ({ client, petkit } = await loadFreshServices());
  silenceConsole();
});

const bearer = (request: Request) => request.headers.get('Authorization');

describe('getPetkitData', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(petkit.getPetkitData('')).rejects.toThrow('No token');
  });

  it('requests one day by default with the bearer token', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/petkit`, ({ request }) => {
        url = new URL(request.url);
        expect(bearer(request)).toBe('Bearer jwt');
        return HttpResponse.json(PETKIT_DATA);
      }),
    );

    await expect(petkit.getPetkitData('jwt')).resolves.toEqual(
      JSON.parse(JSON.stringify(PETKIT_DATA)),
    );
    expect(url?.searchParams.get('days')).toBe('1');
  });

  it('forwards the requested number of days', async () => {
    let days: string | null = null;
    server.use(
      http.get(`${API_URL}/api/petkit`, ({ request }) => {
        days = new URL(request.url).searchParams.get('days');
        return HttpResponse.json({ devices: [], records: [] });
      }),
    );
    await petkit.getPetkitData('jwt', 7);
    expect(days).toBe('7');
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(
      http.get(`${API_URL}/api/petkit`, () =>
        HttpResponse.json({ error: 'PetKit down' }, { status: 503 }),
      ),
    );
    await expect(petkit.getPetkitData('jwt')).rejects.toMatchObject({
      status: 503,
      message: 'Error 503: PetKit down',
    });
  });

  it('refreshes the token and retries on a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.get(`${API_URL}/api/petkit`, ({ request }) =>
        bearer(request) === 'Bearer fresh'
          ? HttpResponse.json({ devices: [], records: [] })
          : new HttpResponse(null, { status: 401 }),
      ),
    );
    await expect(petkit.getPetkitData('stale')).resolves.toEqual({ devices: [], records: [] });
  });
});

describe('triggerPetkitFeed', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(petkit.triggerPetkitFeed('', 1, 1, 0)).rejects.toThrow('No token');
  });

  it('posts the device and amounts as JSON', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/api/petkit/feed`, async ({ request }) => {
        body = await request.json();
        expect(request.headers.get('Content-Type')).toBe('application/json');
        return HttpResponse.json({ success: true });
      }),
    );

    await expect(petkit.triggerPetkitFeed('jwt', 100000001, 2, 1)).resolves.toEqual({
      success: true,
    });
    expect(body).toEqual({ deviceId: 100000001, amount1: 2, amount2: 1 });
  });

  it('rejects when the request fails', async () => {
    server.use(http.post(`${API_URL}/api/petkit/feed`, () => HttpResponse.error()));
    await expect(petkit.triggerPetkitFeed('jwt', 1, 1, 0)).rejects.toThrow();
  });
});

describe('fixed bugs (regressions)', () => {
  it('B01: triggerPetkitFeed refreshes the token and retries after a 401', async () => {
    client.setTokenRefreshHandler(async () => 'fresh');
    server.use(
      http.post(`${API_URL}/api/petkit/feed`, ({ request }) =>
        bearer(request) === 'Bearer fresh'
          ? HttpResponse.json({ success: true })
          : new HttpResponse(null, { status: 401 }),
      ),
    );
    await expect(petkit.triggerPetkitFeed('stale', 1, 1, 0)).resolves.toEqual({ success: true });
  });
});
