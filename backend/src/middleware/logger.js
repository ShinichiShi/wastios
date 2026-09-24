const winston = require('winston');
const crypto = require('crypto');
const { env } = require('../config/env');

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'wastios-backend' },
  transports: [
    new winston.transports.Console(),
  ],
});

function requestContext(req, res, next) {
  req.id = crypto.randomUUID();
  req.logger = logger.child({ 'req.id': req.id });
  next();
}

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('HTTP request', {
      'req.id': req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
    });
  });

  next();
}

module.exports = { logger, requestContext, requestLogger };
