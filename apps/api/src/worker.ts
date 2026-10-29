/**
 * INS Solar Business Management Software — Standalone Job Worker Daemon (DEC-03)
 *
 * Runs persistent background queue consumer with atomic lease claiming,
 * crash recovery, retry backoff, and graceful shutdown.
 */

import { dbManager } from './db/connection.js';
import { JobQueueService } from './services/jobQueueService.js';
import { IJobDocument } from './models/Job.js';
import { JobQueueName } from '@ins-solar/shared';
import { logger } from './utils/logger.js';

export type JobHandler = (payload: Record<string, any>, job: IJobDocument) => Promise<void>;

export class JobWorker {
  public readonly workerId: string;
  private isRunning: boolean = false;
  private handlers: Map<JobQueueName, JobHandler> = new Map();
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private currentJobPromise: Promise<void> | null = null;

  constructor(
    workerId: string = `worker-${process.pid}-${Date.now()}`,
    pollIntervalMs: number = 2000
  ) {
    this.workerId = workerId;
    this.pollIntervalMs = pollIntervalMs;
    this.registerDefaultHandlers();
  }

  /**
   * Registers a handler for a specific queue.
   */
  public registerHandler(queueName: JobQueueName, handler: JobHandler): void {
    this.handlers.set(queueName, handler);
  }

  /**
   * Default operational handlers for solar business queue events.
   */
  private registerDefaultHandlers(): void {
    this.registerHandler(JobQueueName.REMINDER, async (payload, job) => {
      logger.info(
        { jobId: job._id, subject: payload.subject, entityType: payload.entityType },
        '[JobWorker] Processing operational reminder job.'
      );
    });

    this.registerHandler(JobQueueName.CRITICAL_MAIL, async (payload, job) => {
      logger.info(
        { jobId: job._id, to: payload.to, subject: payload.subject },
        '[JobWorker] Processing critical transactional mail job.'
      );
    });

    this.registerHandler(JobQueueName.SMS, async (payload, job) => {
      logger.info(
        { jobId: job._id, to: payload.phone },
        '[JobWorker] Processing DLT SMS notification job.'
      );
    });

    this.registerHandler(JobQueueName.WHATSAPP, async (payload, job) => {
      logger.info(
        { jobId: job._id, to: payload.phone, template: payload.templateId },
        '[JobWorker] Processing WhatsApp template notification job.'
      );
    });

    this.registerHandler(JobQueueName.PDF_COMPILE, async (payload, job) => {
      logger.info(
        { jobId: job._id, quotationId: payload.quotationId },
        '[JobWorker] Processing server-side PDF compilation job.'
      );
    });

    this.registerHandler(JobQueueName.CRON_MAINTENANCE, async (payload, job) => {
      logger.info(
        { jobId: job._id, scanType: payload.scanType },
        '[JobWorker] Processing scheduled maintenance scan.'
      );
    });
  }

  /**
   * Processes a single iteration of queue polling.
   */
  public async processNext(): Promise<boolean> {
    try {
      const job = await JobQueueService.pollNextJob(this.workerId);
      if (!job) {
        return false;
      }

      const handler = this.handlers.get(job.queueName);
      if (!handler) {
        logger.warn(
          { jobId: job._id, queueName: job.queueName },
          '[JobWorker] No registered handler for queue; failing job.'
        );
        await JobQueueService.failJob(
          job._id,
          this.workerId,
          `No handler registered for queue ${job.queueName}`
        );
        return true;
      }

      try {
        await handler(job.payload, job);
        await JobQueueService.completeJob(job._id, this.workerId);
      } catch (err: any) {
        logger.error(
          { jobId: job._id, queueName: job.queueName, err },
          '[JobWorker] Handler error while processing job.'
        );
        await JobQueueService.failJob(job._id, this.workerId, err);
      }

      return true;
    } catch (pollErr) {
      logger.error({ pollErr }, '[JobWorker] Error during job queue polling.');
      return false;
    }
  }

  /**
   * Starts the continuous background polling loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ workerId: this.workerId }, '[JobWorker] Worker daemon started.');

    let recoveryCounter = 0;

    const loop = async () => {
      if (!this.isRunning) return;

      recoveryCounter++;
      // Run stale lease recovery every 10 iterations (~20-30 seconds)
      if (recoveryCounter % 10 === 0) {
        try {
          await JobQueueService.recoverStaleLeases();
        } catch (recErr) {
          logger.warn({ recErr }, '[JobWorker] Error running stale lease recovery.');
        }
      }

      this.currentJobPromise = (async () => {
        let hasMore = true;
        while (hasMore && this.isRunning) {
          hasMore = await this.processNext();
        }
      })();

      await this.currentJobPromise;

      if (this.isRunning) {
        this.timer = setTimeout(loop, this.pollIntervalMs);
      }
    };

    loop();
  }

  /**
   * Stops the worker cleanly, awaiting in-flight jobs.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentJobPromise) {
      await this.currentJobPromise;
    }
    logger.info({ workerId: this.workerId }, '[JobWorker] Worker daemon stopped.');
  }
}

// Standalone entrypoint when executed directly (node dist/worker.js)
if (
  process.env.NODE_ENV !== 'test' &&
  (process.argv[1]?.endsWith('worker.ts') || process.argv[1]?.endsWith('worker.js'))
) {
  async function main() {
    logger.info('[JobWorker] Booting standalone background worker process...');
    await dbManager.connect();

    const worker = new JobWorker();
    worker.start();

    const shutdown = async (signal: string) => {
      logger.info({ signal }, '[JobWorker] Received shutdown signal; stopping...');
      await worker.stop();
      await dbManager.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  main().catch(err => {
    logger.fatal({ err }, '[JobWorker] Fatal failure starting standalone worker.');
    process.exit(1);
  });
}
