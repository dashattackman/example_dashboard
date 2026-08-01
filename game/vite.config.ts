import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is '/' for local/LAN dev and '/example_dashboard/' on GitHub Pages.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(
      `${new Date().toISOString().slice(0, 16)}Z-${process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'local'}`,
    ),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        // Standalone character-rig review harness (art/anim QA + e2e). Not part
        // of the game boot path and excluded from the PWA precache below.
        rig: fileURLToPath(new URL('rig.html', import.meta.url)),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Twin Cities',
        short_name: 'Twin Cities',
        description:
          'Superpowered open-world life-sim brawler set in a stylized Minneapolis.',
        theme_color: '#14213d',
        background_color: '#14213d',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Perf doc: first-playable precache; heavier assets lazy-load later.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The rig harness (and its loader-only chunk) is a dev/QA surface —
        // keep it and the lazy-loaded character glb out of the precache budget.
        globIgnores: ['rig.html', '**/rig-*.js', '**/assets/characters/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Character glbs stay OUT of install-time precache (8MB first-playable
        // rule) but cache on first use, so offline covers the cast after one
        // normal session (docs/06 "fully offline once background precache
        // completes" — this is the character half of that promise).
        runtimeCaching: [
          {
            urlPattern: /\/assets\/characters\/.*\.glb$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'characters',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /\/assets\/audio\/.*\.(mp3|ogg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
});
