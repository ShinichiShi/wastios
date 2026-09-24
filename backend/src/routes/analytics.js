const express = require('express');
const { query, validationResult } = require('express-validator');

const {
  binsAnalytics,
  trendsAnalytics,
  wasteStatsAnalytics,
} = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/bins', auth, binsAnalytics);

router.get(
  '/trends',
  auth,
  [
    query('bin_id').isString().trim().notEmpty().withMessage('bin_id is required'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('days must be an integer between 1 and 365'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 400,
          details: errors.array(),
        },
      });
    }

    if (!req.query.days) {
      req.query.days = '7';
    }

    return trendsAnalytics(req, res, next);
  }
);

router.get('/waste-stats', auth, wasteStatsAnalytics);

module.exports = router;
