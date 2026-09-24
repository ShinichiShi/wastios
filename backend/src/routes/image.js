const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');

const { uploadWasteImage } = require('../controllers/imageController');
const { auth } = require('../middleware/auth');
const { env } = require('../config/env');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    return cb(null, true);
  },
});

router.post(
  '/upload',
  auth,
  upload.single('image'),
  [body('bin_id').isString().trim().notEmpty().withMessage('bin_id is required')],
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

    return uploadWasteImage(req, res, next);
  }
);

module.exports = router;
