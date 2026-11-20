/**
 * main.tsx — App entry point.
 * Mounts the React tree and registers the PWA service worker.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
// Display font, self-hosted (the CSP only allows fonts from 'self'): the weight axis, no opsz/wdth.
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '../global.css';
import { logger } from './lib/logger';
import { watchForAppUpdates, type AppUpdateWatcher } from './lib/app-update';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker only exists in a production build (vite-plugin-pwa devOptions disabled).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // A new worker takes over at once (skipWaiting + clientsClaim) and drops the previous build's
  // precache. Looking for it regularly keeps an app left open for days up to date; the reload
  // waits for a moment that does not interrupt the user (app-update.ts).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let watcher: AppUpdateWatcher | null = null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (watcher) watcher.newVersionReady();
    else window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        watcher = watchForAppUpdates({ registration, reload: () => window.location.reload() });
      })
      .catch((err) => {
        logger.warn('[SW] Registration failed', err);
      });
  });
}
