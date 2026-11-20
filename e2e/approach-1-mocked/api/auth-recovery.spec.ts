/**
 * Tests: reprise après erreur d'authentification ou de profil.
 */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { LIGHT } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Reprise après erreur', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  // B01: actions used to swallow the 401, so the token was never refreshed nor the call retried.
  test('une action refusée en 401 est rejouée une fois, puis aboutit', async ({ page }) => {
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    const lightCalls: number[] = [];
    // Registered after mockAllApis: the first light action gets a 401, the next one succeeds.
    await page.route('**/api/ha/call', (route) => {
      const body = route.request().postDataJSON();
      if (body?.domain !== 'light') return route.fallback();
      lightCalls.push(lightCalls.length);
      return lightCalls.length === 1
        ? route.fulfill({ status: 401, json: { error: 'Unauthorized', code: 'UNAUTHORIZED' } })
        : route.fulfill({ json: [] });
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await page.locator(LIGHT.toggle('salon')).click();

    await expect.poll(() => lightCalls.length).toBe(2);
    await expect(page.getByText('Session expirée')).toHaveCount(0);
  });

  // B04: first launch, no cached profile, the profile request fails: the user can retry.
  test('un échec du profil au premier lancement propose de réessayer', async ({ page }) => {
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    let failProfile = true;
    await page.route('**/api/user/me', (route) =>
      failProfile
        ? route.fulfill({ status: 500, json: { error: 'Erreur serveur' } })
        : route.fallback(),
    );

    await page.goto('/');
    await expect(page.getByText('Erreur de profil')).toBeVisible();

    failProfile = false;
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await waitForDashboardReady(page);
  });
});
