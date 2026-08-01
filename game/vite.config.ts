import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is '/' for local/LAN dev and '/example_dashboard/' on GitHub Pages.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4096,
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
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
});
