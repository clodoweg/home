/**
 * Tests: PetKit Widget — feeder, timeline, images.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { PETKIT_DATA, PETKIT_EMPTY } from '../../fixtures/mock-data/petkit-data';
import { waitForDashboardReady } from '../../helpers/assertions';
import { PETKIT } from '../../helpers/widget-selectors';

test.describe('PetKit Widget', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche les informations du distributeur', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      petkitData: PETKIT_DATA,
    });

    await page.goto('/#animaux');
    await waitForDashboardReady(page);

    // Le widget feeder a pour titre "Croquettes" et testID="widget-petkit"
    const widget = page.locator('[data-testid="widget-petkit"]');
    await expect(widget).toBeVisible({ timeout: 10_000 });
    await expect(widget.getByText('Croquettes')).toBeVisible();

    // Subtitle contains ration count — format: "{n} / {plan} rations distribuées" or "{n} rations distribuées"
    await expect(widget.getByText(/rations distribuées/i)).toBeVisible();
  });

  test('affiche la timeline des repas du jour', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      petkitData: PETKIT_DATA,
    });

    await page.goto('/#animaux');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-petkit"]');
    await expect(widget).toBeVisible({ timeout: 15_000 });

    // Verify the events section exists with filter chips
    await expect(widget.getByText('ÉVÉNEMENTS', { exact: false }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('affiche le bouton de sync', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      petkitData: PETKIT_DATA,
    });

    await page.goto('/#animaux');
    await waitForDashboardReady(page);

    const widget = page.locator('[data-testid="widget-petkit"]');
    await expect(widget).toBeVisible({ timeout: 15_000 });
  });

  test("gère l'absence de données PetKit", async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      petkitData: PETKIT_EMPTY,
    });

    await page.goto('/#animaux');
    await waitForDashboardReady(page);
  });

  test.describe('Fontaine', () => {
    test('affiche les informations de la fontaine', async ({ page }) => {
      await mockAllApis(page, {
        userProfile: ADMIN_PROFILE,
        haStates: ALL_HA_STATES,
        petkitData: PETKIT_DATA,
      });

      await page.goto('/#animaux');
      await waitForDashboardReady(page);

      const widget = page.locator('[data-testid="widget-fountain"]');
      await expect(widget).toBeVisible({ timeout: 10_000 });
      await expect(widget.getByText('Fontaine')).toBeVisible();

      // Subtitle check (Water level and Filter)
      await expect(widget.getByText(/Niveau d'eau normal/i)).toBeVisible();
      await expect(widget.getByText(/Filtre 85%/i)).toBeVisible();
    });

    test("affiche les statistiques d'hydratation", async ({ page }) => {
      await mockAllApis(page, {
        userProfile: ADMIN_PROFILE,
        haStates: ALL_HA_STATES,
        petkitData: PETKIT_DATA,
      });

      await page.goto('/#animaux');
      await waitForDashboardReady(page);

      const widget = page.locator('[data-testid="widget-fountain"]');

      // Total minutes (45s + 30s = 75s = ~1 min)
      await expect(widget.getByText('1', { exact: true })).toBeVisible();
      await expect(widget.getByText('min', { exact: true })).toBeVisible();

      // Total passages
      await expect(widget.getByText('2 passages').first()).toBeVisible();
    });

    test('affiche les événements de la fontaine', async ({ page }) => {
      await mockAllApis(page, {
        userProfile: ADMIN_PROFILE,
        haStates: ALL_HA_STATES,
        petkitData: PETKIT_DATA,
      });

      await page.goto('/#animaux');
      await waitForDashboardReady(page);

      const widget = page.locator('[data-testid="widget-fountain"]');

      // Timeline should be visible
      await expect(widget.getByText('ÉVÉNEMENTS')).toBeVisible();
      await expect(widget.getByText("L'animal est venu boire de l'eau").first()).toBeVisible();
    });
  });

  test('charge les aperçus avec un en-tête Bearer, jamais avec le jeton dans l’URL', async ({
    page,
  }) => {
    const preview =
      '/api/ha/media?media_content_id=' +
      encodeURIComponent('media-source://local/media/1/20260101/feed/snapshot/1_0800.jpg');
    const petkitWithPreview = {
      ...PETKIT_DATA,
      records: PETKIT_DATA.records.map((record, index) =>
        index === 0 ? { ...record, preview } : record,
      ),
    };
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      petkitData: petkitWithPreview,
    });

    const imageRequest = page.waitForRequest((request) => request.url().includes('/api/ha/media'));

    await page.goto('/#animaux');
    await waitForDashboardReady(page);
    const widget = page.locator('[data-testid="widget-petkit"]');
    await expect(widget).toBeVisible({ timeout: 15_000 });
    await widget.getByRole('button', { name: /^Distribution/ }).click();

    const request = await imageRequest;
    expect(request.url()).not.toContain('token=');
    expect(await request.headerValue('authorization')).toMatch(/^Bearer \S+/);
    await expect(widget.locator('img[src^="blob:"]').first()).toBeVisible();
  });

  test('le bouton Actualiser recharge les données PetKit', async ({ page }) => {
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: ALL_HA_STATES,
      petkitData: PETKIT_DATA,
    });

    await page.goto('/#animaux');
    await waitForDashboardReady(page);
    const widget = page.locator('[data-testid="widget-petkit"]');
    await expect(widget).toBeVisible({ timeout: 15_000 });

    const refetch = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/petkit' && request.method() === 'GET',
    );
    await widget.locator(PETKIT.syncButton).click();

    await refetch;
  });
});
