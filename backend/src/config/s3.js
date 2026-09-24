const { S3Client } = require('@aws-sdk/client-s3');
const { env } = require('./env');

const s3ClientConfig = {
  region: env.AWS_REGION,
};

if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3Client = new S3Client(s3ClientConfig);

module.exports = { s3Client };
