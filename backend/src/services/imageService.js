const crypto = require('crypto');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const { env } = require('../config/env');
const { s3Client } = require('../config/s3');
const { getDB, admin } = require('../config/db');
const { predictWasteFromImageUrl } = require('./mlService');
const { emitClassificationUpdate } = require('../sockets/emitters');

function buildS3Key(binId, originalName = 'image.jpg') {
  const ext = path.extname(originalName) || '.jpg';
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  return `bins/${binId}/${unique}${ext}`;
}

function toPublicS3Url(bucket, region, key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
}

async function uploadImageAndStoreResult({ bin_id, file }) {
  const db = getDB();
  const key = buildS3Key(bin_id, file.originalname);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
    })
  );

  const s3_url = toPublicS3Url(env.S3_BUCKET_NAME, env.AWS_REGION, key);

  const prediction = await predictWasteFromImageUrl(s3_url);
  const uploadedAt = Date.now();

  const record = {
    bin_id,
    s3_url,
    uploaded_at: uploadedAt,
    label: prediction.label,
    confidence: prediction.confidence,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('waste_images').add(record);

  emitClassificationUpdate({
    bin_id: record.bin_id,
    label: record.label,
    confidence: record.confidence,
    timestamp: record.uploaded_at,
  });

  return {
    id: docRef.id,
    bin_id: record.bin_id,
    s3_url: record.s3_url,
    uploaded_at: record.uploaded_at,
    label: record.label,
    confidence: record.confidence,
  };
}

module.exports = { uploadImageAndStoreResult };
