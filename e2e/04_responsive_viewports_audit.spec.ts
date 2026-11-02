import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '320x640 Compact Mobile', width: 320, height: 640 },
  { name: '360x800 Android Standard', width: 360, height: 800 },
  { name: '375x812 iPhone Standard', width: 375, height: 812 },
  { name: '390x844 Mainstream Mobile', width: 390, height: 844 },
  { name: '430x932 Large Mobile Pro Max', width: 430, height: 932 },
  { name: '768x1024 Tablet Portrait', width: 768, height: 1024 },
  { name: '1024x768 Tablet Landscape', width: 1024, height: 768 },
  { name: '1366x768 HD Laptop', width: 1366, height: 768 },
  { name: '1440x900 Widescreen Laptop', width: 1440, height: 900 },
  { name: '1920x1080 Full HD Desktop', width: 1920, height: 1080 }
];

const AUDIT_PAGES = [
  { path: '/', name: 'Dashboard' },
  { path: '/leads', name: 'Leads Pipeline' },
  { path: '/projects', name: 'Project Milestones' },
  { path: '/quotations', name: 'Quotations Master' },
  { path: '/orders', name: 'Sales Orders' },
  { path: '/inventory', name: 'Depot Inventory' },
  { path: '/purchase-orders', name: 'Procurement POs' },
  { path: '/vendor-invoices', name: 'Vendor Invoices' },
  { path: '/payments', name: 'Collections & Payments' },
  { path: '/expenses', name: 'Expense Ledger' },
  { path: '/net-metering', name: 'Net Metering Compliance' },
  { path: '/subsidies', name: 'DBT Subsidies' },
  { path: '/service', name: 'Service Hub' },
  { path: '/customer-portal', name: 'Customer Self-Service' },
  { path: '/tasks', name: 'Operational Tasks' },
  { path: '/documents', name: 'Document Vault' },
  { path: '/employees', name: 'Employee Directory' }
];

test.describe('Responsive Viewports QA Suite (10 Viewports × Core Pages)', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test(`Verify Zero Horizontal Overflow on Dashboard at ${vp.width}px`, async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);

        // Check horizontal overflow: scrollWidth should not exceed innerWidth
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 2;
        });
        expect(hasOverflow).toBe(false);

        // Responsive navigation assertion
        if (vp.width < 1024) {
          // Mobile/Tablet menu hamburger button should be visible
          const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
          await expect(menuBtn).toBeVisible();
        } else {
          // Desktop sidebar should be visible
          const sidebar = page.locator('aside');
          await expect(sidebar).toBeVisible();
        }
      });

      test(`Verify Core Pages Zero Horizontal Overflow at ${vp.width}px`, async ({ page }) => {
        for (const pg of AUDIT_PAGES) {
          await page.goto(pg.path, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(300);

          // Verify page loaded without crash
          const rootHtml = await page.locator('#root').innerHTML();
          expect(rootHtml.length).toBeGreaterThan(50);

          // Verify document has zero horizontal scroll blowout
          const hasOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth + 2;
          });
          expect(hasOverflow).toBe(false);
        }
      });

      test(`Verify Modal Responsiveness at ${vp.width}px`, async ({ page }) => {
        await page.goto('/leads', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        const newLeadBtn = page.getByRole('button', { name: /\+ New Lead/i });
        if (await newLeadBtn.isVisible()) {
          await newLeadBtn.click();
          await page.waitForTimeout(300);

          // Modal dialog must be visible and within viewport bounds
          const modalHeading = page.locator('text=Record New Solar Lead');
          await expect(modalHeading).toBeVisible();

          const modalOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth + 2;
          });
          expect(modalOverflow).toBe(false);

          // Close modal
          const cancelBtn = page.getByRole('button', { name: /Cancel/i });
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
          }
        }
      });
    });
  }
});
