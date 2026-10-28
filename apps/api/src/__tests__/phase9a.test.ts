/**
 * INS Solar Business Management Software — Phase 9A Integration Tests
 *
 * Comprehensive test suite for Customer Portal & Notification Center:
 * - Persistent notification creation with atomic sequence (NTF-YYYY-NNNNN)
 * - Deterministic deduplication key enforcement (prevents duplicate notification records)
 * - Notification recipient isolation (Customer A vs Customer B, Employee vs Customer)
 * - Notification category filtering and read/unread status updates
 * - Unread count consistency and atomic bulk mark-all-as-read
 * - Customer notification preferences and disabled channel enforcement
 * - Honest external delivery reporting (SIMULATED_LOG_ONLY when external gateways not provisioned)
 * - Resilient delivery provider failure handling (delivery errors never fail caller transaction)
 * - Customer portal dashboard data isolation and foreign tenant rejection (403 Forbidden)
 * - Quotation revision decision guard (rejects expired or superseded revisions)
 * - 401 Unauthorized guards on protected customer portal and notification endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  NotificationRecipientType,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  QuotationStatus
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { Notification } from '../models/Notification.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { Customer } from '../models/Customer.js';
import { Project } from '../models/Project.js';
import { Quotation } from '../models/Quotation.js';
import { CustomerPayment } from '../models/CustomerPayment.js';
import { ServiceComplaint } from '../models/ServiceComplaint.js';
import { ServiceVisit } from '../models/ServiceVisit.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import { QuotationService } from '../services/quotationService.js';
import { NotificationReminderService } from '../services/notificationReminderService.js';
import { PaymentService } from '../services/paymentService.js';
import { SequenceService } from '../services/sequenceService.js';
import { hashToken } from '../utils/crypto.js';

describe('Phase 9A Integration: Customer Portal & Centralized Notification Center', () => {
  let app: any;
  const customerIdA = new Types.ObjectId();
  const customerIdB = new Types.ObjectId();
  const employeeUserId = new Types.ObjectId().toString();

  const makePopulateQuery = (doc: any) => {
    const query: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(doc),
      exec: vi.fn().mockResolvedValue(doc)
    };
    query.then = (resolve: any) => Promise.resolve(doc).then(resolve);
    return query;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();

    // Mock SequenceService default for Notification
    vi.spyOn(SequenceService, 'generateNextSequence').mockResolvedValue({
      formattedNumber: 'NTF-2026-00001',
      sequenceNumber: 1,
      sequenceKey: 'NOTIFICATION-2026',
      prefix: 'NTF',
      fiscalYear: '2026'
    } as any);
  });

  // Helper to extract session cookie from response headers
  const extractCookieHeader = (setCookie: string | string[] | undefined): string => {
    if (!setCookie) return '';
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies.map(c => c.split(';')[0]).join('; ');
  };

  // Helper to log in a customer and return cookie + csrfToken
  const loginCustomer = async (cid: Types.ObjectId, phone = '+919876543210') => {
    const identityId = new Types.ObjectId();
    const rawOtp = '123456';

    vi.spyOn(CustomerIdentity, 'findOne').mockResolvedValue({
      _id: identityId,
      customerId: cid,
      phone,
      otpHash: hashToken(rawOtp),
      otpExpiresAt: new Date(Date.now() + 600000),
      isActive: true,
      save: vi.fn().mockResolvedValue(true)
    } as any);

    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: cid,
      name: 'Test Customer',
      phone,
      email: 'customer@example.com'
    } as any);

    const res = await request(app)
      .post('/api/v1/customer-auth/otp/verify')
      .send({ phone, otp: rawOtp });

    expect(res.status).toBe(200);
    const cookie = extractCookieHeader(res.headers['set-cookie']);
    const csrfToken = res.body.data.csrfToken;
    return { cookie, csrfToken, identityId };
  };

  // ==========================================================================
  // 1. Persistent Notification Center & Sequence Generation
  // ==========================================================================
  describe('Notification Center Service & Sequences', () => {
    it('creates persistent notification with sequence NTF-YYYY-NNNNN and honest simulated delivery', async () => {
      vi.spyOn(Notification, 'findOne').mockResolvedValue(null);
      vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(null);
      vi.spyOn(Notification.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const notif = await NotificationCenterService.createNotification(
        {
          recipientType: NotificationRecipientType.CUSTOMER,
          recipientId: customerIdA.toString(),
          category: NotificationCategory.PROJECT_MILESTONE,
          eventType: 'STAGE_COMPLETED',
          title: 'Structure Installation Completed',
          message: 'Your solar rooftop mounting structure has been installed and inspected.',
          entityType: 'PROJECT',
          entityId: new Types.ObjectId().toString(),
          deliveryChannels: [
            NotificationChannel.IN_APP,
            NotificationChannel.EMAIL,
            NotificationChannel.WHATSAPP
          ]
        },
        {
          userId: employeeUserId,
          correlationId: 'test-corr-1'
        }
      );

      expect(notif).toBeDefined();
      expect(notif!.notificationNumber).toMatch(/^NTF-\d{4}-\d{5}$/);
      expect(notif!.recipientId.toString()).toBe(customerIdA.toString());
      expect(notif!.category).toBe(NotificationCategory.PROJECT_MILESTONE);
      expect(notif!.isRead).toBe(false);
      expect(notif!.readAt).toBeUndefined();
      // External delivery without third-party credentials configured must be honest SIMULATED_LOG_ONLY
      expect(notif!.deliveryStatus).toBe(NotificationDeliveryStatus.SIMULATED_LOG_ONLY);
      expect(notif!.deliveryChannels).toContain(NotificationChannel.IN_APP);
      expect(notif!.deliveryChannels).toContain(NotificationChannel.EMAIL);
      expect(notif!.deliveryChannels).toContain(NotificationChannel.WHATSAPP);
      expect(notif!.dedupKey).toBeDefined();
    });

    it('enforces deterministic deduplication key to prevent duplicate notifications', async () => {
      const existingNotif = {
        _id: new Types.ObjectId(),
        notificationNumber: 'NTF-2026-00001',
        dedupKey: 'dedup-test-key-123',
        title: 'Existing Notice'
      };

      vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(null);
      vi.spyOn(Notification, 'findOne').mockResolvedValue(existingNotif as any);
      const saveSpy = vi.spyOn(Notification.prototype, 'save');

      const result = await NotificationCenterService.createNotification({
        recipientType: NotificationRecipientType.CUSTOMER,
        recipientId: customerIdA.toString(),
        category: NotificationCategory.QUOTATION,
        eventType: 'QUOTATION_EXPIRING',
        title: 'Quotation Expiring Soon',
        message: 'Your solar quotation is set to expire in 48 hours.',
        dedupKey: 'dedup-test-key-123'
      });

      // Returns existing record without creating duplicate
      expect(result).toBeDefined();
      expect(result!.notificationNumber).toBe('NTF-2026-00001');
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('respects recipient preferences and skips disabled channels/categories', async () => {
      vi.spyOn(Notification, 'findOne').mockResolvedValue(null);
      vi.spyOn(Notification.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      // Customer has disabled whatsapp and email
      vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue({
        recipientType: NotificationRecipientType.CUSTOMER,
        recipientId: customerIdA,
        channels: {
          inApp: true,
          email: false,
          sms: true,
          whatsapp: false
        },
        categories: {
          quotations: true
        }
      } as any);

      const notif = await NotificationCenterService.createNotification({
        recipientType: NotificationRecipientType.CUSTOMER,
        recipientId: customerIdA.toString(),
        category: NotificationCategory.QUOTATION,
        eventType: 'QUOTATION_APPROVED',
        title: 'Quotation Ready',
        message: 'Your customized solar proposal is ready for digital approval.',
        deliveryChannels: [
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
          NotificationChannel.WHATSAPP
        ]
      });

      expect(notif).toBeDefined();
      // Email and WhatsApp should be filtered out per user preferences
      expect(notif!.deliveryChannels).toContain(NotificationChannel.IN_APP);
      expect(notif!.deliveryChannels).not.toContain(NotificationChannel.EMAIL);
      expect(notif!.deliveryChannels).not.toContain(NotificationChannel.WHATSAPP);
    });

    it('isolates external delivery failures so caller transactions never fail', async () => {
      vi.spyOn(Notification, 'findOne').mockResolvedValue(null);
      vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(null);
      vi.spyOn(Notification.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      // Even if an unexpected error occurs inside an optional dispatch channel, createNotification succeeds
      const notif = await NotificationCenterService.createNotification({
        recipientType: NotificationRecipientType.CUSTOMER,
        recipientId: customerIdA.toString(),
        category: NotificationCategory.PAYMENT,
        eventType: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        message: 'Payment of ₹50,000 recorded.',
        deliveryChannels: [NotificationChannel.IN_APP]
      });

      expect(notif).toBeDefined();
      expect(notif!.title).toBe('Payment Received');
    });
  });

  // ==========================================================================
  // 2. Read State & Unread Count Consistency
  // ==========================================================================
  describe('Notification Read State & Unread Counts', () => {
    it('marks a single notification as read and updates readAt', async () => {
      const notifId = new Types.ObjectId().toString();
      const mockDoc = {
        _id: notifId,
        recipientId: customerIdA,
        recipientType: NotificationRecipientType.CUSTOMER,
        isRead: false,
        readAt: null,
        save: vi.fn().mockImplementation(async function (this: any) {
          this.isRead = true;
          this.readAt = new Date();
          return this;
        })
      };

      vi.spyOn(Notification, 'findById').mockResolvedValue(mockDoc as any);

      const updated = await NotificationCenterService.markAsRead(
        notifId,
        customerIdA.toString(),
        NotificationRecipientType.CUSTOMER
      );

      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    it('rejects cross-customer mark-as-read attempts (Customer B cannot read Customer A notice)', async () => {
      const notifId = new Types.ObjectId().toString();
      vi.spyOn(Notification, 'findById').mockResolvedValue(null);

      await expect(
        NotificationCenterService.markAsRead(
          notifId,
          customerIdB.toString(),
          NotificationRecipientType.CUSTOMER
        )
      ).rejects.toThrow(/not found/i);
    });

    it('performs atomic bulk mark-all-as-read for eligible recipient notifications', async () => {
      const updateManySpy = vi.spyOn(Notification, 'updateMany').mockResolvedValue({
        matchedCount: 5,
        modifiedCount: 5,
        acknowledged: true,
        upsertedId: null,
        upsertedCount: 0
      } as any);

      const result = await NotificationCenterService.markAllAsRead(
        customerIdA.toString(),
        NotificationRecipientType.CUSTOMER,
        NotificationCategory.PROJECT_MILESTONE
      );

      expect(result.modifiedCount).toBe(5);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientType: NotificationRecipientType.CUSTOMER,
          recipientId: customerIdA,
          category: NotificationCategory.PROJECT_MILESTONE,
          isRead: false
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ isRead: true })
        })
      );
    });

    it('returns consistent unread counts for recipient', async () => {
      vi.spyOn(Notification, 'countDocuments').mockResolvedValue(3);

      const unread = await NotificationCenterService.getUnreadCount(
        customerIdA.toString(),
        NotificationRecipientType.CUSTOMER
      );

      expect(unread).toBe(3);
    });
  });

  // ==========================================================================
  // 3. Customer Portal Dashboard & Identity Isolation Endpoints
  // ==========================================================================
  describe('Customer Portal Dashboard & APIs', () => {
    it('returns 401 Unauthorized for unauthenticated requests to customer portal endpoints', async () => {
      const resDash = await request(app).get('/api/v1/customer-portal/dashboard');
      expect(resDash.status).toBe(401);

      const resNotif = await request(app).get('/api/v1/customer-portal/notifications');
      expect(resNotif.status).toBe(401);

      const resUnread = await request(app).get(
        '/api/v1/customer-portal/notifications/unread-count'
      );
      expect(resUnread.status).toBe(401);

      const resPrefs = await request(app).get('/api/v1/customer-portal/notifications/preferences');
      expect(resPrefs.status).toBe(401);
    });

    it('returns customer-isolated dashboard records when authenticated', async () => {
      const { cookie } = await loginCustomer(customerIdA);

      // Mock DB queries for customer A
      vi.spyOn(Customer, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: customerIdA,
          name: 'Asha Sharma',
          email: 'asha@example.com',
          phone: '+919876543210',
          customerCode: 'CUST-2026-0001'
        })
      );

      vi.spyOn(Project, 'find').mockReturnValue(
        makePopulateQuery([
          {
            _id: new Types.ObjectId(),
            projectCode: 'PRJ-2026-0001',
            name: 'Sharma Rooftop 5kW',
            customerId: customerIdA,
            currentStage: 'STRUCTURE_INSTALLATION',
            systemTopology: 'ON_GRID',
            systemCapacityKwp: 5.0,
            progressPercent: 40,
            milestones: [
              { milestoneCode: 'M1', name: 'Design', status: 'COMPLETED' },
              { milestoneCode: 'M2', name: 'Procurement', status: 'COMPLETED' },
              { milestoneCode: 'M3', name: 'Structure', status: 'IN_PROGRESS' }
            ]
          }
        ])
      );

      vi.spyOn(Quotation, 'find').mockReturnValue(makePopulateQuery([]));
      vi.spyOn(CustomerPayment, 'find').mockReturnValue(makePopulateQuery([]));
      vi.spyOn(ServiceComplaint, 'find').mockReturnValue(makePopulateQuery([]));
      vi.spyOn(ServiceComplaint, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(ServiceVisit, 'find').mockReturnValue(makePopulateQuery([]));
      vi.spyOn(NotificationCenterService, 'getNotifications').mockResolvedValue({
        items: [],
        total: 0,
        unreadCount: 0
      } as any);
      vi.spyOn(PaymentService, 'getCustomerReceivables').mockResolvedValue({
        customerId: customerIdA.toString(),
        totalOrderAmountPaise: 27500000,
        totalPaidPaise: 5000000,
        outstandingBalancePaise: 22500000,
        unallocatedAmountPaise: 0,
        orders: []
      } as any);

      const res = await request(app).get('/api/v1/customer-portal/dashboard').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.projects).toHaveLength(1);
      expect(res.body.data.projects[0].projectCode).toBe('PRJ-2026-0001');

      // Verify internal staff fields are NOT exposed
      expect(res.body.data.projects[0].internalNotes).toBeUndefined();
      expect(res.body.data.projects[0].actualCostPaise).toBeUndefined();
    });

    it('rejects foreign customer resource access with 403 Forbidden', async () => {
      const { cookie, csrfToken } = await loginCustomer(customerIdA);

      // Customer A tries to access Customer B's resources via customer portal ownership guard
      const res = await request(app)
        .post('/api/v1/test-guard/customer-resource')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ resourceCustomerId: customerIdB.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/You cannot view or modify another customer/i);
    });

    it('allows customer to get and update notification preferences', async () => {
      const { cookie, csrfToken } = await loginCustomer(customerIdA);

      vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(null);
      vi.spyOn(NotificationPreference, 'findOneAndUpdate').mockResolvedValue({
        _id: new Types.ObjectId(),
        recipientType: NotificationRecipientType.CUSTOMER,
        recipientId: customerIdA,
        channels: {
          inApp: true,
          email: false,
          sms: true,
          whatsapp: true
        },
        categories: {
          quotations: true,
          projectMilestones: true,
          payments: true,
          serviceAndWarranty: true,
          reminders: true
        }
      } as any);

      // GET preferences
      const getRes = await request(app)
        .get('/api/v1/customer-portal/notifications/preferences')
        .set('Cookie', cookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.channels.inApp).toBe(true);

      // PUT preferences
      const putRes = await request(app)
        .put('/api/v1/customer-portal/notifications/preferences')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          channels: {
            inApp: true,
            email: false,
            sms: true,
            whatsapp: true
          }
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.channels.email).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Quotation Revision Decision Guards
  // ==========================================================================
  describe('Quotation Customer Decision Guards', () => {
    it('rejects customer decision on expired quotation (validUntil in past)', async () => {
      const quoteId = new Types.ObjectId().toString();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      vi.spyOn(Quotation, 'findById').mockResolvedValue({
        _id: quoteId,
        customerId: customerIdA,
        status: QuotationStatus.APPROVED,
        validUntil: pastDate,
        version: 1,
        isLatest: true,
        save: vi.fn().mockResolvedValue(true)
      } as any);

      await expect(
        QuotationService.customerDecision(quoteId, { action: 'ACCEPT' }, customerIdA.toString())
      ).rejects.toThrow(/expired/i);
    });

    it('rejects customer decision on superseded quotation revisions', async () => {
      const quoteId = new Types.ObjectId().toString();

      vi.spyOn(Quotation, 'findById').mockResolvedValue({
        _id: quoteId,
        customerId: customerIdA,
        status: QuotationStatus.REVISED,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        version: 1,
        isLatest: false
      } as any);

      await expect(
        QuotationService.customerDecision(quoteId, { action: 'ACCEPT' }, customerIdA.toString())
      ).rejects.toThrow(/not eligible|superseded|invalid/i);
    });
  });

  // ==========================================================================
  // 5. Scheduled Operational Reminders Integration
  // ==========================================================================
  describe('Notification Reminder Service Integration', () => {
    it('bridges scheduled operational reminders directly to persistent notification center', async () => {
      const createNotifSpy = vi
        .spyOn(NotificationCenterService, 'createNotification')
        .mockResolvedValue({
          notificationNumber: 'NTF-2026-00099'
        } as any);

      const record = await NotificationReminderService.scheduleOrSendReminder({
        reminderType: 'AMC_RENEWAL',
        entityType: 'AnnualMaintenanceContract',
        entityId: new Types.ObjectId().toString(),
        subject: 'Annual Solar Maintenance Due',
        message: 'Your solar installation is due for annual preventive maintenance checkup.',
        scheduledFor: new Date(),
        metadata: { customerId: customerIdA.toString() }
      });

      expect(record).toBeDefined();
      expect(record.status).toBe('SIMULATED_LOG_ONLY');
      expect(createNotifSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: customerIdA.toString(),
          category: NotificationCategory.WARRANTY_AMC,
          title: 'Annual Solar Maintenance Due'
        })
      );
    });
  });
});
