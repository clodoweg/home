/**
 * Tests: Action — Déclencher une distribution PetKit.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { PETKIT } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: PetKit Feed', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('clic sur distribuer envoie la commande petkit/feed', async ({ page }) => {
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#animaux');
    await waitForDashboardReady(page);

    const feedBtn = page.locator(PETKIT.feedButton);
    await expect(feedBtn).toBeVisible();
    await feedBtn.click();
    await expect
      .poll(() => actionCalls.find((c) => c.domain === 'petkit' && c.service === 'feed'))
      .toBeDefined();
  });
});
