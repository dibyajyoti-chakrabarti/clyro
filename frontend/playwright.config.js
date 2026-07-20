// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Clyro frontend.
 *
 * Defaults to the app running locally via docker-compose:
 *   Frontend → http://localhost:5173
 *   Backend  → http://localhost:8000
 *
 * Set PLAYWRIGHT_BASE_URL to point at a deployed environment instead, e.g.
 *   PLAYWRIGHT_BASE_URL=https://clyro.cloud npx playwright test
 * No separate backend URL override is needed — the deployed frontend build
 * already bakes in VITE_API_BASE_URL at build time.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Reasonable navigation / action timeouts */
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  timeout: 30_000,
  expect: { timeout: 5_000 },

  /* Chromium only for speed */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* No webServer — the app is started externally via docker-compose */
});
