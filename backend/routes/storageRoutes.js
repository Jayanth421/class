const express = require("express");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Transform } = require("stream");
const { verifyUploadToken } = require("../config/jwt");
const ApiError = require("../utils/apiError");
const {
  getLocalUploadDir,
  getSupabaseUploadMode,
  getStorageProvider,
  safeResolveLocalPath,
  uploadObjectStream
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

const verifyJWT = require("../middlewares/verifyJWT");
const { createPresignedDownloadUrl, listObjects } = require("../services/storageService");

const router = express.Router();

router.put("/upload", async (req, res, next) => {
  try {
    const provider = getStorageProvider();
    const supabaseUploadMode = getSupabaseUploadMode();
    const uploadViaBackend = provider === "local" || (provider === "supabase" && supabaseUploadMode === "proxy");

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
      await uploadObjectStream({ key, body: req, contentType: normalizedRequestType, maxBytes });
    }

    res.status(200).json({ message: "Uploaded" });
  } catch (error) {
    next(error);
  }
});

// Return a signed URL for a stored object. Requires authentication.
router.get('/url', verifyJWT, async (req, res, next) => {
  try {
    const key = String(req.query.key || '').trim();
    if (!key) return res.status(400).json({ ok: false, message: 'key query param is required' });

    const expiresIn = Number(req.query.expires || 3600);
    const url = await createPresignedDownloadUrl({ key, expiresIn });
    res.status(200).json({ ok: true, url });
  } catch (error) {
    next(error);
  }
});

// List objects under a prefix. Requires authentication.
router.get('/list', verifyJWT, async (req, res, next) => {
  try {
    const prefix = String(req.query.prefix || '').trim();
    const limit = Number(req.query.limit || 100);
    const offset = Number(req.query.offset || 0);

    const items = await listObjects({ prefix, limit, offset });

    // Normalize to { key, name, isDirectory }
    const normalized = (items || []).map((it) => {
      const name = it.name || it; // supabase returns objects with name property
      const key = prefix ? `${prefix.replace(/\/+$/, '')}/${name}` : name;
      return {
        key,
        name,
        isDirectory: !!it?.is_directory || !!it?.isDirectory || false
      };
    });

    res.status(200).json({ ok: true, files: normalized });
  } catch (error) {
    next(error);
  }
});

// Return a signed URL for an upload record by uploadId. Requires authentication and role checks.
const { ROLES } = require('../config/constants');
const Upload = require('../mongoModels/Upload');

router.get('/file-url', verifyJWT, async (req, res, next) => {
  try {
    const uploadId = String(req.query.uploadId || '').trim();
    if (!uploadId) return res.status(400).json({ ok: false, message: 'uploadId query param is required' });

    const uploadDoc = await Upload.findById(uploadId).lean().exec();
    if (!uploadDoc) return res.status(404).json({ ok: false, message: 'Upload not found' });

    // Authorization: allow admins and faculty to access any file; students can access their own uploads; smartboard role allowed.
    const role = String(req.user.role || '').toUpperCase();
    const userId = String(req.user.userId || '');
    if (role !== ROLES.ADMIN && role !== ROLES.FACULTY && role !== ROLES.SMARTBOARD) {
      // student or other: must be owner
      if (String(uploadDoc.uploadedBy || '') !== userId) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
      }
    }

    const key = uploadDoc.s3Key || uploadDoc.key || uploadDoc.fullPath || uploadDoc.path;
    if (!key) return res.status(404).json({ ok: false, message: 'Upload has no storage key' });

    const url = await createPresignedDownloadUrl({ key, expiresIn: 3600 });
    res.status(200).json({ ok: true, url });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
