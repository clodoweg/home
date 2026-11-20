/**
 * Clerk authentication fixture for Playwright.
 *
 * The signed-in session is simulated by the VITE_TEST_MODE build (playwright.config.ts
 * webServer): ClerkProvider is not even mounted, so the app makes no Clerk request.
 * This fixture only makes sure of it — any real Clerk call is aborted, so a test can never
 * depend on (or reach) a Clerk instance.
 */

import { Page } from '@playwright/test';
import { TestUserProfile } from './users';

/**
 * Prepares a page for a signed-in test session. Call it before `page.goto()` in each test.
 *
 * @param page - Playwright page.
 * @param _profile - Profile of the simulated user, served by `mockAllApis` (/api/user/me).
 */
export async function bypassClerkAuth(page: Page, _profile: TestUserProfile) {
  await page.route(
    (url) => url.hostname.includes('clerk'),
    (route) => route.abort('blockedbyclient'),
  );
}
