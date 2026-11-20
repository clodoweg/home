/**
 * Tests: SpaWidget — affichage température spa.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('SpaWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche la température du spa', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'spa');

    // current_temperature: 36.5
    await expect(page.getByText('36.5', { exact: true }).first()).toBeVisible();
  });
});
