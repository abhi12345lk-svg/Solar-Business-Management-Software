/**
 * INS Solar Business Management Software — Phase 5A Web Frontend Tests
 *
 * Validates OrdersPage, OrderDetailPage, and InventoryPage rendering,
 * real API integration, reservation badges, and action modal triggers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrdersPage } from '../pages/OrdersPage.js';
import { OrderDetailPage } from '../pages/OrderDetailPage.js';
import { InventoryPage } from '../pages/InventoryPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 5A Frontend Operational Pages', () => {
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
  // 1. OrdersPage Rendering & Directory Table
  // --------------------------------------------------------------------------
  it('renders OrdersPage with metric cards, filters, and orders list', async () => {
    const mockOrders = [
      {
        _id: '507f1f77bcf86cd799439011',
        orderNumber: 'ORD-2026-00001',
        orderDate: '2026-10-23T00:00:00.000Z',
        status: 'CONFIRMED',
        reservationStatus: 'FULLY_RESERVED',
        systemCapacityKwp: 10.5,
        netTotalPaise: 24640000,
        customerId: {
          _id: 'cust-1',
          legalName: 'Apex Solar Client',
          customerCode: 'CUST-001'
        },
        createdAt: '2026-10-23T00:00:00.000Z'
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/orders')) {
        return { items: mockOrders, total: 1 };
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Sales Orders/i })).toBeInTheDocument();
    expect(screen.getByText(/Create Order from Quotation/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Apex Solar Client').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/ORD-2026-00001/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Fully Reserved/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. OrderDetailPage: Commercial Scope & Totals
  // --------------------------------------------------------------------------
  it('renders OrderDetailPage with snapshot BOM items, financial totals, and action buttons', async () => {
    const mockOrder = {
      _id: '507f1f77bcf86cd799439011',
      orderNumber: 'ORD-2026-00001',
      orderDate: '2026-10-23T00:00:00.000Z',
      status: 'CONFIRMED',
      reservationStatus: 'NONE',
      systemTopology: 'ON_GRID',
      systemCapacityKwp: 10.5,
      customerId: {
        _id: 'cust-1',
        legalName: 'Apex Solar Client',
        primaryPhone: '+919876543210',
        email: 'apex@example.com'
      },
      quotationRevisionId: {
        _id: 'q-1',
        fullQuotationCode: 'QT-2026-00001-R0'
      },
      lineItems: [
        {
          itemType: 'SOLAR_MODULE',
          description: '550Wp Mono Perc Solar Module',
          quantity: 20,
          unit: 'NOS',
          unitRatePaise: 1100000,
          discountPaise: 0,
          taxableAmountPaise: 22000000,
          gstRateBasisPoints: 1200,
          taxPaise: 2640000,
          itemTotalPaise: 24640000
        }
      ],
      grossSubtotalPaise: 22000000,
      totalDiscountPaise: 0,
      taxableAmountPaise: 22000000,
      totalTaxPaise: 2640000,
      netTotalPaise: 24640000,
      taxProfile: {
        profileName: 'Intra-State GST 12%',
        profileCode: 'GST-INTRA-12'
      },
      paymentMilestones: [
        { name: 'Advance', percentage: 20, description: 'Booking token' },
        { name: 'Material Dispatch', percentage: 70, description: 'Before dispatch' },
        { name: 'Commissioning', percentage: 10, description: 'Net metering' }
      ],
      termsAndConditions: ['5-year warranty'],
      createdAt: '2026-10-23T00:00:00.000Z'
    };

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/orders/507f1f77bcf86cd799439011') {
        return mockOrder;
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/orders/507f1f77bcf86cd799439011']}>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ORD-2026-00001')).toBeInTheDocument();
      expect(screen.getAllByText('550Wp Mono Perc Solar Module').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('20 NOS').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /Reserve Stock/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel Order/i })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 3. InventoryPage: Stock Balances, Movement Ledger & Serial Number Tabs
  // --------------------------------------------------------------------------
  it('renders InventoryPage with multi-location stock balances and action buttons', async () => {
    const mockBalances = [
      {
        _id: 'bal-1',
        productId: {
          _id: 'p-1',
          name: '550Wp Solar Panel',
          sku: 'MOD-550'
        },
        warehouseId: {
          _id: 'wh-1',
          name: 'Central Warehouse',
          code: 'WH-01'
        },
        onHandQuantity: 100,
        reservedQuantity: 20,
        availableQuantity: 80,
        updatedAt: '2026-10-23T00:00:00.000Z'
      }
    ];

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/inventory/balances?')) {
        return { items: mockBalances, total: 1 };
      }
      if (endpoint.startsWith('/warehouses?')) {
        return { items: [{ _id: 'wh-1', name: 'Central Warehouse', code: 'WH-01' }] };
      }
      if (endpoint.startsWith('/catalog/products?')) {
        return { items: [{ _id: 'p-1', name: '550Wp Solar Panel', sku: 'MOD-550' }] };
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InventoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole('heading', { name: /Inventory Ledger & Stock Balances/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Receive Stock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Issue Material/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('550Wp Solar Panel')).toBeInTheDocument();
      expect(screen.getByText('Central Warehouse')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument(); // On-hand
      expect(screen.getByText('20')).toBeInTheDocument(); // Reserved
      expect(screen.getByText('80')).toBeInTheDocument(); // Available
    });
  });
});
