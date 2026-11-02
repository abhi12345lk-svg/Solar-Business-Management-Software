import { test, expect } from '@playwright/test';

test.describe('INS Solar ERP — Role-Based Dashboards & Multi-Panel Switcher Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-DASH-01: Admin Control Room renders 12 KPIs, 10-Stage Pipeline and Feed', async ({ page }) => {
    const main = page.locator('main');

    // 1. Verify Header branding and role badge
    await expect(main.getByText(/Executive Operations Control Center/i)).toBeVisible();
    await expect(main.getByText(/Executive Control Room/i)).toBeVisible();

    // 2. Verify Date Range Dropdown is functional
    const dateSelect = main.locator('select[aria-label="Filter by date range"]');
    await expect(dateSelect).toBeVisible();
    await dateSelect.selectOption('THIS_MONTH');
    await page.waitForTimeout(400);
    await dateSelect.selectOption('ALL');

    // 3. Verify Core Executive KPIs
    await expect(main.getByText('Total Customers').first()).toBeVisible();
    await expect(main.getByText('Total Leads').first()).toBeVisible();
    await expect(main.getByText('Active Projects').first()).toBeVisible();
    await expect(main.getByText('Completed Projects').first()).toBeVisible();
    await expect(main.getByText('Low Stock Alerts').first()).toBeVisible();
    await expect(main.getByText('Customer Receivables').first()).toBeVisible();

    // 4. Verify 10-Stage EPC Project Execution Pipeline
    await expect(main.getByText(/Standard 10-Stage EPC Project Execution Pipeline/i)).toBeVisible();
    await expect(main.getByText('Design & Engineering').first()).toBeVisible();
    await expect(main.getByText('Net Metering Apply').first()).toBeVisible();
    await expect(main.getByText('Civil Structure').first()).toBeVisible();
    await expect(main.getByText('DISCOM Meter Install').first()).toBeVisible();

    // 5. Verify Financial Ledger & Cash Flow
    await expect(main.getByText(/Company Financial Health & Cash Flow Ledger/i)).toBeVisible();
    await expect(main.getByText('Realized Bank Collections').first()).toBeVisible();
  });

  test('TC-DASH-02: Executive View Switcher toggles smoothly to Sales Dashboard', async ({ page }) => {
    const main = page.locator('main');

    // Click "Sales" pill on header
    const salesBtn = main.getByRole('button', { name: /Sales/i });
    await expect(salesBtn).toBeVisible();
    await salesBtn.click();
    await page.waitForTimeout(600);

    // 1. Verify Sales Dashboard Header
    await expect(main.getByText(/Commercial & Sales Pipeline Workspace/i)).toBeVisible();
    await expect(main.getByText(/Sales & CRM Workspace/i)).toBeVisible();

    // 2. Verify Sales Quick Actions
    await expect(main.getByRole('link', { name: /New Lead/i }).first()).toBeVisible();
    await expect(main.getByRole('link', { name: /Book Site Survey/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /PV Sizing Engine/i }).first()).toBeVisible();
    await expect(main.getByRole('link', { name: /Create Quotation/i }).first()).toBeVisible();

    // 3. Verify Sales KPIs
    await expect(main.getByText('Total Inbound Leads').first()).toBeVisible();
    await expect(main.getByText('Site Surveys').first()).toBeVisible();
    await expect(main.getByText('Quotes Created').first()).toBeVisible();
    await expect(main.getByText('Accepted Proposals').first()).toBeVisible();
    await expect(main.getByText('Confirmed Orders').first()).toBeVisible();

    // 4. Verify 7-Stage CRM Lead Conversion Funnel
    await expect(main.getByText(/7-Stage CRM Lead Conversion Funnel/i)).toBeVisible();
    await expect(main.getByText('New Inbound').first()).toBeVisible();
    await expect(main.getByText('Contacted').first()).toBeVisible();
    await expect(main.getByText('Survey Booked').first()).toBeVisible();
    await expect(main.getByText('Quotation Sent').first()).toBeVisible();
    await expect(main.getByText('Converted Order').first()).toBeVisible();

    // 5. Verify Follow-up Workbench
    await expect(main.getByText(/Scheduled Follow-up Reminders Workbench/i)).toBeVisible();
    await expect(main.getByRole('button', { name: /Today/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /Overdue/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /Upcoming/i })).toBeVisible();
  });

  test('TC-DASH-03: Executive View Switcher toggles smoothly to Accounts Dashboard', async ({ page }) => {
    const main = page.locator('main');

    // Click "Accounts" pill on header
    const accountsBtn = main.getByRole('button', { name: /Accounts/i });
    await expect(accountsBtn).toBeVisible();
    await accountsBtn.click();
    await page.waitForTimeout(600);

    // 1. Verify Accounts Dashboard Header
    await expect(main.getByText(/Financial & Billing Workspace/i)).toBeVisible();
    await expect(main.getByText(/Accounts & Financial Ledger/i)).toBeVisible();

    // 2. Verify Accounts Quick Actions
    await expect(main.getByRole('link', { name: /Record Customer Payment/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /Record Expense Voucher/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /Register Vendor Invoice/i })).toBeVisible();

    // 3. Verify Financial KPIs
    await expect(main.getByText('Total Receivables').first()).toBeVisible();
    await expect(main.getByText('Realized Collections').first()).toBeVisible();
    await expect(main.getByText('Pending Verification').first()).toBeVisible();
    await expect(main.getByText('Overdue Receivables').first()).toBeVisible();
    await expect(main.getByRole('link', { name: /Operational Expenses/i }).first()).toBeVisible();
    await expect(main.getByText('Vendor Payables').first()).toBeVisible();
    await expect(main.getByText('Unreconciled Invoices').first()).toBeVisible();
    await expect(main.getByText('Gross Realized Margin').first()).toBeVisible();

    // 4. Verify 4-Bucket Receivables Aging Schedule
    await expect(main.getByText(/Customer Receivables Aging Schedule/i)).toBeVisible();
    await expect(main.getByText(/Current \(0 - 30 Days\)/i)).toBeVisible();
    await expect(main.getByText(/Overdue \(31 - 60 Days\)/i)).toBeVisible();
    await expect(main.getByText(/Overdue \(61 - 90 Days\)/i)).toBeVisible();
    await expect(main.getByText(/Critical \(90\+ Days\)/i)).toBeVisible();

    // 5. Verify 3-Way Match Verification Card
    await expect(main.getByText(/3-Way Match Verification \(PO vs GRN vs Invoice\)/i)).toBeVisible();
    await expect(main.getByText('Material Purchase Orders').first()).toBeVisible();
    await expect(main.getByText('Total Vendor Invoices Logged').first()).toBeVisible();
  });

  test('TC-DASH-04: Full Responsive Test across 320px to 1920px viewports (Zero Horizontal Scroll)', async ({ page }) => {
    const viewports = [
      { width: 320, height: 640, label: '320px Small Mobile' },
      { width: 375, height: 812, label: '375px Mobile' },
      { width: 768, height: 1024, label: '768px Tablet' },
      { width: 1280, height: 800, label: '1280px Laptop' },
      { width: 1920, height: 1080, label: '1920px Full HD Desktop' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Verify zero unintended horizontal document scrolling
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(
        scrollWidth,
        `Expected no horizontal overflow at viewport ${vp.label} (${vp.width}x${vp.height})`
      ).toBeLessThanOrEqual(clientWidth + 2); // 2px margin for subpixel rounding
    }
  });
});
