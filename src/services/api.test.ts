/** api tests — the barrel re-exports every domain client unchanged. */
import { describe, expect, it } from 'vitest';
import * as api from './api';
import * as client from './client';
import * as energy from './energy';
import * as errors from './errors';
import * as ha from './ha';
import * as petkit from './petkit';
import * as user from './user';

describe('api barrel', () => {
  it.each([
    ['client', client],
    ['ha', ha],
    ['user', user],
    ['energy', energy],
    ['petkit', petkit],
  ] as const)('re-exports every export of %s', (_name, domain) => {
    for (const [key, value] of Object.entries(domain)) {
      expect(api[key as keyof typeof api]).toBe(value);
    }
  });

  it('re-exports ApiError only from errors', () => {
    expect(api.ApiError).toBe(errors.ApiError);
    expect('throwApiError' in api).toBe(false);
    expect('handleResponse' in api).toBe(false);
  });
});
