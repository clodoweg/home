/**
 * Reusable assertion helpers for widget tests.
 */

import { expect, Page } from '@playwright/test';
import { WIDGET, WIDGET_SECTION } from './widget-selectors';

/**
 * Asserts that a widget is visible on the dashboard.
 */
export async function expectWidgetVisible(page: Page, widgetKey: keyof typeof WIDGET) {
  const selector = WIDGET[widgetKey];
  await expect(page.locator(selector)).toBeVisible({ timeout: 10_000 });
}

/**
 * Waits for the app shell (header, navigation) to be rendered: the profile and the first data are
 * loaded. Widgets live in sections (`/#maison`, `/#energie`…): a spec opens the section of its
 * widget, then relies on web-first assertions (auto-retry) for it, never on `networkidle`, which
 * never settles with the dashboard's polling and camera refreshes.
 */
export async function waitForDashboardReady(page: Page) {
  await expect(page.getByTestId('menu-button')).toBeVisible({ timeout: 15_000 });
}

/**
 * Opens a section through the navigation (header pills on desktop, bottom bar on mobile).
 */
export async function openSection(
  page: Page,
  section: 'accueil' | 'maison' | 'energie' | 'securite' | 'animaux' | 'appareils' | 'historique',
) {
  await page.getByTestId(`nav-${section}`).click();
}

/**
 * Opens the section of a widget (when it is not the current one) and returns the widget locator.
 */
export async function showWidget(page: Page, widgetKey: keyof typeof WIDGET) {
  const link = page.getByTestId(`nav-${WIDGET_SECTION[widgetKey]}`);
  if ((await link.getAttribute('aria-current')) !== 'page') await link.click();
  return page.locator(WIDGET[widgetKey]);
}
