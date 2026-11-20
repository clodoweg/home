import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';

test.describe('Unauthorized Access (403 Handling)', () => {
  test('redirects to login when backend returns 403 Forbidden', async ({ page }) => {
    // 1. Setup: User is signed in via Clerk but backend will return 403 for profile
    await bypassClerkAuth(page, ADMIN_PROFILE);

    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.route('**/api/user/me', (route) => {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Utilisateur non autorisé' }),
      });
    });

    // 3. Navigate to Dashboard
    await page.goto('/');

    // 4. Verification: Should see the login error message in our new error view
    const errorHeader = page.getByText('Accès refusé', { exact: true });
    await expect(errorHeader).toBeVisible({ timeout: 15_000 });

    const errorMessage = page.getByText('Utilisateur non autorisé', { exact: true });
    await expect(errorMessage).toBeVisible();

    // 5. Verification: Should see the "Déconnexion" button in the error view
    await expect(page.locator('text=Déconnexion')).toBeVisible();

    // 6. Optional: Verify that the login screen is NOT visible yet
    await expect(page.locator('text=Se connecter avec Google')).not.toBeVisible();
  });
});
