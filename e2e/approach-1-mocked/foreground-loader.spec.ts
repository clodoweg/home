/**
 * Tests: retour au premier plan et premier affichage sans attente bloquante.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../fixtures/api-mocks';
import { bypassClerkAuth } from '../fixtures/auth';
import { ADMIN_PROFILE } from '../fixtures/users';
import { ALL_HA_STATES } from '../fixtures/mock-data/ha-states';
import { waitForDashboardReady } from '../helpers/assertions';
import type { QueryClient } from '@tanstack/react-query';

test.describe('Chargement sans attente bloquante', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('au retour au premier plan, même avec des données vieilles, rien ne bloque l’écran', async ({
    page,
  }) => {
    await mockAllApis(page, { userProfile: ADMIN_PROFILE, haStates: ALL_HA_STATES });
    await page.goto('/');
    await waitForDashboardReady(page);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      const client = (window as unknown as { queryClient: QueryClient }).queryClient;
      client
        .getQueryCache()
        .find({ queryKey: ['ha', 'states'] })
        ?.setState({ dataUpdatedAt: Date.now() - 11 * 60 * 1000 });
    });

    // The refresh stays pending until the test has checked the screen.
    let releaseStates: () => void = () => {};
    const statesReleased = new Promise<void>((resolve) => (releaseStates = resolve));
    let statesRequested = false;
    await page.route('**/api/ha/states', async (route) => {
      statesRequested = true;
      await statesReleased;
      return route.fulfill({ status: 200, json: ALL_HA_STATES });
    });

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // The refresh runs in the background: the last known values stay on screen and usable.
    await expect.poll(() => statesRequested).toBe(true);
    await expect(page.getByText('Mise à jour en cours...')).toHaveCount(0);
    await expect(page.getByTestId('home-summary-lights')).toBeVisible();
    await page.getByRole('link', { name: 'Ouvrir les lumières' }).click();
    await expect(page).toHaveURL(/#maison$/);

    releaseStates();
  });

  test('le tableau de bord s’affiche sans attendre Petkit, le bloc Animaux suit', async ({
    page,
  }) => {
    await mockAllApis(page, { userProfile: ADMIN_PROFILE, haStates: ALL_HA_STATES });
    let releasePetkit: () => void = () => {};
    const petkitReleased = new Promise<void>((resolve) => (releasePetkit = resolve));
    await page.route('**/api/petkit**', async (route) => {
      await petkitReleased;
      return route.fallback();
    });

    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-summary-lights')).toBeVisible();
    await expect(page.getByTestId('home-summary-pets-loading')).toBeVisible();

    releasePetkit();
    await expect(page.getByTestId('home-summary-pets')).toBeVisible();
    await expect(page.getByTestId('home-summary-pets-loading')).toHaveCount(0);
  });
});
