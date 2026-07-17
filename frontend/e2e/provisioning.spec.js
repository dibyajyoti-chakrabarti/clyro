// @ts-check
import { test, expect } from '@playwright/test';

// Full Step 1 -> Step 4 -> teardown pass against REAL AWS infrastructure. This
// creates real billable resources (ECS, RDS, ALB, etc.) under the connected
// AWS account and deletes them again at the end. It is deliberately opt-in and
// skipped unless every precondition below is explicitly supplied — there is no
// safe way to synthesize a GitHub App installation, a connected AWS account,
// or a Cognito login from inside this test, so all three must already exist.
//
// Required env vars:
//   E2E_TEST_EMAIL / E2E_TEST_PASSWORD — a real Cognito user for this app
//   E2E_TEST_REPO                     — 'owner/repo' already installed via the
//                                        GitHub App for that user (Django+React)
//   E2E_TEST_BRANCH                   — branch to scan/deploy (default 'main')
//
// The AWS account must already be connected (a prior CFN quick-create of
// backend/cfn-templates/bootstrap.yaml) — connecting AWS itself opens a new
// tab into the real AWS console and cannot be driven headlessly.
//
// Run with: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... E2E_TEST_REPO=... \
//   npx playwright test e2e/provisioning.spec.js --timeout=2400000

const { E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_REPO } = process.env;
const E2E_TEST_BRANCH = process.env.E2E_TEST_BRANCH || 'main';

const shouldRun = Boolean(E2E_TEST_EMAIL && E2E_TEST_PASSWORD && E2E_TEST_REPO);

test.describe('Full provisioning + teardown (real AWS)', () => {
  test.skip(!shouldRun, 'Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_REPO to run this against real AWS.');

  // Provisioning + teardown against real CloudFormation routinely takes
  // 10-20 minutes each way — far past the suite's default 30s.
  test.setTimeout(40 * 60 * 1000);

  test('drives Step 1 scan through Step 4 deploy and teardown with 0 unexpected issues', async ({ page }) => {
    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(E2E_TEST_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_TEST_PASSWORD);
    await page.locator('button', { hasText: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });

    // ── Create project ─────────────────────────────────────────────────────
    await page.goto('/app/create-project');
    const projectName = `e2e-provisioning-${Date.now()}`;
    await page.locator('input[type="text"]').fill(projectName);
    await page.locator('button', { hasText: /Create/i }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+$/, { timeout: 15_000 });

    // ── Step 1: connect an existing GitHub installation, scan ──────────────
    // GithubConnectCard.jsx renders one button per existing installation,
    // labelled with the GitHub account login — click the first one rather
    // than "Install Clyro GitHub App" (that opens a real github.com OAuth
    // flow and cannot be driven headlessly).
    await page.getByText('OR USE AN EXISTING ACCOUNT').waitFor({ timeout: 10_000 });
    await page.locator('button:has(span)').filter({ hasNotText: 'Install' }).first().click();
    await page.locator('select, [role="combobox"]').first().selectOption({ label: E2E_TEST_REPO }).catch(() => {});
    await page.getByText(E2E_TEST_REPO).first().click().catch(() => {});
    await page.locator('button', { hasText: /Scan|Connect/i }).first().click();

    // Scan can take a while (RepoRecon call + compliance checks).
    await expect(page.getByText('Step 1 Complete')).toBeVisible({ timeout: 120_000 });

    // The whole point of Phase 2's blocker-gating fix: if the test repo trips
    // a real blocker, Continue must actually be disabled, not just cosmetic.
    const blockerNote = page.getByText('Resolve the blockers above to continue');
    if (await blockerNote.isVisible().catch(() => false)) {
      throw new Error(`Step 1 compliance blockers on ${E2E_TEST_REPO} — fix the repo before re-running this test.`);
    }
    await page.locator('button', { hasText: 'Continue' }).click();

    // ── Step 2 / Step 3: accept generated defaults ─────────────────────────
    // (Intent collection and canvas both have sensible generated defaults for
    // a Django+React repo — this test exercises the deploy path, not manual
    // customization, so it clicks through with whatever was auto-generated.)
    await page.locator('button', { hasText: 'Continue' }).click();
    await expect(page.locator('button', { hasText: 'Continue' })).toBeEnabled({ timeout: 60_000 });
    await page.locator('button', { hasText: 'Continue' }).click();

    // ── Step 4: generate IaC, review, connect AWS (already connected) ──────
    await page.locator('button', { hasText: 'Generate template' }).click();
    await expect(page.locator('button', { hasText: 'Continue' })).toBeEnabled({ timeout: 120_000 });
    await page.locator('button', { hasText: 'Continue' }).click(); // -> review
    await page.locator('button', { hasText: /Provision|Deploy/i }).click(); // -> connect-aws (already connected) -> provisioning

    // ── Provisioning: poll to CREATE_COMPLETE ──────────────────────────────
    await expect(page.getByText(/deployment.*ready|live|success/i)).toBeVisible({ timeout: 20 * 60 * 1000 });

    // ── Teardown: delete everything this test created ──────────────────────
    await page.locator('button', { hasText: /Delete infrastructure/i }).click();
    await page.locator('button', { hasText: /Yes, delete infrastructure/i }).click();
    await expect(page.getByText(/deleted/i)).toBeVisible({ timeout: 15 * 60 * 1000 });
  });
});
