// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('frontend loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Clyro');
  });

  // The API host was hardcoded to localhost, so this failed against any
  // deployed environment. Derive it from the base URL instead: clyro.cloud is
  // served by api.clyro.cloud, and locally the backend is on port 8000.
  // Django is mounted under /api/, so /health/ 404s and /api/health/ is real.
  test('backend health check returns 200', async ({ request, baseURL }) => {
    const api = (baseURL || '').includes('localhost')
      ? 'http://localhost:8000'
      : (baseURL || '').replace('//', '//api.');

    const response = await request.get(`${api}/api/health/`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('no console errors on landing page', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    // Wait for the page to settle
    await page.waitForLoadState('networkidle');

    // Filter out known benign errors (e.g. favicon 404, third-party scripts)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
