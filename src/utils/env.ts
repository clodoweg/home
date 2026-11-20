/**
 * Environment variable utility — Vite webapp build.
 * All public env vars use the VITE_ prefix and are accessed via import.meta.env.
 */
import { resolveApiUrl } from '../constants/api';

export const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
export const apiUrl = resolveApiUrl(import.meta.env.VITE_API_URL);

/**
 * Simulated auth for Playwright. `__APP_TEST_MODE__` is a build-time constant (see
 * vite.config.mts): nothing at runtime can switch it on, and the minifier drops every
 * test-only branch from a production build.
 */
export const isTestMode: boolean = __APP_TEST_MODE__;
