import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { LIGHT } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Resilience: Optimistic UI & Rollbacks', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test("L'UI réagit immédiatement avant que l'API ne réponde (Optimistic UI)", async ({ page }) => {
    // Mock l'API initiale
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    // 🚨 OVERRIDE DIRECT 🚨
    await page.route('**/api/ha/call', async (route) => {
      if (route.request().method() === 'POST') {
        // Délai artificiel de 3s pour bien laisser le temps à l'Optimistic UI de briller
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // On cherche le bouton du Salon
    const toggleBtn = page.locator(LIGHT.toggle('salon'));

    // On s'assure qu'il est bien visible et on scrolle
    await toggleBtn.scrollIntoViewIfNeeded();
    await expect(toggleBtn).toBeVisible();

    // État initial (mocké à 'on' dans ha-states.ts)
    await expect(toggleBtn).toHaveText('ON');

    const lightResponse = page.waitForResponse(
      (r) => r.url().includes('/api/ha/call') && r.request().postDataJSON()?.domain === 'light',
    );
    await toggleBtn.click();

    // 🚨 VÉRIFICATION CRITIQUE 🚨
    // Le texte doit passer à 'OFF' IMMÉDIATEMENT (on donne 2s de marge car l'environnement de test peut être lent)
    // mais le serveur ne répondra qu'après 3s.
    await expect(toggleBtn).toHaveText('OFF', { timeout: 2000 });

    // On attend la fin de l'appel pour éviter les erreurs de navigation en fin de test
    await lightResponse;
  });

  test("L'UI annule automatiquement l'action au bout d'un moment en cas d'erreur réseau (Rollback)", async ({
    page,
  }) => {
    // Mock l'API initiale
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
    });

    // 🚨 OVERRIDE DIRECT pour simuler une erreur 500 avec délai 🚨
    await page.route('**/api/ha/call', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    const toggleBtn = page.locator(LIGHT.toggle('salon'));
    await toggleBtn.scrollIntoViewIfNeeded();
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('ON');

    await toggleBtn.click();

    // 1. Optimistic Update : ON -> OFF (immédiat)
    await expect(toggleBtn).toHaveText('OFF', { timeout: 2000 });

    // 2. Erreur intervient après 1.5s -> Rollback : OFF -> ON
    // On attend que l'erreur soit processée (le délai est de 1500ms + un peu de temps pour React Query)
    await expect(toggleBtn).toHaveText('ON', { timeout: 5000 });
  });
});
