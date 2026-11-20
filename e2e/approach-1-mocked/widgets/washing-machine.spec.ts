/**
 * Tests: WashingMachineWidget — statut du cycle et boutons d'actualisation des détails.
 */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES, WASHING_MACHINE_STATES } from '../../fixtures/mock-data/ha-states';
import { WIDGET } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('WashingMachineWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche le cycle en cours', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [...ALL_HA_STATES, ...WASHING_MACHINE_STATES],
    });
    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    await expect(page.locator(WIDGET.washing_machine)).toBeVisible();
    await expect(page.locator(WIDGET.washing_machine)).toContainText('Coton');
  });

  // B08: the buttons used to look for `button.*` entities among the sensors only.
  test("les boutons d'actualisation pressent les boutons Home Assistant", async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [...ALL_HA_STATES, ...WASHING_MACHINE_STATES],
    });
    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    const widget = page.locator(WIDGET.washing_machine);
    await widget.getByTestId('wash-details-toggle').click();
    await widget.getByTestId('wash-btn-programs').click();
    await widget.getByTestId('wash-btn-settings').click();

    await expect
      .poll(() => serviceCalls.filter((c) => c.domain === 'button').map((c) => c.entity_id))
      .toEqual([
        'button.washing_machine_get_programs_details',
        'button.washing_machine_get_settings_details',
      ]);
  });
});
