/** env tests — public build-time variables and their defaults. */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_URL } from '../constants/api';

const loadEnv = async () => {
  vi.resetModules();
  return import('./env');
};

describe('env', () => {
  it('reads the Clerk key and the API URL from VITE_ variables', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_abc');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');

    const env = await loadEnv();

    expect(env.publishableKey).toBe('pk_test_abc');
    expect(env.apiUrl).toBe('http://localhost:3000');
  });

  it('defaults to an empty Clerk key and the production backend', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_API_URL', '');

    const env = await loadEnv();

    expect(env.publishableKey).toBe('');
    expect(env.apiUrl).toBe(DEFAULT_API_URL);
  });

  it('keeps the simulated auth off outside a VITE_TEST_MODE build', async () => {
    vi.stubEnv('VITE_TEST_MODE', 'true');
    const env = await loadEnv();
    expect(env.isTestMode).toBe(false);
  });
});
