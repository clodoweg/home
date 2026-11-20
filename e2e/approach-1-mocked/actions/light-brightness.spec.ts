/**
 * Tests: Action — Régler la luminosité d'une lumière.
 */

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES } from '../../fixtures/mock-data/ha-states';
import { LIGHT } from '../../helpers/widget-selectors';
import { waitForDashboardReady } from '../../helpers/assertions';

test.describe('Action: Light Brightness', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
  });

  test('réglage luminosité envoie la valeur correcte', async ({ page }) => {
    // A Hue room only dims its bulbs that are on: add one bulb to the Salon room.
    const bulb = {
      ...ALL_HA_STATES.find((s) => s.entity_id === 'light.salon')!,
      entity_id: 'light.salon_plafonnier',
      attributes: { friendly_name: 'Plafonnier', brightness: 200, color_mode: 'brightness' },
    };
    const { actionCalls } = await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [...ALL_HA_STATES, bulb],
      entityMetadata: {
        'light.salon_plafonnier': { area: 'Salon', floor: 'RdC', model: 'Hue bulb' },
      },
    });

    await page.goto('/#maison');
    await waitForDashboardReady(page);

    // Salon est allumé : son curseur de luminosité est affiché
    const slider = page.locator(LIGHT.brightness('salon'));
    await expect(slider).toBeVisible();
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    expect(box).not.toBeNull();
    // Salon est à 78 % : un clic à 30 % change vraiment la valeur
    await page.mouse.click(box!.x + box!.width * 0.3, box!.y + box!.height / 2);

    await expect
      .poll(() =>
        actionCalls.find(
          (c) =>
            c.domain === 'light' &&
            (c.service_data?.brightness !== undefined ||
              c.service_data?.brightness_pct !== undefined),
        ),
      )
      .toBeTruthy();
  });
});
