const SmtpSetting = require("../mongoModels/SmtpSetting");

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return String(value).trim().toLowerCase() === "true";
}

function getEnvMailSettings() {
  return {
    provider: String(process.env.MAIL_PROVIDER || "node").trim().toLowerCase(),
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    starttls: toBool(process.env.SMTP_STARTTLS, true),
    timeoutSeconds: Number(process.env.SMTP_TIMEOUT_SECONDS || 20),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || ""
  };
}

async function getActiveMailSettings() {
  const envSettings = getEnvMailSettings();
  const saved = await SmtpSetting.findOne({ key: "default" }).lean().exec();
  if (!saved) return envSettings;

  return {
    provider: saved.provider || envSettings.provider,
    host: saved.host || envSettings.host,
    port: Number(saved.port || envSettings.port || 587),
    secure: Boolean(saved.secure),
    starttls: saved.starttls === undefined ? envSettings.starttls : Boolean(saved.starttls),
    timeoutSeconds: Number(saved.timeoutSeconds || envSettings.timeoutSeconds || 20),
    user: saved.user || envSettings.user,
    pass: saved.pass || envSettings.pass,
    from: saved.from || envSettings.from
  };
}

function sanitizeMailSettingsForResponse(settings) {
  return {
    ...settings,
    pass: settings.pass ? "********" : ""
  };
}

module.exports = {
  getActiveMailSettings,
  getEnvMailSettings,
  sanitizeMailSettingsForResponse
};

