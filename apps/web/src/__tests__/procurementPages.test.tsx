import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { VendorsPage } from '../pages/VendorsPage.js';
import { PurchaseOrdersPage } from '../pages/PurchaseOrdersPage.js';
import { PurchaseOrderDetailPage } from '../pages/PurchaseOrderDetailPage.js';
import { GoodsReceiptsPage } from '../pages/GoodsReceiptsPage.js';
import { VendorInvoicesPage } from '../pages/VendorInvoicesPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 5B: Procurement Frontend Operational Pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders VendorsPage with metrics cards and suppliers list', async () => {
    const mockVendors = [
      {
        _id: '507f1f77bcf86cd799439044',
        vendorCode: 'VEN-2026-00001',
        name: 'Adani Solar Tech Ltd',
        contactPerson: 'Karan Patel',
        phone: '+919876543210',
        email: 'sales@adanisolar.com',
        gstin: '24AAACA1234A1Z5',
        paymentTermsDays: 45,
        isActive: true,
        hasPurchaseHistory: true,
        createdAt: '2026-10-26T00:00:00.000Z'
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/vendors')) {
        return { data: { items: mockVendors, total: 1 } };
      }
      return null;
    });

    render(
      <MemoryRouter>
        <VendorsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Vendor Directory/i);
    expect(screen.getByText(/Add Vendor/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Adani Solar Tech Ltd')).toBeInTheDocument();
      expect(screen.getByText('VEN-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('24AAACA1234A1Z5')).toBeInTheDocument();
    });
  });

  it('renders PurchaseOrdersPage with table and status badges', async () => {
    const mockPOs = [
      {
        _id: '507f1f77bcf86cd799439088',
        poNumber: 'PO-2026-00001',
        orderDate: '2026-10-26T00:00:00.000Z',
        status: 'APPROVED',
        totalAmountPaise: 16800000,
        isInterState: false,
        vendorId: {
          _id: '507f1f77bcf86cd799439044',
          name: 'Adani Solar Tech Ltd',
          vendorCode: 'VEN-2026-00001'
        },
        destinationWarehouseId: {
          _id: '507f1f77bcf86cd799439055',
          name: 'Central Solar Depot',
          code: 'WH-CENTRAL'
        },
        lineItems: []
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/purchase-orders')) {
        return { data: { items: mockPOs, total: 1 } };
      }
      return null;
    });

    render(
      <MemoryRouter>
        <PurchaseOrdersPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Purchase Orders/i);
    expect(screen.getByText(/Create Purchase Order/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PO-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Central Solar Depot')).toBeInTheDocument();
    });
  });

  it('renders PurchaseOrderDetailPage with line items, outstanding tracking and receipt actions', async () => {
    const mockPODetail = {
      _id: 'po-123',
      poNumber: 'PO-2026-00001',
      orderDate: '2026-10-26T00:00:00.000Z',
      status: 'APPROVED',
      isInterState: false,
      subtotalPaise: 15000000,
      totalDiscountPaise: 0,
      totalTaxPaise: 1800000,
      totalAmountPaise: 16800000,
      revision: 1,
      vendorId: {
        _id: 'v-1',
        name: 'Waaree Energies Ltd',
        vendorCode: 'VEN-2026-00001',
        gstin: '24AAACW1234A1Z5'
      },
      destinationWarehouseId: {
        _id: 'wh-1',
        name: 'Ahmedabad Warehouse',
        code: 'WH-AMD'
      },
      createdBy: {
        firstName: 'Amit',
        lastName: 'Sharma',
        email: 'amit@solar.com'
      },
      lineItems: [
        {
          productId: 'p-1',
          sku: 'MOD-550-MONO',
          productName: '550Wp Mono TopCon Solar Panel',
          orderedQuantity: 20,
          receivedQuantity: 15,
          rejectedQuantity: 1,
          outstandingQuantity: 5,
          unitPurchaseRatePaise: 1500000,
          gstRate: 12,
          totalTaxPaise: 180000,
          totalAmountPaise: 1680000,
          uom: 'NOS'
        }
      ]
    };

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/purchase-orders/po-123') {
        return { data: mockPODetail };
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={['/purchase-orders/po-123']}>
        <Routes>
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PO-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Waaree Energies Ltd')).toBeInTheDocument();
      expect(screen.getByText('550Wp Mono TopCon Solar Panel')).toBeInTheDocument();
      expect(screen.getByText('Receive Goods (GRN)')).toBeInTheDocument();
    });
  });

  it('renders GoodsReceiptsPage with GRN list', async () => {
    const mockGRNs = [
      {
        _id: 'grn-1',
        grnNumber: 'GRN-2026-00001',
        receiptDate: '2026-10-26T00:00:00.000Z',
        status: 'COMPLETED',
        deliveryChallanNumber: 'DC-9901',
        purchaseOrderId: {
          _id: 'po-1',
          poNumber: 'PO-2026-00001',
          status: 'PARTIALLY_RECEIVED'
        },
        vendorId: {
          _id: 'v-1',
          name: 'Adani Solar'
        },
        destinationWarehouseId: {
          _id: 'wh-1',
          name: 'Central Depot'
        },
        receivedBy: {
          firstName: 'Suresh',
          lastName: 'Kumar'
        },
        lineItems: [
          {
            sku: 'INV-10KW',
            productName: '10kW Inverter',
            orderedQuantity: 10,
            deliveredQuantity: 5,
            acceptedQuantity: 5,
            rejectedQuantity: 0
          }
        ]
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/goods-receipts')) {
        return { data: { items: mockGRNs, total: 1 } };
      }
      return null;
    });

    render(
      <MemoryRouter>
        <GoodsReceiptsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Goods Receipt Notes/i);

    await waitFor(() => {
      expect(screen.getByText('GRN-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('PO-2026-00001')).toBeInTheDocument();
    });
  });

  it('renders VendorInvoicesPage with 3-way match reconciliation badges', async () => {
    const mockInvoices = [
      {
        _id: 'inv-1',
        vendorInvoiceNumber: 'INV-WAR-001',
        invoiceDate: '2026-10-26T00:00:00.000Z',
        subtotalPaise: 10000000,
        taxAmountPaise: 1200000,
        totalAmountPaise: 11200000,
        paidAmountPaise: 0,
        balancePayablePaise: 11200000,
        status: 'RECONCILED',
        discrepancyAmountPaise: 0,
        vendorId: {
          _id: 'v-1',
          name: 'Waaree Energies',
          vendorCode: 'VEN-001'
        },
        purchaseOrderId: {
          _id: 'po-1',
          poNumber: 'PO-2026-00001',
          totalAmountPaise: 11200000
        }
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/vendor-invoices')) {
        return { data: { items: mockInvoices, total: 1 } };
      }
      return null;
    });

    render(
      <MemoryRouter>
        <VendorInvoicesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Vendor Invoices & Payables/i
    );

    await waitFor(() => {
      expect(screen.getByText('INV-WAR-001')).toBeInTheDocument();
      expect(screen.getByText(/Reconciled \(3-Way Match\)/i)).toBeInTheDocument();
    });
  });
});
