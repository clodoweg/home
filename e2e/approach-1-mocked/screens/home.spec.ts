/**
 * Tests: écran d'accueil (tuiles bento) et navigation entre les sections.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockAllApis } from '../../fixtures/api-mocks';
import { bypassClerkAuth } from '../../fixtures/auth';
import { ADMIN_PROFILE, CHILDREN_PROFILE, USER_PROFILE } from '../../fixtures/users';
import { ALL_HA_STATES, WASHING_MACHINE_STATES } from '../../fixtures/mock-data/ha-states';
import { TEMPERATURE, WIDGET } from '../../helpers/widget-selectors';
import { openSection, waitForDashboardReady } from '../../helpers/assertions';

/**
 * Checks the folding after a home link: on a phone, only the linked widgets are unfolded; on a
 * wider screen, widgets do not fold at all: their header is no toggle.
 *
 * @param page - The page.
 * @param unfolded - Widgets the link opened.
 * @param others - Other widgets of the section.
 */
const expectUnfoldedOnly = async (page: Page, unfolded: string[], others: string[]) => {
  const isPhone = page.viewportSize()!.width < 768;
  for (const id of [...unfolded, ...others]) {
    const header = page.getByTestId(`widget-header-${id}`);
    if (isPhone) {
      await expect(header).toHaveAttribute('aria-expanded', String(unfolded.includes(id)));
    } else {
      await expect(header).not.toHaveAttribute('aria-expanded');
      await expect(header).not.toHaveRole('button');
    }
  }
};

test.describe('Accueil et sections', () => {
  test("l'accueil ne montre que les blocs de résumé des widgets visibles", async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: { ...ADMIN_PROFILE.widgetPreferences, hiddenWidgets: ['alarm', 'arlo'] },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-overview')).toBeVisible();
    await expect(page.getByTestId('home-summary-today')).toBeVisible();
    await expect(page.getByTestId('home-summary-lights')).toBeVisible();
    await expect(page.getByTestId('home-summary-temperature')).toBeVisible();
    // Plus de petite tuile par widget sous les blocs.
    await expect(page.locator('[data-testid^="home-tile-"]')).toHaveCount(0);
    // Alarme et caméras masquées : pas de bloc sécurité.
    await expect(page.getByTestId('home-summary-security')).toHaveCount(0);

    // Les widgets vivent dans les sections, pas sur l'accueil.
    await expect(page.locator(WIDGET.lights)).toHaveCount(0);
  });

  test('un bloc ne montre que ce que son widget montre : capteur et pièce masqués exclus', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: {
        ...ADMIN_PROFILE.widgetPreferences,
        hiddenSensors: ['sensor.temperature_chambre'],
        hiddenRooms: ['Cuisine'],
      },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    const temperature = page.getByTestId('home-summary-temperature');
    await expect(temperature).toContainText('Salon');
    await expect(temperature).toContainText('20,5°');
    await expect(temperature).not.toContainText('Chambre');

    // La cuisine est allumée mais masquée : elle ne compte pas.
    await expect(page.getByTestId('home-summary-lights')).not.toContainText('Cuisine');
  });

  test('un bloc ouvre sa section, et le retour arrière revient à l’accueil', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await page.getByTestId('home-alarm-link').click();
    await expect(page).toHaveURL(/#securite$/);
    await expect(page.locator(WIDGET.alarm)).toBeVisible();
    await expect(page.getByTestId('nav-securite')).toHaveAttribute('aria-current', 'page');

    await page.goBack();
    await expect(page.getByTestId('home-overview')).toBeVisible();
  });

  test('la navigation change de section et un lien direct y arrive', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/#energie');
    await waitForDashboardReady(page);
    await expect(page.locator(WIDGET.gas)).toBeVisible();
    await expect(page.locator(WIDGET.lights)).toHaveCount(0);

    await openSection(page, 'maison');
    await expect(page.locator(WIDGET.lights)).toBeVisible();
    await expect(page.locator(WIDGET.gas)).toHaveCount(0);
  });

  test('« Tout éteindre » éteint les lumières allumées', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const { serviceCalls } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await page.getByTestId('home-lights-off').click();

    await expect
      .poll(() =>
        serviceCalls
          .filter((c) => c.domain === 'light' && c.service === 'turn_off')
          .flatMap((c) => c.entity_id)
          .sort(),
      )
      .toEqual(['light.cuisine', 'light.salon']);
  });

  test('la tuile du jour montre la météo, la température du salon et les prévisions', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    const today = page.getByTestId('home-summary-today');
    await expect(today).toContainText('Nuageux');
    await expect(today).toContainText('8°');
    await expect(today).toContainText('Salon');
    await expect(today).toContainText('20,5°');
    await expect(today).toContainText('15 km/h');
    await expect(page.getByTestId('home-forecast')).toContainText('12°');
  });

  test('la température dehors vient du capteur extérieur de la maison, pas de la météo', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [
        ...ALL_HA_STATES,
        {
          entity_id: 'sensor.temperature_exterieur',
          state: '10.7',
          attributes: { friendly_name: 'Température Exterieur', device_class: 'temperature' },
          last_changed: '2026-02-25T06:30:00Z',
          last_updated: '2026-02-25T06:30:00Z',
        },
      ],
      entityMetadata: {
        'sensor.temperature_exterieur': { area: 'Exterieur', floor: 'Exterieur', model: 'Sensor' },
      },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    // La météo annonce 8° ; le capteur du jardin mesure 10,7°.
    await expect(page.getByTestId('home-outdoor-temp')).toHaveText('10,7°');
    await expect(page.getByTestId('home-summary-today')).toContainText('Dehors · Nuageux');
    // Le capteur extérieur ne remplace jamais le salon.
    await expect(page.getByTestId('home-summary-today')).toContainText('20,5°');
  });

  test('la tuile lumières allume tout, et bascule une pièce', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const { serviceCalls } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    const lights = page.getByTestId('home-summary-lights');
    await expect(lights).toContainText('allumées sur 3');
    const chambre = page.getByTestId('home-light-room-Chambre');
    await expect(chambre).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId('home-lights-on').click();
    await expect
      .poll(() =>
        serviceCalls
          .filter((c) => c.domain === 'light' && c.service === 'turn_on')
          .flatMap((c) => c.entity_id),
      )
      .toEqual(['light.chambre']);
    // Mise à jour optimiste : la pièce passe allumée, il n'y a plus rien à allumer.
    await expect(chambre).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('home-lights-on')).toBeDisabled();

    await page.getByTestId('home-light-room-Salon').click();
    await expect
      .poll(() =>
        serviceCalls
          .filter((c) => c.domain === 'light' && c.service === 'turn_off')
          .flatMap((c) => c.entity_id),
      )
      .toEqual(['light.salon']);
  });

  test('la tuile animaux résume distributeur et fontaine, et sert une ration en un appui', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const { actionCalls } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    const feeds = () => actionCalls.filter((c) => c.domain === 'petkit' && c.service === 'feed');
    await page.goto('/');
    await waitForDashboardReady(page);

    const pets = page.getByTestId('home-summary-pets');
    await expect(pets).toContainText('Croquettes');
    await expect(pets).toContainText('rations aujourd');
    await expect(pets).toContainText('Fontaine');
    await expect(pets).toContainText('Filtre 85 %');

    // Un seul appui sert la ration, comme le bouton « Nourrir » du widget.
    const feed = page.getByTestId('home-feed');
    await expect(feed).toHaveText('Donner une ration');
    await feed.click();
    await expect.poll(() => feeds().length).toBe(1);
  });

  test('la tuile appareils résume spa, lave-linge et imprimante', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      haStates: [...ALL_HA_STATES, ...WASHING_MACHINE_STATES],
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    const devices = page.getByTestId('home-summary-devices');
    await expect(devices).toContainText('3 en marche');

    const spa = page.getByTestId('home-device-spa');
    await expect(spa).toContainText('36,5°');
    await expect(spa).toContainText('Chauffe vers 38°');
    await expect(spa).toContainText('Filtration');

    const washer = page.getByTestId('home-device-washing_machine');
    await expect(washer).toContainText('45 min');
    await expect(washer).toContainText('En cours');

    const printer = page.getByTestId('home-device-bambu_lab');
    await expect(printer).toContainText('65 %');
    await expect(printer).toContainText('benchie_boat.gcode');
  });

  test('un appareil masqué quitte la tuile appareils', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: { ...ADMIN_PROFILE.widgetPreferences, hiddenWidgets: ['bambu_lab'] },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-device-spa')).toBeVisible();
    await expect(page.getByTestId('home-device-bambu_lab')).toHaveCount(0);
  });

  test("la tuile sécurité montre l'alarme et une vignette par caméra", async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const haStates = [
      ...ALL_HA_STATES,
      {
        entity_id: 'camera.aarlo_entree',
        state: 'idle',
        attributes: { friendly_name: 'Arlo Entrée' },
        last_changed: '',
        last_updated: '',
      },
      {
        entity_id: 'binary_sensor.aarlo_motion_entree',
        state: 'on',
        attributes: {},
        last_changed: '',
        last_updated: '',
      },
    ];
    const { serviceCalls } = await mockAllApis(page, { userProfile: ADMIN_PROFILE, haStates });
    await page.goto('/');
    await waitForDashboardReady(page);

    const security = page.getByTestId('home-summary-security');
    await expect(security).toContainText('1 mouvement détecté');
    await expect(page.getByTestId('home-camera-jardin')).toContainText('Arlo Jardin');
    await expect(page.getByTestId('home-camera-entree')).toContainText('Mouvement');
    await expect(page.getByTestId('home-camera-jardin').locator('img')).toHaveCount(1);
    // Side by side on a wide screen, stacked on a phone.
    const garden = await page.getByTestId('home-camera-jardin').boundingBox();
    const entrance = await page.getByTestId('home-camera-entree').boundingBox();
    const isPhone = (page.viewportSize()?.width ?? 0) < 768;
    expect(Math.abs(garden!.y - entrance!.y) < 1).toBe(!isPhone);

    // L'alarme est activée : un appui la désactive, puis un autre la réactive.
    const toggle = page.getByTestId('home-alarm-toggle');
    const alarmPanel = page.getByTestId('home-alarm-panel');
    await expect(page.getByTestId('home-alarm-state')).toHaveText('Activée');
    await expect(alarmPanel).toHaveAttribute('data-armed', 'true');
    // Home Assistant now reports the alarm disarmed: the app reads the states again 2 s after the
    // action, and the static default mock would bring « Activée » back, so that on a slow runner
    // the second press disarmed again.
    await page.route('**/api/ha/states', (route) =>
      route.fulfill({
        json: haStates.map((s) =>
          s.entity_id.startsWith('alarm_control_panel.') ? { ...s, state: 'disarmed' } : s,
        ),
      }),
    );
    await toggle.click();
    await expect
      .poll(() => serviceCalls.find((c) => c.domain === 'alarm_control_panel')?.service)
      .toBe('alarm_disarm');
    await expect(page.getByTestId('home-alarm-state')).toHaveText('Désactivée');
    await expect(toggle).toHaveText('Activer');
    await expect(alarmPanel).toHaveAttribute('data-armed', 'false');

    await toggle.click();
    await expect
      .poll(() =>
        serviceCalls.filter((c) => c.domain === 'alarm_control_panel').map((c) => c.service),
      )
      .toEqual(['alarm_disarm', 'alarm_arm_away']);
  });

  test('sans le droit caméras, la tuile sécurité ne montre que l’alarme', async ({ page }) => {
    await bypassClerkAuth(page, USER_PROFILE);
    await mockAllApis(page, { userProfile: USER_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-alarm-state')).toBeVisible();
    await expect(page.locator('[data-testid^="home-camera-"]')).toHaveCount(0);
  });

  test('sans le droit historique, ni tuile ni section Énergie', async ({ page }) => {
    await bypassClerkAuth(page, CHILDREN_PROFILE);
    await mockAllApis(page, { userProfile: CHILDREN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-summary-lights')).toBeVisible();
    await expect(page.getByTestId('nav-energie')).toHaveCount(0);
    await expect(page.getByTestId('home-summary-energy')).toHaveCount(0);
  });

  test('la tuile énergie compare la semaine à la précédente et le dernier jour à la veille', async ({
    page,
  }) => {
    // 14 days ending yesterday: the week before, then the last 7 days.
    const series = (values: number[]) =>
      values.map((value, index) => {
        const day = new Date();
        day.setDate(day.getDate() - (values.length - index));
        const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        return { date, value, isEstimate: false };
      });
    const previousWeek = (value: number) => Array<number>(7).fill(value);
    const electricity = series([
      ...previousWeek(10000),
      11000,
      11000,
      11000,
      11000,
      11000,
      10000,
      12000,
    ]);

    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      enedisData: {
        dailyConsumption: electricity,
        dailyMaxPower: electricity.map(({ date }) => ({ date, value: 3000 })),
        loadCurve: [],
      },
      grdfData: { dailyConsumption: series([...previousWeek(20), 18, 18, 18, 18, 18, 18, 15]) },
      suezData: { price: 2.74, dailyConsumption: series(Array<number>(14).fill(100)) },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    const tile = page.getByTestId('home-summary-energy');
    await expect(tile.getByTestId('home-energy-electricity-last')).toHaveText('12,0 kWh');
    await expect(tile.getByTestId('home-energy-electricity-day-trend')).toContainText(
      '+20 % vs veille',
    );
    await expect(tile.getByTestId('home-energy-electricity-day-trend')).toHaveAttribute(
      'data-trend',
      'up',
    );
    await expect(tile.getByTestId('home-energy-electricity-week')).toHaveText('77,0 kWh');
    await expect(tile.getByTestId('home-energy-electricity-week-trend')).toContainText(
      '+10 % vs sem. préc.',
    );

    await expect(tile.getByTestId('home-energy-gas-last')).toHaveText('15,0 kWh');
    await expect(tile.getByTestId('home-energy-gas-day-trend')).toContainText('−17 % vs veille');
    await expect(tile.getByTestId('home-energy-gas-day-trend')).toHaveAttribute(
      'data-trend',
      'down',
    );
    await expect(tile.getByTestId('home-energy-gas-week')).toHaveText('123,0 kWh');
    await expect(tile.getByTestId('home-energy-gas-week-trend')).toContainText(
      '−12 % vs sem. préc.',
    );

    await expect(tile.getByTestId('home-energy-water-last')).toHaveText('100 L');
    await expect(tile.getByTestId('home-energy-water-day-trend')).toContainText('stable vs veille');
    await expect(tile.getByTestId('home-energy-water-week')).toHaveText('700 L');
    await expect(tile.getByTestId('home-energy-water-week-trend')).toHaveAttribute(
      'data-trend',
      'same',
    );
  });

  test('un compteur masqué quitte la tuile énergie', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: { ...ADMIN_PROFILE.widgetPreferences, hiddenWidgets: ['water'] },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-energy-electricity')).toBeVisible();
    await expect(page.getByTestId('home-energy-gas')).toBeVisible();
    await expect(page.getByTestId('home-energy-water')).toHaveCount(0);
  });

  test('un bloc ouvre la section de son widget avec seulement ce widget déplié', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await page.getByRole('link', { name: 'Ouvrir les lumières' }).click();

    // The hash goes back to the plain section: a reload keeps the user's own folding.
    await expect(page).toHaveURL(/#maison$/);
    await expectUnfoldedOnly(page, ['lights'], ['temperature']);
    await expect(page.getByTestId('widget-lights')).toBeInViewport();
  });

  test('une ligne de tuile de résumé ouvre seulement son widget', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    await page.getByTestId('home-energy-gas').click();

    await expect(page).toHaveURL(/#energie$/);
    await expectUnfoldedOnly(page, ['gas'], ['electricity', 'water']);
    await expect(page.getByTestId('widget-gas')).toBeInViewport();
  });

  test('la tuile températures montre chaque pièce, par étage, avec son humidité', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    const tile = page.getByTestId('home-summary-temperature');
    await expect(tile).toContainText('De 18,8° à 20,5°');
    await expect(tile).toContainText('RdC');
    await expect(tile).toContainText('1er');
    await expect(tile.getByTestId('home-room-sensor.temperature_salon-temp')).toHaveText('20,5°');
    await expect(tile.getByTestId('home-room-sensor.temperature_salon-humidity')).toHaveText(
      '45 %',
    );
    await expect(tile.getByTestId('home-room-sensor.temperature_chambre-temp')).toHaveText('18,8°');
    await expect(tile.getByTestId('home-room-sensor.temperature_chambre-humidity')).toHaveCount(0);
    // A wide screen draws each room's last 24 h; a phone loads no history for the tile.
    const history = tile.getByTestId('home-room-sensor.temperature_salon-temp-history');
    if (page.viewportSize()!.width >= 1280) {
      await expect(history).toBeVisible();
      await expect(
        tile.getByTestId('home-room-sensor.temperature_salon-humidity-history'),
      ).toBeVisible();
      // Each line says what it is and its range over the day.
      await expect(
        tile.getByTestId('home-room-sensor.temperature_salon-temp-history-range'),
      ).toContainText(/min .+° · max .+°/);
      await expect(tile.getByTestId('home-room-sensor.temperature_salon')).toContainText(
        'il y a 24 h',
      );
    } else {
      await expect(history).toHaveCount(0);
    }

    // RdC and 1er hold a single sensor each: they share one row, side by side, under one heading.
    await expect(tile).toContainText('RdC · 1er');
    const salon = await tile.getByTestId('home-room-sensor.temperature_salon').boundingBox();
    const chambre = await tile.getByTestId('home-room-sensor.temperature_chambre').boundingBox();
    // Same row: tops within 2 px (sub-pixel layout may round either way while scrolling).
    expect(Math.abs(salon!.y - chambre!.y)).toBeLessThan(2);
    expect(chambre!.x).toBeGreaterThan(salon!.x);

    await tile.getByTestId('home-room-sensor.temperature_salon').click();
    await expect(page).toHaveURL(/#maison$/);
    await expectUnfoldedOnly(page, ['temperature'], []);
    // The sensor clicked on the home page is open in the widget, with its chart, the others not.
    await expect(page.locator(TEMPERATURE.row('sensor.temperature_salon'))).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.locator(TEMPERATURE.row('sensor.temperature_chambre'))).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('une pièce masquée quitte la tuile températures', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: { ...ADMIN_PROFILE.widgetPreferences, hiddenRooms: ['Chambre'] },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    const tile = page.getByTestId('home-summary-temperature');
    await expect(tile.getByTestId('home-room-sensor.temperature_salon')).toBeVisible();
    await expect(tile.getByTestId('home-room-sensor.temperature_chambre')).toHaveCount(0);
  });

  test('la tuile prises montre chaque prise et l’allume ou l’éteint en un appui', async ({
    page,
  }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    const { actionCalls } = await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);

    const tile = page.getByTestId('home-summary-plugs');
    await expect(tile).toContainText('1 allumée · 120 W');
    await expect(tile.getByTestId('home-plug-pc-state')).toHaveText('120 W');
    await expect(tile.getByTestId('home-plug-tv-state')).toHaveText('Éteinte');

    await tile.getByTestId('home-plug-tv-toggle').click();
    await expect
      .poll(() => actionCalls.find((c) => c.entity_id === 'switch.prise_tv'))
      .toMatchObject({ domain: 'switch', service: 'turn_on' });
    await expect(tile.getByTestId('home-plug-tv-toggle')).toHaveAttribute('aria-pressed', 'true');

    await tile.getByTestId('home-plug-pc-toggle').click();
    await expect
      .poll(() => actionCalls.find((c) => c.entity_id === 'switch.prise_pc'))
      .toMatchObject({ domain: 'switch', service: 'turn_off' });
    await expect(tile.getByTestId('home-plug-pc-state')).toHaveText('Éteinte');
  });

  test('sans widget prises visible, pas de tuile prises', async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, {
      userProfile: ADMIN_PROFILE,
      widgetPreferences: { ...ADMIN_PROFILE.widgetPreferences, hiddenWidgets: ['plugs'] },
    });
    await page.goto('/');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('home-summary-temperature')).toBeVisible();
    await expect(page.getByTestId('home-summary-plugs')).toHaveCount(0);
  });
});
