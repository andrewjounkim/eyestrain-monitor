import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Build the detection Web Worker (src/worker.js) as an ES module so it can use
  // `import` like the rest of the app.
  worker: { format: 'es' },

  plugins: [
    VitePWA({
      // "injectManifest" = we write our own service worker (src/sw.js) and the
      // plugin only injects the list of build files to precache into it.
      // (The other strategy, "generateSW", writes the whole SW for you, but then
      // it's harder to add our own notificationclick handler.)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Injects a small script into index.html that registers the service worker.
      injectRegister: 'auto',
      registerType: 'autoUpdate',

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The MediaPipe wasm + model are big (tens of MB, several variants of
        // which only one is used). Don't download them all at install time;
        // sw.js caches the ones actually used on first load instead.
        globIgnores: ['mediapipe/**'],
      },

      // Web app manifest: what Chrome needs to offer "Install app".
      manifest: {
        name: 'Eye Strain Monitor',
        short_name: 'Eye Strain',
        description: 'Monitors blink rate and eye strain with your webcam. Video never leaves your device.',
        start_url: '/',
        scope: '/',
        display: 'standalone', // own window, no browser address bar
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // "maskable" icons fill the whole square; the OS crops them to its own shape.
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      // Also run the service worker during `npm run dev`, so the notification
      // test works without building first.
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});
