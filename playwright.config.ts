import { defineConfig, devices } from '@playwright/test';

// A dedicated port per run (PW_PORT) avoids two local runs sharing one Vite server.
const port = Number(process.env.PW_PORT ?? 5173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker per vCPU of the GitHub runner (4). Against the production build below, 4 workers
  // are stable; against the Vite dev server they were not worth it (−10 %, CPU spent transforming).
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list'], ['./e2e/summary-reporter.ts']],
  timeout: 30_000,

  use: {
    baseURL: `http://localhost:${port}`,
    // Dates, numbers and screenshots must not depend on the machine running the tests.
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The production build registers src/sw.ts (dev never did): blocked so that page.route mocks
    // see every request, as before.
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'mocked',
      testDir: './e2e/approach-1-mocked',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mocked-mobile',
      testDir: './e2e/approach-1-mocked',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: [
    {
      // A test-mode production build served by `vite preview`, in its own folder (dist/ stays the
      // real build checked by check:dist). Measured against the dev server, which transformed every
      // module again for each page of each worker: 2.7 min instead of 5 on a 4-vCPU machine, 6.6
      // instead of 7.9 on the (slower) GitHub runner.
      command: `npx vite build --outDir dist-e2e --emptyOutDir --logLevel warn && npx vite preview --outDir dist-e2e --port ${port} --strictPort`,
      env: { VITE_TEST_MODE: 'true' },
      port,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
