// @ts-check
import { test, expect } from '@playwright/test';

// The authenticated half of the app: native Cognito login, the dashboard, and
// the wizard up to the point where a real GitHub App installation is needed.
//
// This is deliberately separate from provisioning.spec.js. That test drives the
// whole of Step 1 to Step 7 against real AWS and needs a disposable account and
// a repo already installed through the GitHub App, so it stays opt-in and
// almost never runs. Everything below needs nothing but a Cognito user, so it
// can run on every push and still cover login, project creation, the wizard
// shell and Step 1 rendering.
//
// Required env vars:
//   E2E_TEST_EMAIL / E2E_TEST_PASSWORD - a native (not federated) Cognito user
//     that is on the project-creation allowlist. Create one with:
//       aws cognito-idp admin-create-user  --user-pool-id <pool> ...
//       aws cognito-idp admin-set-user-password ... --permanent
//     then add it to the allowlist with the Django Management workflow
//     (whitelist_email add).
//
// Optional:
//   E2E_EXPECT_GITHUB_INSTALLATION - set when the user under test already has a
//     Clyro GitHub App installation. Step 1 then asserts the installation list
//     renders rather than only the install prompt.

const { E2E_TEST_EMAIL, E2E_TEST_PASSWORD } = process.env;
const hasCreds = Boolean(E2E_TEST_EMAIL && E2E_TEST_PASSWORD);
const expectInstallation = Boolean(process.env.E2E_EXPECT_GITHUB_INSTALLATION);

/** Log in through the real Cognito-backed form and land on the dashboard. */
async function login(page) {
  await page.goto('/login');
  // By id, not by type. /login mounts the signup form alongside the login form
  // so it can animate between them, and input[type="email"] matches both.
  await page.locator('#email-address').fill(E2E_TEST_EMAIL);
  await page.locator('#password').fill(E2E_TEST_PASSWORD);
  await page.locator('button', { hasText: 'Sign In' }).click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
}

/** Collect console errors and failed responses so a green test cannot hide a 500. */
function watchForErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    // 401 on the pre-login session probe is how the app discovers it is logged
    // out, and 404 on an absent optional resource is not a failure either.
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return errors;
}

/** Remember where the API lives, so cleanup can call it directly.
 *
 * The deployed frontend bakes VITE_API_BASE_URL in at build time and it is not
 * the page origin (production serves the app from clyro.cloud and the API from
 * api.clyro.cloud), so a relative /api/ fetch would come back as the SPA's own
 * HTML. Reading it off a request the app has already made is the only way to
 * get it right for both local and deployed runs. */
function trackApiBase(page) {
  const seen = { base: null };
  page.on('request', (r) => {
    if (seen.base) return;
    const url = r.url();
    const at = url.indexOf('/api/');
    if (at > 0) seen.base = url.slice(0, at);
  });
  return seen;
}

/** Delete a project this test created.
 *
 * Both tests below create a real project and neither used to remove it, so the
 * bot account accumulated one per test per CI run. A project with no AWS
 * connection is a synchronous database delete on the backend (204), so this is
 * cheap and there is nothing in anyone's AWS account to tear down.
 *
 * Best-effort on purpose: a failure to clean up should never turn a passing
 * assertion red, so it reports and moves on. */
async function deleteProject(page, seen, projectId) {
  if (!projectId || !seen.base) return;
  const outcome = await page.evaluate(async ({ id, base }) => {
    // Amplify v6 keeps the Cognito id token in localStorage. api/index.js gets
    // it through fetchAuthSession(), which is not reachable from here, so find
    // the key rather than hardcode the client id and username it embeds.
    const key = Object.keys(localStorage).find((k) => k.endsWith('.idToken'));
    const token = key ? localStorage.getItem(key) : null;
    if (!token) return 'no id token in localStorage';
    const res = await fetch(`${base}/api/projects/${id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status;
  }, { id: projectId, base: seen.base }).catch((e) => `evaluate failed: ${e.message}`);

  if (outcome !== 204 && outcome !== 202) {
    console.log(`could not clean up project ${projectId}: ${outcome}`);
  }
}

/** The wizard open on a project that exists.
 *
 * It has to match the id, not just "a segment". The obvious /app/projects/[^/]+
 * also matches /app/projects/new, which is the page the form is submitted from,
 * so both tests below were asserting a URL they already had and passing while
 * still sitting on the creation form. */
const PROJECT_URL = /\/app\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** The project id out of /app/projects/<uuid>, or null if the wizard never opened. */
function projectIdFromUrl(page) {
  const m = PROJECT_URL.exec(page.url());
  return m ? m[0].split('/').pop() : null;
}

test.describe('Authenticated app', () => {
  test.skip(!hasCreds, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run the authenticated suite.');

  test('native email and password login reaches the dashboard', async ({ page }) => {
    const errors = watchForErrors(page);
    await login(page);

    await expect(page.getByText('TOTAL PROJECTS')).toBeVisible();
    // The shell renders a desktop sidebar and a mobile drawer, so the email
    // matches twice and one of the two is always hidden.
    await expect(page.getByText(E2E_TEST_EMAIL).filter({ visible: true })).toBeVisible();
    expect(errors, `server or console errors during login:\n${errors.join('\n')}`).toEqual([]);
  });

  test('sign out returns to a logged-out state', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Sign Out' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 15_000 });

    // The real assertion: the session is gone, not just the route changed.
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('dashboard offers project creation', async ({ page }) => {
    await login(page);
    await page.goto('/app/projects/new');
    await expect(page.locator('#project-name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next Step' })).toBeVisible();
  });

  test('creating a project opens the wizard at Step 1', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchForErrors(page);
    const seen = trackApiBase(page);
    await login(page);

    await page.goto('/app/projects/new');
    const projectName = `e2e-wizard-${Date.now()}`;
    await page.locator('#project-name').fill(projectName);
    await page.getByRole('button', { name: 'Next Step' }).click();

    // A 403 here means the account is not on the project-creation allowlist.
    // Say so, rather than timing out on a selector that was never going to
    // appear, because that is the failure a new test account actually hits.
    const denied = page.getByText('not authorized to create projects');
    await expect
      .poll(async () => (await denied.isVisible()) ? 'denied' : (PROJECT_URL.test(page.url()) ? 'created' : 'pending'),
        { timeout: 30_000 })
      .not.toBe('pending');
    if (await denied.isVisible()) {
      throw new Error(
        `${E2E_TEST_EMAIL} is not on the project-creation allowlist. Add it with the ` +
        'Django Management workflow: whitelist_email add.',
      );
    }

    await expect(page).toHaveURL(PROJECT_URL);
    const createdId = projectIdFromUrl(page);

    try {
      // PremiumStepHeading splits the heading across spans, so match the role.
      await expect(
        page.getByRole('heading', { name: 'Connect your GitHub account' }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Install Clyro GitHub App' })).toBeVisible();
      expect(errors, `server or console errors in the wizard:\n${errors.join('\n')}`).toEqual([]);
    } finally {
      await deleteProject(page, seen, createdId);
    }
  });

  test('Step 1 lists existing GitHub installations', async ({ page }) => {
    test.skip(
      !expectInstallation,
      'Set E2E_EXPECT_GITHUB_INSTALLATION once this account has a Clyro GitHub App installation. ' +
      'Installations are one-to-one with a Clyro user (GitHubInstallation.installation_id is unique ' +
      'and reassignment is refused), so the test account needs its own, installed from a GitHub ' +
      'account or org that is not already connected to another Clyro user.',
    );
    test.setTimeout(120_000);
    const seen = trackApiBase(page);
    await login(page);

    await page.goto('/app/projects/new');
    await page.locator('#project-name').fill(`e2e-gh-${Date.now()}`);
    await page.getByRole('button', { name: 'Next Step' }).click();
    await expect(page).toHaveURL(PROJECT_URL, { timeout: 30_000 });
    const createdId = projectIdFromUrl(page);

    try {
      await expect(page.getByText('OR USE AN EXISTING ACCOUNT')).toBeVisible({ timeout: 20_000 });
    } finally {
      await deleteProject(page, seen, createdId);
    }
  });
});
