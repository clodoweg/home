/**
 * Tests: Gestion des erreurs API — 500, réseau, données vides.
 * Vérifie que l'application ne crash pas face aux erreurs serveur.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('API Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('erreur 500 sur /api/ha/states — le tableau de bord reste utilisable', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      overrides: {
        '/api/ha/states': async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        },
      },
    });

    await page.goto('/#maison');

    await expect(page.getByTestId('menu-button')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=App Crash')).toHaveCount(0);
    await expect(page.locator('text=Something went wrong')).toHaveCount(0);
  });

  test("erreur 500 sur /api/ha/call — l'interrupteur revient à son état", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      overrides: {
        '/api/ha/call': async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        },
      },
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Tenter une action (toggle lumière)
    const lightToggle = page.getByTestId('light-toggle-salon');
    await expect(lightToggle).toHaveText('ON');
    const failedCall = page.waitForResponse(
      (r) =>
        r.url().includes('/api/ha/call') &&
        r.status() === 500 &&
        r.request().postDataJSON()?.domain === 'light',
    );
    await lightToggle.click();
    await failedCall;

    // Optimistic update rolled back after the error, and the user is told why
    await expect(lightToggle).toHaveText('ON');
    await expect(page.getByText('Action impossible')).toBeVisible();
    await expect(page.locator('text=App Crash')).toHaveCount(0);
  });

  test('erreur 500 sur le profil — propose de réessayer', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      overrides: {
        '/api/user/me': async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        },
      },
    });

    await page.goto('/#maison');

    await expect(page.getByText('Erreur de profil')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });

  test("erreur 403 sans code sur le profil — affiche l'erreur de profil", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      overrides: {
        '/api/user/me': async (route) => {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Forbidden' }),
          });
        },
      },
    });

    await page.goto('/#maison');

    // A 403 without IP_RESTRICTED / USER_NOT_FOUND is a profile error, not a global refusal
    // (those are covered by children-view and unauthorized specs).
    await expect(page.getByText('Erreur de profil')).toBeVisible();
    await expect(page.getByText('Forbidden')).toBeVisible();
  });

  test('données HA vides — dashboard se charge sans crash', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [],
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    await expect(page.locator('text=App Crash')).toHaveCount(0);
  });

  test("erreur 500 sur enedis — widget electricité gère l'erreur", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      overrides: {
        '/api/enedis/data': async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Enedis unavailable' }),
          });
        },
      },
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    await expect(page.locator('text=App Crash')).not.toBeVisible();
  });

  test("erreur 500 sur grdf — widget gaz gère l'erreur", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      overrides: {
        '/api/grdf': async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'GRDF unavailable' }),
          });
        },
      },
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    await expect(page.locator('text=App Crash')).not.toBeVisible();
  });
});
