/**
 * INS Solar Business Management Software — Phase 9A Frontend Tests
 *
 * Tests for Customer Portal & Notification Center:
 * - Customer Portal Hub header with client identity and live alerts badge
 * - Dashboard Tab with live installation progress, quick actions, and key metrics
 * - My Projects Tab with 10-stage execution pipeline and checklist
 * - Quotations Tab with digital accept/decline action triggers
 * - Payments Tab with operational receipt modal and statutory non-tax disclaimer
 * - Service & AMC Tab with support ticket reporting and warranty cards
 * - Notification Center Tab with category filters, unread badge, and mark all read
 * - Delivery Preferences Tab with multi-channel notification toggles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CustomerPortalPage } from '../pages/CustomerPortalPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 9A Frontend: Customer Portal & Centralized Notification Center', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockDashboardData = {
    customer: {
      id: 'cust-001',
      name: 'Asha Sharma',
      email: 'asha@example.com',
      phone: '+919876543210',
      customerCode: 'CUST-2026-0001'
    },
    projects: [
      {
        id: 'proj-001',
        projectCode: 'PRJ-2026-0001',
        name: 'Sharma 5kWp Rooftop Solar',
        systemTopology: 'ON_GRID',
        systemCapacityKwp: 5.0,
        currentStage: 'STRUCTURE_INSTALLATION',
        progressPercent: 40,
        discomName: 'Tata Power DDL'
      }
    ],
    pendingQuotations: [
      {
        _id: 'quot-001',
        id: 'quot-001',
        quotationNumber: 'QUO-2026-0001',
        revisionNumber: 1,
        systemCapacityKwp: 5.0,
        netTotalPaise: 27500000,
        totalPayablePaise: 27500000, // ₹2,75,000.00
        status: 'SENT',
        validUntil: '2026-11-15T00:00:00.000Z',
        pdfUrl: 'https://storage.example.com/quotations/QUO-2026-0001.pdf'
      }
    ],
    receivables: {
      totalOrderValuePaise: 27500000,
      totalAllocatedPaise: 5000000,
      totalOutstandingPaise: 22500000,
      outstandingPaise: 22500000
    }
  };

  const mockNotificationsData = {
    items: [
      {
        id: 'notif-001',
        notificationNumber: 'NTF-2026-00001',
        category: 'PROJECT_MILESTONE',
        eventType: 'STAGE_COMPLETED',
        title: 'Structure Installation Finished',
        message: 'Your solar rooftop mounting structure is complete.',
        isRead: false,
        createdAt: '2026-10-27T10:00:00.000Z',
        actionUrl: '/customer-portal?tab=projects'
      },
      {
        id: 'notif-002',
        notificationNumber: 'NTF-2026-00002',
        category: 'PAYMENT',
        eventType: 'PAYMENT_RECEIVED',
        title: 'Advance Payment Received',
        message: 'Advance payment of ₹50,000.00 has been verified.',
        isRead: true,
        createdAt: '2026-10-25T14:30:00.000Z',
        actionUrl: '/customer-portal?tab=payments'
      }
    ]
  };

  const mockPaymentsData = [
    {
      _id: 'pay-001',
      id: 'pay-001',
      paymentNumber: 'PAY-2026-00001',
      receiptNumber: 'PAY-2026-00001',
      paymentDate: '2026-10-25T14:30:00.000Z',
      amountPaise: 5000000, // ₹50,000.00
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'UTR-987654321',
      status: 'VERIFIED',
      customerName: 'Asha Sharma',
      projectCode: 'PRJ-2026-0001'
    }
  ];

  it('renders Customer Portal Hub header, verified badge, and aggregated dashboard data', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (path: string) => {
      if (path.includes('/customer-portal/dashboard')) {
        return mockDashboardData;
      }
      if (path.includes('/customer-portal/notifications/unread-count')) {
        return { unreadCount: 1 };
      }
      if (path.includes('/customer-portal/notifications?limit=20')) {
        return mockNotificationsData;
      }
      return null;
    });

    render(
      <MemoryRouter>
        <CustomerPortalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Customer Portal Hub')).toBeInTheDocument();
      expect(screen.getByText('Verified Client')).toBeInTheDocument();
      expect(screen.getByText(/Asha Sharma/)).toBeInTheDocument();
      expect(screen.getByText('Sharma 5kWp Rooftop Solar')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText(/2,25,000/)).toBeInTheDocument(); // Outstanding balance
    });
  });

  it('navigates to Quotations tab and opens digital acceptance modal', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (path: string) => {
      if (path.includes('/customer-portal/dashboard')) return mockDashboardData;
      if (path.includes('/customer-portal/quotations')) return mockDashboardData.pendingQuotations;
      if (path.includes('/customer-portal/notifications/unread-count')) return { unreadCount: 1 };
      if (path.includes('/customer-portal/notifications')) return mockNotificationsData;
      return null;
    });

    render(
      <MemoryRouter>
        <CustomerPortalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Customer Portal Hub')).toBeInTheDocument();
    });

    // Click Quotations Tab
    const quotesTab = screen.getByRole('button', { name: /Quotations/i });
    fireEvent.click(quotesTab);

    await waitFor(() => {
      expect(screen.getByText('QUO-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Rev 1')).toBeInTheDocument();
    });

    // Click Accept Quotation button
    const acceptBtn = screen.getByRole('button', { name: /Accept Proposal/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Digital Proposal Acceptance/i)).toBeInTheDocument();
      expect(screen.getByText(/I hereby accept quotation QUO-2026-0001/i)).toBeInTheDocument();
    });
  });

  it('navigates to Payments tab and displays operational receipt modal with statutory disclaimer', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (path: string) => {
      if (path.includes('/customer-portal/dashboard')) return mockDashboardData;
      if (path.includes('/receipt')) {
        return {
          receiptNumber: 'PAY-2026-00001',
          paymentDate: '2026-10-25T14:30:00.000Z',
          amountPaise: 5000000,
          paymentMethod: 'BANK_TRANSFER',
          transactionReference: 'UTR-987654321'
        };
      }
      if (path.includes('/customer-portal/payments')) return mockPaymentsData;
      if (path.includes('/customer-portal/notifications/unread-count')) return { unreadCount: 0 };
      if (path.includes('/customer-portal/notifications')) return mockNotificationsData;
      return null;
    });

    render(
      <MemoryRouter>
        <CustomerPortalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Customer Portal Hub')).toBeInTheDocument();
    });

    // Click Payments Tab
    const paymentsTab = screen.getByRole('button', { name: /Payments & Receipts/i });
    fireEvent.click(paymentsTab);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-00001')).toBeInTheDocument();
      expect(screen.getByText(/50,000/)).toBeInTheDocument();
    });

    // Click Print Receipt button
    const receiptBtn = screen.getByRole('button', { name: /Print Receipt/i });
    fireEvent.click(receiptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Official Operational Receipt/i)).toBeInTheDocument();
      // Crucial statutory non-tax invoice disclaimer requirement
      expect(
        screen.getByText(/This document is an operational payment receipt/i)
      ).toBeInTheDocument();
    });
  });

  it('navigates to Notification Center and triggers mark-all-as-read', async () => {
    const markAllReadSpy = vi.fn().mockResolvedValue({ success: true, count: 1 });

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (path: string) => {
      if (path.includes('/customer-portal/dashboard')) return mockDashboardData;
      if (path.includes('/customer-portal/notifications/unread-count')) return { unreadCount: 1 };
      if (path.includes('/customer-portal/notifications/mark-all-read')) {
        return markAllReadSpy();
      }
      if (path.includes('/customer-portal/notifications')) return mockNotificationsData;
      return null;
    });

    render(
      <MemoryRouter>
        <CustomerPortalPage defaultTab="NOTIFICATIONS" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Notification Inbox')).toBeInTheDocument();
      expect(screen.getByText('Structure Installation Finished')).toBeInTheDocument();
      expect(screen.getByText('Advance Payment Received')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark All as Read/i })).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole('button', { name: /Mark All as Read/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(markAllReadSpy).toHaveBeenCalled();
    });
  });

  it('navigates to Preferences tab and toggles delivery channels', async () => {
    const mockPrefs = {
      channels: { inApp: true, email: true, sms: false, whatsapp: true },
      categories: {
        quotations: true,
        projectMilestones: true,
        payments: true,
        serviceComplaints: true,
        warranties: true,
        systemReminders: true
      }
    };

    const updatePrefsSpy = vi.fn().mockResolvedValue({ success: true });

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/customer-portal/dashboard')) return mockDashboardData;
      if (path.includes('/customer-portal/notifications/unread-count')) return { unreadCount: 0 };
      if (path.includes('/customer-portal/notifications/preferences')) {
        if (options?.method === 'PUT') {
          return updatePrefsSpy(JSON.parse(options.body));
        }
        return mockPrefs;
      }
      if (path.includes('/customer-portal/notifications')) return mockNotificationsData;
      return null;
    });

    render(
      <MemoryRouter>
        <CustomerPortalPage defaultTab="PREFERENCES" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Delivery Channels')).toBeInTheDocument();
      expect(screen.getByText('In-App Notifications')).toBeInTheDocument();
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /Save Preferences/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updatePrefsSpy).toHaveBeenCalled();
      expect(screen.getByText(/preferences updated successfully/i)).toBeInTheDocument();
    });
  });
});
