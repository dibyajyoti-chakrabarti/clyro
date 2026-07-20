// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders with "Welcome back" heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Welcome back');
  });

  test('login form has email and password fields', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Google OAuth button is present', async ({ page }) => {
    const googleButton = page.locator('button', { hasText: 'Continue with Google' });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
  });

  test('GitHub OAuth button is present but disabled', async ({ page }) => {
    const githubButton = page.locator('button', { hasText: 'Continue with GitHub' });
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toBeDisabled();
  });

  test('empty form submission stays on login page', async ({ page }) => {
    const signInButton = page.locator('button', { hasText: 'Sign In' });
    await signInButton.click();

    // Should remain on login page (Cognito will reject empty creds)
    await expect(page).toHaveURL(/\/login/);
  });

  test('"Sign up" link navigates to /signup', async ({ page }) => {
    const signUpLink = page.locator('a', { hasText: 'Sign up' });
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('Signup page', () => {
  test('renders with registration form', async ({ page }) => {
    await page.goto('/signup');

    const heading = page.locator('h2');
    await expect(heading).toHaveText('Create your account');

    // Check all form fields are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    const signUpButton = page.locator('button', { hasText: 'Sign Up' });
    await expect(signUpButton).toBeVisible();
  });
});

test.describe('Protected routes', () => {
  test('unauthenticated access to /app/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
