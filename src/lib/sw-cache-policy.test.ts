/** sw-cache-policy tests — what the service worker may cache, and which caches are purged. */
import { describe, expect, it } from 'vitest';
import {
  API_HISTORY_CACHE,
  isCacheableApiRequest,
  isUserCacheName,
  obsoleteApiCaches,
} from './sw-cache-policy';

const API = 'https://home-back.psaltery.org';
const cacheable = (path: string, method = 'GET', origin = API) =>
  isCacheableApiRequest(new URL(path, origin), method, API);

describe('isCacheableApiRequest', () => {
  it.each([
    '/api/ha/history?entity_id=sensor.a&start_time=x&end_time=y',
    '/api/ha/history/period/2026-10-22T13%3A10%3A00.000Z?filter_entity_id=sensor.a',
    '/api/enedis/data?start=2025-01-01',
    '/api/grdf?start=2023-10-24',
    '/api/suez?start=2023-10-24',
  ])('caches the slow-changing read %s', (path) => {
    expect(cacheable(path)).toBe(true);
  });

  it.each([
    '/api/user/me',
    '/api/user/preferences',
    '/api/ha/states',
    '/api/ha/scenes',
    '/api/petkit?days=7',
    '/api/camera_proxy_image/camera.aarlo_jardin',
    '/api/ha/image/image.feeder',
    '/api/ha/media?media_content_id=x',
  ])('never caches the user or live data %s', (path) => {
    expect(cacheable(path)).toBe(false);
  });

  it('ignores the same paths on another origin', () => {
    expect(cacheable('/api/ha/history', 'GET', 'https://evil.example')).toBe(false);
    expect(cacheable('/api/ha/history', 'GET', 'https://home.psaltery.org')).toBe(false);
  });

  it('never caches a write', () => {
    expect(cacheable('/api/ha/history', 'POST')).toBe(false);
  });
});

describe('cache names', () => {
  it('treats every api-* cache as user data, not the precache', () => {
    expect(isUserCacheName('api-get')).toBe(true);
    expect(isUserCacheName(API_HISTORY_CACHE)).toBe(true);
    expect(isUserCacheName('workbox-precache-v2-https://home.psaltery.org/')).toBe(false);
  });

  it('lists the API caches of previous versions only', () => {
    expect(
      obsoleteApiCaches(['api-get', 'api-slow-changing', API_HISTORY_CACHE, 'workbox-precache-v2']),
    ).toEqual(['api-get', 'api-slow-changing']);
  });
});
