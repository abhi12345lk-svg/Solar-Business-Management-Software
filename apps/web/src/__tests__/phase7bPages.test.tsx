/**
 * INS Solar Business Management Software — Phase 7B Web Frontend Tests
 *
 * Tests for Service, Warranty, AMC & Service Visits:
 * - Service Complaints register, metrics, category & priority badges
 * - Warranty register, serialized equipment status, claim tracking
 * - AMC register, paise pricing, included vs consumed visit progress
 * - Service Visits register, technician assignment, checklist and completion
 * - Customer Service Portal views (isolated customer data, tickets, equipment)
 * - Project Detail Service & AMC Tab integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComplaintsPage } from '../pages/ComplaintsPage.js';
import { WarrantiesPage } from '../pages/WarrantiesPage.js';
import { AmcPage } from '../pages/AmcPage.js';
import { ServiceVisitsPage } from '../pages/ServiceVisitsPage.js';
import { CustomerServicePortalPage } from '../pages/CustomerServicePortalPage.js';
import { ServiceAmcTab } from '../components/project/ServiceAmcTab.js';
import * as apiModule from '../lib/api.js';

describe('Phase 7B Frontend: Service, Warranty, AMC & Service Visits', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  const mockComplaint = {
    _id: 'cmp-101',
    complaintNumber: 'CMP-2026-00001',
    customerId: {
      _id: 'cust-101',
      name: 'Sharma Residence',
      legalName: 'Sharma Residence',
      primaryPhone: '+91 9876543210'
    },
    projectId: {
      _id: 'proj-101',
      projectCode: 'PRJ-2026-00101',
      name: 'Sharma 10kWp Rooftop'
    },
    title: 'Inverter Error Code E04 Grid Fault',
    category: 'INVERTER_FAULT',
    priority: 'HIGH',
    severity: 'MAJOR',
    source: 'CUSTOMER_PORTAL',
    status: 'IN_PROGRESS',
    description: 'Inverter trips repeatedly when grid voltage crosses 250V.',
    createdAt: '2026-11-01T00:00:00.000Z',
    assignedTechnicianId: {
      _id: 'tech-1',
      firstName: 'Vikram',
      lastName: 'Singh'
    },
    statusHistory: [
      {
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        changedAt: '2026-11-02T10:00:00.000Z',
        reason: 'Technician assigned'
      }
    ]
  };

  const mockWarrantySerial = {
    _id: 'sn-101',
    serialNumber: 'INV-SOLIS-992211',
    productId: {
      _id: 'prod-inv-1',
      name: 'Solis 10kW On-Grid Inverter 3-Phase',
      category: 'INVERTER',
      modelNumber: 'SOL-10K-3P'
    },
    projectId: {
      _id: 'proj-101',
      projectCode: 'PRJ-2026-00101',
      name: 'Sharma 10kWp Rooftop'
    },
    customerId: {
      _id: 'cust-101',
      name: 'Sharma Residence',
      legalName: 'Sharma Residence'
    },
    warrantyStartDate: '2026-01-01T00:00:00.000Z',
    warrantyEndDate: '2031-01-01T00:00:00.000Z',
    warrantyStatus: 'ACTIVE',
    supplierWarrantyReference: 'SOLIS-INDIA-WRN-88331',
    warrantyTerms: '5 Years Manufacturer Replacement Warranty',
    status: 'ISSUED'
  };

  const mockWarrantyClaim = {
    _id: 'clm-101',
    claimNumber: 'CLM-2026-00001',
    complaintId: {
      _id: 'cmp-101',
      complaintNumber: 'CMP-2026-00001',
      title: 'Inverter Error Code E04 Grid Fault'
    },
    serialNumber: 'INV-SOLIS-992211',
    manufacturerName: 'Solis Power Inverters Ltd',
    claimType: 'REPLACEMENT',
    status: 'APPROVED',
    issueDescription: 'IGBT breakdown under grid surge',
    decisionNotes: 'Manufacturer approved full replacement inverter unit.',
    decisionDate: '2026-11-04T12:00:00.000Z',
    createdAt: '2026-11-02T00:00:00.000Z'
  };

  const mockAmc = {
    _id: 'amc-101',
    amcNumber: 'AMC-2026-00001',
    contractName: 'Comprehensive 5-Year Maintenance Plan',
    customerId: {
      _id: 'cust-101',
      name: 'Sharma Residence',
      legalName: 'Sharma Residence',
      primaryPhone: '+91 9876543210'
    },
    projectId: {
      _id: 'proj-101',
      projectCode: 'PRJ-2026-00101',
      name: 'Sharma 10kWp Rooftop'
    },
    planType: 'COMPREHENSIVE',
    capacityKwp: 10,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2027-01-01T00:00:00.000Z',
    contractAmountPaise: 2500000,
    includedVisits: 4,
    consumedVisits: 1,
    chargeableVisits: 0,
    visitCadence: 'QUARTERLY',
    status: 'ACTIVE',
    slaResponseHours: 24,
    slaResolutionHours: 72
  };

  const mockServiceVisit = {
    _id: 'vis-101',
    visitNumber: 'VIS-2026-00001',
    complaintId: {
      _id: 'cmp-101',
      complaintNumber: 'CMP-2026-00001',
      title: 'Inverter Error Code E04 Grid Fault'
    },
    customerId: {
      _id: 'cust-101',
      name: 'Sharma Residence',
      legalName: 'Sharma Residence',
      primaryPhone: '+91 9876543210'
    },
    projectId: {
      _id: 'proj-101',
      projectCode: 'PRJ-2026-00101',
      name: 'Sharma 10kWp Rooftop'
    },
    assignedTechnicianId: {
      _id: 'tech-1',
      firstName: 'Vikram',
      lastName: 'Singh',
      phone: '+91 9822334455'
    },
    visitType: 'BREAK_FIX_COMPLAINT',
    status: 'SCHEDULED',
    scheduledDate: '2026-11-05T00:00:00.000Z',
    scheduledTimeSlot: '10:00 AM - 01:00 PM',
    purpose: 'Inspect inverter internal capacitor and grid sync settings',
    checklist: [
      { item: 'Inspect DC isolator & SPD', completed: true },
      { item: 'Measure VOC & ISC on strings', completed: true },
      { item: 'Check grid voltage and phase sequence', completed: false }
    ],
    createdAt: '2026-11-02T00:00:00.000Z'
  };

  it('renders Service Complaints register with metrics and complaints', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/complaints')) {
        return {
          items: [mockComplaint],
          total: 1
        };
      }
      return { items: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ComplaintsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Service Complaints/i })).toBeInTheDocument();
      expect(screen.getByText('CMP-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Inverter Error Code E04 Grid Fault')).toBeInTheDocument();
      expect(screen.getByText('Sharma Residence')).toBeInTheDocument();
      expect(screen.getByText('Vikram Singh')).toBeInTheDocument();
    });
  });

  it('renders Warranty register with serial equipment and claims', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/warranties/claims')) {
        return {
          items: [mockWarrantyClaim],
          total: 1
        };
      }
      if (endpoint.startsWith('/warranties')) {
        return {
          items: [mockWarrantySerial],
          total: 1
        };
      }
      return { items: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WarrantiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Hardware Warranties & Claims/i })
      ).toBeInTheDocument();
      expect(screen.getByText('INV-SOLIS-992211')).toBeInTheDocument();
      expect(screen.getByText('Solis 10kW On-Grid Inverter 3-Phase')).toBeInTheDocument();
      expect(screen.getByText('SOLIS-INDIA-WRN-88331')).toBeInTheDocument();
    });

    // Switch to Claims tab
    const claimsTab = screen.getByRole('button', { name: /Warranty Claims Ledger/i });
    fireEvent.click(claimsTab);

    await waitFor(() => {
      expect(screen.getByText('CLM-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Solis Power Inverters Ltd')).toBeInTheDocument();
    });
  });

  it('renders AMC register with integer paise calculations and visit progress', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/amc')) {
        return {
          items: [mockAmc],
          total: 1
        };
      }
      return { items: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AmcPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Annual Maintenance Contracts \(AMC\)/i })
      ).toBeInTheDocument();
      expect(screen.getByText('AMC-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Sharma Residence')).toBeInTheDocument();
      // 2500000 paise = ₹25,000
      expect(screen.getByText(/₹25,000/)).toBeInTheDocument();
      // 1 of 4 visits consumed
      expect(screen.getByText('1 / 4')).toBeInTheDocument();
    });
  });

  it('renders Service Visits register with technician and checklist details', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/service-visits')) {
        return {
          items: [mockServiceVisit],
          total: 1
        };
      }
      return { items: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ServiceVisitsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Service Visits & Technician Dispatch/i })
      ).toBeInTheDocument();
      expect(screen.getByText('VIS-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Vikram Singh')).toBeInTheDocument();
      expect(
        screen.getByText('Inspect inverter internal capacitor and grid sync settings')
      ).toBeInTheDocument();
    });
  });

  it('renders Customer Service Portal with isolated customer data', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/customer-portal/service/complaints')) {
        return { items: [mockComplaint] };
      }
      if (endpoint.startsWith('/customer-portal/service/warranties')) {
        return { items: [mockWarrantySerial] };
      }
      if (endpoint.startsWith('/customer-portal/service/amc')) {
        return { items: [mockAmc] };
      }
      return { items: [] };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CustomerServicePortalPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Customer Service & Support Portal/i })
      ).toBeInTheDocument();
      expect(screen.getByText('CMP-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Inverter Error Code E04 Grid Fault')).toBeInTheDocument();
    });

    // Switch to Warranties Tab
    const warTab = screen.getByRole('button', { name: /Installed Equipment Warranties/i });
    fireEvent.click(warTab);

    await waitFor(() => {
      expect(screen.getByText('INV-SOLIS-992211')).toBeInTheDocument();
    });

    // Switch to AMC Tab
    const amcTab = screen.getByRole('button', { name: /Annual Maintenance \(AMC\)/i });
    fireEvent.click(amcTab);

    await waitFor(() => {
      expect(screen.getByText('AMC-2026-00001')).toBeInTheDocument();
    });
  });

  it('renders Service & AMC tab in Project Detail view', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/complaints')) {
        return { items: [mockComplaint], total: 1 };
      }
      if (endpoint.startsWith('/warranties')) {
        return { items: [mockWarrantySerial], total: 1 };
      }
      if (endpoint.startsWith('/amc')) {
        return { items: [mockAmc], total: 1 };
      }
      if (endpoint.startsWith('/service-visits')) {
        return { items: [mockServiceVisit], total: 1 };
      }
      return { items: [], total: 0 };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ServiceAmcTab projectId="proj-101" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('AMC-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('INV-SOLIS-992211')).toBeInTheDocument();
      expect(screen.getByText('Inverter Error Code E04 Grid Fault')).toBeInTheDocument();
      expect(screen.getByText('VIS-2026-00001')).toBeInTheDocument();
    });
  });
});
