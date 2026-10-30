/**
 * INS Solar Business Management Software — Phase 8A Web Frontend Tests
 *
 * Tests for Customer Payments, Allocations & Receivables:
 * - Customer Payments register with KPI metric cards, filters, and receipt numbers
 * - Record Payment modal with INR to integer-paise entry
 * - Verify and Allocation flow triggers
 * - Printable operational payment receipt modal with legal disclaimer (non-tax invoice)
 * - Customer Receivables Statement modal with 30/60/90 days aging breakdown
 * - Customer Portal self-service payments and receivables views
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentsPage } from '../pages/PaymentsPage.js';
import { CustomerPaymentsPortalPage } from '../pages/CustomerPaymentsPortalPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 8A Frontend: Customer Payments, Allocations & Receivables', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  const mockPayment = {
    _id: 'pay-001',
    receiptNumber: 'REC-2026-00001',
    amountPaise: 15000000, // Rs. 150,000.00
    paymentDate: '2026-10-25T00:00:00.000Z',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'NEFT2026102500123',
    status: 'VERIFIED',
    allocatedAmountPaise: 10000000, // Rs. 100,000.00
    unallocatedAmountPaise: 5000000, // Rs. 50,000.00
    notes: 'Advance for rooftop solar installation',
    customerId: {
      _id: 'cust-001',
      name: 'Vikram Mehta',
      customerCode: 'CUST-2026-00001',
      primaryPhone: '9876543210',
      email: 'vikram.mehta@example.com'
    },
    allocations: [
      {
        _id: 'alloc-001',
        allocationNumber: 'ALC-2026-00001',
        salesOrderId: {
          _id: 'order-001',
          orderNumber: 'SO-2026-00001',
          netTotalPaise: 25000000,
          systemCapacityKwp: 10
        },
        allocatedAmountPaise: 10000000,
        allocationDate: '2026-10-25T00:00:00.000Z',
        status: 'ACTIVE'
      }
    ],
    createdAt: '2026-10-25T00:00:00.000Z'
  };

  const mockReceiptDoc = {
    receiptNumber: 'REC-2026-00001',
    paymentDate: '2026-10-25T00:00:00.000Z',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'NEFT2026102500123',
    amountPaise: 15000000,
    allocatedAmountPaise: 10000000,
    unallocatedAmountPaise: 5000000,
    status: 'VERIFIED',
    company: {
      companyName: 'INS Solar Solutions Pvt Ltd',
      legalEntityName: 'INS Solar Private Limited',
      gstin: '07AAACI1234F1Z5',
      pan: 'AAACI1234F',
      contactPhone: '+91 80 1234 5678',
      contactEmail: 'accounts@inssolar.com'
    },
    customer: {
      name: 'Vikram Mehta',
      primaryPhone: '9876543210',
      email: 'vikram.mehta@example.com'
    },
    allocations: [
      {
        allocationNumber: 'ALC-2026-00001',
        orderNumber: 'SO-2026-00001',
        systemCapacityKwp: 10,
        allocatedAmountPaise: 10000000
      }
    ],
    notes: 'Advance for rooftop solar installation',
    disclaimer:
      'This document is an operational payment receipt confirming realization of customer funds against solar plant installation milestones. It does not constitute a statutory Tax Invoice under GST law.'
  };

  const mockReceivablesStatement = {
    customer: {
      _id: 'cust-001',
      name: 'Vikram Mehta',
      customerCode: 'CUST-2026-00001'
    },
    totalOrderValuePaise: 30000000,
    totalPaidPaise: 15000000,
    totalAllocatedPaise: 10000000,
    totalUnallocatedCreditPaise: 5000000,
    totalOutstandingPaise: 20000000,
    orders: [
      {
        _id: 'order-001',
        orderNumber: 'SO-2026-00001',
        orderDate: '2026-10-01T00:00:00.000Z',
        systemCapacityKwp: 10,
        netTotalPaise: 30000000,
        allocatedAmountPaise: 10000000,
        outstandingBalancePaise: 20000000,
        paymentStatus: 'PARTIALLY_PAID'
      }
    ],
    aging: {
      current0To30Paise: 0,
      overdue31To60Paise: 20000000,
      overdue61To90Paise: 0,
      overdueAbove90Paise: 0
    }
  };

  it('renders Customer Payments ledger with KPI cards, filters, and records', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({
      data: {
        items: [mockPayment],
        total: 1,
        page: 1,
        limit: 15
      }
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify Title & Subtitle
    expect(screen.getByText('Customer Payments & Receivables Ledger')).toBeInTheDocument();

    // Wait for ledger table to populate
    await waitFor(() => {
      expect(screen.getByText('REC-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Vikram Mehta')).toBeInTheDocument();
      expect(screen.getByText('VERIFIED')).toBeInTheDocument();
      expect(screen.getByText('NEFT2026102500123')).toBeInTheDocument();
    });

    // Check KPI metrics
    expect(screen.getByText('Total Realized Collections')).toBeInTheDocument();
    expect(screen.getByText('Allocated to Orders')).toBeInTheDocument();
    expect(screen.getByText('Unallocated Credits')).toBeInTheDocument();
  });

  it('opens Record Payment modal with required fields when button is clicked', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 15
      }
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const recordBtn = screen.getByText('Record Payment');
    fireEvent.click(recordBtn);

    expect(screen.getByText('Record Customer Payment')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter Customer Code (e.g. CUST-2026-00001) or ID')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 50000.00')).toBeInTheDocument();
  });

  it('opens and prints operational payment receipt with legal non-tax disclaimer', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(((endpoint: string) => {
      if (endpoint.includes('/receipt')) {
        return Promise.resolve({ data: mockReceiptDoc });
      }
      return Promise.resolve({
        data: {
          items: [mockPayment],
          total: 1,
          page: 1,
          limit: 15
        }
      });
    }) as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('REC-2026-00001')).toBeInTheDocument();
    });

    const printBtns = screen.getAllByTitle('Print / View Receipt');
    expect(printBtns.length).toBeGreaterThan(0);
    fireEvent.click(printBtns[0]!);

    await waitFor(() => {
      expect(screen.getByText('INS Solar Solutions Pvt Ltd')).toBeInTheDocument();
      expect(screen.getByText(/Notice of Fund Realization:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/does not constitute a statutory Tax Invoice under GST law/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Print Receipt')).toBeInTheDocument();
    });
  });

  it('opens customer receivables statement with aging breakdown', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(((endpoint: string) => {
      if (endpoint.includes('/receivables/customers')) {
        return Promise.resolve({ data: mockReceivablesStatement });
      }
      return Promise.resolve({
        data: {
          items: [mockPayment],
          total: 1,
          page: 1,
          limit: 15
        }
      });
    }) as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Statement')).toBeInTheDocument();
    });

    const statementLink = screen.getByText('Statement');
    fireEvent.click(statementLink);

    await waitFor(() => {
      expect(screen.getByText('Customer Receivables & Aging Statement')).toBeInTheDocument();
      expect(screen.getByText('Receivables Aging Analysis')).toBeInTheDocument();
      expect(screen.getByText('31–60 Days Overdue')).toBeInTheDocument();
      expect(screen.getByText('SO-2026-00001')).toBeInTheDocument();
    });
  });

  it('renders Customer Payments Portal with receipt view and statement tabs', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(((endpoint: string) => {
      if (endpoint === '/customer-portal/payments') {
        return Promise.resolve({ data: { items: [mockPayment] } });
      }
      if (endpoint === '/customer-portal/payments/receivables') {
        return Promise.resolve({ data: mockReceivablesStatement });
      }
      return Promise.resolve({ data: mockReceiptDoc });
    }) as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CustomerPaymentsPortalPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Payments & Receipts Portal')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('REC-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    });

    // Switch to Receivables Tab
    const receivablesTab = screen.getByText('Receivables Statement');
    fireEvent.click(receivablesTab);

    await waitFor(() => {
      expect(screen.getByText('Contracted Solar Orders')).toBeInTheDocument();
      expect(screen.getByText('SO-2026-00001')).toBeInTheDocument();
    });
  });
});
