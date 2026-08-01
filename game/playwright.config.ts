import { defineConfig } from '@playwright/test';

// Preinstalled Chromium; software WebGL must be enough for geometry asserts (docs/06).
const CHROMIUM = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  use: {
    viewport: { width: 844, height: 390 }, // phone landscape
  },
  projects: [
    {
      name: 'webgl2',
      testIgnore: /webgpu\.spec\.ts/,
      use: {
        launchOptions: {
          executablePath: CHROMIUM,
          args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
        },
      },
    },
    {
      // docs/06: validate BOTH transports from M1 on. Headless WebGPU rides
      // swiftshader Vulkan; the spec skips itself cleanly where the env can't
      // sustain it (see test/e2e/webgpu.spec.ts for the exact semantics).
      name: 'webgpu',
      testMatch: /webgpu\.spec\.ts/,
      use: {
        launchOptions: {
          executablePath: CHROMIUM,
          args: [
            '--headless=new',
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan',
            '--use-webgpu-adapter=swiftshader',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
