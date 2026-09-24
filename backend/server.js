const { httpServer, io } = require('./app');
const { connectDB, closeDB } = require('./src/config/db');
const { env, validateEnv } = require('./src/config/env');
const { logger } = require('./src/middleware/logger');

async function startServer() {
  try {
    validateEnv();
    await connectDB();

    const server = httpServer.listen(env.PORT, () => {
      logger.info('Server started', { port: env.PORT });
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      server.close(async () => {
        try {
          io.close();
          await closeDB();
          logger.info('Firebase connections closed. Shutdown complete.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown', { message: err.message });
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('Failed to start server', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

startServer();
