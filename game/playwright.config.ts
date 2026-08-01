import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  use: {
    // Preinstalled Chromium; software WebGL must be enough for geometry asserts (docs/06).
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
    viewport: { width: 844, height: 390 }, // phone landscape
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
