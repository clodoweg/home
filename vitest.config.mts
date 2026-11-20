/** Vitest config — unit and component tests (jsdom + Testing Library + MSW). */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Date-dependent code (history windows, energy aggregation) runs in the users' time zone.
process.env.TZ = 'Europe/Paris';

const AREA = { lines: 80, branches: 80, perFile: true };
const SENSITIVE = { lines: 95, branches: 95, functions: 95, statements: 95 };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_TEST_MODE__: 'false',
  },
  test: {
    // Never the real backend (nor production when .env.local is absent): a request that
    // escapes MSW fails on an unresolvable host.
    env: { VITE_API_URL: 'https://home-back.test.invalid', VITE_CLERK_PUBLISHABLE_KEY: '' },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'App.tsx'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        // Glue only: its decisions live in lib/sw-cache-policy.ts (tested); bundled by the build.
        'src/sw.ts',
      ],
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      thresholds: {
        'src/services/**': AREA,
        'src/hooks/**': AREA,
        'src/utils/**': AREA,
        'src/lib/**': AREA,
        'src/context/**': AREA,
        // Security-sensitive modules: auth, errors, rights, authenticated images, purge, caches.
        'src/services/client.ts': SENSITIVE,
        'src/services/errors.ts': SENSITIVE,
        'src/context/UserContext.tsx': SENSITIVE,
        'src/components/ui/SecureImage.tsx': SENSITIVE,
        'src/utils/permissions.ts': SENSITIVE,
        'src/lib/user-data.ts': SENSITIVE,
        'src/lib/sw-cache-policy.ts': SENSITIVE,
        'src/lib/query-client.ts': SENSITIVE,
      },
    },
  },
});
