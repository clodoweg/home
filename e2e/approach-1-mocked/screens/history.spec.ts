/**
 * Tests: onglet Historique (périodes, comparaison N-1, vues par domaine, croisement, droits).
 * L'horloge est fixée au 26 février 2026, dans les données Enedis et GRDF simulées.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE, USER_PROFILE, type TestUserProfile } from '../../fixtures/users';
import { openSection, waitForDashboardReady } from '../../helpers/assertions';

const NOW = new Date('2026-02-26T12:00:00+01:00');

async function openHistory(page: Page, profile: TestUserProfile = ADMIN_PROFILE, preferences = {}) {
  await page.clock.setFixedTime(NOW);
  await bypassClerkAuth(page, profile);
  const mocks = await mockAllApis(page, {
    userProfile: profile,
    widgetPreferences: { ...profile.widgetPreferences, ...preferences },
  });
  await page.goto('/');
  await waitForDashboardReady(page);
  await openSection(page, 'historique');
  await expect(page.getByTestId('history-screen')).toBeVisible();
  return mocks;
}

test.describe('Historique', () => {
  test('montre toutes les vues sans défilement horizontal, sur plusieurs lignes au besoin', async ({
    page,
  }) => {
    await openHistory(page);

    const tabs = page.getByRole('navigation', { name: "Vues de l'historique" });
    for (const id of ['energie', 'appareils', 'climat', 'animaux', 'securite', 'croiser']) {
      await expect(page.getByTestId(`history-tab-${id}`)).toBeInViewport();
    }
    const overflow = await tabs.evaluate((nav) => nav.scrollWidth - nav.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('montre l’énergie du mois, son coût et les analyses', async ({ page }) => {
    await openHistory(page);
    await page.getByTestId('history-granularity-month').click();
    await page.getByTestId('history-tab-energie').click();

    await expect(page.getByTestId('history-period-label')).toHaveText('Février 2026');
    // 12,5 + 15,2 + 11,8 + 13,6 + 14,1 + 9,8 kWh relevés par Enedis en février.
    await expect(page.getByTestId('history-energy-electricity-total')).toContainText('77');
    await expect(page.getByTestId('history-energy-gas')).toBeVisible();
    await expect(page.getByTestId('history-energy-water')).toBeVisible();
    await expect(page.getByTestId('history-gas-weather')).toBeVisible();
    await expect(page.getByTestId('history-electricity-heatmap')).toBeVisible();

    await page.getByTestId('history-unit-cost').click();
    await expect(page.getByTestId('history-energy-electricity-total')).toContainText('≈');
    await expect(page.getByTestId('history-energy-electricity-total')).toContainText('€');
  });

  test('navigue entre les périodes sans dépasser la période en cours', async ({ page }) => {
    await openHistory(page);
    await page.getByTestId('history-granularity-year').click();
    await expect(page.getByTestId('history-period-label')).toHaveText('2026');
    await expect(page.getByTestId('history-next')).toBeDisabled();
    await expect(page.getByTestId('history-electricity-calendar')).toBeVisible();

    await page.getByTestId('history-previous').click();
    await expect(page.getByTestId('history-period-label')).toHaveText('2025');
    await expect(page.getByTestId('history-next')).toBeEnabled();

    // 12 mois glissants : depuis « 2025 », janvier à décembre 2025 ; puis au plus tard février 2025
    // à janvier 2026, le mois en cours (février 2026) exclu.
    await page.getByTestId('history-granularity-rolling').click();
    await expect(page.getByTestId('history-period-label')).toHaveText(
      '12 mois : janv. 2025 – déc. 2025',
    );
    await page.getByTestId('history-next').click();
    await expect(page.getByTestId('history-period-label')).toHaveText(
      '12 mois : févr. 2025 – janv. 2026',
    );
    await expect(page.getByTestId('history-next')).toBeDisabled();

    await page.getByTestId('history-granularity-week').click();
    await expect(page.getByTestId('history-period-label')).toContainText('Semaine du');
  });

  test('les vues Appareils, Climat, Animaux et Sécurité lisent les compteurs et statistiques', async ({
    page,
  }) => {
    await openHistory(page);
    await page.getByTestId('history-granularity-month').click();

    await page.getByTestId('history-tab-appareils').click();
    await expect(page.getByTestId('history-devices-plugs')).toBeVisible();
    await expect(page.getByTestId('history-devices-washer')).not.toContainText('Pas encore');
    await expect(page.getByTestId('history-devices-lights')).toContainText('Salon');
    await expect(page.getByTestId('history-devices-spa')).toContainText('Température moyenne');
    await expect(page.getByTestId('history-devices-spa')).toContainText('°C');

    await page.getByTestId('history-tab-climat').click();
    await expect(page.getByTestId('history-climate-rooms')).toBeVisible();
    await expect(page.getByTestId('history-comfort-sensor.temperature_salon')).toBeVisible();

    await page.getByTestId('history-tab-animaux').click();
    await expect(page.getByTestId('history-pets-feeder')).toBeVisible();

    await page.getByTestId('history-tab-securite').click();
    await expect(page.getByTestId('history-security-alarm')).toBeVisible();
    await expect(page.getByTestId('history-security-alerts')).toBeVisible();
  });

  test('croise deux séries choisies', async ({ page }) => {
    await openHistory(page);
    await page.getByTestId('history-granularity-month').click();
    await page.getByTestId('history-tab-croiser').click();
    const card = page.getByTestId('history-cross');
    await expect(card).toBeVisible();
    await page.getByTestId('history-cross-select-1').selectOption('temp:sensor.temperature_salon');
    await expect(card.locator('.recharts-line')).toHaveCount(2);
  });

  test('une pièce masquée quitte le climat, un widget masqué sa vue', async ({ page }) => {
    await openHistory(page, ADMIN_PROFILE, {
      hiddenRooms: ['Chambre'],
      hiddenWidgets: ['feeder', 'fountain'],
    });
    await expect(page.getByTestId('history-tab-animaux')).toHaveCount(0);
    await page.getByTestId('history-tab-climat').click();
    await expect(page.getByTestId('history-comfort-sensor.temperature_salon')).toBeVisible();
    await expect(page.getByTestId('history-comfort-sensor.temperature_chambre')).toHaveCount(0);
  });

  test('une erreur du serveur sur les compteurs est dite, pas prise pour une période vide', async ({
    page,
  }) => {
    await page.clock.setFixedTime(NOW);
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      overrides: {
        '/api/history/usage': (route) =>
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' }),
          }),
      },
    });
    await page.goto('/');
    await waitForDashboardReady(page);
    await openSection(page, 'historique');
    await page.getByTestId('history-tab-animaux').click();
    await expect(page.getByTestId('history-pets-feeder')).toContainText('Compteurs indisponibles', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('history-pets-feeder')).not.toContainText('Pas encore');
  });

  test('sans le droit historique, pas d’onglet', async ({ page }) => {
    await bypassClerkAuth(page, USER_PROFILE);
    await mockAllApis(page, { userProfile: USER_PROFILE });
    await page.goto('/#historique');
    await waitForDashboardReady(page);
    await expect(page.getByTestId('nav-historique')).toHaveCount(0);
    await expect(page.getByTestId('history-screen')).toHaveCount(0);
  });
});
