import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../apps/api/src/app.js';
import { DatabaseManager } from '../apps/api/src/db/connection.js';
import { SequenceService } from '../apps/api/src/services/sequenceService.js';
import { logger } from '../apps/api/src/utils/logger.js';

let isDbInitialized = false;

async function ensureDbConnected(): Promise<void> {
  if (isDbInitialized) return;
  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.connect();
    await SequenceService.syncAllCounters();
    isDbInitialized = true;
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Vercel serverless database connection warning');
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await ensureDbConnected();
  app(req, res);
}
