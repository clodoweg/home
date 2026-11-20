/**
 * Tests: ArloWidget — snapshot caméra (admin only).
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('ArloWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche la caméra avec nom', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'arlo');

    await expect(page.getByText('Arlo Jardin')).toBeVisible();
  });
});
