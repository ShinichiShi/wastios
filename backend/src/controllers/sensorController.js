const { createSensorReading } = require('../services/sensorService');
const { emitBinUpdate, emitBinAlert } = require('../sockets/emitters');

async function postSensorData(req, res, next) {
  try {
    const { bin_id, fill_level, timestamp } = req.body;

    const reading = await createSensorReading({
      bin_id,
      fill_level: Number(fill_level),
      timestamp: Number(timestamp),
    });

    emitBinUpdate({
      bin_id: reading.bin_id,
      fill_level: reading.fill_level,
      timestamp: Number(reading.timestamp),
    });

    if (Number(reading.fill_level) > 85) {
      emitBinAlert({
        bin_id: reading.bin_id,
        fill_level: reading.fill_level,
      });
    }

    return res.status(201).json({
      message: 'Sensor reading stored',
      data: {
        id: reading.id,
        bin_id: reading.bin_id,
        fill_level: reading.fill_level,
        timestamp: reading.timestamp,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { postSensorData };
