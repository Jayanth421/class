const fs = require("fs");
const path = require("path");
const { buildPublicFileUrl, createPresignedUploadUrl, doesObjectExist } = require("./s3Service");

function getStorageProvider() {
  const value = String(process.env.STORAGE_PROVIDER || "s3").trim().toLowerCase();
  return value === "local" ? "local" : "s3";
}

function getS3UploadMode() {
  const value = String(process.env.S3_UPLOAD_MODE || "").trim().toLowerCase();
  return value === "proxy" ? "proxy" : "presigned";
}

function getLocalUploadDir() {
  const configured = String(process.env.LOCAL_UPLOAD_DIR || "").trim();
  const root = path.resolve(__dirname, "..");
  const dir = configured ? path.resolve(root, configured) : path.resolve(root, "uploads");
  return dir;
}

function encodeKeyForUrl(key) {
  return String(key || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function safeResolveLocalPath(uploadDir, key) {
  const base = path.resolve(uploadDir);
  const normalizedKey = String(key || "").replace(/^\/+/, "");
  const resolved = path.resolve(base, normalizedKey);
  if (resolved === base || resolved.startsWith(`${base}${path.sep}`)) {
    return resolved;
  }
  throw new Error("Invalid storage key path");
}

function buildFileUrl({ origin, key }) {
  if (getStorageProvider() === "local") {
    const prefix = origin ? String(origin).replace(/\/$/, "") : "";
    return `${prefix}/files/${encodeKeyForUrl(key)}`;
  }
  return buildPublicFileUrl(key);
}

async function buildUploadUrl({ origin, key, contentType, uploadToken }) {
  const provider = getStorageProvider();
  const s3UploadMode = getS3UploadMode();
  if (provider === "local" || (provider === "s3" && s3UploadMode === "proxy")) {
    const prefix = String(origin || "").replace(/\/$/, "");
    if (!prefix) throw new Error("origin is required for local uploads");
    if (!uploadToken) throw new Error("uploadToken is required for local uploads");
    return `${prefix}/api/storage/upload?token=${encodeURIComponent(String(uploadToken))}`;
  }
  return createPresignedUploadUrl({ key, contentType });
}

async function doesUploadedFileExist({ key }) {
  if (getStorageProvider() === "local") {
    const uploadDir = getLocalUploadDir();
    const filePath = safeResolveLocalPath(uploadDir, key);
    return fs.existsSync(filePath);
  }
  return doesObjectExist({ key });
}

module.exports = {
  buildFileUrl,
  buildUploadUrl,
  doesUploadedFileExist,
  getLocalUploadDir,
  getStorageProvider,
  getS3UploadMode,
  safeResolveLocalPath
};
