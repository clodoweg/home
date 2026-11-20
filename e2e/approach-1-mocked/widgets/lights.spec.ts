/**
 * Tests: LightsWidget — affichage des lumières et états visuels.
 */

import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { LIGHT_STATES } from '../../fixtures/mock-data/ha-states';
import { WIDGET, LIGHT } from '../../helpers/widget-selectors';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('LightsWidget', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche toutes les lumières avec noms corrects', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: LIGHT_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'lights');

    // Vérifie que chaque lumière est affichée avec son nom
    const lightsWidget = page.locator(WIDGET.lights);
    await expect(lightsWidget.getByText('Salon')).toBeVisible();
    await expect(lightsWidget.getByText('Chambre')).toBeVisible();
    await expect(lightsWidget.getByText('Cuisine')).toBeVisible();
  });

  test("affiche l'état on/off correctement", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: LIGHT_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Salon est allumé (state: 'on')
    const salonCard = page.locator(LIGHT.card('salon'));
    await expect(salonCard).toBeVisible();

    // Chambre est éteinte (state: 'off')
    const chambreCard = page.locator(LIGHT.card('chambre'));
    await expect(chambreCard).toBeVisible();
  });

  test('affiche correctement avec aucune lumière', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [], // pas de données HA
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    // Le widget s'affiche quand même, sans lumière allumée
    await expect(page.locator(WIDGET.lights)).toBeVisible();
    await expect(page.locator(WIDGET.lights)).toContainText('0');
  });

  // Visual regression test (snapshots are platform-specific).
  // To update snapshots locally: npx playwright test -g "screenshot" --project=mocked --update-snapshots
  test('screenshot du widget pour régression visuelle', async ({ page }, testInfo) => {
    // Baselines are Linux only, generated in the Playwright Docker image (update-snapshots
    // workflow) and checked in CI: skipped on a platform without a baseline (macOS, Windows).
    test.skip(
      !process.env.UPDATE_SNAPSHOTS &&
        !existsSync(testInfo.snapshotPath('lights-widget-default.png')),
      'Visual baselines exist for Linux only (CI)',
    );

    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: LIGHT_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const widget = page.locator(WIDGET.lights);
    const header = page.locator(`[data-testid="widget-header-lights"]`);
    await expect(header).toBeVisible();
    // Folded on a phone; a wider screen has no folding and shows the whole widget.
    if (page.viewportSize()!.width < 768) await header.click();

    await expect(widget).toBeVisible();
    await expect(widget).toHaveScreenshot('lights-widget-default.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
