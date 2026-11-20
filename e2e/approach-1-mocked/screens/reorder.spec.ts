/**
 * Tests: écran Réorganiser — visibilité des widgets, enregistrée côté back et conservée.
 */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { WIDGET } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Écran Réorganiser', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('masquer un widget le retire du tableau de bord, même après rechargement', async ({
    page,
    isMobile,
  }) => {
    const { preferenceUpdates } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/#securite');
    await waitForDashboardReady(page);
    await expect(page.locator(WIDGET.alarm)).toBeVisible();

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();
    await page.getByTestId('reorder-tab-widgets').click();
    await page.getByRole('button', { name: 'Masquer Alarme' }).click();

    await expect
      .poll(() => preferenceUpdates.find((u) => u.hiddenWidgets)?.hiddenWidgets)
      .toContain('alarm');

    if (isMobile) await page.getByTestId('overlay-close-button-mobile').click();
    else await page.getByTestId('overlay-close-button').click();
    await expect(page.locator(WIDGET.alarm)).toHaveCount(0);

    await page.reload();
    await waitForDashboardReady(page);
    await expect(page.locator(WIDGET.arlo)).toBeVisible();
    await expect(page.locator(WIDGET.alarm)).toHaveCount(0);
  });

  test('un widget masqué peut être réaffiché', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: { ...ADMIN_PROFILE.widgetPreferences, hiddenWidgets: ['alarm'] },
    });
    await page.goto('/#securite');
    await waitForDashboardReady(page);
    await expect(page.locator(WIDGET.alarm)).toHaveCount(0);

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-reorder').click();
    await page.getByTestId('reorder-tab-widgets').click();
    await page.getByRole('button', { name: 'Afficher Alarme' }).click();

    await expect(page.getByRole('button', { name: 'Masquer Alarme' })).toBeVisible();
  });
});
