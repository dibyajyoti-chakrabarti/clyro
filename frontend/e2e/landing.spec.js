// @ts-check
import { test, expect } from '@playwright/test';

// These assertions track the landing page as it shipped after the layout
// refactor. The previous versions still expected the pre-refactor copy
// ("Deploy to AWS", "Explore Features") and a WhyCrylo section that Landing.jsx
// no longer imports, so they failed against a perfectly healthy page.

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero section renders the headline', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('From Idea to Cloud Infrastructure');
    await expect(heading).toContainText('Powered by AI');
  });

  test('"Start Building" CTA links to /signup', async ({ page }) => {
    const cta = page.locator('a', { hasText: 'Start Building' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/signup');
  });

  test('"View Plans" CTA links to /pricing', async ({ page }) => {
    const cta = page.locator('a', { hasText: 'View Plans' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/pricing');
  });

  test('HowClyroWorks section is visible', async ({ page }) => {
    const section = page.locator('text=How Clyro Works').first();
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
  });

  test('BuiltForEngineers section is visible', async ({ page }) => {
    const section = page.locator('text=Everything you need to').first();
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
  });

  test('page is responsive at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const heading = page.locator('h1');
    await expect(heading).toContainText('From Idea to Cloud Infrastructure');

    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeVisible();
  });
});
