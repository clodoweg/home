/**
 * Session purge — after a logout, no user data may remain on the device
 * (localStorage, Cache Storage), and the session token is never stored at all.
 */
import { test, expect, Page } from '@playwright/test';
import { mockAllApis } from '../fixtures/api-mocks';
import { bypassClerkAuth } from '../fixtures/auth';
import { ADMIN_PROFILE } from '../fixtures/users';
import { waitForDashboardReady } from '../helpers/assertions';

const USER_KEY = /^(hsh|petkit_img_)/;

const userStorageKeys = (page: Page) =>
  page.evaluate((pattern) => {
    const regex = new RegExp(pattern);
    return Object.keys(localStorage).filter((key) => regex.test(key));
  }, USER_KEY.source);

const apiCacheNames = (page: Page) =>
  page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith('api-')));

test.describe('Purge des données à la déconnexion', () => {
  test.beforeEach(async ({ page }) => {
    await bypassClerkAuth(page, ADMIN_PROFILE);
    await mockAllApis(page, { userProfile: ADMIN_PROFILE });
    await page.goto('/');
    await waitForDashboardReady(page);
  });

  test("le jeton de session n'est jamais écrit dans localStorage", async ({ page }) => {
    const values = await page.evaluate(() => Object.values(localStorage).join('\n'));
    // Every JWT starts with a base64url JSON header: `eyJ`.
    expect(values).not.toMatch(/eyJ[\w-]+\.eyJ[\w-]+\./);
  });

  test('la déconnexion vide localStorage et Cache Storage des données utilisateur', async ({
    page,
  }) => {
    // The persisted query cache is written asynchronously (throttled).
    await expect.poll(() => userStorageKeys(page)).toContain('hsh-react-query-cache');
    await page.evaluate(async () => {
      localStorage.setItem('petkit_img_legacy', 'data:image/png;base64,AAAA');
      localStorage.setItem('app-theme-preference', 'light');
      const cache = await caches.open('api-history-v1');
      await cache.put('https://home-back.example/api/ha/history', new Response('[]'));
      await caches.open('api-get');
    });

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-item-logout').click();

    await expect(page.getByText('Se connecter avec Google')).toBeVisible();
    await expect.poll(() => userStorageKeys(page)).toEqual([]);
    await expect.poll(() => apiCacheNames(page)).toEqual([]);
    // The query cache is persisted with a 1 s throttle: a write scheduled before the logout
    // must not put the data back afterwards. Checking that nothing happens needs a fixed wait.
    // eslint-disable-next-line sonarjs/no-fixed-wait-in-tests -- absence of an event, nothing to poll
    await page.waitForTimeout(1_500);
    expect(await userStorageKeys(page)).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('app-theme-preference'))).toBe('light');
  });
});
