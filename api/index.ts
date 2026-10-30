import type { IncomingMessage, ServerResponse } from 'node:http';

let appInstance: any = null;
let initError: Error | null = null;

async function getApp() {
  if (appInstance) return appInstance;
  if (initError) throw initError;

  try {
    const { createApp } = await import('../apps/api/src/app.js');
    const { DatabaseManager } = await import('../apps/api/src/db/connection.js');

    try {
      const dbManager = DatabaseManager.getInstance();
      const state = await dbManager.connect();
      if (state === 'connected') {
        const { User } = await import('../apps/api/src/models/User.js');
        const count = await User.countDocuments();
        if (count === 0) {
          const { bootstrapDefaultUsers } = await import('../apps/api/src/db/bootstrap.js');
          await bootstrapDefaultUsers();
        }
      }
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
  // Restore original request URL if rewritten by Vercel routing
  const forwardedUri =
    (req.headers['x-forwarded-uri'] as string) ||
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-now-route-matches'] as string);

  if (forwardedUri && !req.url?.startsWith('/api/v1') && forwardedUri.startsWith('/api')) {
    req.url = forwardedUri;
  }

  try {
    const app = await getApp();
    await new Promise<void>((resolve, reject) => {
      res.on('finish', () => resolve());
      res.on('close', () => resolve());
      res.on('error', err => reject(err));
      app(req, res);
    });
  } catch (err: any) {
    if (!res.headersSent) {
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
}
