/**
 * Tests: WaterWidget — graphiques consommation Suez.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { SUEZ_DATA } from '../../fixtures/mock-data/suez-data';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('WaterWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test("affiche les données de consommation d'eau Suez", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      suezData: SUEZ_DATA,
    });

    await page.goto('/#energie');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'water');

    // Check header states
    const widget = page.getByTestId('widget-water');
    await expect(widget).toBeVisible();

    // The widget opens on the last 7 days.
    const tab7j = page.getByTestId('water-view-week');
    await expect(tab7j).toHaveAttribute('aria-pressed', 'true');
    await expect(widget.getByText('Total 7 Jours')).toBeVisible();

    const tab1a = page.getByTestId('water-view-year');
    await expect(tab1a).toBeVisible();
    // The charts of the widgets above load lazily and push this one down: a click issued while
    // the layout moves can land beside the tab, so it is retried until the tab is selected.
    await expect(async () => {
      await tab1a.click();
      await expect(tab1a).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
    }).toPass();

    const yearText = widget.getByText('Total Annuel');
    await expect(yearText).toBeVisible();
  });

  test("gère gracieusement l'absence de données Suez", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      suezData: null,
    });

    await page.goto('/#energie');
    await waitForDashboardReady(page);

    // Le widget devrait gérer gracieusement l'absence de données
    await expectWidgetVisible(page, 'water');
  });
});
