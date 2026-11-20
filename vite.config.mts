import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const DEFAULT_API_URL = 'https://home-back.psaltery.org';

/**
 * Origin of Clerk's Frontend API, encoded in the publishable key (`pk_<env>_<base64 of host$>`).
 *
 * @param publishableKey - VITE_CLERK_PUBLISHABLE_KEY.
 * @returns `https://<host>`, or null when the key cannot be decoded.
 */
const clerkOrigin = (publishableKey: string | undefined): string | null => {
  const encoded = publishableKey?.split('_')[2];
  if (!encoded) return null;
  const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
  return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
};

/**
 * Adds `preconnect` hints for the back and Clerk: the TLS handshakes then run while the JS
 * loads, instead of delaying the first profile and session requests.
 *
 * @param env - VITE_ variables of the build.
 * @returns The Vite plugin.
 */
const preconnectOrigins = (env: Record<string, string>): Plugin => ({
  name: 'preconnect-origins',
  transformIndexHtml: () =>
    // Test builds mock every API call: a preconnect would only reach for a server that is not there.
    env.VITE_TEST_MODE === 'true'
      ? []
      : [
          new URL(env.VITE_API_URL || DEFAULT_API_URL).origin,
          clerkOrigin(env.VITE_CLERK_PUBLISHABLE_KEY),
        ]
          .filter((origin): origin is string => origin !== null)
          .map((href) => ({
            tag: 'link',
            attrs: { rel: 'preconnect', href, crossorigin: '' },
            injectTo: 'head' as const,
          })),
});

export default defineConfig(({ mode }) => ({
  // Simulated auth is a build-time switch: a production build is made without
  // VITE_TEST_MODE, so the constant is `false` and the test-only code is dropped.
  define: {
    __APP_TEST_MODE__: JSON.stringify(
      loadEnv(mode, process.cwd(), 'VITE_').VITE_TEST_MODE === 'true',
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    preconnectOrigins(loadEnv(mode, process.cwd(), 'VITE_')),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Home Sweet Home',
        short_name: 'Home',
        description: 'Smart home dashboard',
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    // No error-tracking tool consumes source maps: publishing them would only expose the sources.
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Clerk in its own file, which changes less often than the app code. Rolldown also
            // pulls its dependencies in (React included): with includeDependenciesRecursively
            // set to false, the regrouped modules kept the simulated-auth code in the production
            // build (caught by check-dist), so the default stays. recharts is not listed: it is
            // only reached through the lazy charts (LazyCharts.tsx).
            { name: 'clerk', test: /node_modules[\\/]@clerk[\\/]/ },
          ],
        },
      },
    },
  },
}));
