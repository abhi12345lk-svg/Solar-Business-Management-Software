import { app } from './app.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { dbManager } from './db/connection.js';

async function startServer(): Promise<void> {
  // 1. Initialize Database Connection
  await dbManager.connect();

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

startServer().catch(err => {
  logger.fatal({ err }, 'Failed to start API server');
  process.exit(1);
});
