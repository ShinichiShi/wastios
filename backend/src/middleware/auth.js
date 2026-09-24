const { env } = require('../config/env');
const { getAuth } = require('../config/db');
const { logger } = require('./logger');

async function auth(req, res, next) {
  // Local/dev bypass only when explicitly enabled.
  if (env.FIREBASE_AUTH_BYPASS) {
    return next();
  }

  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Missing bearer token',
        code: 401,
      },
    });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      claims: decoded,
    };
    return next();
  } catch (error) {
    logger.warn('Firebase auth verification failed', {
      'req.id': req.id,
      code: error.code,
      message: error.message,
    });

    return res.status(401).json({
      error: {
        message: 'Invalid or expired bearer token',
        code: 401,
      },
    });
  }
}

module.exports = { auth };
