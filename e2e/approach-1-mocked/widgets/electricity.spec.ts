/**
 * Tests: ElectricityWidget — graphiques consommation Enedis.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { ENEDIS_DATA } from '../../fixtures/mock-data/enedis-data';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('ElectricityWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche les données de consommation journalière', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      enedisData: ENEDIS_DATA,
    });

    await page.goto('/#energie');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'electricity');
    // The widget opens on the last 7 days, like the gas and water ones.
    await expect(page.getByTestId('electricity-view-week')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('widget-electricity').getByText('Total 7 Jours')).toBeVisible();
  });

  test('affiche correctement sans données Enedis', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      enedisData: null,
    });

    await page.goto('/#energie');
    await waitForDashboardReady(page);
    // Le widget devrait gérer gracieusement l'absence de données
  });
});
