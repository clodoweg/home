/**
 * Tests: TemperatureWidget — affichage des pièces et données climatiques.
 */

import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE, USER_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { TEMPERATURE } from '../../helpers/widget-selectors';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('TemperatureWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche les températures de chaque pièce', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'temperature');
    const widget = page.locator('[data-testid="widget-temperature"]');

    // Vérifie les noms des pièces
    await expect(widget.getByText('Salon', { exact: false }).first()).toBeVisible();
    await expect(widget.getByText('Chambre', { exact: false }).first()).toBeVisible();

    // Vérifie les valeurs de température affichées (les symboles ° peuvent être séparés)
    await expect(widget.getByText('20.5', { exact: false }).first()).toBeVisible(); // current_temperature Salon
    await expect(widget.getByText('18.8', { exact: false }).first()).toBeVisible(); // current_temperature Chambre
  });

  test('clic sur une pièce affiche les détails corrects', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Clic sur la ligne du Salon : son historique se déplie
    const salonRow = page.locator(TEMPERATURE.row('sensor.temperature_salon'));
    await expect(salonRow).toHaveAttribute('aria-expanded', 'false');
    await salonRow.click();
    await expect(salonRow).toHaveAttribute('aria-expanded', 'true');
    await salonRow.click();
    await expect(salonRow).toHaveAttribute('aria-expanded', 'false');
  });

  test('met à jour les seuils de température et change les couleurs en direct', async ({
    page,
    isMobile,
  }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Salon temperature is 20.5°C, initially green
    const salonTempInitial = page.locator('[data-testid="widget-temperature"]').getByText('20.5°C');
    await expect(salonTempInitial).toHaveClass(/text-success/);

    // Open reorder / settings screen
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Click on the Thresholds tab
    await page.getByTestId('reorder-tab-thresholds').click();

    // Change tempIndoorMinOrange to 22.0
    const input = page.locator('input[type="number"]').nth(1);
    await input.fill('22');

    // Click save button
    await page.getByRole('button', { name: 'Sauvegarder les seuils' }).click();

    // Verify success message
    await expect(page.getByText('Seuils sauvegardés avec succès !')).toBeVisible();

    // Close the modal / reorder screen
    if (isMobile) {
      await page.getByTestId('overlay-close-button-mobile').click();
    } else {
      await page.getByTestId('overlay-close-button').click();
    }

    // Verify that the Salon temperature (20.5) is now orange (text-warning) because 20.5 <= 22
    const salonTempAfter = page.locator('[data-testid="widget-temperature"]').getByText('20.5°C');
    await expect(salonTempAfter).toHaveClass(/text-warning/);
  });

  test("met à jour les seuils d'humidité et change les couleurs en direct", async ({
    page,
    isMobile,
  }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Salon humidity is 45%, initially green
    const salonHumInitial = page.locator('tr', { hasText: 'Salon' }).getByText('45%');
    await expect(salonHumInitial).toHaveClass(/text-success/);

    // Open reorder / settings screen
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Click on the Thresholds tab
    await page.getByTestId('reorder-tab-thresholds').click();

    // Change humIndoorMinOrange to 50
    // In our new form, the inputs are:
    // tempIndoor (4 inputs), tempOutdoor (4 inputs), humIndoor (4 inputs), humOutdoor (4 inputs)
    // humIndoorMinOrange is index 9 (the 10th input)
    const input = page.locator('input[type="number"]').nth(9);
    await input.fill('50');

    // Click save button
    await page.getByRole('button', { name: 'Sauvegarder les seuils' }).click();

    // Verify success message
    await expect(page.getByText('Seuils sauvegardés avec succès !')).toBeVisible();

    // Close the modal / reorder screen
    if (isMobile) {
      await page.getByTestId('overlay-close-button-mobile').click();
    } else {
      await page.getByTestId('overlay-close-button').click();
    }

    // Verify that the Salon humidity (45) is now orange (text-warning) because 45 <= 50
    const salonHumAfter = page.locator('tr', { hasText: 'Salon' }).getByText('45%');
    await expect(salonHumAfter).toHaveClass(/text-warning/);
  });

  test('un administrateur peut configurer les seuils des alertes', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Open reorder / settings screen
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Click on the Thresholds tab
    await page.getByTestId('reorder-tab-thresholds').click();

    // Verify alert thresholds section is visible
    await expect(page.getByText('Seuils des alertes (Admin)')).toBeVisible();

    // Locate the inputs by test-id
    const spaInput = page.getByTestId('input-alert-spa');
    const tempMinInput = page.getByTestId('input-alert-temp-min');
    const tempMaxInput = page.getByTestId('input-alert-temp-max');
    const humMinInput = page.getByTestId('input-alert-hum-min');
    const humMaxInput = page.getByTestId('input-alert-hum-max');

    // Initial default values
    await expect(spaInput).toHaveValue('37');
    await expect(tempMinInput).toHaveValue('15');
    await expect(tempMaxInput).toHaveValue('30');
    await expect(humMinInput).toHaveValue('30');
    await expect(humMaxInput).toHaveValue('70');

    // Fill new valid values
    await spaInput.fill('38.5');
    await tempMinInput.fill('16');
    await tempMaxInput.fill('29');
    await humMinInput.fill('35');
    await humMaxInput.fill('65');

    // Click save button
    await page.getByRole('button', { name: 'Sauvegarder les seuils' }).click();

    // Verify success message
    await expect(page.getByText('Seuils sauvegardés avec succès !')).toBeVisible();
  });

  test('un utilisateur standard ne voit pas la section de configuration des seuils des alertes', async ({
    page,
  }) => {
    // Override standard auth bypass from beforeEach
    await bypassClerkAuth(page, USER_PROFILE);

    await mockAllApis(page, {
      userProfile: USER_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Open reorder / settings screen
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Click on the Thresholds tab
    await page.getByTestId('reorder-tab-thresholds').click();

    // Verify alert thresholds section is NOT visible
    await expect(page.getByText('Seuils des alertes (Admin)')).not.toBeVisible();
    await expect(page.getByTestId('input-alert-spa')).not.toBeVisible();
    await expect(page.getByTestId('input-alert-temp-min')).not.toBeVisible();
    await expect(page.getByTestId('input-alert-temp-max')).not.toBeVisible();
    await expect(page.getByTestId('input-alert-hum-min')).not.toBeVisible();
    await expect(page.getByTestId('input-alert-hum-max')).not.toBeVisible();
  });

  test("peut reconfigurer l'ordre et la visibilité des pièces par étage", async ({
    page,
    isMobile,
  }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Verify Salon is initially visible in the widget
    const widget = page.locator('[data-testid="widget-temperature"]');
    await expect(widget.getByRole('cell', { name: 'Salon' }).first()).toBeVisible();

    // Open reorder / settings screen
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Click on the Pièces tab
    await page.getByTestId('reorder-tab-rooms').click();

    // Verify floors and rooms are rendered
    await expect(page.getByRole('heading', { name: 'RdC' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1er' })).toBeVisible();
    await expect(page.getByLabel('Masquer Salon')).toBeVisible();
    await expect(page.getByLabel('Masquer Chambre')).toBeVisible();

    // Toggle visibility of Salon (should hide it)
    await page.getByLabel('Masquer Salon').click();

    // Close the modal / reorder screen
    if (isMobile) {
      await page.getByTestId('overlay-close-button-mobile').click();
    } else {
      await page.getByTestId('overlay-close-button').click();
    }

    // Verify that Salon is no longer visible in the temperature widget
    await expect(widget.getByRole('cell', { name: 'Salon' })).not.toBeVisible();
  });

  test('peut activer ou désactiver certains capteurs individuellement', async ({
    page,
    isMobile,
  }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-temperature"]');
    // Initially Salon temperature (20.5°C) is visible
    await expect(widget.getByText('20.5', { exact: false }).first()).toBeVisible();

    // Open reorder / settings screen
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Click on the Pièces tab
    await page.getByTestId('reorder-tab-rooms').click();

    // Verify sub-sensor text is present
    await expect(page.getByText('Capteurs de température').first()).toBeVisible();
    await expect(page.getByText('sensor.temperature_salon')).toBeVisible();

    // Toggle visibility of Salon temperature sensor (should hide it)
    await page.getByTestId('room-item-Salon').getByLabel('Masquer Capteur').first().click();

    // Close the modal / reorder screen
    if (isMobile) {
      await page.getByTestId('overlay-close-button-mobile').click();
    } else {
      await page.getByTestId('overlay-close-button').click();
    }

    // Verify that the Salon temperature (20.5°C) is no longer visible in the widget
    await expect(widget.getByText('20.5', { exact: false }).first()).not.toBeVisible();
  });

  // Visual regression test — skip in CI (snapshots are platform-specific: macOS ≠ Linux)
  // To update snapshots locally: npx playwright test -g "screenshot" --project=mocked --update-snapshots
  test('screenshot du widget pour régression visuelle', async ({ page }, testInfo) => {
    // Baselines are Linux only, generated in the Playwright Docker image (update-snapshots
    // workflow) and checked in CI: skipped on a platform without a baseline (macOS, Windows).
    test.skip(
      !process.env.UPDATE_SNAPSHOTS &&
        !existsSync(testInfo.snapshotPath('temperature-widget-default.png')),
      'Visual baselines exist for Linux only (CI)',
    );

    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-temperature"]');
    await expect(widget).toBeVisible();
    await expect(widget).toHaveScreenshot('temperature-widget-default.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
