/**
 * Tests: Admin view — voit tous les widgets y compris caméras et historique.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { WIDGET } from '../../helpers/widget-selectors';
import { showWidget, waitForDashboardReady } from '../../helpers/assertions';

test.describe('Admin Permissions', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('admin voit tous les widgets', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/');
    await waitForDashboardReady(page);

    // Admin voit TOUS les widgets
    const expectedWidgets = [
      'lights',
      'alarm',
      'temperature',
      'weather',
      'electricity',
      'gas',
      'arlo',
      'plugs',
    ] as const;

    for (const widgetKey of expectedWidgets) {
      const widget = await showWidget(page, widgetKey);
      await expect(widget, `Widget ${widgetKey} devrait être visible pour admin`).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test('admin voit les caméras (Arlo)', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    await expect(page.locator(WIDGET.arlo)).toBeVisible();
  });

  test('admin peut déclencher toutes les actions', async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const lightToggle = page.locator('[data-testid^="light-toggle-"]').first();
    await expect(lightToggle).toBeVisible();
    await lightToggle.click();

    await expect.poll(() => serviceCalls.filter((c) => c.domain === 'light').length).toBe(1);
  });
});
