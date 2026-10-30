import { test, expect } from '@playwright/test';

test.describe('End-to-End Business Workflows (A through J) & Interactive Element Audits', () => {
  // Uses pre-authenticated storageState from admin.json

  test('Workflow A: Lead Creation, Search Filtering, Detail Navigation & Solar PV Sizing', async ({
    page
  }) => {
    // 1. Navigate to CRM & Leads Pipeline
    await page.goto('/leads');
    await expect(page.locator('h1, h2').filter({ hasText: /Lead Pipeline|CRM/i })).toBeVisible({
      timeout: 10000
    });

    // 2. Open "+ New Lead" modal
    const newLeadBtn = page.getByRole('button', { name: /\+ New Lead/i });
    await expect(newLeadBtn).toBeVisible();
    await newLeadBtn.click();

    // 3. Fill and submit the lead creation form
    await expect(page.locator('text=Record New Solar Lead')).toBeVisible();
    await page.locator('input[placeholder*="Ramesh Patel"]').fill('Ramesh Gupta Enterprise');
    await page.locator('input[placeholder*="9876543210"]').fill('9820011223');
    await page
      .locator('input[placeholder*="prospect@example.com"]')
      .fill('ramesh.gupta@solardemo.in');
    await page.locator('input[placeholder*="Jaipur"]').fill('Jaipur');
    await page.locator('input[placeholder*="302001"]').fill('302001');

    const submitBtn = page.getByRole('button', { name: /Save & Create Lead/i });
    await submitBtn.click();

    // 4. Verify modal closes and new record is displayed in the table
    await expect(page.locator('text=Record New Solar Lead')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ramesh Gupta Enterprise').first()).toBeVisible({
      timeout: 10000
    });

    // 5. Verify Search Filter works
    const searchInput = page.locator('input[placeholder*="Search prospect"]');
    await searchInput.fill('Ramesh Gupta');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Ramesh Gupta Enterprise').first()).toBeVisible();

    // 6. Navigate to Solar PV Engineering
    await page.goto('/solar-designs');
    await expect(page.locator('text=Solar PV Sizing & System Design')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=System Topology')).toBeVisible();

    // 7. Verify dynamic calculation controls
    const capacityInput = page.locator('input[value="10.0"], input[value="10"]');
    if (await capacityInput.isVisible()) {
      await capacityInput.fill('15.0');
    }
    await expect(page.locator('text=Disclaimer')).toBeVisible();
  });

  test('Workflow B: Supply Chain, Depot Inventory & Purchase Management', async ({ page }) => {
    // 1. Navigate to Depot Inventory
    await page.goto('/inventory');
    await expect(page.locator('text=Depot Inventory & Warehouse Control')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=Total Tracked SKUs')).toBeVisible();

    // 2. Navigate to Purchase Orders
    await page.goto('/purchase-orders');
    await expect(page.locator('text=Procurement & Purchase Orders')).toBeVisible({
      timeout: 10000
    });
    const newPoBtn = page.getByRole('button', { name: /\+ New Purchase Order/i });
    await expect(newPoBtn).toBeVisible();

    // 3. Navigate to Goods Receipts (GRN)
    await page.goto('/goods-receipts');
    await expect(page.locator('text=Goods Receipts (GRN) & Warehouse Intake')).toBeVisible({
      timeout: 10000
    });

    // 4. Navigate to Vendor Invoices
    await page.goto('/vendor-invoices');
    await expect(page.locator('text=Vendor Invoices & Three-Way Match')).toBeVisible({
      timeout: 10000
    });
  });

  test('Workflow C & D: 10-Stage EPC Projects & DISCOM Net Metering Compliance', async ({
    page
  }) => {
    // 1. Projects Execution Pipeline
    await page.goto('/projects');
    await expect(page.locator('text=Project Execution & Installation Milestones')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=All Projects')).toBeVisible();

    // 2. DISCOM Net Metering Page
    await page.goto('/net-metering');
    await expect(page.locator('text=DISCOM Net Metering Compliance')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=Document Verification')).toBeVisible();
  });

  test('Workflow E & F: Government Subsidy Ledger & Payment Reconciliation', async ({ page }) => {
    // 1. Govt Subsidies
    await page.goto('/subsidies');
    await expect(page.locator('text=PM Surya Ghar & State Subsidy Ledger')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=Total Subsidy Tracked')).toBeVisible();

    // 2. Customer Payments & Collections
    await page.goto('/payments');
    await expect(page.locator('text=Customer Payments & Receivables')).toBeVisible({
      timeout: 10000
    });

    // 3. Test "Record Payment" modal
    const recordPaymentBtn = page.getByRole('button', { name: /\+ Record Payment/i });
    await expect(recordPaymentBtn).toBeVisible();
    await recordPaymentBtn.click();
    await expect(page.locator('text=Record Customer Payment')).toBeVisible();

    // Close modal
    const closeBtn = page.getByRole('button', { name: /Cancel|✕/i }).first();
    await closeBtn.click();
    await expect(page.locator('text=Record Customer Payment')).not.toBeVisible();
  });

  test('Workflow G & H: Expense Management, Service Complaints, Warranties & AMC', async ({
    page
  }) => {
    // 1. Expense Ledger
    await page.goto('/expenses');
    await expect(page.locator('text=Project Expense Ledger')).toBeVisible({ timeout: 10000 });

    // 2. Service Complaints
    await page.goto('/complaints');
    await expect(page.locator('text=Customer Service Complaints & Grievances')).toBeVisible({
      timeout: 10000
    });

    // 3. Equipment Warranties
    await page.goto('/warranties');
    await expect(page.locator('text=Equipment Warranties & Claims Registry')).toBeVisible({
      timeout: 10000
    });

    // 4. AMC Management
    await page.goto('/amc');
    await expect(page.locator('text=Annual Maintenance Contracts (AMC)')).toBeVisible({
      timeout: 10000
    });

    // 5. Service Visits
    await page.goto('/service-visits');
    await expect(page.locator('text=Field Service Visits & Maintenance Logs')).toBeVisible({
      timeout: 10000
    });
  });

  test('Workflow I & J: Teams, Unified Tasks, Document Vault & Customer Self-Service Portal', async ({
    page
  }) => {
    // 1. Employees Directory
    await page.goto('/employees');
    await expect(page.locator('text=Employee Directory & Access Management')).toBeVisible({
      timeout: 10000
    });

    // 2. Teams & Squads
    await page.goto('/teams');
    await expect(page.locator('text=Field Installation Teams & Crews')).toBeVisible({
      timeout: 10000
    });

    // 3. Unified Task Board
    await page.goto('/tasks');
    await expect(page.locator('text=Unified Task Board & Operations Tracker')).toBeVisible({
      timeout: 10000
    });

    // 4. Private Document Vault
    await page.goto('/documents');
    await expect(page.locator('text=Secure Document Vault & Compliance')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=Private Document Vault')).toBeVisible();

    // 5. Customer Self-Service Portal (Main)
    await page.goto('/customer-portal');
    await expect(page.locator('text=Customer Self-Service Portal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=My Solar EPC Projects')).toBeVisible();

    // 6. Customer Service Portal
    await page.goto('/customer-portal/service');
    await expect(page.locator('text=Customer Service & Maintenance Portal')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('text=Submit Service Ticket')).toBeVisible();

    // 7. Customer Payments Portal
    await page.goto('/customer-portal/payments');
    await expect(page.locator('text=Customer Billing & Online Payments')).toBeVisible({
      timeout: 10000
    });
  });
});
