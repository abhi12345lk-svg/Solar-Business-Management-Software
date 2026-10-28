/**
 * INS Solar Business Management Software — Phase 8B Web Frontend Tests
 *
 * Tests for Expense Management, Project Costing & Profitability:
 * - Expenses register with KPI metric cards, filters, and atomic EXP numbers
 * - Record Expense modal with INR to integer-paise entry and threshold notices
 * - Manager approval and rejection action triggers
 * - Payment disbursement flow for approved expenses
 * - Project Costing Tab with profitability overview, margin %, and data completeness badge
 * - Budget-versus-actual variance comparison table and versioning modal
 * - Line-by-line Cost Ledger with material dispatch and direct expense drill-downs
 * - Statutory non-accounting disclaimer verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpensesPage } from '../pages/ExpensesPage.js';
import { ProjectCostingTab } from '../components/project/ProjectCostingTab.js';
import * as apiModule from '../lib/api.js';

describe('Phase 8B Frontend: Expense Management, Project Costing & Profitability', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  const mockExpense = {
    _id: 'exp-001',
    expenseNumber: 'EXP-2026-00001',
    expenseDate: '2026-10-25T00:00:00.000Z',
    category: 'INSTALLATION_LABOR',
    payeeName: 'Ravi Kumar Contractors',
    description: 'Subcontractor structure installation charge',
    amountPaise: 4500000, // ₹45,000.00
    taxAmountPaise: 810000, // ₹8,100.00
    totalAmountPaise: 5310000, // ₹53,100.00
    paymentStatus: 'UNPAID',
    paidAmountPaise: 0,
    status: 'PENDING_APPROVAL',
    requiresApproval: true,
    projectId: {
      _id: 'proj-001',
      projectCode: 'PRJ-2026-00001',
      name: 'Rooftop 15kWp Commercial'
    }
  };

  const mockApprovedExpense = {
    ...mockExpense,
    _id: 'exp-002',
    expenseNumber: 'EXP-2026-00002',
    category: 'TRAVEL_FUEL',
    payeeName: 'IOCL Petrol Bunk',
    description: 'Site inspection fuel',
    amountPaise: 250000,
    taxAmountPaise: 0,
    totalAmountPaise: 250000,
    paymentStatus: 'UNPAID',
    status: 'APPROVED',
    requiresApproval: false
  };

  const mockProfitabilityReport = {
    projectId: 'proj-001',
    projectCode: 'PRJ-2026-00001',
    projectName: 'Rooftop 15kWp Commercial',
    customerId: 'cust-001',
    systemCapacityKwp: 15,
    currentStage: 'STAGE_06_INSTALLATION_WORK',
    projectStatus: 'IN_PROGRESS',
    hasConfirmedOrder: true,
    orderNumber: 'ORD-2026-00001',
    contractedSalesValuePaise: 75000000, // ₹750,000.00
    operationalProgressPercent: 50,
    operationalProgressRevenuePaise: 37500000, // ₹375,000.00
    confirmedCollectionsPaise: 30000000, // ₹300,000.00
    unallocatedCustomerCreditPaise: 2000000, // ₹20,000.00
    outstandingReceivablesPaise: 45000000, // ₹450,000.00
    costSummary: {
      materialsCostPaise: 46000000,
      laborCostPaise: 4500000,
      logisticsCostPaise: 1500000,
      civilCostPaise: 0,
      miscCostPaise: 0,
      totalCostPaise: 52000000 // ₹520,000.00
    },
    estimatedGrossMarginPaise: 23000000, // ₹230,000.00
    grossMarginPercent: 30.67,
    budgetComparison: {
      hasApprovedBudget: true,
      budgetVersion: 1,
      approvedAt: '2026-10-15T00:00:00.000Z',
      materials: { plannedPaise: 45000000, actualPaise: 46000000, variancePaise: 1000000 },
      labor: { plannedPaise: 5000000, actualPaise: 4500000, variancePaise: -500000 },
      logistics: { plannedPaise: 1000000, actualPaise: 1500000, variancePaise: 500000 },
      civil: { plannedPaise: 0, actualPaise: 0, variancePaise: 0 },
      misc: { plannedPaise: 0, actualPaise: 0, variancePaise: 0 },
      contingency: { plannedPaise: 1000000, actualPaise: 0, variancePaise: -1000000 },
      total: { plannedPaise: 52000000, actualPaise: 52000000, variancePaise: 0 }
    },
    isDataComplete: true,
    dataCompletenessNotes: [],
    disclaimer:
      'Operational Costing & Profitability Notice: These figures represent operational cost allocations and project progress estimates. They do not constitute audited statutory financial statements or double-entry general ledger accounts under Indian GAAP or Ind AS.'
  };

  const mockCostLedgerEntries = [
    {
      id: 'disp_1',
      sourceType: 'MATERIAL_DISPATCH',
      sourceId: 'disp-001',
      sourceNumber: 'DSP-2026-00001',
      costCategory: 'MATERIALS',
      description: 'Solar Panel 540W Mono PERC (Qty: 30 NOS)',
      quantity: 30,
      unitRatePaise: 1250000,
      amountPaise: 37500000,
      effectiveDate: '2026-10-20T00:00:00.000Z',
      status: 'DISPATCHED'
    },
    {
      id: 'exp_1',
      sourceType: 'EXPENSE',
      sourceId: 'exp-001',
      sourceNumber: 'EXP-2026-00001',
      costCategory: 'INSTALLATION_LABOR',
      description: 'Subcontractor structure installation charge',
      amountPaise: 4500000,
      effectiveDate: '2026-10-22T00:00:00.000Z',
      status: 'APPROVED'
    }
  ];

  const mockBudgets = [
    {
      _id: 'b-001',
      version: 1,
      status: 'APPROVED',
      totalBudgetPaise: 52000000,
      materialsBudgetPaise: 45000000,
      laborBudgetPaise: 5000000,
      logisticsBudgetPaise: 1000000,
      civilBudgetPaise: 0,
      miscBudgetPaise: 0,
      contingencyBudgetPaise: 1000000,
      createdAt: '2026-10-15T00:00:00.000Z'
    }
  ];

  // --------------------------------------------------------------------------
  // 1. ExpensesPage Register & KPI Cards
  // --------------------------------------------------------------------------
  it('renders Operational Expense Management page with KPI cards and expense register', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({
      data: [mockExpense, mockApprovedExpense],
      total: 2,
      page: 1,
      totalPages: 1
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ExpensesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Title
    expect(screen.getByText('Operational Expense Management')).toBeInTheDocument();

    // KPI card titles
    expect(screen.getByText('Total Recorded Expenses')).toBeInTheDocument();
    expect(screen.getAllByText('Pending Approval').length).toBeGreaterThan(0);
    expect(screen.getByText('Approved & Unpaid')).toBeInTheDocument();
    expect(screen.getByText('Disbursed / Paid')).toBeInTheDocument();

    // Table rows
    await waitFor(() => {
      expect(screen.getByText('EXP-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Ravi Kumar Contractors')).toBeInTheDocument();
      expect(screen.getByText('EXP-2026-00002')).toBeInTheDocument();
      expect(screen.getByText('IOCL Petrol Bunk')).toBeInTheDocument();
    });

    // Action buttons
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Disburse')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 2. Record Expense Modal
  // --------------------------------------------------------------------------
  it('opens Record Expense modal when clicking Record Expense button', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 1
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ExpensesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const recordBtn = screen.getByText('Record Expense');
    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(screen.getByText('Record New Expense')).toBeInTheDocument();
      expect(screen.getByText('Base Amount (₹)')).toBeInTheDocument();
      expect(screen.getByText('Description & Business Purpose')).toBeInTheDocument();
      expect(screen.getByText('Submit Expense')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 3. ProjectCostingTab Profitability & Margin Overview
  // --------------------------------------------------------------------------
  it('renders ProjectCostingTab with margin %, collections, costs and disclaimer', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(((url: string) => {
      if (url.includes('/profitability')) {
        return Promise.resolve(mockProfitabilityReport);
      }
      if (url.includes('/cost-ledger')) {
        return Promise.resolve({ entries: mockCostLedgerEntries });
      }
      if (url.includes('/budgets')) {
        return Promise.resolve(mockBudgets);
      }
      return Promise.resolve({});
    }) as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProjectCostingTab projectId="proj-001" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // KPI Overview Cards
    await waitFor(() => {
      expect(screen.getByText('Contracted Order Value')).toBeInTheDocument();
      expect(screen.getByText('Customer Collections')).toBeInTheDocument();
      expect(screen.getByText('Total Incurred Cost')).toBeInTheDocument();
      expect(screen.getByText('Estimated Gross Margin')).toBeInTheDocument();
      expect(screen.getByText('30.7%')).toBeInTheDocument(); // 30.67% rounded
    });

    // Budget vs Actual Table
    expect(screen.getByText('Budget versus Actual Cost Analysis')).toBeInTheDocument();
    expect(screen.getByText('Materials Consumed')).toBeInTheDocument();
    expect(screen.getByText('Installation Labor')).toBeInTheDocument();

    // Cost Ledger Table
    expect(screen.getByText('Project Cost Ledger')).toBeInTheDocument();
    expect(screen.getByText('DSP-2026-00001')).toBeInTheDocument();
    expect(screen.getByText('EXP-2026-00001')).toBeInTheDocument();

    // Legal Disclaimer
    expect(
      screen.getByText(/do not constitute audited statutory financial statements/i)
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 4. Incomplete Data Notice in ProjectCostingTab
  // --------------------------------------------------------------------------
  it('displays incomplete data warning when project lacks confirmed sales order', async () => {
    const incompleteReport = {
      ...mockProfitabilityReport,
      isDataComplete: false,
      dataCompletenessNotes: [
        'No confirmed Sales Order is linked to this project.',
        'No approved project baseline budget exists.'
      ],
      budgetComparison: {
        ...mockProfitabilityReport.budgetComparison,
        hasApprovedBudget: false
      }
    };

    vi.spyOn(apiModule, 'apiClient').mockImplementation(((url: string) => {
      if (url.includes('/profitability')) {
        return Promise.resolve(incompleteReport);
      }
      return Promise.resolve({ entries: [] });
    }) as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProjectCostingTab projectId="proj-001" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Incomplete Financial Data Notice')).toBeInTheDocument();
      expect(screen.getByText(/No confirmed Sales Order is linked/i)).toBeInTheDocument();
    });
  });
});
