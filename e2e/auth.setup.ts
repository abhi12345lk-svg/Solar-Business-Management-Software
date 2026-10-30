import { test as setup, expect } from '@playwright/test';

const adminFile = 'playwright/.auth/admin.json';

setup('authenticate as Superadmin', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill('admin@inssolar.com');
  await page.locator('#password').fill('SolarAdmin2026!');
  await page.getByRole('button', { name: /Sign In to Workstation/i }).click();

  // Wait until dashboard is rendered
  await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 });
  await expect(page.locator('text=System Administrator')).toBeVisible({ timeout: 10000 });

  // Save authenticated storage state
  await page.context().storageState({ path: adminFile });
});
