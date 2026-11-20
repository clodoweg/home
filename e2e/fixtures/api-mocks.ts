/**
 * Central API mocking helper for Approach 1 tests.
 *
 * Intercepts all backend API routes via page.route() and returns
 * deterministic JSON data. No backend needed.
 */

import { Page, Route } from '@playwright/test';
import { TestUserProfile } from './users';
import { MockHAState, ALL_HA_STATES } from './mock-data/ha-states';
import { PETKIT_DATA } from './mock-data/petkit-data';
import { ENEDIS_DATA } from './mock-data/enedis-data';
import { GRDF_DATA } from './mock-data/grdf-data';
import { SUEZ_DATA } from './mock-data/suez-data';
import { ALERTS_DATA, type MockAlert } from './mock-data/alerts-data';

// ── Types ────────────────────────────────────────────────────────────────────────

interface ActionCall {
  domain: string;
  service: string;
  entity_id: string | string[];
  service_data?: Record<string, unknown>;
}

export interface MockApiOptions {
  /** User profile to return from /api/user/me */
  userProfile: TestUserProfile;
  /** HA states to return from /api/ha/states (defaults to ALL_HA_STATES) */
  haStates?: MockHAState[];
  /** PetKit data (defaults to PETKIT_DATA) */
  petkitData?: unknown;
  /** Enedis data (defaults to ENEDIS_DATA) */
  enedisData?: unknown;
  /** GRDF data (defaults to GRDF_DATA) */
  grdfData?: unknown;
  /** Suez data (defaults to SUEZ_DATA) */
  suezData?: unknown;
  /** Widget preferences (defaults to profile's) */
  widgetPreferences?: Record<string, unknown>;
  /** Extra entity metadata merged into ENTITY_METADATA (GET /api/ha/metadata) */
  entityMetadata?: Record<string, { area: string; floor: string; model: string }>;
  /** Alerts of the admin's bell (defaults to ALERTS_DATA) */
  alerts?: MockAlert[];
  /** Handlers replacing the default mock of a route, keyed by path (e.g. '/api/ha/states') */
  overrides?: Record<string, (route: Route) => Promise<void>>;
}

export interface MockApiResult {
  /** Bodies of every POST /api/user/preferences, in order */
  preferenceUpdates: Record<string, unknown>[];
  /** All HA service calls captured (POST /api/ha/call), legacy name kept for the specs */
  actionCalls: ActionCall[];
  /** All HA service calls captured (POST /api/ha/call) */
  serviceCalls: ActionCall[];
  /** Bodies of every POST /api/notifications/read, in order */
  alertReads: { ids?: number[] }[];
  /** Bodies of every POST /api/push/subscription and /api/push/unsubscribe, in order */
  pushCalls: { path: string; body: unknown }[];
  /** Reset captured calls */
  reset: () => void;
}

// ── Main Helper ──────────────────────────────────────────────────────────────────

/**
 * Intercepts ALL backend API routes and returns mock data.
 * Returns captured action/service calls for assertion.
 *
 * @example
 * ```ts
 * const { actionCalls } = await mockAllApis(page, {
 *   userProfile: ADMIN_PROFILE,
 * });
 * await page.goto('/');
 * await page.getByTestId('light-toggle-salon').click();
 * expect(actionCalls).toHaveLength(1);
 * ```
 */
/** Area / floor / model of each entity, as returned by GET /api/ha/metadata. */
const ENTITY_METADATA: Record<string, { area: string; floor: string; model: string }> = {
  'light.salon': { area: 'Salon', floor: 'RdC', model: 'Room' },
  'light.chambre': { area: 'Chambre', floor: '1er', model: 'Room' },
  'light.cuisine': { area: 'Cuisine', floor: 'RdC', model: 'Room' },
  'climate.salon': { area: 'Salon', floor: 'RdC', model: 'Thermostat' },
  'climate.chambre': { area: 'Chambre', floor: '1er', model: 'Thermostat' },
  'sensor.temperature_salon': { area: 'Salon', floor: 'RdC', model: 'Sensor' },
  'sensor.temperature_chambre': { area: 'Chambre', floor: '1er', model: 'Sensor' },
  'sensor.humidity_salon': { area: 'Salon', floor: 'RdC', model: 'Sensor' },
  'sensor.humidity_chambre': { area: 'Chambre', floor: '1er', model: 'Sensor' },
};

/** 1×1 transparent PNG, so that `<img>` actually decodes the mocked previews. */
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Deterministic pseudo-random value in [0, 1) from a string (same input, same value). */
const noise = (seed: string): number => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 1000) / 1000;
};

const STAT_STEP_MS: Record<string, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

/**
 * Long-term statistics as GET /api/ha/statistics returns them, made up for the requested window
 * (up to now): temperatures around 20 °C, humidities around 50 %, meters a few tenths of kWh.
 */
function mockStatistics(ids: string[], start: string, end: string, period: string) {
  const from = Date.parse(start);
  const to = Math.min(Date.parse(end), Date.now());
  const step = STAT_STEP_MS[period] ?? STAT_STEP_MS.day;
  const result: Record<string, unknown[]> = {};
  for (const id of ids.filter(Boolean)) {
    const rows: unknown[] = [];
    for (let t = from; t < to; t += step) {
      const n = noise(`${id}${t}`);
      const iso = new Date(t).toISOString();
      if (id.includes('consommation')) {
        rows.push({ start: iso, change: Math.round((0.2 + n) * (step / 86_400_000) * 100) / 100 });
      } else {
        const base = id.includes('humid') ? 50 : 20;
        const mean = base + (n - 0.5) * 6;
        rows.push({ start: iso, mean, min: mean - 1.5, max: mean + 1.5 });
      }
    }
    result[id] = rows;
  }
  return result;
}

/** Usage counters as GET /api/history/usage returns them, for each day of the range up to today. */
function mockUsage(start: string, end: string) {
  const metrics: Record<string, number> = {
    washer_cycles: 2,
    washer_hours: 3,
    spa_heating_hours: 6,
    spa_on_hours: 24,
    spa_temperature: 38,
    printer_hours: 4,
    printer_jobs: 2,
    'light_hours:light.salon': 6,
    'light_hours:light.chambre': 3,
    'light_hours:light.cuisine': 2,
    'alarm_arms:alarm_control_panel.alarme_maison': 2,
    'alarm_triggers:alarm_control_panel.alarme_maison': 1,
    'motion:binary_sensor.aarlo_motion_jardin': 12,
    feeder_meals: 6,
    feeder_distributions: 3,
    'feeder_portions:sensor.croquettes_total_distribue_reservoir_1': 4,
    fountain_drinks: 9,
    'alerts:alarm': 1,
  };
  const today = new Date().toISOString().slice(0, 10);
  const last = end < today ? end : today;
  const result: Record<string, { date: string; value: number }[]> = {};
  for (const [metric, scale] of Object.entries(metrics)) {
    const series: { date: string; value: number }[] = [];
    for (let day = new Date(`${start}T00:00:00Z`); day.toISOString().slice(0, 10) < last;) {
      const date = day.toISOString().slice(0, 10);
      series.push({ date, value: Math.round(noise(`${metric}${date}`) * scale * 10) / 10 });
      day = new Date(day.getTime() + 86_400_000);
    }
    result[metric] = series;
  }
  return result;
}

export async function mockAllApis(page: Page, options: MockApiOptions): Promise<MockApiResult> {
  const {
    userProfile,
    haStates = ALL_HA_STATES,
    petkitData = PETKIT_DATA,
    enedisData = ENEDIS_DATA,
    grdfData = GRDF_DATA,
    suezData = SUEZ_DATA,
    widgetPreferences = userProfile.widgetPreferences,
    overrides = {},
    entityMetadata = {},
    alerts = ALERTS_DATA,
  } = options;

  const actionCalls: ActionCall[] = [];
  const preferenceUpdates: Record<string, unknown>[] = [];
  // Server-side user state: POSTed preferences survive a reload, as in the back.
  const account = {
    widgetPreferences: { ...widgetPreferences },
    theme: userProfile.theme ?? 'dark',
    telegramChatId: null as string | null,
    notificationPreferences: {} as Record<string, boolean>,
  };
  const serviceCalls: ActionCall[] = [];

  // ── User Profile ─────────────────────────────────────────────────────
  await page.route('**/api/user/me', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: userProfile.email,
        group: userProfile.group,
        permissions: userProfile.permissions,
        widgetPreferences: account.widgetPreferences,
        theme: account.theme,
      }),
    });
  });

  // ── Widget Preferences ───────────────────────────────────────────────
  // Same envelopes and merge rules as home-back app/api/user/preferences/route.ts
  await page.route('**/api/user/preferences', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preferences: account.widgetPreferences,
          telegramChatId: account.telegramChatId,
          notificationPreferences: account.notificationPreferences,
        }),
      });
    }
    const { theme, telegramChatId, notificationPreferences, ...widgetFields } =
      route.request().postDataJSON() ?? {};
    preferenceUpdates.push({ theme, telegramChatId, notificationPreferences, ...widgetFields });
    if (theme) account.theme = theme;
    if (telegramChatId !== undefined) account.telegramChatId = telegramChatId;
    if (notificationPreferences !== undefined) {
      account.notificationPreferences = {
        ...account.notificationPreferences,
        ...notificationPreferences,
      };
    }
    account.widgetPreferences = { ...account.widgetPreferences, ...widgetFields };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, preferences: account.widgetPreferences }),
    });
  });

  // ── HA States ────────────────────────────────────────────────────────
  // The back hides camera entities from the children group (lib/permissions canSeeCameraEntities)
  const visibleStates =
    userProfile.group === 'children'
      ? haStates.filter((s) => !s.entity_id.startsWith('camera.'))
      : haStates;
  await page.route('**/api/ha/states', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(visibleStates),
    }),
  );

  // ── HA Service Calls ─────────────────────────────────────────────────
  await page.route('**/api/ha/call', async (route) => {
    const body = route.request().postDataJSON();
    serviceCalls.push(body);
    // Backward compatibility with legacy tests expecting actionCalls
    actionCalls.push(body);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // ── HA History ───────────────────────────────────────────────────────
  await page.route('**/api/ha/history**', (route) => {
    const url = route.request().url();
    const now = new Date();

    // Helper to generate points for the last 24 hours
    const generateHistory = (entityId: string, baseVal: number, isTemp: boolean) => {
      const points = [];
      for (let i = 24; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        // Add a small sine wave variation so it's not completely flat
        const variance = Math.sin(i / 3) * (isTemp ? 1.2 : 5);
        const val = (baseVal + variance).toFixed(1);
        points.push({
          entity_id: entityId,
          state: val,
          last_changed: time.toISOString(),
        });
      }
      return points;
    };

    if (url.includes('/history/period')) {
      // Batch history endpoint
      const urlObj = new URL(url);
      const filterStr = urlObj.searchParams.get('filter_entity_id') || '';
      const entityIds = filterStr.split(',');

      const batchData = entityIds.map((entId) => {
        if (entId.includes('temperature_salon')) {
          return generateHistory(entId, 20.5, true);
        }
        if (entId.includes('temperature_chambre')) {
          return generateHistory(entId, 18.8, true);
        }
        if (entId.includes('humidity_salon')) {
          return generateHistory(entId, 45, false);
        }
        if (entId.includes('humidity_chambre')) {
          return generateHistory(entId, 55, false);
        }
        return generateHistory(
          entId,
          entId.includes('humidity') ? 50 : 20,
          !entId.includes('humidity'),
        );
      });

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(batchData),
      });
    } else {
      // Single history endpoint
      const urlObj = new URL(url);
      const entityId = urlObj.searchParams.get('entity_id') || '';
      let base = 20;
      let isTemp = true;
      if (entityId.includes('temperature_salon')) {
        base = 20.5;
      } else if (entityId.includes('temperature_chambre')) {
        base = 18.8;
      } else if (entityId.includes('humidity_salon')) {
        base = 45;
        isTemp = false;
      } else if (entityId.includes('humidity_chambre')) {
        base = 55;
        isTemp = false;
      } else if (entityId.includes('humidity')) {
        base = 50;
        isTemp = false;
      }

      const singleData = [generateHistory(entityId, base, isTemp)];

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(singleData),
      });
    }
  });

  // ── HA Metadata (GET /api/ha/metadata) ──────────────────────────────
  await page.route('**/api/ha/metadata', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...ENTITY_METADATA, ...entityMetadata }),
    }),
  );

  // ── HA Forecast (GET /api/ha/forecast?entity_id&type) ───────────────
  // The back returns the forecast array itself; here it is the entity's `forecast` attribute.
  await page.route('**/api/ha/forecast**', (route) => {
    const entityId = new URL(route.request().url()).searchParams.get('entity_id');
    const state = haStates.find((s) => s.entity_id === entityId);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state?.attributes?.forecast ?? []),
    });
  });

  // ── HA Scenes ────────────────────────────────────────────────────────
  await page.route('**/api/ha/scenes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  );

  // ── PetKit ───────────────────────────────────────────────────────────
  await page.route('**/api/petkit**', (route) =>
    route.request().url().includes('/feed')
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(petkitData),
        }),
  );

  await page.route('**/api/petkit/feed', async (route) => {
    const body = route.request().postDataJSON();
    actionCalls.push({ domain: 'petkit', service: 'feed', ...body });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // The back answers `{ message }` only (ApiResponse.success)
      body: JSON.stringify({ message: 'Dispensé: Bac 1: 1, Bac 2: 1' }),
    });
  });

  // ── Enedis ───────────────────────────────────────────────────────────
  await page.route('**/api/enedis/data**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(enedisData),
    }),
  );

  // ── GRDF ─────────────────────────────────────────────────────────────
  await page.route('**/api/grdf**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(grdfData),
    }),
  );

  // ── Suez ─────────────────────────────────────────────────────────────
  await page.route('**/api/suez**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(suezData),
    }),
  );

  // ── History tab (as home-back: the history right, from the group or admin) ──
  const canSeeHistory =
    userProfile.group === 'admin' || userProfile.permissions.includes('history');
  const historyForbidden = (route: Route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Forbidden: You do not have permission to view history.' }),
    });

  await page.route('**/api/ha/statistics**', (route) => {
    if (!canSeeHistory) return historyForbidden(route);
    const url = new URL(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        mockStatistics(
          (url.searchParams.get('statistic_ids') ?? '').split(','),
          url.searchParams.get('start') ?? '',
          url.searchParams.get('end') ?? '',
          url.searchParams.get('period') ?? 'day',
        ),
      ),
    });
  });

  await page.route('**/api/history/usage**', (route) => {
    if (!canSeeHistory) return historyForbidden(route);
    const url = new URL(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        mockUsage(url.searchParams.get('start') ?? '', url.searchParams.get('end') ?? ''),
      ),
    });
  });

  // ── Camera proxy ─────────────────────────────────────────────────────
  await page.route('**/api/camera_proxy_image/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from('fake-jpeg-data'),
    }),
  );
  // ── Arlo ─────────────────────────────────────────────────────────────
  await page.route('**/api/arlo/snapshot/**', (route) =>
    route.request().method() !== 'POST'
      ? route.fulfill({ status: 405 })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Snapshot requested',
            entity_id: decodeURIComponent(
              new URL(route.request().url()).pathname.split('/').pop()!,
            ),
            timestamp: new Date().toISOString(),
          }),
        }),
  );

  // ── HA images (Petkit previews) ──────────────────────────────────────
  // The back serves raw image bytes; SecureImage fetches them with a Bearer header
  await page.route(/\/api\/ha\/(media|image)(\?|\/)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'),
    }),
  );

  // ── Alerts (admins only, as in home-back lib/permissions canReceiveNotifications) ──
  const alertList = alerts.map((alert) => ({ ...alert }));
  const alertReads: { ids?: number[] }[] = [];
  const pushCalls: { path: string; body: unknown }[] = [];
  const isAdmin = userProfile.group === 'admin';
  const forbidden = (route: Route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }),
    });

  await page.route('**/api/notifications', (route) =>
    !isAdmin
      ? forbidden(route)
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: alertList,
            unread: alertList.filter((alert) => !alert.read).length,
          }),
        }),
  );
  await page.route('**/api/notifications/read', (route) => {
    if (!isAdmin) return forbidden(route);
    const body = (route.request().postDataJSON() ?? {}) as { ids?: number[] };
    alertReads.push(body);
    let updated = 0;
    for (const alert of alertList) {
      if (!alert.read && (!body.ids || body.ids.includes(alert.id))) {
        alert.read = true;
        updated += 1;
      }
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ updated }),
    });
  });
  await page.route('**/api/push/public-key', (route) =>
    !isAdmin
      ? forbidden(route)
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ publicKey: null }),
        }),
  );
  for (const path of ['/api/push/subscription', '/api/push/unsubscribe']) {
    await page.route(`**${path}`, (route) => {
      if (!isAdmin) return forbidden(route);
      pushCalls.push({ path, body: route.request().postDataJSON() });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
  }

  // ── Overrides ────────────────────────────────────────────────────────
  // Registered last, so they take precedence over the default mocks above (Playwright runs the
  // most recently registered matching route first). Key: path prefix, e.g. '/api/ha/states'.
  for (const [path, handler] of Object.entries(overrides)) {
    await page.route(`**${path}**`, handler);
  }

  return {
    preferenceUpdates,
    actionCalls,
    serviceCalls,
    alertReads,
    pushCalls,
    reset: () => {
      actionCalls.length = 0;
      serviceCalls.length = 0;
    },
  };
}
