import { test, expect } from '@playwright/test';
import { mockAllApis } from '../fixtures/api-mocks';
import { bypassClerkAuth } from '../fixtures/auth';
import { ADMIN_PROFILE } from '../fixtures/users';
import { waitForDashboardReady } from '../helpers/assertions';

test.describe('Navigation Menu', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);
  });

  test('peut ouvrir et fermer le menu', async ({ page, isMobile }) => {
    const menuButton = page.getByTestId('menu-button');
    await menuButton.click();

    // Check if menu items are visible
    await expect(page.getByTestId('menu-item-refresh')).toBeVisible();

    // Close menu
    if (isMobile) {
      // On mobile, the overlay is a bottom sheet with its own close button.
      await page.getByTestId('overlay-close-button-mobile').click();
    } else {
      // On desktop, use the X button in the modal header.
      await page.getByTestId('overlay-close-button').click();
    }

    await expect(page.getByTestId('menu-item-refresh')).not.toBeVisible();
  });

  test('peut déclencher un rafraîchissement', async ({ page }) => {
    // Intercept API call to verify refresh
    let refreshCalled = false;
    await page.route('**/api/ha/states', async (route) => {
      refreshCalled = true;
      await route.continue();
    });

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-refresh').click();

    // Menu should close
    await expect(page.getByTestId('menu-item-refresh')).not.toBeVisible();

    // Verify refresh was triggered
    expect(refreshCalled).toBe(true);
  });

  test('peut basculer le mode auto/manuel', async ({ page }) => {
    await page.getByTestId('menu-button').click();

    const autoToggle = page.getByTestId('menu-item-auto-refresh');

    // Default is Auto (Sparkles icon / "Auto" text)
    await expect(autoToggle.getByText('Auto')).toBeVisible();

    await autoToggle.click();

    // Should switch to Manuel
    await expect(autoToggle.getByText('Manuel')).toBeVisible();
  });

  test('peut naviguer vers la réorganisation', async ({ page }) => {
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();

    // Overlay title should be "Réorganiser"
    await expect(page.getByTestId('overlay-title')).toHaveText('Réorganiser');
  });

  test('peut se déconnecter', async ({ page }) => {
    await page.getByTestId('menu-button').click();

    // Verifie que le bouton de déconnexion est présent
    const logoutButton = page.getByTestId('menu-item-logout');
    await expect(logoutButton).toBeVisible();
  });
});
