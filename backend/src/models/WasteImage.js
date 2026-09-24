module.exports = {
  collection: 'waste_images',
  fields: {
    bin_id: 'string',
    s3_url: 'string',
    uploaded_at: 'number',
    label: 'string|null',
    confidence: 'number|null',
    created_at: 'timestamp',
  },
};
