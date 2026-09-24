const admin = require('firebase-admin');
const { env } = require('./env');

let app;
let db;

function getCredential() {
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    });
  }

  // Fallback to GOOGLE_APPLICATION_CREDENTIALS / ADC.
  return admin.credential.applicationDefault();
}

function initFirebase() {
  if (app) return app;

  app = admin.initializeApp({
    credential: getCredential(),
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET || undefined,
  });

  db = admin.firestore(app);
  db.settings({ ignoreUndefinedProperties: true });

  return app;
}

async function connectDB() {
  initFirebase();
  // Lightweight query to verify Firestore connectivity.
  // Note: collection IDs starting and ending with "__" are reserved by
  // Firestore and rejected as INVALID_ARGUMENT, so this must avoid that pattern.
  await db.collection('_internal_healthcheck').limit(1).get();
}

async function closeDB() {
  if (app) {
    await app.delete();
    app = null;
    db = null;
  }
}

function getDB() {
  if (!db) {
    initFirebase();
  }
  return db;
}

function getAuth() {
  if (!app) {
    initFirebase();
  }
  return admin.auth(app);
}

module.exports = {
  connectDB,
  closeDB,
  getDB,
  getAuth,
  admin,
};
