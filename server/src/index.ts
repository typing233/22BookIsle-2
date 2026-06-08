import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { initializeDb, closeDb } from './db/connection';
import { initWebSocket } from './services/wsService';
import { initScheduler } from './services/scheduler';
import { logger } from './utils/logger';

async function main() {
  await initializeDb();

  const app = createApp();
  const server = http.createServer(app);

  initWebSocket(server);
  await initScheduler();

  server.listen(config.port, () => {
    logger.info(`BookIsle server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
