const dotenv = require('dotenv');

dotenv.config();

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function toInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? fallback : num;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toInt(process.env.PORT, 3000),

  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
  FIREBASE_AUTH_BYPASS: toBool(process.env.FIREBASE_AUTH_BYPASS, false),

  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,

  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://ml-service/predict',
  AUTH_API_KEY: process.env.AUTH_API_KEY || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '*',

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  MAX_UPLOAD_MB: toInt(process.env.MAX_UPLOAD_MB, 8),
};

function validateEnv() {
  const missing = [];

  if (!env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');

  const hasServiceAccount =
    Boolean(env.FIREBASE_CLIENT_EMAIL) && Boolean(env.FIREBASE_PRIVATE_KEY);
  if (!hasServiceAccount && env.NODE_ENV === 'production') {
    missing.push('FIREBASE_CLIENT_EMAIL');
    missing.push('FIREBASE_PRIVATE_KEY');
  }

  if (!env.S3_BUCKET_NAME) missing.push('S3_BUCKET_NAME');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { env, validateEnv };
