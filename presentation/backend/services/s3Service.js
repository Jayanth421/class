const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function getAwsRegion() {
  const region = String(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();
  if (!region) {
    throw new Error("AWS_REGION is not configured");
  }
  return region;
}

let s3Client;

function getS3Client() {
  if (s3Client) return s3Client;

  s3Client = new S3Client({
    region: getAwsRegion(),
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: process.env.AWS_SESSION_TOKEN || undefined
          }
        : undefined
  });

  return s3Client;
}

function getBucketName() {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }
  return process.env.AWS_S3_BUCKET;
}

async function createPresignedUploadUrl({ key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: 600 });
}

async function createPresignedDownloadUrl({ key, expiresIn = 3600 }) {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

async function doesObjectExist({ key }) {
  const command = new HeadObjectCommand({
    Bucket: getBucketName(),
    Key: key
  });
  try {
    await getS3Client().send(command);
    return true;
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode === 404 || error?.name === "NotFound" || error?.Code === "NotFound") {
      return false;
    }
    throw error;
  }
}

async function uploadObjectStream({ key, body, contentType }) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    throw new Error("key is required");
  }

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: normalizedKey,
    Body: body,
    ...(contentType ? { ContentType: contentType } : {})
  });

  await getS3Client().send(command);
  return { key: normalizedKey };
}

function buildPublicFileUrl(key) {
  if (process.env.CLOUDFRONT_URL) {
    return `${process.env.CLOUDFRONT_URL.replace(/\/$/, "")}/${key}`;
  }
  const region = getAwsRegion();
  return `https://${getBucketName()}.s3.${region}.amazonaws.com/${key}`;
}

module.exports = {
  buildPublicFileUrl,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  doesObjectExist,
  uploadObjectStream
};
