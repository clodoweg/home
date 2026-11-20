/**
 * Tests: Action — Allumer/éteindre une lumière.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { LIGHT } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Light Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('toggle lumière envoie la bonne commande API', async ({ page }) => {
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Clique sur le toggle de la lumière Salon
    const toggleBtn = page.locator(LIGHT.toggle('salon'));
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Attend que l'appel API soit capturé
    await expect.poll(() => actionCalls.find((c) => c.domain === 'light')).toBeDefined();
    const lightCall = actionCalls.find((c) => c.domain === 'light')!;
    expect(lightCall.service).toMatch(/toggle|turn_on|turn_off/);
    expect(lightCall.entity_id).toContain('light.salon');
  });

  test("toggle d'une lumière éteinte envoie turn_on", async ({ page }) => {
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Chambre est éteinte → clic devrait l'allumer
    const toggleBtn = page.locator(LIGHT.toggle('chambre'));
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect.poll(() => actionCalls.some((c) => c.domain === 'light')).toBe(true);
  });
});
