const { getDB, admin } = require('../config/db');

async function createSensorReading(payload) {
  const db = getDB();
  const reading = {
    bin_id: payload.bin_id,
    fill_level: payload.fill_level,
    timestamp: payload.timestamp,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('sensor_readings').add(reading);

  return {
    id: docRef.id,
    ...reading,
  };
}

module.exports = { createSensorReading };
