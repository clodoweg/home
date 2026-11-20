/**
 * Tests: Standard user view — restricted access (no cameras, no history).
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { USER_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { WIDGET } from '../../helpers/widget-selectors';
import { showWidget, waitForDashboardReady } from '../../helpers/assertions';

test.describe('Standard User Permissions', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, USER_PROFILE);
  });

  test('user voit les widgets autorisés', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: USER_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/');
    await waitForDashboardReady(page);

    // Widgets autorisés pour un user standard
    const allowedWidgets = ['lights', 'temperature', 'weather', 'plugs'] as const;
    for (const widgetKey of allowedWidgets) {
      await expect(
        await showWidget(page, widgetKey),
        `Widget ${widgetKey} devrait être visible pour user`,
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('user ne voit pas les caméras sans permission cameras', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: USER_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    // USER_PROFILE n'a pas la permission 'cameras' → widget arlo masqué
    await expect(page.locator(WIDGET.arlo)).not.toBeVisible();
  });

  test("user ne voit pas l'historique sans permission history", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: USER_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/');
    await waitForDashboardReady(page);

    // USER_PROFILE n'a pas la permission 'history' → widgets electricity/gas masqués
    await expect(page.getByTestId('nav-energie')).toHaveCount(0);
    await page.goto('/#energie');
    await waitForDashboardReady(page);
    await expect(page.locator(WIDGET.electricity)).not.toBeVisible();
    await expect(page.locator(WIDGET.gas)).not.toBeVisible();
  });
});
