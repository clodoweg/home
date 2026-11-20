/**
 * Tests: BambuLabWidget — affichage et contrôle de l'imprimante 3D Bambu Lab P1S.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('BambuLabWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test("affiche le widget d'impression 3D avec les métriques P1S", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'bambu_lab');

    // Vérification du statut traduit et du nom de fichier gcode
    await expect(page.getByText('En cours').first()).toBeVisible();
    await expect(page.getByText('benchie_boat.gcode').first()).toBeVisible();

    // Vérification des températures
    await expect(page.getByText('220°C').first()).toBeVisible();
    await expect(page.getByText('60°C').first()).toBeVisible();
    await expect(page.getByText('38°C').first()).toBeVisible();
  });
});
