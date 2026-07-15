// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('landing page → pricing page via nav link', async ({ page }) => {
    await page.goto('/');

    // Click the "Pricing" nav link (desktop nav)
    const pricingLink = page.locator('nav[aria-label="Primary navigation"] a', {
      hasText: 'Pricing',
    });
    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test('pricing page has 3 tiers (Free, Pro, Enterprise)', async ({ page }) => {
    await page.goto('/pricing');

    const tierNames = ['Free', 'Pro', 'Enterprise'];
    for (const name of tierNames) {
      const tierHeading = page.locator('h2', { hasText: name });
      await expect(tierHeading).toBeVisible();
    }
  });

  test('Free and Pro CTA buttons on pricing link to /signup', async ({ page }) => {
    await page.goto('/pricing');

    // Free and Pro tiers link to /signup
    const signupLinks = page.locator('a[href="/signup"]');
    const count = await signupLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Enterprise tier links to mailto
    const enterpriseLink = page.locator('a[href="mailto:hello@clyro.io"]');
    await expect(enterpriseLink).toBeVisible();
  });

  test('back navigation works', async ({ page }) => {
    await page.goto('/');
    await page.goto('/pricing');
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('unknown routes redirect to /', async ({ page }) => {
    await page.goto('/some-nonexistent-route');
    await expect(page).toHaveURL(/\/$/);
  });
});
