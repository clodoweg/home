/** energy tests — Enedis, GRDF and Suez clients: query parameters, payloads and errors. */
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { ENEDIS_DATA } from '../../e2e/fixtures/mock-data/enedis-data';
import { GRDF_DATA } from '../../e2e/fixtures/mock-data/grdf-data';
import { SUEZ_DATA } from '../../e2e/fixtures/mock-data/suez-data';
import { server } from '../test/msw-server';
import { type FreshServices, loadFreshServices, silenceConsole } from '../test/services/helpers';
import { API_URL } from './client';

let energy: FreshServices['energy'];

beforeEach(async () => {
  ({ energy } = await loadFreshServices());
  silenceConsole();
});

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

/** Registers a GET handler that records the query and answers `payload`. */
const recordQuery = (path: string, payload: Parameters<typeof HttpResponse.json>[0]) => {
  const seen: { query?: URLSearchParams; authorization?: string | null } = {};
  server.use(
    http.get(`${API_URL}${path}`, ({ request }) => {
      seen.query = new URL(request.url).searchParams;
      seen.authorization = request.headers.get('Authorization');
      return HttpResponse.json(payload);
    }),
  );
  return seen;
};

describe('getEnedisData', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(energy.getEnedisData('')).rejects.toThrow('No token');
  });

  it('sends every date filter provided', async () => {
    const seen = recordQuery('/api/enedis/data', ENEDIS_DATA);

    await expect(
      energy.getEnedisData('jwt', '2026-10-01', '2026-10-20', '2026-10-19'),
    ).resolves.toEqual(asJson(ENEDIS_DATA));
    expect(seen.authorization).toBe('Bearer jwt');
    expect(Object.fromEntries(seen.query ?? [])).toEqual({
      start: '2026-10-01',
      end: '2026-10-20',
      loadCurveStart: '2026-10-19',
    });
  });

  it('sends no query parameter when no date is given', async () => {
    const seen = recordQuery('/api/enedis/data', ENEDIS_DATA);
    await energy.getEnedisData('jwt');
    expect([...(seen.query ?? [])]).toEqual([]);
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(
      http.get(`${API_URL}/api/enedis/data`, () =>
        HttpResponse.json({ error: 'Enedis down' }, { status: 502 }),
      ),
    );
    await expect(energy.getEnedisData('jwt')).rejects.toMatchObject({
      status: 502,
      message: 'Error 502: Enedis down',
    });
  });
});

describe('getGrdfData', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(energy.getGrdfData('')).rejects.toThrow('No token');
  });

  it('sends the date filters provided', async () => {
    const seen = recordQuery('/api/grdf', GRDF_DATA);

    await expect(energy.getGrdfData('jwt', '2026-10-01', '2026-10-20')).resolves.toEqual(
      asJson(GRDF_DATA),
    );
    expect(Object.fromEntries(seen.query ?? [])).toEqual({
      start: '2026-10-01',
      end: '2026-10-20',
    });
    expect(seen.authorization).toBe('Bearer jwt');
  });

  it('sends no query parameter when no date is given', async () => {
    const seen = recordQuery('/api/grdf', GRDF_DATA);
    await energy.getGrdfData('jwt');
    expect([...(seen.query ?? [])]).toEqual([]);
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(http.get(`${API_URL}/api/grdf`, () => new HttpResponse('down', { status: 500 })));
    await expect(energy.getGrdfData('jwt')).rejects.toMatchObject({ status: 500 });
  });
});

describe('getSuezData', () => {
  it('rejects without calling the back when there is no token', async () => {
    await expect(energy.getSuezData('')).rejects.toThrow('No token');
  });

  it('sends the date filters provided', async () => {
    const seen = recordQuery('/api/suez', SUEZ_DATA);

    await expect(energy.getSuezData('jwt', '2026-10-01', '2026-10-20')).resolves.toEqual(
      asJson(SUEZ_DATA),
    );
    expect(Object.fromEntries(seen.query ?? [])).toEqual({
      start: '2026-10-01',
      end: '2026-10-20',
    });
  });

  it('sends only the start when no end is given', async () => {
    const seen = recordQuery('/api/suez', SUEZ_DATA);
    await energy.getSuezData('jwt', '2026-10-01');
    expect(Object.fromEntries(seen.query ?? [])).toEqual({ start: '2026-10-01' });
  });

  it('sends no query parameter when no date is given', async () => {
    const seen = recordQuery('/api/suez', SUEZ_DATA);
    await energy.getSuezData('jwt');
    expect([...(seen.query ?? [])]).toEqual([]);
  });

  it('throws an ApiError on a non-2xx response', async () => {
    server.use(http.get(`${API_URL}/api/suez`, () => new HttpResponse(null, { status: 404 })));
    await expect(energy.getSuezData('jwt')).rejects.toMatchObject({ status: 404 });
  });
});
