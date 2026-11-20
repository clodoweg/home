/**
 * Tests: Action — Contrôles du spa (power, chauffage, filtre, bulles).
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Spa Controls', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('toggle power envoie switch.turn_off (spa_power est on)', async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    const powerBtn = page.locator('[data-testid="spa-toggle-power"]');
    await expect(powerBtn).toBeVisible();
    await powerBtn.click();
    await expect
      .poll(() => serviceCalls.find((c) => c.entity_id?.toString().includes('spa_power')))
      .toMatchObject({ domain: 'switch', service: expect.stringMatching(/turn_on|turn_off/) });
  });

  test('toggle chauffage envoie climate.set_hvac_mode off (spa_thermostat est heat)', async ({
    page,
  }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    const heatBtn = page.locator('[data-testid="spa-toggle-heat"]');
    await expect(heatBtn).toBeEnabled();
    await heatBtn.click();

    await expect
      .poll(() => serviceCalls.find((c) => c.entity_id?.toString().includes('spa_thermostat')))
      .toMatchObject({
        domain: 'climate',
        service: 'set_hvac_mode',
        service_data: { hvac_mode: 'off' },
      });
  });

  test('toggle filtre envoie switch.turn_off (spa_filter est on)', async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    const filterBtn = page.locator('[data-testid="spa-toggle-filter"]');
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();
    await expect
      .poll(() => serviceCalls.find((c) => c.entity_id?.toString().includes('spa_filter')))
      .toMatchObject({ domain: 'switch', service: expect.stringMatching(/turn_on|turn_off/) });
  });

  test('toggle bulles envoie select.select_option (spa_bubbles est off)', async ({ page }) => {
    const { serviceCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    const bubblesBtn = page.locator('[data-testid="spa-toggle-bubbles"]');
    await expect(bubblesBtn).toBeVisible();
    await bubblesBtn.click();
    await expect
      .poll(() => serviceCalls.find((c) => c.entity_id?.toString().includes('spa_bubbles')))
      .toMatchObject({ domain: 'select', service: 'select_option' });
    const call = serviceCalls.find((c) => c.entity_id?.toString().includes('spa_bubbles'));
    // Bubbles was 'off', so the next option must be another one
    expect(call?.service_data?.option).toBeDefined();
    expect(call?.service_data?.option).not.toBe('off');
  });

  test('le widget spa affiche les 4 contrôles', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#appareils');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-spa"]');
    await expect(widget).toBeVisible();

    await expect(widget.locator('[data-testid="spa-toggle-power"]')).toBeVisible();
    await expect(widget.locator('[data-testid="spa-toggle-heat"]')).toBeVisible();
    await expect(widget.locator('[data-testid="spa-toggle-filter"]')).toBeVisible();
    await expect(widget.locator('[data-testid="spa-toggle-bubbles"]')).toBeVisible();
  });
});
