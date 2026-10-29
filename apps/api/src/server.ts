import { app } from './app.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { dbManager } from './db/connection.js';

export async function startServer(): Promise<any> {
  // 1. Initialize Database Connection (Fail-fast before opening HTTP listener)
  const dbState = await dbManager.connect();
  if (config.NODE_ENV === 'production' || config.NODE_ENV === 'staging') {
    if (!dbManager.isReady() || dbState !== 'connected') {
      throw new Error(
        `Fatal startup error: Cannot start API server when database state is '${dbState}'. Aborting.`
      );
    }
  }

  // 2. Start HTTP Server
  const server = app.listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        prefix: config.API_PREFIX
      },
      `INS Solar API server running on port ${config.PORT}`
    );
  });

  // 3. Graceful Shutdown Handlers
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, `Received ${signal}. Commencing graceful shutdown...`);

    server.close(async err => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
        process.exit(1);
      }

      try {
        await dbManager.disconnect();
        logger.info('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error disconnecting database during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (config.NODE_ENV !== 'test') {
  startServer().catch(err => {
    logger.fatal({ err: err?.message || err }, 'Failed to start API server');
    process.exit(1);
  });
}
