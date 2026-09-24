const { getDB } = require('../config/db');

async function getCurrentFillLevelPerBin() {
  const db = getDB();
  const snapshot = await db.collection('sensor_readings').orderBy('timestamp', 'desc').get();

  const latestByBin = new Map();
  snapshot.forEach((doc) => {
    const row = doc.data();
    if (!latestByBin.has(row.bin_id)) {
      latestByBin.set(row.bin_id, {
        bin_id: row.bin_id,
        fill_level: Number(row.fill_level),
        timestamp: Number(row.timestamp),
      });
    }
  });

  return [...latestByBin.values()].sort((a, b) => a.bin_id.localeCompare(b.bin_id));
}

async function getFillTrends(binId, days) {
  const db = getDB();
  const sinceEpochMs = Date.now() - Number(days) * 24 * 60 * 60 * 1000;

  const snapshot = await db
    .collection('sensor_readings')
    .where('bin_id', '==', binId)
    .where('timestamp', '>=', sinceEpochMs)
    .orderBy('timestamp', 'asc')
    .get();

  const rows = [];
  snapshot.forEach((doc) => {
    const row = doc.data();
    rows.push({
      bin_id: row.bin_id,
      fill_level: Number(row.fill_level),
      timestamp: Number(row.timestamp),
    });
  });

  return rows;
}

async function getWasteStats() {
  const db = getDB();
  const snapshot = await db.collection('waste_images').get();

  const counter = {};
  snapshot.forEach((doc) => {
    const row = doc.data();
    if (!row.label) return;
    counter[row.label] = (counter[row.label] || 0) + 1;
  });

  const grouped = Object.entries(counter).map(([label, count]) => ({ label, count }));

  const total = grouped.reduce((sum, item) => sum + Number(item.count), 0);

  const breakdown = grouped.map((item) => {
    const count = Number(item.count);
    return {
      label: item.label,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
    };
  });

  return {
    total,
    breakdown,
  };
}

module.exports = {
  getCurrentFillLevelPerBin,
  getFillTrends,
  getWasteStats,
};
