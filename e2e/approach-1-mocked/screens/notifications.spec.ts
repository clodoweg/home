/**
 * Tests: écran Notifications — catégories d'alertes, enregistrés côté back.
 */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Écran Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test("désactive une catégorie activée par défaut et l'enregistre", async ({ page }) => {
    const { preferenceUpdates } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-notifications').click();
    // B22: a category without a stored preference is on; one click must switch it off.
    const alarm = page.getByRole('button', { name: /^Alarme Activation/ });
    await expect(alarm).toHaveAttribute('aria-pressed', 'true');
    await alarm.click();
    await expect(alarm).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: /Enregistrer/ }).click();

    await expect
      .poll(() => preferenceUpdates.find((u) => u.notificationPreferences))
      .toMatchObject({ notificationPreferences: { alarm: false } });
  });
});
