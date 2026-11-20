/**
 * Tests: Action — Déclencher un snapshot Arlo (admin only).
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Arlo Snapshot', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('clic sur refresh déclenche un appel /api/arlo', async ({ page }) => {
    const arloCalls: unknown[] = [];

    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    // Enregistré APRÈS mockAllApis : Playwright utilise LIFO, ce handler prend priorité
    await page.route('**/api/arlo**', async (route) => {
      arloCalls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ snapshot: true }),
      });
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    // camera.aarlo_jardin → suffix 'jardin' → testID 'arlo-refresh-jardin'
    const refreshBtn = page.locator('[data-testid="arlo-refresh-jardin"]');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect.poll(() => arloCalls.length).toBeGreaterThan(0);
  });

  test('le widget arlo est visible en mode admin', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-arlo"]');
    await expect(widget).toBeVisible();
  });

  test('affiche le bouton de refresh pour chaque caméra', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    await page.goto('/#securite');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-arlo"]');
    await expect(widget).toBeVisible();

    // camera.aarlo_jardin → arlo-refresh-jardin
    await expect(widget.locator('[data-testid="arlo-refresh-jardin"]')).toBeVisible();
  });
});
