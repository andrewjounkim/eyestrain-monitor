// SERVICE WORKER
//
// Not to be confused with the Web Worker in worker.js:
// - A service worker is registered once per site (origin). The browser starts and
//   stops it on demand, even when no tab of the site is open. It sits between the
//   page and the network (caching, offline) and receives push/notification events.
//   It has no access to the DOM or the camera, and it can't run continuously.
// - A Web Worker (worker.js) is a background thread owned by ONE open page. It
//   lives exactly as long as that page and is used for heavy computation, here
//   face detection on camera frames.
//
// This file does three jobs: precache the app shell (so the installed app opens
// offline), cache MediaPipe files on first use, and handle notification clicks.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

// Activate a new version right away instead of waiting for all tabs to close.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// At build time vite-plugin-pwa replaces self.__WB_MANIFEST with the list of
// built files (HTML, JS, CSS, icons) plus a hash of each, so updates are detected.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// MediaPipe wasm + model: cache the first time they are fetched, then serve from
// the cache. The files are versioned by the npm package, so they never change in place.
// ignoreSearch: "loader.js?retry" (see landmarker.js) is served from the same cache entry.
// Paths are relative to the service worker's scope, which is the app's folder
// ("/" locally, "/eyestrain-monitor/" on GitHub Pages).
const MEDIAPIPE_URL = new URL('mediapipe/', self.registration.scope).href;
registerRoute(
  ({ url }) => url.href.startsWith(MEDIAPIPE_URL),
  new CacheFirst({ cacheName: 'mediapipe-assets', matchOptions: { ignoreSearch: true } }),
);

// NOTIFICATION CLICKS
// The page creates notifications with registration.showNotification(), which
// means the notification belongs to this service worker, not to the page. That's
// why the click is handled here: it still works if the page was closed or
// minimized. We focus an existing app window if one is open, otherwise open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || './', self.registration.scope).href;

  // waitUntil keeps the service worker alive until focusing finishes.
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appWindow = windows.find((client) => client.url.startsWith(self.registration.scope));

      if (appWindow) {
        await appWindow.focus();
        // Tell the page which notification was clicked (later: which exercise to start).
        appWindow.postMessage({ type: 'notification-clicked', tag: event.notification.tag });
      } else {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
