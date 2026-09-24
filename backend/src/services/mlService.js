const axios = require('axios');
const { env } = require('../config/env');

async function predictWasteFromImageUrl(imageUrl) {
  const response = await axios.post(
    env.ML_SERVICE_URL,
    { image_url: imageUrl },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data || {};
  return {
    label: data.label || null,
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
  };
}

module.exports = { predictWasteFromImageUrl };
