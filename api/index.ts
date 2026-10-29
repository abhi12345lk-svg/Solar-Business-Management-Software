import type { IncomingMessage, ServerResponse } from 'node:http';

let appInstance: any = null;
let initError: Error | null = null;

async function getApp() {
  if (appInstance) return appInstance;
  if (initError) throw initError;

  try {
    const { createApp } = await import('../apps/api/src/app.js');
    const { DatabaseManager } = await import('../apps/api/src/db/connection.js');
    const { SequenceService } = await import('../apps/api/src/services/sequenceService.js');

    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.connect();
      await SequenceService.syncAllCounters();
    } catch (dbErr: any) {
      console.warn('Vercel serverless database initialization:', dbErr?.message || dbErr);
    }

    appInstance = createApp();
    return appInstance;
  } catch (err: any) {
    initError = err;
    throw err;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    app(req, res);
  } catch (err: any) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_INITIALIZATION_ERROR',
          message:
            'API Serverless initialization failed. Please ensure MONGODB_URI and other required environment variables are configured in Vercel project settings.',
          details: err?.message || String(err)
        }
      })
    );
  }
}
