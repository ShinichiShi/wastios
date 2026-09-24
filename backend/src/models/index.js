// Firebase/Firestore does not require ORM model sync.
// This module is kept for compatibility with any legacy imports.

const SensorReading = require('./SensorReading');
const WasteImage = require('./WasteImage');

async function syncModels() {
  return Promise.resolve();
}

module.exports = {
  SensorReading,
  WasteImage,
  syncModels,
};
