const { createClient } = require("@supabase/supabase-js");

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function getSupabaseUrl() {
  const url = readEnv("SUPABASE_URL");
  if (!url) {
    throw new Error("SUPABASE_URL is not configured");
  }
  return url.replace(/\/+$/, "");
}

function getSupabaseServiceKey() {
  // Server-side operations (uploads, signed URLs, privileged table access) require
  // the Supabase service role key. Do not fall back to the anon/publishable key here
  // because it lacks the privileges needed for storage upload/download management.
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase storage operations.\n" +
      "Set SUPABASE_SERVICE_ROLE_KEY in your backend environment (do NOT commit this secret)."
    );
  }
  return serviceKey;
}

function getSupabaseBucket() {
  const bucket = readEnv("SUPABASE_STORAGE_BUCKET");
  if (!bucket) {
    throw new Error("SUPABASE_STORAGE_BUCKET is not configured");
  }
  return bucket;
}

function getSupabaseClient() {
  if (!global.__supabaseClient) {
    global.__supabaseClient = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return global.__supabaseClient;
}

function normalizeStorageKey(key) {
  return String(key || "").replace(/^\/+/, "");
}

function encodeStorageKey(key) {
  return normalizeStorageKey(key)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function createPresignedUploadUrl({ key, contentType, expiresIn = 600 }) {
  const bucket = getSupabaseBucket();
  const client = getSupabaseClient();

  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(normalizeStorageKey(key), {
    expiresIn,
    ...(contentType ? { contentType } : {})
  });

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

async function createPresignedDownloadUrl({ key, expiresIn = 3600 }) {
  const bucket = getSupabaseBucket();
  const client = getSupabaseClient();

  const { data, error } = await client.storage.from(bucket).createSignedUrl(normalizeStorageKey(key), expiresIn);
  if (error) {
    throw error;
  }

  return data.signedUrl;
}

function buildPublicFileUrl(key) {
  const bucket = getSupabaseBucket();
  const url = getSupabaseUrl();
  return `${url}/storage/v1/object/public/${bucket}/${encodeStorageKey(key)}`;
}

async function doesObjectExist({ key }) {
  const bucket = getSupabaseBucket();
  const client = getSupabaseClient();
  const { error } = await client.storage.from(bucket).download(normalizeStorageKey(key));
  if (error) {
    if (error.status === 404 || error.statusCode === 404) {
      return false;
    }
    throw error;
  }
  return true;
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function uploadObjectStream({ key, body, contentType }) {
  const bucket = getSupabaseBucket();
  const client = getSupabaseClient();
  const buffer = await streamToBuffer(body);
  const { error } = await client.storage.from(bucket).upload(normalizeStorageKey(key), buffer, {
    cacheControl: "3600",
    contentType,
    upsert: false
  });
  if (error) {
    throw error;
  }
  return { key };
}

module.exports = {
  buildPublicFileUrl,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  doesObjectExist,
  uploadObjectStream
};
