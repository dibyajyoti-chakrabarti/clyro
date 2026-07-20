// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero section renders with "Deploy to AWS" heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('Deploy to AWS');
    await expect(heading).toContainText('Without the complexity');
  });

  test('"Start Building" CTA links to /signup', async ({ page }) => {
    const cta = page.locator('a', { hasText: 'Start Building' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/signup');
  });

  test('"Explore Features" CTA links to /pricing', async ({ page }) => {
    const cta = page.locator('a', { hasText: 'Explore Features' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/pricing');
  });

  test('HowItWorks section is visible', async ({ page }) => {
    // Scroll to ensure lazy-loaded content appears
    const section = page.locator('text=How It Works').first();
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
  });

  test('WhyCrylo section is visible', async ({ page }) => {
    const section = page.locator('text=Why Clyro').first();
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
  });

  test('page is responsive at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Hero should still be visible
    const heading = page.locator('h1');
    await expect(heading).toContainText('Deploy to AWS');

    // Desktop nav should be hidden, hamburger should be visible
    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeVisible();
  });
});
