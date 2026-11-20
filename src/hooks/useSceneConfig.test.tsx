/** useSceneConfig tests — scene configuration loading and target brightness lookup. */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../services/client';
import { server } from '../test/msw-server';
import { createQueryWrapper, createTestQueryClient } from '../test/query-wrapper';
import { useSceneConfig } from './useSceneConfig';

const profile = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('../context/UserContext', () => ({
  useUserProfile: () => profile,
}));

const SCENES = { 'scene.soir': { brightness: 120 }, 'scene.off': { brightness: null } };

let requests = 0;

beforeEach(() => {
  profile.token = 'jwt';
  requests = 0;
  server.use(
    http.get(`${API_URL}/api/ha/scenes`, () => {
      requests += 1;
      return HttpResponse.json(SCENES);
    }),
  );
});

describe('useSceneConfig', () => {
  it('loads the scenes under the ["ha","scenes"] key with a 5 min staleTime', async () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => useSceneConfig(), { wrapper: createQueryWrapper(client) });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.scenes).toEqual({});
    await waitFor(() => expect(result.current.scenes).toEqual(SCENES));
    expect(result.current.isLoading).toBe(false);
    const query = client.getQueryCache().find({ queryKey: ['ha', 'scenes'] });
    expect(query?.observers[0].options.staleTime).toBe(5 * 60 * 1000);
  });

  it('returns the configured brightness, or null when absent or undefined', async () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => useSceneConfig(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.getSceneBrightness('scene.soir')).toBe(120));
    expect(result.current.getSceneBrightness('scene.off')).toBeNull();
    expect(result.current.getSceneBrightness('scene.unknown')).toBeNull();
  });

  it('reports a non-ok answer as an error instead of caching an empty configuration', async () => {
    server.use(http.get(`${API_URL}/api/ha/scenes`, () => new HttpResponse(null, { status: 500 })));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useSceneConfig(), { wrapper: createQueryWrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.scenes).toEqual({});
    expect(client.getQueryState(['ha', 'scenes'])?.status).toBe('error');
  });

  it('does not fetch without a token', () => {
    profile.token = null;
    const client = createTestQueryClient();

    const { result } = renderHook(() => useSceneConfig(), { wrapper: createQueryWrapper(client) });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.getSceneBrightness('scene.soir')).toBeNull();
    expect(requests).toBe(0);
  });
});
