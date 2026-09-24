const {
  getCurrentFillLevelPerBin,
  getFillTrends,
  getWasteStats,
} = require('../services/analyticsService');

async function binsAnalytics(req, res, next) {
  try {
    const rows = await getCurrentFillLevelPerBin();
    return res.status(200).json({ data: rows });
  } catch (error) {
    return next(error);
  }
}

async function trendsAnalytics(req, res, next) {
  try {
    const { bin_id, days } = req.query;
    const rows = await getFillTrends(bin_id, Number(days));

    return res.status(200).json({
      data: rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function wasteStatsAnalytics(req, res, next) {
  try {
    const stats = await getWasteStats();
    return res.status(200).json({ data: stats });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  binsAnalytics,
  trendsAnalytics,
  wasteStatsAnalytics,
};
