// @ts-check
import { test, expect } from '@playwright/test';

// Full Step 1 -> Step 7 -> teardown pass against REAL AWS infrastructure. This
// creates real billable resources (ECS, RDS, ALB, etc.) under the connected
// AWS account and deletes them again at the end. It is deliberately opt-in and
// skipped unless every precondition below is explicitly supplied — there is no
// safe way to synthesize a GitHub App installation or a Cognito login from
// inside this test, so both must already exist.
//
// Required env vars:
//   E2E_TEST_EMAIL / E2E_TEST_PASSWORD — a real Cognito user for this app
//   E2E_TEST_REPO                     — 'owner/repo' already installed via the
//                                        GitHub App for that user (Django+React)
//   E2E_TEST_BRANCH                   — branch to scan/deploy (default 'main')
//
// Optional:
//   E2E_TEST_AWS_ROLE_ARN — a Role ARN from a bootstrap.yaml quick-create
//     already run against a *disposable/sandbox* AWS account (never Clyro's
//     own production account — this test creates and tears down real,
//     billable resources under whatever account this ARN belongs to). Step 2
//     (Connect your AWS account) is per-project, not reusable — every run
//     needs its own connection. If set, Step 2 is filled in and verified
//     automatically. If unset, the test opens the CloudFormation console and
//     waits (up to 10 minutes) for a human watching the browser to complete
//     the quick-create and paste the resulting Role ARN in themselves —
//     connecting AWS opens a real AWS console tab and cannot be driven
//     headlessly no matter what.
//
// Run with: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... E2E_TEST_REPO=... \
//   npx playwright test e2e/provisioning.spec.js --timeout=2400000 --headed

const { E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_REPO, E2E_TEST_AWS_ROLE_ARN } = process.env;
const E2E_TEST_BRANCH = process.env.E2E_TEST_BRANCH || 'main';

const shouldRun = Boolean(E2E_TEST_EMAIL && E2E_TEST_PASSWORD && E2E_TEST_REPO);

test.describe('Full provisioning + teardown (real AWS)', () => {
  test.skip(!shouldRun, 'Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_REPO to run this against real AWS.');

  // Provisioning + teardown against real CloudFormation routinely takes
  // 10-20 minutes each way — far past the suite's default 30s. A manual
  // Step 2 AWS-connect (no pre-supplied ARN) can add up to 10 more.
  test.setTimeout(50 * 60 * 1000);

  test('drives Step 1 scan through Step 7 live and teardown with 0 unexpected issues', async ({ page }) => {
    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto('/login');
    // By id, not by type: /login mounts the signup form too so the transition
    // between them can animate, and a bare input[type="email"] matches both.
    await page.locator('#email-address').fill(E2E_TEST_EMAIL);
    await page.locator('#password').fill(E2E_TEST_PASSWORD);
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

    // ── Step 2: connect your AWS account ───────────────────────────────────
    // Moved here (ahead of intent/canvas/generate) by the 7-step wizard split
    // — no longer the "connect-aws" sub-phase folded into the old Step 4.
    // Per-project, so a fresh project always needs a fresh connection; the
    // CFN quick-create itself can't be driven headlessly regardless.
    const roleConnectedText = page.getByText('IAM role connected');
    if (E2E_TEST_AWS_ROLE_ARN) {
      await page.locator('button', { hasText: 'Open AWS CloudFormation console' }).waitFor({ timeout: 15_000 });
      await page.locator('input[placeholder*="arn:aws:iam"]').fill(E2E_TEST_AWS_ROLE_ARN);
      await page.locator('button', { hasText: 'Verify' }).click();
      await expect(roleConnectedText).toBeVisible({ timeout: 30_000 });
    } else {
      console.log(
        'No E2E_TEST_AWS_ROLE_ARN supplied — opening the CloudFormation console and waiting up to 10 ' +
        'minutes for a human watching this browser to complete the quick-create and paste the Role ARN in.',
      );
      await page.locator('button', { hasText: 'Open AWS CloudFormation console' }).click();
      await expect(roleConnectedText).toBeVisible({ timeout: 10 * 60 * 1000 });
    }
    await page.locator('button', { hasText: 'Continue' }).click();

    // ── Step 3 / Step 4: accept generated defaults ─────────────────────────
    // (Intent collection and canvas both have sensible generated defaults for
    // a Django+React repo — this test exercises the deploy path, not manual
    // customization, so it clicks through with whatever was auto-generated.)
    await page.locator('button', { hasText: 'Continue' }).click();
    await expect(page.locator('button', { hasText: 'Continue' })).toBeEnabled({ timeout: 60_000 });
    await page.locator('button', { hasText: 'Continue' }).click();

    // ── Step 5: generate + validate the CloudFormation template ────────────
    await page.locator('button', { hasText: 'Generate template' }).click();
    await expect(page.locator('button', { hasText: 'Continue' })).toBeEnabled({ timeout: 120_000 });
    await page.locator('button', { hasText: 'Continue' }).click(); // -> Step 6 review

    // ── Step 6: review + provision. AWS is already connected (Step 2), so ──
    // this click goes straight to live provisioning — no connect-aws detour.
    await page.locator('button', { hasText: /Provision|Deploy/i }).click();

    // Everything past this point creates/destroys real, billable AWS
    // resources — teardown must run even if a later assertion fails, or a
    // failed run strands the stack instead of just failing the test.
    try {
      // ── Provisioning: poll to CREATE_COMPLETE ────────────────────────────
      await expect(page.getByText(/deployment.*ready|live|success/i)).toBeVisible({ timeout: 20 * 60 * 1000 });
    } finally {
      // ── Teardown: delete everything this test created ────────────────────
      await page.locator('button', { hasText: /Delete infrastructure/i }).click();
      await page.locator('button', { hasText: /Yes, delete infrastructure/i }).click();
      await expect(page.getByText(/deleted/i)).toBeVisible({ timeout: 15 * 60 * 1000 });
    }
  });
});
