const express = require("express");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { PassThrough, Transform } = require("stream");
const { verifyUploadToken } = require("../config/jwt");
const ApiError = require("../utils/apiError");
const { uploadObjectStream } = require("../services/s3Service");
const {
  getLocalUploadDir,
  getS3UploadMode,
  getStorageProvider,
  safeResolveLocalPath
} = require("../services/storageService");

function getUploadToken(req) {
  const fromQuery = req.query?.token;
  if (fromQuery) return String(fromQuery);
  const fromHeader = req.headers["x-upload-token"];
  if (fromHeader) return String(fromHeader);
  return "";
}

function createByteLimitTransform(limitBytes) {
  let seen = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      seen += chunk.length;
      if (limitBytes > 0 && seen > limitBytes) {
        callback(new ApiError(413, "File size exceeds limit"));
        return;
      }
      callback(null, chunk);
    }
  });
}

async function writeRequestToFile(req, filePath, maxBytes) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const writeStream = fs.createWriteStream(tempPath, { flags: "wx" });
  try {
    await pipeline(req, createByteLimitTransform(maxBytes), writeStream);

    await fs.promises.rm(filePath, { force: true });
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.promises.rm(tempPath, { force: true });
    } catch (_cleanupError) {
      // ignore cleanup errors
    }
    throw error;
  }
}

async function uploadRequestToS3(req, { key, contentType, maxBytes }) {
  const passThrough = new PassThrough();

  const uploadPromise = uploadObjectStream({
    key,
    body: passThrough,
    contentType
  }).catch((error) => {
    passThrough.destroy(error);
    throw error;
  });

  try {
    await pipeline(req, createByteLimitTransform(maxBytes), passThrough);
    await uploadPromise;
  } catch (error) {
    passThrough.destroy(error);
    try {
      await uploadPromise;
    } catch (_uploadError) {
      // ignore secondary upload errors
    }
    throw error;
  }
}

const router = express.Router();

router.put("/upload", async (req, res, next) => {
  try {
    const provider = getStorageProvider();
    const s3UploadMode = getS3UploadMode();
    const uploadViaBackend = provider === "local" || (provider === "s3" && s3UploadMode === "proxy");

    if (!uploadViaBackend) {
      throw new ApiError(404, "Not found");
    }

    const uploadToken = getUploadToken(req);
    if (!uploadToken) throw new ApiError(400, "token is required");

    let decoded;
    try {
      decoded = verifyUploadToken(uploadToken);
    } catch (_error) {
      throw new ApiError(400, "token is invalid or expired");
    }

    const allowedPurposes = new Set([
      "student_presentation_upload",
      "student_presentation_replace",
      "faculty_material_upload"
    ]);

    if (!allowedPurposes.has(decoded.purpose)) {
      throw new ApiError(400, "token is invalid");
    }

    const key = String(decoded.key || "").trim();
    if (!key) throw new ApiError(400, "token is invalid");

    const contentType = String(decoded.fileType || "").trim();
    const requestContentType = String(req.headers["content-type"] || "").trim();
    const normalizedTokenType = contentType.split(";")[0].trim().toLowerCase();
    const normalizedRequestType = requestContentType.split(";")[0].trim().toLowerCase();
    if (normalizedTokenType && normalizedRequestType && normalizedTokenType !== normalizedRequestType) {
      throw new ApiError(400, "Content-Type does not match token");
    }

    const uploadDir = getLocalUploadDir();
    const maxBytes = Number(process.env.LOCAL_UPLOAD_MAX_BYTES || 60 * 1024 * 1024);
    if (provider === "local") {
      const filePath = safeResolveLocalPath(uploadDir, key);
      await writeRequestToFile(req, filePath, maxBytes);
    } else {
      await uploadRequestToS3(req, { key, contentType: normalizedRequestType, maxBytes });
    }

    res.status(200).json({ message: "Uploaded" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
