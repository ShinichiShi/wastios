const express = require('express');
const { body, validationResult } = require('express-validator');

const { postSensorData } = require('../controllers/sensorController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/',
  auth,
  [
    body('bin_id').isString().trim().notEmpty().withMessage('bin_id is required'),
    body('fill_level')
      .isFloat({ min: 0, max: 100 })
      .withMessage('fill_level must be a float between 0 and 100'),
    body('timestamp').isInt({ min: 0 }).withMessage('timestamp must be epoch milliseconds'),
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

    return postSensorData(req, res, next);
  }
);

module.exports = router;
