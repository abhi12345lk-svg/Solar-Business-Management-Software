/**
 * INS Solar Business Management Software — Phase 6B Web Frontend Tests
 *
 * Tests for Material Dispatch and 5-Category Installation Checklist:
 * - Material dispatch ledger, summary cards, and serialized tracking
 * - 5-Category installation checklist rendering and category progress
 * - Mandatory photo evidence enforcement and blocker alerts
 * - Secure evidence link viewing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectDetailPage } from '../pages/ProjectDetailPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 6B Frontend: Material Dispatch & Installation Checklist', () => {
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
    _id: 'proj-123',
    projectCode: 'PRJ-2026-00001',
    name: 'Apex Commercial Rooftop 25kWp',
    customerId: {
      _id: 'cust-1',
      customerCode: 'CUST-001',
      legalName: 'Apex Industries Ltd',
      primaryPhone: '+91 9876543210',
      email: 'contact@apexind.com'
    },
    orderId: {
      _id: 'ord-1',
      orderNumber: 'ORD-2026-00001',
      netTotalPaise: 125000000,
      status: 'CONFIRMED'
    },
    systemCapacityKwp: 25.0,
    systemTopology: 'ON_GRID',
    currentStage: 'STAGE_3_MATERIAL_DISPATCH',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    plannedStartDate: '2026-11-01T00:00:00.000Z',
    targetCompletionDate: '2026-12-01T00:00:00.000Z',
    projectManagerId: {
      _id: 'user-pm',
      firstName: 'Vikram',
      lastName: 'Patel',
      email: 'vikram.patel@inssolar.com'
    },
    milestones: [],
    stageHistory: []
  };

  const mockMaterialSummary = {
    materialSummary: [
      {
        productId: 'prod-solar-540',
        name: 'Mono PERC 540W Solar Panel',
        sku: 'SOL-540-MONO',
        contractedQuantity: 50,
        totalIssuedQuantity: 30,
        remainingQuantity: 20
      },
      {
        productId: 'prod-inv-25kw',
        name: '25kW 3-Phase On-Grid Inverter',
        sku: 'INV-25KW-3P',
        contractedQuantity: 1,
        totalIssuedQuantity: 1,
        remainingQuantity: 0
      }
    ]
  };

  const mockDispatches = [
    {
      _id: 'disp-001',
      dispatchNumber: 'DSP-2026-00001',
      projectId: 'proj-123',
      sourceWarehouseId: {
        _id: 'wh-main',
        name: 'Central Logistics Depot',
        code: 'DEPOT-01'
      },
      status: 'DISPATCHED',
      dispatchedAt: '2026-11-05T10:00:00.000Z',
      vehicleNumber: 'GJ-01-AB-1234',
      driverName: 'Suresh Kumar',
      driverPhone: '9876543210',
      lineItems: [
        {
          productId: {
            _id: 'prod-solar-540',
            name: 'Mono PERC 540W Solar Panel',
            sku: 'SOL-540-MONO'
          },
          requestedQuantity: 30,
          issuedQuantity: 30,
          serialNumbers: ['PANEL-001', 'PANEL-002']
        }
      ]
    }
  ];

  const mockChecklist = {
    _id: 'chk-instance-123',
    projectId: 'proj-123',
    templateCode: 'CKT-STANDARD-ROOFTOP',
    templateVersion: 1,
    categories: [
      {
        category: 'SITE_READINESS_SAFETY',
        title: '1. Site Readiness & Safety',
        items: [
          {
            _id: 'item-1',
            itemCode: 'CHK-01-01',
            description: 'Roof structural integrity & load-bearing certification verified',
            isRequired: true,
            requiresEvidence: true,
            status: 'PASSED',
            evidence: [
              {
                _id: 'ev-01',
                storageKey: 'evidence/roof_cert.jpg',
                fileName: 'roof_cert.jpg',
                fileSizeBytes: 204800,
                mimeType: 'image/jpeg',
                latitude: 23.0225,
                longitude: 72.5714,
                uploadedAt: '2026-11-02T10:00:00.000Z'
              }
            ]
          }
        ]
      },
      {
        category: 'STRUCTURE_MODULE_MOUNTING',
        title: '2. Mounting Structure & Modules',
        items: [
          {
            _id: 'item-2',
            itemCode: 'CHK-02-01',
            description: 'MMS rails torqued and anodized corrosion protection verified',
            isRequired: true,
            requiresEvidence: true,
            status: 'FAILED',
            failureReason: 'Torque on clamp bolts measured below specified 14 Nm',
            evidence: []
          }
        ]
      },
      {
        category: 'DC_WIRING_EARTHING',
        title: '3. DC Wiring, Protection & Earthing',
        items: [
          {
            _id: 'item-3',
            itemCode: 'CHK-03-01',
            description: 'Earth pit resistance measured under 5 ohms',
            isRequired: true,
            requiresEvidence: true,
            status: 'NOT_STARTED',
            evidence: []
          }
        ]
      },
      {
        category: 'INVERTER_AC_PROTECTION',
        title: '4. Inverter, AC & Protection',
        items: [
          {
            _id: 'item-4',
            itemCode: 'CHK-04-01',
            description: 'Inverter IP65 mounting and ACDB surge protector installed',
            isRequired: true,
            requiresEvidence: false,
            status: 'NOT_STARTED',
            evidence: []
          }
        ]
      },
      {
        category: 'TESTING_COMMISSIONING_HANDOVER',
        title: '5. Testing & Handover Readiness',
        items: [
          {
            _id: 'item-5',
            itemCode: 'CHK-05-01',
            description: 'String open circuit Voc and operating Isc validated against design',
            isRequired: true,
            requiresEvidence: true,
            status: 'NOT_STARTED',
            evidence: []
          }
        ]
      }
    ]
  };

  // --------------------------------------------------------------------------
  // 1. Material Dispatch Tab & Fulfillment Cards
  // --------------------------------------------------------------------------
  it('renders Material Dispatch tab with BOM summary, dispatch slips, and serialized panel tracking', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-123') {
        return mockProjectDetail;
      }
      if (endpoint === '/dispatches?projectId=proj-123') {
        return mockDispatches;
      }
      if (endpoint === '/dispatches/projects/proj-123/summary') {
        return mockMaterialSummary;
      }
      if (endpoint === '/warehouses') {
        return [{ _id: 'wh-main', name: 'Central Logistics Depot', code: 'DEPOT-01' }];
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-123']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-00001')).toBeInTheDocument();
    });

    // Click on Material Dispatch tab
    const dispatchTab = screen.getByRole('button', { name: /Material Dispatch/i });
    fireEvent.click(dispatchTab);

    await waitFor(() => {
      // BOM summary cards
      expect(screen.getAllByText('Mono PERC 540W Solar Panel').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('SKU: SOL-540-MONO')).toBeInTheDocument();
      expect(screen.getByText('60% Dispatched')).toBeInTheDocument();
      expect(screen.getByText('100% Dispatched')).toBeInTheDocument();

      // Dispatch slip record
      expect(screen.getByText('DSP-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('DISPATCHED')).toBeInTheDocument();
      expect(screen.getByText('GJ-01-AB-1234')).toBeInTheDocument();
      expect(screen.getByText('Suresh Kumar (9876543210)')).toBeInTheDocument();
      expect(screen.getByText('SN: PANEL-001')).toBeInTheDocument();
      expect(screen.getByText('SN: PANEL-002')).toBeInTheDocument();

      // Action button
      expect(screen.getByRole('button', { name: /Issue Material Dispatch/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel & Return Stock/i })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 2. 5-Category Installation Checklist & Blocker Alert
  // --------------------------------------------------------------------------
  it('renders 5-category installation checklist with status badges and commissioning blocker warning', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-123') {
        return mockProjectDetail;
      }
      if (endpoint === '/projects/proj-123/checklist') {
        return mockChecklist;
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-123']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-00001')).toBeInTheDocument();
    });

    // Click on Installation Checklist tab
    const checklistTab = screen.getByRole('button', { name: /Installation Checklist/i });
    fireEvent.click(checklistTab);

    await waitFor(() => {
      // Checklist header and gate counter
      expect(screen.getByText('Installation Quality & Safety Checklist')).toBeInTheDocument();
      expect(screen.getByText('Mandatory: 1 / 5 Passed')).toBeInTheDocument();

      // Commissioning blocker warning banner (item-2 is FAILED)
      expect(screen.getByText(/Commissioning Stage Gates Blocked/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Torque on clamp bolts measured below specified 14 Nm/i).length).toBeGreaterThanOrEqual(1);

      // 5 categories present in pills or sections
      expect(screen.getAllByText(/1\. Site Readiness & Safety/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/2\. Mounting Structure & Modules/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/3\. DC Wiring, Protection & Earthing/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/4\. Inverter, AC & Protection/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/5\. Testing & Handover Readiness/i).length).toBeGreaterThanOrEqual(1);

      // Inspection item codes and statuses
      expect(screen.getByText('CHK-01-01')).toBeInTheDocument();
      expect(screen.getByText('PASSED')).toBeInTheDocument();
      expect(screen.getByText('roof_cert.jpg')).toBeInTheDocument();
      expect(screen.getByText('23.02, 72.57')).toBeInTheDocument(); // GPS tag
      expect(screen.getByRole('button', { name: /View Link/i })).toBeInTheDocument();

      expect(screen.getByText('CHK-02-01')).toBeInTheDocument();
      expect(screen.getAllByText('FAILED').length).toBeGreaterThanOrEqual(1);
    });
  });
});
