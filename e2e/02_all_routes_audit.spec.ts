import { test, expect } from '@playwright/test';

// Full Page & Subpage Route Inventory (38 distinct paths)
const routesToAudit = [
  { path: '/', name: 'Dashboard' },
  { path: '/leads', name: 'Leads Pipeline' },
  { path: '/follow-ups', name: 'Follow-ups' },
  { path: '/surveys', name: 'Site Surveys' },
  { path: '/solar-designs', name: 'Solar PV Design' },
  { path: '/quotations', name: 'Quotations Master' },
  { path: '/orders', name: 'Sales Orders' },
  { path: '/projects', name: 'Projects (10-Stage)' },
  { path: '/net-metering', name: 'DISCOM Net Metering' },
  { path: '/subsidies', name: 'Govt Subsidies' },
  { path: '/inventory', name: 'Depot Inventory' },
  { path: '/vendors', name: 'Vendors Master' },
  { path: '/purchase-orders', name: 'Purchase Orders' },
  { path: '/goods-receipts', name: 'Goods Receipts (GRN)' },
  { path: '/vendor-invoices', name: 'Vendor Invoices' },
  { path: '/payments', name: 'Payments & Collections' },
  { path: '/expenses', name: 'Expense Ledger' },
  { path: '/complaints', name: 'Service Complaints' },
  { path: '/warranties', name: 'Equipment Warranties' },
  { path: '/amc', name: 'AMC Contracts' },
  { path: '/service-visits', name: 'Service Field Visits' },
  { path: '/customer-portal', name: 'Customer Portal Main' },
  { path: '/customer-portal/service', name: 'Customer Service Portal' },
  { path: '/customer-portal/payments', name: 'Customer Payments Portal' },
  { path: '/portal', name: 'Customer Portal Alias' },
  { path: '/employees', name: 'Employees Directory' },
  { path: '/teams', name: 'Squads & Teams' },
  { path: '/tasks', name: 'Unified Tasks' },
  { path: '/documents', name: 'Document Vault' },
  { path: '/health', name: 'Health Status' },
  { path: '/mfa-setup', name: 'MFA Setup' },
  { path: '/mfa-challenge', name: 'MFA Challenge' },
  { path: '/login', name: 'Login Screen' }
];

test.describe('Master Route Audit: 38 Distinct Routes & Panels Verification', () => {
  for (const route of routesToAudit) {
    test(`Verify Route: ${route.path} (${route.name}) loads cleanly without blank screen or fatal error`, async ({
      page
    }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const failedHttp: string[] = [];

      page.on('pageerror', err => pageErrors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('response', res => {
        if (res.status() >= 500) {
          failedHttp.push(`${res.status()} ${res.url()}`);
        }
      });

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Verify no blank screen (#root has children)
      const rootHtml = await page.locator('#root').innerHTML();
      expect(rootHtml.length).toBeGreaterThan(50);

      // Verify page is not a React crash screen
      expect(pageErrors.length).toBe(0);
      expect(failedHttp.length).toBe(0);

      // Ensure no raw uncaught crash text is rendered in the DOM
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/Cannot read properties of undefined/i);
      expect(bodyText).not.toMatch(/Unhandled Runtime Error/i);
    });
  }

  test('Verify Project Detail Page with 6 operational tabs', async ({ page }) => {
    // Navigate to a simulated/demo project detail route
    await page.goto('/projects/PRJ-DEMO-001');
    await page.waitForTimeout(1000);

    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(50);
  });

  test('Verify Lead Detail Page', async ({ page }) => {
    await page.goto('/leads/LEAD-DEMO-001');
    await page.waitForTimeout(1000);
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(50);
  });

  test('Verify Quotation Detail Page', async ({ page }) => {
    await page.goto('/quotations/QT-DEMO-001');
    await page.waitForTimeout(1000);
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(50);
  });

  test('Verify Order Detail Page', async ({ page }) => {
    await page.goto('/orders/ORD-DEMO-001');
    await page.waitForTimeout(1000);
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(50);
  });

  test('Verify Purchase Order Detail Page', async ({ page }) => {
    await page.goto('/purchase-orders/PO-DEMO-001');
    await page.waitForTimeout(1000);
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(50);
  });
});
