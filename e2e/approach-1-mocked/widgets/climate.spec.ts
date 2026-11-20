/**
 * Tests: ClimateWidget — consignes, marche/arrêt et modes des thermostats.
 */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { WIDGET, CLIMATE } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('ClimateWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche chaque thermostat avec sa température', async ({ page }) => {
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const widget = page.locator(WIDGET.climate);
    await expect(widget).toBeVisible();
    await expect(page.locator(CLIMATE.card('climate.salon'))).toContainText('20.5');
    await expect(page.locator(CLIMATE.card('climate.chambre'))).toContainText('18.8');
  });

  test("l'arrêt envoie set_hvac_mode off", async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/#maison');
    await waitForDashboardReady(page);

    await page.locator(CLIMATE.power('climate.salon')).click();

    await expect
      .poll(() => serviceCalls.find((c) => c.domain === 'climate'))
      .toMatchObject({
        service: 'set_hvac_mode',
        entity_id: 'climate.salon',
        service_data: { hvac_mode: 'off' },
      });
  });

  test('un thermostat éteint se rallume dans son premier mode', async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [
        {
          entity_id: 'climate.salon',
          state: 'off',
          attributes: {
            friendly_name: 'Thermostat Salon',
            temperature: 21,
            current_temperature: 20.5,
            hvac_modes: ['heat', 'off'],
            min_temp: 7,
            max_temp: 30,
          },
          last_changed: '2026-02-25T06:00:00Z',
          last_updated: '2026-02-25T06:00:00Z',
        },
      ],
    });
    await page.goto('/#maison');
    await waitForDashboardReady(page);

    await page.locator(CLIMATE.power('climate.salon')).click();

    await expect
      .poll(() => serviceCalls.find((c) => c.domain === 'climate'))
      .toMatchObject({ service: 'set_hvac_mode', service_data: { hvac_mode: 'heat' } });
  });
});
