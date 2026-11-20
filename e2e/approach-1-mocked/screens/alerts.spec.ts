/**
 * Alerts bell (admins): unread badge, panel listing the alerts, read on opening, an alert opening
 * its widget; no bell for other users.
 */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE, USER_PROFILE } from '../../fixtures/users';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Cloche des alertes', () => {
  test('montre les alertes non lues, les marque lues et ouvre leur widget', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const api = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    const bell = page.getByTestId('alerts-button');
    await expect(page.getByTestId('alerts-badge')).toHaveText('2');
    await expect(bell).toHaveAccessibleName('Alertes, 2 nouvelles');

    await bell.click();
    await expect(page.getByRole('dialog', { name: 'Alertes' })).toBeVisible();
    await expect(page.getByTestId('alert-3')).toContainText('Alarme activée (absence)');
    await expect(page.getByTestId('alert-3')).toHaveAttribute('data-unread', 'true');
    await expect(page.getByTestId('alert-1')).not.toHaveAttribute('data-unread');
    await expect.poll(() => api.alertReads).toEqual([{}]);
    await expect(page.getByTestId('alerts-badge')).toHaveCount(0);

    await page.getByTestId('alert-2').click();
    await expect(page.getByTestId('alerts-screen')).toHaveCount(0);
    await expect(page.getByTestId('widget-petkit')).toBeVisible();
  });

  test("n'apparaît pas pour un utilisateur non admin", async ({ page }) => {
    await bypassClerkAuth(page, USER_PROFILE);
    await mockAllApis(page, { userProfile: USER_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('menu-button')).toBeVisible();
    await expect(page.getByTestId('alerts-button')).toHaveCount(0);
  });
});
