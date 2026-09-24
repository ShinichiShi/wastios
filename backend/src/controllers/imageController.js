const { uploadImageAndStoreResult } = require('../services/imageService');

async function uploadWasteImage(req, res, next) {
  try {
    const { bin_id } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'Image file is required (multipart field name: image)',
          code: 400,
        },
      });
    }

    const result = await uploadImageAndStoreResult({
      bin_id,
      file: req.file,
    });

    return res.status(201).json({
      message: 'Image uploaded and inference stored',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { uploadWasteImage };
