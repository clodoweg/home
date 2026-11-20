/**
 * Tests: Action — Allumer/éteindre une prise connectée.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { PLUG } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Plug Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('toggle prise envoie la commande switch.toggle', async ({ page }) => {
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const plugToggle = page.locator(PLUG.toggle('pc'));
    await expect(plugToggle).toBeVisible();
    await plugToggle.click();

    await expect
      .poll(() => actionCalls.find((c) => c.domain === 'switch'))
      .toMatchObject({
        entity_id: 'switch.prise_pc',
        service: expect.stringMatching(/toggle|turn_on|turn_off/),
      });
  });
});
