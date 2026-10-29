/**
 * INS Solar Business Management Software — Background Job Queue Service (DEC-03)
 *
 * Implements MongoDB-backed distributed asynchronous queue with:
 * - Atomic `findOneAndUpdate` claiming with lease locks
 * - Crash recovery (stale lease reclaiming)
 * - Exponential backoff retries & dead-letter state
 * - Idempotent deduplication via unique `jobKey`
 */

import { Types } from 'mongoose';
import { JobModel, IJobDocument } from '../models/Job.js';
import { JobStatus, JobQueueName } from '@ins-solar/shared';
import { logger } from '../utils/logger.js';

export interface EnqueueJobOptions {
  jobKey?: string;
  scheduledFor?: Date;
  maxRetries?: number;
}

export class JobQueueService {
  /**
   * Enqueues a persistent job. If an identical jobKey is already PENDING or PROCESSING,
   * it returns the existing job to guarantee idempotency.
   */
  public static async enqueueJob(
    queueName: JobQueueName,
    payload: Record<string, any>,
    options: EnqueueJobOptions = {}
  ): Promise<IJobDocument> {
    const { jobKey, scheduledFor = new Date(), maxRetries = 3 } = options;

    if (jobKey) {
      const existing = await JobModel.findOne({ jobKey });
      if (existing) {
        if (existing.status === JobStatus.PENDING || existing.status === JobStatus.PROCESSING) {
          logger.info(
            { jobKey, status: existing.status, jobId: existing._id },
            '[JobQueueService] Deduplicated job already active in queue.'
          );
          return existing;
        }
      }
    }

    const job = new JobModel({
      jobKey,
      queueName,
      payload,
      status: JobStatus.PENDING,
      retryCount: 0,
      maxRetries,
      scheduledFor
    });

    try {
      await job.save();
      logger.info(
        { jobId: job._id, queueName, jobKey },
        '[JobQueueService] Job enqueued successfully.'
      );
      return job;
    } catch (err: any) {
      // Race condition on unique jobKey
      if (err.code === 11000 && jobKey) {
        const raceExisting = await JobModel.findOne({ jobKey });
        if (raceExisting) return raceExisting;
      }
      logger.error({ err, queueName, jobKey }, '[JobQueueService] Failed to enqueue job.');
      throw err;
    }
  }

  /**
   * Atomically claims the next eligible job using a lease lock.
   */
  public static async pollNextJob(
    workerId: string,
    queueNames?: JobQueueName[],
    leaseDurationMs: number = 5 * 60 * 1000
  ): Promise<IJobDocument | null> {
    const now = new Date();

    const query: any = {
      status: JobStatus.PENDING,
      scheduledFor: { $lte: now },
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }]
    };

    if (queueNames && queueNames.length > 0) {
      query.queueName = { $in: queueNames };
    }

    const update = {
      $set: {
        status: JobStatus.PROCESSING,
        lockedUntil: new Date(now.getTime() + leaseDurationMs),
        lockedByWorkerId: workerId
      }
    };

    const claimed = await JobModel.findOneAndUpdate(query, update, {
      sort: { scheduledFor: 1 },
      returnDocument: 'after'
    });

    if (claimed) {
      logger.info(
        { jobId: claimed._id, queueName: claimed.queueName, workerId },
        '[JobQueueService] Job claimed by worker.'
      );
    }

    return claimed;
  }

  /**
   * Marks a job as completed and releases any locks.
   */
  public static async completeJob(
    jobId: string | Types.ObjectId,
    workerId: string
  ): Promise<IJobDocument | null> {
    const completed = await JobModel.findOneAndUpdate(
      {
        _id: jobId,
        status: JobStatus.PROCESSING,
        lockedByWorkerId: workerId
      },
      {
        $set: {
          status: JobStatus.COMPLETED,
          completedAt: new Date()
        },
        $unset: {
          lockedUntil: 1,
          lockedByWorkerId: 1
        }
      },
      { returnDocument: 'after' }
    );

    if (completed) {
      logger.info({ jobId }, '[JobQueueService] Job marked COMPLETED.');
    }

    return completed;
  }

  /**
   * Records a job failure, increments retry count, and schedules exponential backoff
   * or transitions to FAILED dead-letter status.
   */
  public static async failJob(
    jobId: string | Types.ObjectId,
    _workerId: string,
    error: Error | string
  ): Promise<IJobDocument | null> {
    const errorMessage = typeof error === 'string' ? error : error.message || String(error);
    const existing = await JobModel.findById(jobId);
    if (!existing) return null;

    const newRetryCount = existing.retryCount + 1;
    const hasRemainingRetries = newRetryCount < existing.maxRetries;

    if (hasRemainingRetries) {
      // Exponential backoff: 2^retryCount * 60 seconds (1m, 2m, 4m, 8m...)
      const backoffMs = Math.pow(2, newRetryCount) * 60 * 1000;
      const nextRun = new Date(Date.now() + backoffMs);

      const retried = await JobModel.findOneAndUpdate(
        { _id: jobId },
        {
          $set: {
            status: JobStatus.PENDING,
            retryCount: newRetryCount,
            scheduledFor: nextRun,
            lastError: errorMessage
          },
          $unset: {
            lockedUntil: 1,
            lockedByWorkerId: 1
          }
        },
        { returnDocument: 'after' }
      );

      logger.warn(
        { jobId, retryCount: newRetryCount, nextRun, errorMessage },
        '[JobQueueService] Job failed; scheduled for retry.'
      );

      return retried;
    } else {
      // Transition to terminal FAILED state
      const failed = await JobModel.findOneAndUpdate(
        { _id: jobId },
        {
          $set: {
            status: JobStatus.FAILED,
            retryCount: newRetryCount,
            failedAt: new Date(),
            lastError: errorMessage
          },
          $unset: {
            lockedUntil: 1,
            lockedByWorkerId: 1
          }
        },
        { returnDocument: 'after' }
      );

      logger.error(
        { jobId, retryCount: newRetryCount, errorMessage },
        '[JobQueueService] Job exceeded maxRetries; transitioned to FAILED dead-letter.'
      );

      return failed;
    }
  }

  /**
   * Crash Recovery: Reclaims stale leased jobs if a worker died without releasing lock.
   */
  public static async recoverStaleLeases(): Promise<number> {
    const now = new Date();
    const result = await JobModel.updateMany(
      {
        status: JobStatus.PROCESSING,
        lockedUntil: { $lt: now }
      },
      {
        $set: {
          status: JobStatus.PENDING
        },
        $unset: {
          lockedUntil: 1,
          lockedByWorkerId: 1
        }
      }
    );

    if (result.modifiedCount > 0) {
      logger.warn(
        { recoveredJobs: result.modifiedCount },
        '[JobQueueService] Crash recovery: Reclaimed stale worker leases.'
      );
    }

    return result.modifiedCount;
  }

  /**
   * Manually retries a failed job.
   */
  public static async retryJob(jobId: string | Types.ObjectId): Promise<IJobDocument | null> {
    return await JobModel.findOneAndUpdate(
      { _id: jobId, status: JobStatus.FAILED },
      {
        $set: {
          status: JobStatus.PENDING,
          scheduledFor: new Date(),
          retryCount: 0
        },
        $unset: {
          lastError: 1,
          lockedUntil: 1,
          lockedByWorkerId: 1,
          failedAt: 1
        }
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Retrieves queue statistics by status.
   */
  public static async getJobStats(): Promise<Record<JobStatus, number>> {
    const counts = await JobModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats: Record<JobStatus, number> = {
      [JobStatus.PENDING]: 0,
      [JobStatus.PROCESSING]: 0,
      [JobStatus.COMPLETED]: 0,
      [JobStatus.FAILED]: 0
    };

    for (const item of counts) {
      if (item._id in stats) {
        stats[item._id as JobStatus] = item.count;
      }
    }

    return stats;
  }
}
