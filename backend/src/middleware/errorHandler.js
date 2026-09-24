const { logger } = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError('Route not found', 404));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || err.status || 500;

  // Convert common operational errors to HTTP 400
  if (err.name === 'MulterError') {
    statusCode = 400;
  }
  if (err.code && String(err.code).startsWith('firestore/')) {
    statusCode = 400;
  }
  if (err.code && String(err.code).startsWith('auth/')) {
    statusCode = 401;
  }
  if (err.message === 'Only image files are allowed') {
    statusCode = 400;
  }

  const message = err.message || 'Internal Server Error';

  logger.error('Unhandled error', {
    'req.id': req.id,
    message,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: {
      message,
      code: statusCode,
      req_id: req.id,
    },
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
