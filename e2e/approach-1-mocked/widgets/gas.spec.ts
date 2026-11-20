/**
 * Tests: GasWidget — données consommation GRDF.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { GRDF_DATA } from '../../fixtures/mock-data/grdf-data';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('GasWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche les données de consommation gaz', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      grdfData: GRDF_DATA,
    });

    await page.goto('/#energie');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'gas');
  });

  test('affiche correctement sans données GRDF', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      grdfData: null,
    });

    await page.goto('/#energie');
    await waitForDashboardReady(page);
  });
});
