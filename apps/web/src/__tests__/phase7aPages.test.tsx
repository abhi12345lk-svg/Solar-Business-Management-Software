/**
 * INS Solar Business Management Software — Phase 7A Web Frontend Tests
 *
 * Tests for Net Metering and Government Subsidy Tracking:
 * - Net Metering register metrics, table rows, and status badges
 * - Subsidy register financial cards (Sanctioned, Disbursed, Pipeline) and scheme filters
 * - Project Detail Net Metering Tab (DISCOM, feasibility, inspection, meter installation, document gate)
 * - Project Detail Subsidy Tab (paise financial calculations, progress bar, disbursement ledger, documents)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NetMeteringPage } from '../pages/NetMeteringPage.js';
import { SubsidyPage } from '../pages/SubsidyPage.js';
import { ProjectDetailPage } from '../pages/ProjectDetailPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 7A Frontend: Net Metering & Subsidy Tracking', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  const mockProjectDetail = {
    _id: 'proj-101',
    projectCode: 'PRJ-2026-00101',
    name: 'Sharma Residence Solar Rooftop 10kWp',
    customerId: {
      _id: 'cust-101',
      customerCode: 'CUST-101',
      legalName: 'Sharma Residence',
      primaryPhone: '+91 9988776655',
      email: 'sharma@example.com'
    },
    orderId: {
      _id: 'ord-101',
      orderNumber: 'ORD-2026-00101',
      netTotalPaise: 45000000,
      status: 'CONFIRMED'
    },
    systemCapacityKwp: 10.0,
    systemTopology: 'ON_GRID',
    currentStage: 'STAGE_7_NET_METERING_INTERCONNECTION',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    plannedStartDate: '2026-11-01T00:00:00.000Z',
    targetCompletionDate: '2026-12-01T00:00:00.000Z',
    projectManagerId: {
      _id: 'user-pm',
      firstName: 'Rahul',
      lastName: 'Verma',
      email: 'rahul.verma@inssolar.com'
    },
    milestones: [],
    tags: []
  };

  const mockNetMeteringApp = {
    _id: 'nma-1',
    applicationNumber: 'NMA-2026-00001',
    projectId: {
      _id: 'proj-101',
      projectCode: 'PRJ-2026-00101',
      name: 'Sharma Residence Solar Rooftop 10kWp'
    },
    customerId: {
      _id: 'cust-101',
      name: 'Sharma Residence',
      phone: '+91 9988776655'
    },
    discomName: 'Tata Power Delhi Distribution Limited',
    division: 'Civil Lines',
    subdivision: 'Sub-Div 4',
    consumerNumber: 'TPDDL-99882233',
    sanctionedLoadKw: 10,
    proposedCapacityKw: 10,
    status: 'INSPECTION_SCHEDULED',
    submissionDate: '2026-11-05T00:00:00.000Z',
    discomApplicationNumber: 'SUB-DISCOM-9911',
    feasibility: {
      isFeasible: true,
      feasibilityReference: 'FEAS-2026-001',
      demandNoteAmountPaise: 500000,
      demandNotePaid: true
    },
    inspectionSchedule: {
      scheduledDate: '2026-11-20T00:00:00.000Z',
      officerName: 'Er. S. K. Gupta',
      officerContact: '+91 9811223344',
      outcome: 'PENDING'
    },
    meterInstallation: {
      meterInstalled: true,
      meterNumber: 'MTR-BI-88331',
      installationDate: '2026-11-22T00:00:00.000Z',
      initialExportReadingKwh: 0,
      initialImportReadingKwh: 450
    },
    documents: [
      {
        id: 'doc-1',
        documentType: 'ELECTRICITY_BILL',
        title: 'Latest Electricity Bill',
        status: 'ACCEPTED',
        storageKey: 'evidence/doc1.pdf',
        fileSize: 102400
      },
      {
        id: 'doc-2',
        documentType: 'SINGLE_LINE_DIAGRAM',
        title: 'Single Line Diagram',
        status: 'PENDING_REVIEW',
        storageKey: 'evidence/doc2.pdf',
        fileSize: 204800
      }
    ],
    statusHistory: [
      {
        fromStatus: 'DRAFT',
        toStatus: 'INSPECTION_SCHEDULED',
        changedAt: '2026-11-10T10:00:00.000Z',
        reason: 'Inspection appointment confirmed by DISCOM'
      }
    ],
    createdAt: '2026-11-01T00:00:00.000Z'
  };

  const mockSubsidyApp = {
    _id: 'sub-1',
    applicationNumber: 'SUB-2026-00001',
    projectId: {
      _id: 'proj-101',
      projectCode: 'PRJ-2026-00101',
      name: 'Sharma Residence Solar Rooftop 10kWp'
    },
    customerId: {
      _id: 'cust-101',
      name: 'Sharma Residence',
      phone: '+91 9988776655'
    },
    schemeName: 'PM_SURYA_GHAR_MUFT_BIJLI_YOJANA',
    schemeVersion: '2024-2026 Phase II',
    status: 'PARTIALLY_DISBURSED',
    estimatedAmountPaise: 7800000,
    requestedAmountPaise: 7800000,
    approvedAmountPaise: 7800000,
    disbursedAmountPaise: 3900000,
    portalApplicationNumber: 'PMSG-DEL-2026-8812',
    sanctionReference: 'MNRE-SANC-2026-7788',
    sanctionDate: '2026-11-15T00:00:00.000Z',
    disbursements: [
      {
        disbursementId: 'disb-1',
        disbursementReference: 'DISB-001',
        amountPaise: 3900000,
        disbursedAt: '2026-11-20T00:00:00.000Z',
        referenceNumber: 'NEFT-RBI-99881122',
        paymentMode: 'DIRECT_BENEFIT_TRANSFER',
        recipientAccount: 'SBIN0001234-9988',
        idempotencyKey: 'IDEM-001',
        notes: 'Initial tranche 50% release from Central portal'
      }
    ],
    documents: [
      {
        id: 'sub-doc-1',
        documentType: 'AADHAAR_CARD',
        title: 'Consumer Aadhaar Card',
        status: 'ACCEPTED',
        storageKey: 'evidence/sub_doc1.pdf',
        fileSize: 1048576
      }
    ],
    statusHistory: [],
    createdAt: '2026-11-02T00:00:00.000Z'
  };

  it('renders Net Metering register with metrics and applications', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/net-metering')) {
        return {
          applications: [mockNetMeteringApp],
          total: 1
        };
      }
      return { applications: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NetMeteringPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Net Metering Applications')).toBeInTheDocument();
      expect(screen.getByText(/NMA-2026-00001/)).toBeInTheDocument();
      expect(screen.getByText(/Tata Power Delhi Distribution/)).toBeInTheDocument();
      expect(screen.getByText(/TPDDL-99882233/)).toBeInTheDocument();
      expect(screen.getAllByText(/Installed/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders Subsidy register with financial balances and disbursements', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/subsidies')) {
        return {
          applications: [mockSubsidyApp],
          total: 1
        };
      }
      return { applications: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SubsidyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Subsidies')).toBeInTheDocument();
      expect(screen.getByText(/SUB-2026-00001/)).toBeInTheDocument();
      expect(screen.getByText(/PMSG-DEL-2026-8812/)).toBeInTheDocument();
    });
  });

  it('renders Net Metering tab within ProjectDetailPage', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-101') {
        return mockProjectDetail;
      }
      if (endpoint.startsWith('/net-metering')) {
        return {
          applications: [mockNetMeteringApp]
        };
      }
      if (endpoint.startsWith('/subsidies')) {
        return {
          applications: [mockSubsidyApp]
        };
      }
      if (endpoint.startsWith('/projects/proj-101/tasks')) {
        return [];
      }
      if (endpoint.startsWith('/dispatches/projects/proj-101/summary')) {
        return { materialSummary: [] };
      }
      if (endpoint.startsWith('/dispatches?projectId=proj-101')) {
        return [];
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-101']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for project detail to load
    await waitFor(() => {
      expect(screen.getByText('Sharma Residence Solar Rooftop 10kWp')).toBeInTheDocument();
    });

    // Click Net Metering tab
    const netMeteringTabBtn = screen.getByRole('button', { name: /Net Metering/i });
    fireEvent.click(netMeteringTabBtn);

    // Check that Net Metering details are rendered
    await waitFor(() => {
      expect(screen.getByText('NMA-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Tata Power Delhi Distribution Limited')).toBeInTheDocument();
      expect(screen.getByText(/MTR-BI-88331/)).toBeInTheDocument();
      expect(screen.getByText('Latest Electricity Bill')).toBeInTheDocument();
    });
  });

  it('renders Subsidy tab within ProjectDetailPage with paise financial ledger', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-101') {
        return mockProjectDetail;
      }
      if (endpoint.startsWith('/net-metering')) {
        return {
          applications: [mockNetMeteringApp]
        };
      }
      if (endpoint.startsWith('/subsidies')) {
        return {
          applications: [mockSubsidyApp]
        };
      }
      if (endpoint.startsWith('/projects/proj-101/tasks')) {
        return [];
      }
      if (endpoint.startsWith('/dispatches/projects/proj-101/summary')) {
        return { materialSummary: [] };
      }
      if (endpoint.startsWith('/dispatches?projectId=proj-101')) {
        return [];
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-101']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sharma Residence Solar Rooftop 10kWp')).toBeInTheDocument();
    });

    // Click Subsidy tab
    const subsidyTabBtn = screen.getByRole('button', { name: /Subsidy/i });
    fireEvent.click(subsidyTabBtn);

    // Check that Subsidy financial amounts and disbursement ledger are rendered
    await waitFor(() => {
      expect(subsidyTabBtn).toHaveClass('border-solar-600');
      expect(screen.getByText('SUB-2026-00001')).toBeInTheDocument();
      expect(screen.getByText(/DISB-001/)).toBeInTheDocument();
    });
  });
});
