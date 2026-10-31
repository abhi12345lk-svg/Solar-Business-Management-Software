import { ensureCustomerPortalSession } from '../middleware/customerPortalGuard.js';
/**
 * INS Solar Business Management Software — Customer Portal Dashboard Routes
 *
 * Provides aggregated operational summary for the authenticated customer:
 * - Active solar installations, execution stages, and milestone progression
 * - Quotations awaiting review or digital acceptance
 * - Verified payment receipts, unallocated credit, and outstanding balance
 * - Open service complaints and scheduled technician visits
 * - In-app notification summary and unread badge count
 *
 * Strict tenant isolation enforced; zero cross-customer data leakage.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Project, Quotation, ServiceComplaint, ServiceVisit } from '../models/index.js';
import { PaymentService } from '../services/paymentService.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import { NotificationRecipientType } from '@ins-solar/shared';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';

export const customerDashboardRouter = Router();

// Boundary guard: customer portal session required
customerDashboardRouter.use(requireAuth);
customerDashboardRouter.use(ensureCustomerPortalSession);

/**
 * GET /api/v1/customer-portal/dashboard
 * Aggregated customer portal overview.
 */
customerDashboardRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;

    const [
      projects,
      pendingQuotations,
      openComplaintsCount,
      upcomingVisits,
      receivables,
      notificationsData
    ] = await Promise.all([
      // 1. Customer's projects
      Project.find({ customerId })
        .select(
          'projectCode name status currentStage systemCapacityKwp systemTopology plannedStartDate targetCompletionDate milestones'
        )
        .sort({ createdAt: -1 })
        .lean(),

      // 2. Quotations pending customer action
      Quotation.find({
        customerId,
        status: { $in: ['SENT', 'APPROVED'] }
      })
        .select(
          'quotationNumber revisionNumber fullQuotationCode systemTopology systemCapacityKwp netTotalPaise validUntil status'
        )
        .sort({ createdAt: -1 })
        .lean(),

      // 3. Open complaints count
      ServiceComplaint.countDocuments({
        customerId,
        status: { $in: ['OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS'] }
      }).catch(() => 0),

      // 4. Scheduled upcoming service visits
      ServiceVisit.find({
        customerId,
        status: { $in: ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'] }
      })
        .select('visitNumber visitType scheduledDate scheduledTimeSlot purpose status')
        .sort({ scheduledDate: 1 })
        .limit(3)
        .lean()
        .catch(() => []),

      // 5. Customer receivables & payment metrics
      PaymentService.getCustomerReceivables(customerId, {
        isCustomer: true,
        customerId
      }).catch(() => null),

      // 6. Latest notifications & unread count
      NotificationCenterService.getNotifications(customerId, NotificationRecipientType.CUSTOMER, {
        page: 1,
        limit: 5
      }).catch(() => ({ items: [], total: 0, unreadCount: 0 }))
    ]);

    // Format customer-friendly project summaries
    const projectSummaries = projects.map(p => {
      const totalMilestones = p.milestones?.length || 0;
      const completedMilestones =
        p.milestones?.filter((m: any) => m.status === 'COMPLETED').length || 0;
      const progressPercent =
        totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

      return {
        id: p._id.toString(),
        projectCode: p.projectCode,
        name: p.name,
        status: p.status,
        currentStage: p.currentStage,
        systemCapacityKwp: p.systemCapacityKwp,
        systemTopology: p.systemTopology,
        targetCompletionDate: p.targetCompletionDate,
        totalMilestones,
        completedMilestones,
        progressPercent
      };
    });

    return sendSuccess(req, res, {
      projects: projectSummaries,
      pendingQuotations,
      openComplaintsCount,
      upcomingVisits,
      receivables,
      unreadNotificationCount: notificationsData.unreadCount,
      recentNotifications: notificationsData.items
    });
  } catch (err) {
    return next(err);
  }
});
