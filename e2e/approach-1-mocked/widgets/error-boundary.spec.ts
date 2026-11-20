import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('WidgetErrorBoundary', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('affiche une erreur quand un widget crash au rendu, mais le reste du tableau fonctionne', async ({
    page,
  }) => {
    // Passer une entité météo avec un state non-string force un crash PENDANT le rendu :
    // translateCondition({}) → {}.replace('-', ' ') → TypeError
    // (erreur synchrone dans le corps du composant, capturée par WidgetErrorBoundary)
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [
        {
          entity_id: 'weather.home',
          state: {} as unknown as string,
          attributes: {},
          last_changed: '',
          last_updated: '',
        },
      ],
    });

    await page.goto('/#maison');

    // Attendre que le tableau de bord soit chargé
    await waitForDashboardReady(page);

    // Le widget météo devrait crasher et afficher la boundary d'erreur
    const errorBoundary = page.getByText('Erreur: Weather');

    // On devrait voir l'erreur spécifique pour le composant "Weather"
    await expect(errorBoundary).toBeVisible({ timeout: 10000 });

    // L'UI globale (le Dashboard) doit toujours être interactive et vivante
    await expect(page.getByTestId('nav-accueil')).toBeVisible();
    await expect(page.getByTestId('menu-button')).toBeVisible();
  });
});
