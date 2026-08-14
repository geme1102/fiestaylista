import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: 'html',
  use: {
    baseURL: process.env.VITE_APP_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  // ST2-M: e2e contra el build de preview (no dev server) — genera sw.js,
  // assets hasheados, headers de producción. Antes usaba `npm run dev`
  // (sin SW, sin minificación) y el hallazgo #1 (SW offline) nunca lo detectó.
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    cwd: '.',
    timeout: 60_000,
  },
  expect: {
    timeout: 10_000,
  },
});
