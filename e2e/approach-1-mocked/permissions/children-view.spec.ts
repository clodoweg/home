/**
 * Tests: Children view — vue la plus restreinte.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { CHILDREN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { WIDGET } from '../../helpers/widget-selectors';
import { showWidget, waitForDashboardReady } from '../../helpers/assertions';

test.describe('Children Permissions', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, CHILDREN_PROFILE);
  });

  test('children voit uniquement les widgets autorisés', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: CHILDREN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/');
    await waitForDashboardReady(page);

    // Widgets autorisés pour children
    const allowedWidgets = ['lights', 'weather'] as const;
    for (const widgetKey of allowedWidgets) {
      await expect(
        await showWidget(page, widgetKey),
        `Widget ${widgetKey} devrait être visible pour children`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // Also check feeder widget (PetKit)
    await expect(
      await showWidget(page, 'petkit'),
      'Widget feeder devrait être visible pour children',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('children NE voit PAS les caméras', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: CHILDREN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    await expect(page.locator(WIDGET.arlo)).not.toBeVisible({ timeout: 5_000 });
  });

  test('children est bloqué en accès remote sans permissions', async ({ page }) => {
    // 1. Setup: Backend returns 403 on profile/me due to Remote Restriction
    await mockAllApis(page, {
      userProfile: CHILDREN_PROFILE,
      overrides: {
        '/api/user/me': async (route) =>
          route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Forbidden: Access restricted to Home WiFi',
              code: 'IP_RESTRICTED',
              detectedIp: '8.8.8.8',
            }),
          }),
      },
    });

    await page.goto('/');

    // 2. Verification: AuthGuard should show the error and stay on login
    const errorMessage = page.locator(
      "text=L'application doit être connectée au WIFI de la maison pour fonctionner",
    );
    await expect(errorMessage).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Déconnexion')).toBeVisible();
  });

  test('children voit les widgets du DEFAULT_ORDER également', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: CHILDREN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    // The alarm widget appears because DEFAULT_ORDER includes it
    // (no permission gate in DashboardScreen)
    await expect(page.locator(WIDGET.alarm)).toBeVisible({ timeout: 10_000 });
  });

  test('children NE voit PAS les données énergie', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: CHILDREN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/');
    await waitForDashboardReady(page);

    // Without the history right, the whole energy section is gone, even through its URL.
    await expect(page.getByTestId('nav-energie')).toHaveCount(0);
    await page.goto('/#energie');
    await waitForDashboardReady(page);
    await expect(page.locator(WIDGET.electricity)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator(WIDGET.gas)).not.toBeVisible({ timeout: 5_000 });
  });
});
