/**
 * Tests: Action — Armer/désarmer l'alarme.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { ALARM } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Alarm Arm/Disarm', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test("désarmer l'alarme envoie la bonne commande", async ({ page }) => {
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES, // alarm is armed_away
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    const disarmBtn = page.locator(ALARM.disarmButton);
    await expect(disarmBtn).toBeVisible();
    await disarmBtn.click();

    await expect
      .poll(() => actionCalls.find((c) => c.domain === 'alarm_control_panel')?.service)
      .toBe('alarm_disarm');
  });

  test("armer l'alarme avec état disarmed", async ({ page }) => {
    const disarmedStates = ALL_HA_STATES.map((s) =>
      s.entity_id === 'alarm_control_panel.alarme_maison' ? { ...s, state: 'disarmed' } : s,
    );

    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: disarmedStates,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    const armBtn = page.locator(ALARM.armButton);
    await expect(armBtn).toBeVisible();
    await armBtn.click();

    await expect
      .poll(() => actionCalls.find((c) => c.domain === 'alarm_control_panel')?.service)
      .toBe('alarm_arm_away');
  });
});
