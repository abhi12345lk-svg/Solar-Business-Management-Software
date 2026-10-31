import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SolarDesignPage } from '../pages/SolarDesignPage.js';
import { QuotationsPage } from '../pages/QuotationsPage.js';
import { QuotationDetailPage } from '../pages/QuotationDetailPage.js';
import * as apiModule from '../lib/api.js';
import { SolarTopology, QuotationStatus, QuotationItemType } from '@ins-solar/shared';

describe('Phase 4B Frontend Operational Pages', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 1. SolarDesignPage: Interactive Sizing Calculator & Design List
  // --------------------------------------------------------------------------
  it('renders SolarDesignPage with topology selector, sizing inputs, and disclaimer', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/solar-designs?')) {
        return [];
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SolarDesignPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole('heading', { name: /Solar Sizing Engine & Design Center/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/On-Grid \(Grid-Tied\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Off-Grid \(Autonomous\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hybrid \(Grid \+ Storage\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calculate Sizing Preview/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No solar designs recorded yet/i)).toBeInTheDocument();
    });
  });

  it('triggers sizing preview calculation and displays technical output', async () => {
    const mockSizingResult = {
      topology: SolarTopology.ON_GRID,
      moduleWattageWp: 550,
      proposedCapacityKwp: 10.45,
      panelQuantity: 19,
      actualDcCapacityKwp: 10.45,
      recommendedInverterKw: 8.71,
      inverterQuantity: 1,
      actualDcAcRatio: 1.2,
      estimatedGeneration: {
        dailyGenerationKwh: 39.19,
        monthlyGenerationKwh: 1175.7,
        annualGenerationKwh: 14304.35,
        specificYieldKwhPerKwp: 1368.8
      },
      warnings: [],
      disclaimer:
        'Preliminary technical sizing calculation based on standardized mathematical formulas.'
    };

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/solar-designs/calculate') {
        return mockSizingResult;
      }
      if (endpoint.startsWith('/solar-designs?')) {
        return [];
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SolarDesignPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const calcButton = screen.getByRole('button', { name: /Calculate Sizing Preview/i });
    fireEvent.click(calcButton);

    await waitFor(() => {
      expect(screen.getByText(/Calculated Technical Specifications/i)).toBeInTheDocument();
      expect(screen.getByText(/10.45/i)).toBeInTheDocument();
      expect(screen.getByText(/8.71/i)).toBeInTheDocument();
      expect(screen.getByText(/39.19/i)).toBeInTheDocument();
      expect(screen.getByText(/Preliminary technical sizing calculation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save as Official Design/i })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 2. QuotationsPage: Proposals Directory & Approval Queue Filter
  // --------------------------------------------------------------------------
  it('renders QuotationsPage with status tabs, discount approval queue, and proposals table', async () => {
    const mockQuotations = [
      {
        _id: '507f1f77bcf86cd799439001',
        quotationNumber: 'QT-2026-00001',
        revisionNumber: 0,
        fullQuotationCode: 'QT-2026-00001-R0',
        isLatestRevision: true,
        status: QuotationStatus.PENDING_APPROVAL,
        systemTopology: SolarTopology.ON_GRID,
        systemCapacityKwp: 10.45,
        grossSubtotalPaise: 10000000,
        additionalDiscountPaise: 800000,
        totalDiscountPaise: 800000,
        discountPercent: 8.0,
        requiresDiscountApproval: true,
        discountApprovalStatus: 'PENDING',
        taxableAmountPaise: 9200000,
        totalTaxPaise: 1104000,
        netTotalPaise: 10304000,
        validUntil: '2026-11-23T00:00:00.000Z',
        createdAt: '2026-10-23T12:00:00.000Z',
        customerId: {
          _id: '507f1f77bcf86cd799439002',
          legalName: 'Apex Commercial Towers',
          customerCode: 'CUS-2026-00001'
        },
        createdBy: {
          firstName: 'Aditya',
          lastName: 'Sales'
        }
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockResolvedValue(mockQuotations);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <QuotationsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole('heading', { name: /Quotations & Commercial Proposals/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All Quotations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discount Approval Queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Quotation/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('QT-2026-00001-R0').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Apex Commercial Towers').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Pending Discount Approval/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/8.0%/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. QuotationDetailPage: BOM, Financials, Discount Control & Acceptance
  // --------------------------------------------------------------------------
  it('renders QuotationDetailPage with BOM, financial breakdown, anti-self-approval notice, and customer acceptance', async () => {
    const mockDetail = {
      _id: '507f1f77bcf86cd799439001',
      quotationNumber: 'QT-2026-00001',
      revisionNumber: 0,
      fullQuotationCode: 'QT-2026-00001-R0',
      isLatestRevision: true,
      status: QuotationStatus.PENDING_APPROVAL,
      systemTopology: SolarTopology.ON_GRID,
      systemCapacityKwp: 10.45,
      customerId: {
        _id: '507f1f77bcf86cd799439002',
        legalName: 'Apex Commercial Towers',
        customerCode: 'CUS-2026-00001',
        primaryPhone: '+919876543210',
        email: 'ops@apex.in'
      },
      lineItems: [
        {
          itemType: QuotationItemType.SOLAR_MODULE,
          description: '550Wp Mono Perc Solar Module',
          quantity: 19,
          unit: 'Nos',
          unitRatePaise: 1450000,
          discountPaise: 0,
          taxableAmountPaise: 27550000,
          gstRateBasisPoints: 1200,
          taxPaise: 3306000,
          itemTotalPaise: 30856000
        }
      ],
      grossSubtotalPaise: 27550000,
      additionalDiscountPaise: 2000000,
      totalDiscountPaise: 2000000,
      discountPercent: 7.26,
      requiresDiscountApproval: true,
      discountApprovalStatus: 'PENDING',
      taxableAmountPaise: 25550000,
      totalTaxPaise: 3066000,
      taxComponents: [
        { componentName: 'CGST', rateBasisPoints: 600, taxAmountPaise: 1533000 },
        { componentName: 'SGST', rateBasisPoints: 600, taxAmountPaise: 1533000 }
      ],
      netTotalPaise: 28616000,
      taxProfile: {
        profileName: 'Standard Indian Solar EPC Tax Profile',
        profileCode: 'GST-EPC-STD-2026',
        effectiveDate: '2026-04-01',
        isInterState: false,
        accountingNotice:
          'Pre-commercial quotation; final GST classification must be confirmed by qualified chartered accountant.'
      },
      paymentMilestones: [
        { name: 'Advance', percentage: 20, description: 'Order booking' },
        { name: 'Dispatch', percentage: 70, description: 'Pre-dispatch' },
        { name: 'Commissioning', percentage: 10, description: 'Testing' }
      ],
      termsAndConditions: ['Valid for 30 days.'],
      validUntil: '2026-11-23T00:00:00.000Z',
      isAccepted: false,
      createdBy: {
        _id: '507f1f77bcf86cd799439099',
        firstName: 'Vikram',
        lastName: 'Sales',
        email: 'vikram@inssolar.com'
      },
      createdAt: '2026-10-23T12:00:00.000Z',
      updatedAt: '2026-10-23T12:00:00.000Z'
    };

    vi.spyOn(apiModule, 'apiClient').mockResolvedValue(mockDetail);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/quotations/507f1f77bcf86cd799439001']}>
          <Routes>
            <Route path="/quotations/:id" element={<QuotationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('QT-2026-00001-R0')).toBeInTheDocument();
      expect(screen.getByText(/Revision R0/i)).toBeInTheDocument();
      expect(screen.getByText('Apex Commercial Towers')).toBeInTheDocument();
      expect(screen.getAllByText(/550Wp Mono Perc Solar Module/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Commercial Discount Control/i)).toBeInTheDocument();
      expect(screen.getByText(/Exceeds 5.0% Limit/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Approve Discount/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject Discount/i })).toBeInTheDocument();
      expect(screen.getByText(/Anti-Self-Approval rule enforced on server/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Accept Proposal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();
      expect(
        screen.getByText(
          /final GST classification must be confirmed by qualified chartered accountant/i
        )
      ).toBeInTheDocument();
    });
  });
});
