const mysql = require("mysql2/promise");
const MySqlFileDbSetting = require("../mongoModels/MySqlFileDbSetting");

let pool = null;
let poolSignature = "";
const ensuredTables = new Set();

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function sanitizeSqlIdentifier(value, fallback = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    throw new Error("Invalid SQL identifier");
  }
  return normalized;
}

function getEnvMySqlFileDbSettings() {
  return {
    enabled: toBool(process.env.MYSQL_FILE_DB_ENABLED, false),
    host: String(process.env.MYSQL_HOST || "").trim(),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: String(process.env.MYSQL_USER || "").trim(),
    pass: String(process.env.MYSQL_PASSWORD || "").trim(),
    database: String(process.env.MYSQL_DATABASE || "").trim(),
    ssl: toBool(process.env.MYSQL_SSL, false),
    tableName: String(process.env.MYSQL_FILE_UPLOADS_TABLE || "file_uploads").trim()
  };
}

async function getActiveMySqlFileDbSettings() {
  const env = getEnvMySqlFileDbSettings();
  const saved = await MySqlFileDbSetting.findOne({ key: "default" }).lean().exec();
  if (!saved) return env;

  return {
    enabled: saved.enabled === undefined ? env.enabled : Boolean(saved.enabled),
    host: String(saved.host || env.host || "").trim(),
    port: Number(saved.port || env.port || 3306),
    user: String(saved.user || env.user || "").trim(),
    pass: String(saved.pass || env.pass || "").trim(),
    database: String(saved.database || env.database || "").trim(),
    ssl: saved.ssl === undefined ? env.ssl : Boolean(saved.ssl),
    tableName: String(saved.tableName || env.tableName || "file_uploads").trim()
  };
}

function maskMySqlFileDbSettingsForResponse(settings) {
  return {
    ...settings,
    pass: settings.pass ? "********" : ""
  };
}

function assertEnabledSettings(settings) {
  const missing = [];
  if (!settings.host) missing.push("host");
  if (!settings.port) missing.push("port");
  if (!settings.user) missing.push("user");
  if (!settings.pass) missing.push("pass");
  if (!settings.database) missing.push("database");
  if (missing.length) {
    throw new Error(`MySQL settings incomplete: ${missing.join(", ")}`);
  }
}

function getPoolSignature(settings) {
  return [
    settings.host,
    settings.port,
    settings.user,
    settings.database,
    settings.ssl ? "ssl" : "no_ssl"
  ].join("|");
}

function buildPool(settings) {
  return mysql.createPool({
    host: settings.host,
    port: Number(settings.port || 3306),
    user: settings.user,
    password: settings.pass,
    database: settings.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(settings.ssl ? { ssl: { rejectUnauthorized: false } } : null)
  });
}

async function getPool(settingsOverride = null) {
  const effective = settingsOverride || (await getActiveMySqlFileDbSettings());
  assertEnabledSettings(effective);

  if (settingsOverride) {
    return buildPool(effective);
  }

  const signature = getPoolSignature(effective);
  if (!pool || poolSignature !== signature) {
    if (pool) {
      try {
        await pool.end();
      } catch (_error) {
        // ignore
      }
    }
    pool = buildPool(effective);
    poolSignature = signature;
  }

  return pool;
}

async function ensureUploadsTable(mysqlPool, tableName) {
  const safeTableName = sanitizeSqlIdentifier(tableName, "file_uploads");
  const ensuredKey = `${poolSignature}:${safeTableName}`;
  if (ensuredTables.has(ensuredKey)) return;

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`${safeTableName}\` (
      id VARCHAR(40) PRIMARY KEY,
      uploaded_by VARCHAR(40) NOT NULL,
      subject_id VARCHAR(40) NOT NULL,
      s3_key VARCHAR(500) NOT NULL,
      file_url VARCHAR(1000) NOT NULL,
      status VARCHAR(20) NOT NULL,
      title VARCHAR(255) NULL,
      description TEXT NULL,
      file_name VARCHAR(255) NULL,
      file_type VARCHAR(120) NULL,
      category VARCHAR(40) NOT NULL,
      feedback TEXT NULL,
      reviewed_by VARCHAR(40) NULL,
      reviewed_at DATETIME NULL,
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      INDEX idx_uploaded_by (uploaded_by),
      INDEX idx_subject_id (subject_id),
      INDEX idx_status (status),
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  ensuredTables.add(ensuredKey);
}

async function testMySqlConnection(settingsOverride = null) {
  const mysqlPool = await getPool(settingsOverride);
  await mysqlPool.query("SELECT 1");
  if (settingsOverride) {
    try {
      await mysqlPool.end();
    } catch (_error) {
      // ignore
    }
  }
  return true;
}

function toDbDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function extractId(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
}

async function upsertUploadRecord(record) {
  const settings = await getActiveMySqlFileDbSettings();
  if (!settings.enabled) return { ok: true, skipped: true };

  const mysqlPool = await getPool(settings);
  await ensureUploadsTable(mysqlPool, settings.tableName);
  const safeTableName = sanitizeSqlIdentifier(settings.tableName, "file_uploads");

  const payload = {
    id: String(extractId(record.id || record._id) || "").trim(),
    uploadedBy: String(extractId(record.uploadedBy) || "").trim(),
    subjectId: String(extractId(record.subjectId) || "").trim(),
    s3Key: String(record.s3Key || "").trim(),
    fileUrl: String(record.fileUrl || "").trim(),
    status: String(record.status || "").trim(),
    title: record.title !== undefined && record.title !== null ? String(record.title) : null,
    description:
      record.description !== undefined && record.description !== null ? String(record.description) : null,
    fileName: record.fileName !== undefined && record.fileName !== null ? String(record.fileName) : null,
    fileType: record.fileType !== undefined && record.fileType !== null ? String(record.fileType) : null,
    category: String(record.category || "").trim(),
    feedback: record.feedback !== undefined && record.feedback !== null ? String(record.feedback) : null,
    reviewedBy:
      record.reviewedBy !== undefined && record.reviewedBy !== null
        ? String(extractId(record.reviewedBy))
        : null,
    reviewedAt: toDbDate(record.reviewedAt),
    createdAt: toDbDate(record.createdAt),
    updatedAt: toDbDate(record.updatedAt)
  };

  if (!payload.id || !payload.uploadedBy || !payload.subjectId || !payload.s3Key || !payload.fileUrl) {
    return { ok: false, skipped: true, reason: "missing_required_fields" };
  }

  const sql = `
    INSERT INTO \`${safeTableName}\`
      (id, uploaded_by, subject_id, s3_key, file_url, status, title, description, file_name, file_type, category, feedback, reviewed_by, reviewed_at, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      uploaded_by = VALUES(uploaded_by),
      subject_id = VALUES(subject_id),
      s3_key = VALUES(s3_key),
      file_url = VALUES(file_url),
      status = VALUES(status),
      title = VALUES(title),
      description = VALUES(description),
      file_name = VALUES(file_name),
      file_type = VALUES(file_type),
      category = VALUES(category),
      feedback = VALUES(feedback),
      reviewed_by = VALUES(reviewed_by),
      reviewed_at = VALUES(reviewed_at),
      updated_at = VALUES(updated_at)
  `;

  await mysqlPool.query(sql, [
    payload.id,
    payload.uploadedBy,
    payload.subjectId,
    payload.s3Key,
    payload.fileUrl,
    payload.status,
    payload.title,
    payload.description,
    payload.fileName,
    payload.fileType,
    payload.category,
    payload.feedback,
    payload.reviewedBy,
    payload.reviewedAt,
    payload.createdAt,
    payload.updatedAt
  ]);

  return { ok: true };
}

async function deleteUploadRecord(uploadId) {
  const settings = await getActiveMySqlFileDbSettings();
  if (!settings.enabled) return { ok: true, skipped: true };

  const id = String(uploadId || "").trim();
  if (!id) return { ok: false, skipped: true, reason: "missing_upload_id" };

  const mysqlPool = await getPool(settings);
  await ensureUploadsTable(mysqlPool, settings.tableName);
  const safeTableName = sanitizeSqlIdentifier(settings.tableName, "file_uploads");
  await mysqlPool.query(`DELETE FROM \`${safeTableName}\` WHERE id = ?`, [id]);
  return { ok: true };
}

module.exports = {
  deleteUploadRecord,
  getActiveMySqlFileDbSettings,
  getEnvMySqlFileDbSettings,
  maskMySqlFileDbSettingsForResponse,
  testMySqlConnection,
  upsertUploadRecord
};
