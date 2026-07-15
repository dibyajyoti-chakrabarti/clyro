// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('frontend loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Clyro');
  });

  test('backend health check returns 200', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/hello');
    expect(response.status()).toBe(200);
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
