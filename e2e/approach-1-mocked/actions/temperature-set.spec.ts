/**
 * Tests: Action — Régler la température d'un thermostat.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { CLIMATE } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Temperature Set', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('régler la température envoie la commande climate.set_temperature', async ({ page }) => {
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Curseur de consigne du thermostat du salon (ClimateWidget)
    const slider = page.locator(CLIMATE.tempSlider('climate.salon'));
    await expect(slider).toBeVisible();
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.8, box!.y + box!.height / 2);

    await expect
      .poll(() =>
        actionCalls.find((c) => c.domain === 'climate' && c.service === 'set_temperature'),
      )
      .toMatchObject({
        entity_id: 'climate.salon',
        service_data: { temperature: expect.any(Number) },
      });
  });
});
