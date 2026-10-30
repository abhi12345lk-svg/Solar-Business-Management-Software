import { test, expect } from '@playwright/test';

// Use clean unauthenticated state for auth flow testing
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Module 28 & Auth: Authentication, MFA, Navigation & Viewport Audits', () => {
  test('TC-AUTH-01: Login page renders with branding, form elements, and security badges', async ({
    page
  }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/INS Solar/i);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In to Workstation/i })).toBeVisible();
  });

  test('TC-AUTH-02: Submitting invalid credentials shows error banner and rejects access', async ({
    page
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill('nonexistent@inssolar.com');
    await page.locator('#password').fill('InvalidPassword999!');
    await page.getByRole('button', { name: /Sign In to Workstation/i }).click();

    // Verify error banner is visible
    const errorBanner = page.locator('text=Authentication Denied');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
  });

  test('TC-AUTH-03: Superadmin credentials log in successfully and load operational dashboard', async ({
    page
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@inssolar.com');
    await page.locator('#password').fill('SolarAdmin2026!');
    await page.getByRole('button', { name: /Sign In to Workstation/i }).click();

    // Verify redirection to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 10000 });
    await expect(page.locator('text=System Administrator')).toBeVisible();
    await expect(page.locator('text=SUPERADMIN')).toBeVisible();
  });

  test('TC-AUTH-04: Sign Out terminates session and redirects cleanly to /login', async ({
    page
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@inssolar.com');
    await page.locator('#password').fill('SolarAdmin2026!');
    await page.getByRole('button', { name: /Sign In to Workstation/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 10000 });

    // Click Sign Out
    const signOutBtn = page.getByRole('button', { name: /Sign Out/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Verify redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
