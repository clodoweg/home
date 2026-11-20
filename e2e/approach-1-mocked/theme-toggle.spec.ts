/** Theme switch in the header: applies the theme at once and saves it in the preferences. */
import { test, expect } from '@playwright/test';
import { mockAllApis } from '../fixtures/api-mocks';
import { bypassClerkAuth } from '../fixtures/auth';
import { ADMIN_PROFILE } from '../fixtures/users';
import { waitForDashboardReady } from '../helpers/assertions';

test.describe('Sélecteur de thème', () => {
  test('bascule clair / sombre et enregistre le choix', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const { preferenceUpdates } = await mockAllApis(page, {
      userProfile: { ...ADMIN_PROFILE, theme: 'dark' },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    const html = page.locator('html');
    const light = page.getByTestId('theme-toggle-light');
    const dark = page.getByTestId('theme-toggle-dark');
    await expect(html).toHaveClass(/dark/);
    await expect(dark).toHaveAttribute('aria-pressed', 'true');

    await light.click();
    await expect(html).toHaveClass(/light/);
    await expect(light).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => preferenceUpdates.some((u) => u.theme === 'light')).toBe(true);

    await dark.click();
    await expect(html).toHaveClass(/dark/);
    await expect.poll(() => preferenceUpdates.some((u) => u.theme === 'dark')).toBe(true);
  });
});
