/**
 * Tests: AlarmWidget — affichage état alarme et boutons arm/disarm.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALARM_STATES } from '../../fixtures/mock-data/ha-states';
import { WIDGET } from '../../helpers/widget-selectors';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('AlarmWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test("affiche l'état armé (armed_away)", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALARM_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'alarm');

    // L'alarme est en mode armed_away
    await expect(page.locator(WIDGET.alarm).getByText('Activée', { exact: true })).toBeVisible();
  });

  test("affiche l'état désarmé (disarmed)", async ({ page }) => {
    const disarmedStates = [
      {
        ...ALARM_STATES[0],
        state: 'disarmed',
      },
    ];

    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: disarmedStates,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'alarm');
    await expect(page.locator(WIDGET.alarm).getByText('Désactivée', { exact: true })).toBeVisible();
  });

  test("affiche l'état déclenché (triggered)", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [{ ...ALARM_STATES[0], state: 'triggered' }],
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    await expect(page.locator(WIDGET.alarm).getByText('DÉCLENCHÉE', { exact: true })).toBeVisible();
  });
});
