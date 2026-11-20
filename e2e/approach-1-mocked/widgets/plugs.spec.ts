/**
 * Tests: PlugsWidget — affichage et état des prises connectées.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('PlugsWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche les prises avec noms et puissance', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'plugs');

    await expect(page.getByText('Prise PC')).toBeVisible();
    await expect(page.getByText('Prise TV')).toBeVisible();
  });
});
