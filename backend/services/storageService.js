const fs = require("fs");
const path = require("path");
const { PassThrough, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const supabaseStorageService = require("./supabaseStorageService");

function getStorageProvider() {
  const value = String(process.env.STORAGE_PROVIDER || "supabase").trim().toLowerCase();
  if (value === "local" || value === "supabase") return value;
  return "supabase";
}

function getSupabaseUploadMode() {
  const value = String(process.env.SUPABASE_UPLOAD_MODE || "").trim().toLowerCase();
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
  const provider = getStorageProvider();
  if (provider === "local") {
    const prefix = origin ? String(origin).replace(/\/$/, "") : "";
    return `${prefix}/files/${encodeKeyForUrl(key)}`;
  }
  return supabaseStorageService.buildPublicFileUrl(key);
}

function getProxyUploadUrl(origin, uploadToken) {
  const prefix = String(origin || "").replace(/\/$/, "");
  if (!prefix) throw new Error("origin is required for local uploads");
  if (!uploadToken) throw new Error("uploadToken is required for local uploads");
  return `${prefix}/api/storage/upload?token=${encodeURIComponent(String(uploadToken))}`;
}

async function createPresignedDownloadUrl({ key, expiresIn = 3600 }) {
  const provider = getStorageProvider();
  if (provider === "local") {
    throw new Error("Local storage does not support signed download URLs");
  }
  return supabaseStorageService.createPresignedDownloadUrl({ key, expiresIn });
}

async function listObjects({ prefix = "", limit = 100, offset = 0 }) {
  const provider = getStorageProvider();
  if (provider === "local") {
    const uploadDir = getLocalUploadDir();
    const listDir = safeResolveLocalPath(uploadDir, prefix || "");
    const entries = await fs.promises.readdir(listDir, { withFileTypes: true }).catch(() => []);
    return entries.map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory()
    }));
  }

  if (provider === "supabase") {
    return supabaseStorageService.listObjects({ prefix, limit, offset });
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

async function buildUploadUrl({ origin, key, contentType, uploadToken }) {
  const provider = getStorageProvider();
  const supabaseUploadMode = getSupabaseUploadMode();

  if (provider === "local" || (provider === "supabase" && supabaseUploadMode === "proxy")) {
    return getProxyUploadUrl(origin, uploadToken);
  }

  if (provider === "supabase") {
    return supabaseStorageService.createPresignedUploadUrl({ key, contentType });
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

async function doesUploadedFileExist({ key }) {
  const provider = getStorageProvider();
  if (provider === "local") {
    const uploadDir = getLocalUploadDir();
    const filePath = safeResolveLocalPath(uploadDir, key);
    return fs.existsSync(filePath);
  }

  if (provider === "supabase") {
    return supabaseStorageService.doesObjectExist({ key });
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

function createByteLimitTransform(limitBytes) {
  let seen = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      seen += chunk.length;
      if (limitBytes > 0 && seen > limitBytes) {
        callback(new Error("File size exceeds limit"));
        return;
      }
      callback(null, chunk);
    }
  });
}

async function uploadObjectStream({ key, body, contentType, maxBytes }) {
  const provider = getStorageProvider();
  const limitedBody = body.pipe(createByteLimitTransform(maxBytes));

  if (provider === "local") {
    throw new Error("Local storage does not support backend uploads");
  }

  if (provider === "supabase") {
    await supabaseStorageService.uploadObjectStream({ key, body: limitedBody, contentType });
    return;
  }

  throw new Error(`Storage provider ${provider} does not support backend uploads`);
}

module.exports = {
  buildFileUrl,
  buildUploadUrl,
  createPresignedDownloadUrl,
  doesUploadedFileExist,
  uploadObjectStream,
  getLocalUploadDir,
  getStorageProvider,
  getSupabaseUploadMode,
  safeResolveLocalPath
};
