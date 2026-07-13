// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Clyro frontend.
 *
 * Expects the app to already be running via docker-compose:
 *   Frontend → http://localhost:5173
 *   Backend  → http://localhost:8000
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
    baseURL: 'http://localhost:5173',
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
