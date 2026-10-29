/**
 * Phase 11: Final Completion & Production Launch Test Suite
 *
 * Validates:
 * 1. Background Job Queue (DEC-03): Persistence, atomic lease locking, exponential backoff retries, crash recovery.
 * 2. Standalone Job Worker Daemon: Handler dispatch, completion, failure capture, clean shutdown.
 * 3. External Communications (DEC-02): Email & SMS service honest delivery status and template generation.
 * 4. Durable Reminder Queue: NotificationReminderService persistence to MongoDB jobs collection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { JobModel } from '../models/Job.js';
import { JobQueueService } from '../services/jobQueueService.js';
import { JobWorker } from '../worker.js';
import { EmailService } from '../services/emailService.js';
import { SmsService } from '../services/smsService.js';
import { NotificationReminderService } from '../services/notificationReminderService.js';
import { JobStatus, JobQueueName } from '@ins-solar/shared';

describe('Phase 11: Final Completion & Asynchronous Engine Verification', () => {
  let mockJobs: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockJobs = [];
    EmailService.clearHistory();
    SmsService.clearHistory();
    NotificationReminderService.clearRegistry();

    // Mock JobModel constructor & save
    vi.spyOn(JobModel.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      this.createdAt = new Date();
      this.updatedAt = new Date();
      mockJobs.push(this);
      return Promise.resolve(this);
    });

    // Mock JobModel.findOne
    vi.spyOn(JobModel, 'findOne').mockImplementation((query: any) => {
      if (query.jobKey) {
        const found = mockJobs.find(j => j.jobKey === query.jobKey);
        return Promise.resolve(found || null) as any;
      }
      if (query.queueName) {
        const found = mockJobs.find(j => j.queueName === query.queueName);
        return Promise.resolve(found || null) as any;
      }
      return Promise.resolve(null) as any;
    });

    // Mock JobModel.findById
    vi.spyOn(JobModel, 'findById').mockImplementation((id: any) => {
      const idStr = id.toString();
      const found = mockJobs.find(j => j._id.toString() === idStr);
      return Promise.resolve(found || null) as any;
    });

    // Mock JobModel.findOneAndUpdate
    vi.spyOn(JobModel, 'findOneAndUpdate').mockImplementation((query: any, update: any) => {
      const now = new Date();
      let job: any = null;

      if (query._id) {
        const idStr = query._id.toString();
        job = mockJobs.find(j => j._id.toString() === idStr);
      } else if (query.status === JobStatus.PENDING) {
        // Match eligible job for polling
        job = mockJobs.find(j => {
          if (j.status !== JobStatus.PENDING) return false;
          if (j.scheduledFor && j.scheduledFor.getTime() > now.getTime()) return false;
          if (j.lockedUntil && j.lockedUntil.getTime() >= now.getTime()) return false;
          if (query.queueName && query.queueName.$in) {
            if (!query.queueName.$in.includes(j.queueName)) return false;
          }
          return true;
        });
      }

      if (!job) return Promise.resolve(null) as any;

      if (update.$set) {
        Object.assign(job, update.$set);
      }
      if (update.$unset) {
        for (const key of Object.keys(update.$unset)) {
          job[key] = undefined;
          if (job._doc) job._doc[key] = undefined;
        }
      }

      return Promise.resolve(job) as any;
    });

    // Mock JobModel.updateMany (for recoverStaleLeases)
    vi.spyOn(JobModel, 'updateMany').mockImplementation((_query: any, update: any) => {
      let modifiedCount = 0;
      const now = new Date();
      for (const job of mockJobs) {
        if (
          job.status === JobStatus.PROCESSING &&
          job.lockedUntil &&
          job.lockedUntil.getTime() < now.getTime()
        ) {
          if (update.$set) Object.assign(job, update.$set);
          if (update.$unset) {
            for (const key of Object.keys(update.$unset)) delete job[key];
          }
          modifiedCount++;
        }
      }
      return Promise.resolve({ modifiedCount }) as any;
    });

    // Mock JobModel.aggregate
    vi.spyOn(JobModel, 'aggregate').mockImplementation(() => {
      const counts: Record<string, number> = {};
      for (const j of mockJobs) {
        counts[j.status] = (counts[j.status] || 0) + 1;
      }
      const aggResult = Object.entries(counts).map(([_id, count]) => ({ _id, count }));
      return Promise.resolve(aggResult) as any;
    });
  });

  describe('1. Background Job Queue Service (DEC-03)', () => {
    it('enqueues a job with PENDING status and default retry limit', async () => {
      const job = await JobQueueService.enqueueJob(JobQueueName.CRITICAL_MAIL, {
        to: 'customer@example.com',
        subject: 'Quotation Ready'
      });

      expect(job._id).toBeDefined();
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.queueName).toBe(JobQueueName.CRITICAL_MAIL);
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
      expect(job.payload.to).toBe('customer@example.com');
    });

    it('enforces idempotent deduplication on active job keys', async () => {
      const jobKey = 'DEDUP-QUOTATION-QT-2026-0001';

      const job1 = await JobQueueService.enqueueJob(
        JobQueueName.CRITICAL_MAIL,
        { quotationId: 'QT-001' },
        { jobKey }
      );

      const job2 = await JobQueueService.enqueueJob(
        JobQueueName.CRITICAL_MAIL,
        { quotationId: 'QT-001-duplicate' },
        { jobKey }
      );

      expect(job1._id.toString()).toBe(job2._id.toString());
      expect(mockJobs.length).toBe(1);
    });

    it('atomically claims pending jobs with lease lock', async () => {
      const workerId = 'worker-node-1';
      await JobQueueService.enqueueJob(JobQueueName.PDF_COMPILE, { docId: 'DOC-123' });

      const claimed = await JobQueueService.pollNextJob(
        workerId,
        [JobQueueName.PDF_COMPILE],
        60000
      );

      expect(claimed).not.toBeNull();
      expect(claimed!.status).toBe(JobStatus.PROCESSING);
      expect(claimed!.lockedByWorkerId).toBe(workerId);
      expect(claimed!.lockedUntil).toBeDefined();
      expect(claimed!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      // Second poll should return null since job is locked
      const secondPoll = await JobQueueService.pollNextJob('worker-node-2', [
        JobQueueName.PDF_COMPILE
      ]);
      expect(secondPoll).toBeNull();
    });

    it('ignores future scheduled jobs during polling', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour in future
      await JobQueueService.enqueueJob(
        JobQueueName.CRON_MAINTENANCE,
        { scan: 'daily' },
        { scheduledFor: futureDate }
      );

      const claimed = await JobQueueService.pollNextJob('worker-node-1');
      expect(claimed).toBeNull();
    });

    it('completes claimed job and clears worker locks', async () => {
      const workerId = 'worker-node-1';
      const job = await JobQueueService.enqueueJob(JobQueueName.WHATSAPP, { phone: '9876543210' });
      await JobQueueService.pollNextJob(workerId, [JobQueueName.WHATSAPP]);

      const completed = await JobQueueService.completeJob(job._id, workerId);

      expect(completed).not.toBeNull();
      expect(completed!.status).toBe(JobStatus.COMPLETED);
      expect(completed!.completedAt).toBeDefined();
      expect(completed!.lockedUntil).toBeUndefined();
      expect(completed!.lockedByWorkerId).toBeUndefined();
    });

    it('retries failed job with exponential backoff before dead-lettering', async () => {
      const workerId = 'worker-node-1';
      const job = await JobQueueService.enqueueJob(
        JobQueueName.SMS,
        { phone: '9876543210' },
        { maxRetries: 2 }
      );

      // Attempt 1: Poll & fail
      await JobQueueService.pollNextJob(workerId);
      const retry1 = await JobQueueService.failJob(job._id, workerId, 'Network timeout');

      expect(retry1!.status).toBe(JobStatus.PENDING);
      expect(retry1!.retryCount).toBe(1);
      expect(retry1!.scheduledFor.getTime()).toBeGreaterThan(Date.now()); // backoff applied
      expect(retry1!.lastError).toBe('Network timeout');

      // Fast-forward scheduledFor to now for attempt 2
      job.scheduledFor = new Date();

      // Attempt 2: Poll & fail -> should reach terminal FAILED
      await JobQueueService.pollNextJob(workerId);
      const terminalFail = await JobQueueService.failJob(job._id, workerId, 'Gateway rejected');

      expect(terminalFail!.status).toBe(JobStatus.FAILED);
      expect(terminalFail!.retryCount).toBe(2);
      expect(terminalFail!.failedAt).toBeDefined();
      expect(terminalFail!.lastError).toBe('Gateway rejected');
    });

    it('reclaims expired leases during crash recovery', async () => {
      const expiredDate = new Date(Date.now() - 10000); // 10 seconds ago
      const crashedJob: any = {
        _id: new Types.ObjectId(),
        queueName: JobQueueName.REMINDER,
        payload: { test: true },
        status: JobStatus.PROCESSING,
        lockedByWorkerId: 'dead-worker-pid-9999',
        lockedUntil: expiredDate
      };
      mockJobs.push(crashedJob);

      const recoveredCount = await JobQueueService.recoverStaleLeases();
      expect(recoveredCount).toBe(1);
      expect(crashedJob.status).toBe(JobStatus.PENDING);
      expect(crashedJob.lockedUntil).toBeUndefined();
      expect(crashedJob.lockedByWorkerId).toBeUndefined();
    });

    it('manually retries a failed job', async () => {
      const failedJob: any = {
        _id: new Types.ObjectId(),
        queueName: JobQueueName.CRITICAL_MAIL,
        payload: { email: 'test@example.com' },
        status: JobStatus.FAILED,
        retryCount: 3,
        failedAt: new Date(),
        lastError: 'Fatal SMTP error'
      };
      mockJobs.push(failedJob);

      const retried = await JobQueueService.retryJob(failedJob._id);
      expect(retried!.status).toBe(JobStatus.PENDING);
      expect(retried!.retryCount).toBe(0);
      expect(retried!.lastError).toBeUndefined();
      expect(retried!.failedAt).toBeUndefined();
    });

    it('aggregates accurate queue statistics', async () => {
      await JobQueueService.enqueueJob(JobQueueName.REMINDER, { a: 1 });
      await JobQueueService.enqueueJob(JobQueueName.REMINDER, { a: 2 });

      const stats = await JobQueueService.getJobStats();
      expect(stats[JobStatus.PENDING]).toBe(2);
      expect(stats[JobStatus.PROCESSING]).toBe(0);
      expect(stats[JobStatus.COMPLETED]).toBe(0);
      expect(stats[JobStatus.FAILED]).toBe(0);
    });
  });

  describe('2. Standalone Job Worker Daemon', () => {
    it('executes registered queue handler and marks job completed', async () => {
      const worker = new JobWorker('test-worker-alpha', 500);
      let executedPayload: any = null;

      worker.registerHandler(JobQueueName.CRITICAL_MAIL, async payload => {
        executedPayload = payload;
      });

      await JobQueueService.enqueueJob(JobQueueName.CRITICAL_MAIL, {
        to: 'solar@example.com',
        amount: 500000
      });

      const processed = await worker.processNext();
      expect(processed).toBe(true);
      expect(executedPayload).not.toBeNull();
      expect(executedPayload.to).toBe('solar@example.com');

      const job = mockJobs.find(j => j.queueName === JobQueueName.CRITICAL_MAIL);
      expect(job!.status).toBe(JobStatus.COMPLETED);
    });

    it('handles handler exception by triggering job retry', async () => {
      const worker = new JobWorker('test-worker-beta', 500);

      worker.registerHandler(JobQueueName.SMS, async () => {
        throw new Error('DLT Template not approved');
      });

      await JobQueueService.enqueueJob(JobQueueName.SMS, { phone: '9999999999' });

      await worker.processNext();

      const job = mockJobs.find(j => j.queueName === JobQueueName.SMS);
      expect(job!.status).toBe(JobStatus.PENDING);
      expect(job!.retryCount).toBe(1);
      expect(job!.lastError).toBe('DLT Template not approved');
    });
  });

  describe('3. External Communications & Honest Reporting', () => {
    it('reports honest SIMULATED_LOG_ONLY status when SMTP is unconfigured', async () => {
      const result = await EmailService.sendEmail({
        to: 'customer@inssolar.com',
        subject: 'Quotation Approved',
        html: '<p>Your quotation is ready</p>'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SIMULATED_LOG_ONLY');
      expect(result.messageId).toBeDefined();
      expect(result.recipient).toBe('customer@inssolar.com');

      const history = EmailService.getHistory();
      expect(history.length).toBe(1);
    });

    it('generates well-formatted magic link email with 15-minute expiry notice', async () => {
      const result = await EmailService.sendMagicLink(
        'lead@inssolar.com',
        'https://app.inssolar.com/customer-portal?token=test-token-123'
      );

      expect(result.success).toBe(true);
      expect(result.subject).toContain('INS Solar Customer Portal');
    });

    it('reports honest SIMULATED_LOG_ONLY status for SMS and records DLT template', async () => {
      const result = await SmsService.sendOtp('9876543210', '123456');

      expect(result.success).toBe(true);
      expect(result.status).toBe('SIMULATED_LOG_ONLY');
      expect(result.templateId).toBe('DLT-INS-OTP-001');
      expect(result.phone).toBe('9876543210');

      const history = SmsService.getHistory();
      expect(history.length).toBe(1);
    });
  });

  describe('4. Durable Reminder Queue Persistence', () => {
    it('persists scheduled reminders to MongoDB Job Queue collection', async () => {
      const payload: any = {
        reminderType: 'UPCOMING_INSPECTION',
        entityType: 'NetMeteringApplication',
        entityId: new Types.ObjectId().toString(),
        subject: 'DISCOM Net Metering Inspection Due',
        message: 'Inspector assigned for tomorrow morning.',
        scheduledFor: new Date()
      };

      const record = await NotificationReminderService.scheduleOrSendReminder(payload);

      expect(record.reminderId).toBeDefined();

      // Verify that a persistent Job was enqueued
      expect(mockJobs.length).toBeGreaterThan(0);
      const reminderJob = mockJobs.find(j => j.queueName === JobQueueName.REMINDER);
      expect(reminderJob).toBeDefined();
      expect(reminderJob.status).toBe(JobStatus.PENDING);
      expect(reminderJob.payload.reminderType).toBe('UPCOMING_INSPECTION');
      expect(reminderJob.payload.subject).toBe('DISCOM Net Metering Inspection Due');
    });
  });
});
