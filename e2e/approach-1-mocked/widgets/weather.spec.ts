/**
 * Tests: WeatherWidget — forecast et détails journaliers.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { WEATHER_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady, expectWidgetVisible } from '../../helpers/assertions';

test.describe('WeatherWidget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche la température actuelle et les conditions', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: WEATHER_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'weather');
    const widget = page.locator('[data-testid="widget-weather"]');

    // Température actuelle: 8°C
    await expect(widget.getByText('8', { exact: false }).first()).toBeVisible();
  });

  test('affiche les prévisions sur plusieurs jours', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: WEATHER_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'weather');
    const widget = page.locator('[data-testid="widget-weather"]');

    // Les prévisions devraient inclure des températures futures
    await expect(widget.getByText('10', { exact: false }).first()).toBeVisible(); // Jour 1
    await expect(widget.getByText('12', { exact: false }).first()).toBeVisible(); // Jour 2
  });

  test('affiche pression et vent', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: WEATHER_STATES,
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);
    await expectWidgetVisible(page, 'weather');
    const widget = page.locator('[data-testid="widget-weather"]');

    // Pressure: 1013 hPa, Vent: 15 km/h
    await expect(widget.getByText('1013', { exact: false }).first()).toBeVisible();
    await expect(widget.getByText('15 km/h', { exact: false }).first()).toBeVisible();
  });
});
