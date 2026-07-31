const MailTemplate = require("../mongoModels/MailTemplate");
const DEFAULT_MAIL_TEMPLATES = require("./defaultMailTemplates");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderString(input, vars = {}, options = {}) {
  const template = String(input ?? "");
  if (!template) return "";

  const htmlEscape = Boolean(options.htmlEscape);

  return template.replace(
    /{{{\s*([a-zA-Z0-9_]+)\s*}}}|{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_match, rawKey, escapedKey) => {
      const key = rawKey || escapedKey;
      const value = vars && Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "";
      const stringValue = value === null || value === undefined ? "" : String(value);
      if (rawKey) return stringValue;
      return htmlEscape ? escapeHtml(stringValue) : stringValue;
    }
  );
}

function getDefaultTemplateByKey(key) {
  const normalized = String(key || "").trim().toUpperCase();
  return DEFAULT_MAIL_TEMPLATES.find((item) => item.key === normalized) || null;
}

async function getTemplateByKey(key) {
  const normalized = String(key || "").trim().toUpperCase();
  if (!normalized) return null;
  const doc = await MailTemplate.findOne({ key: normalized }).lean().exec();
  if (!doc) return null;

  return {
    key: doc.key,
    name: doc.name,
    description: doc.description || "",
    subject: doc.subject,
    text: doc.text || "",
    html: doc.html || ""
  };
}

function getAppName() {
  return String(process.env.APP_NAME || "CMR Smart Presentation Portal").trim();
}

function getPortalUrl() {
  return String(process.env.APP_BASE_URL || "").trim();
}

function buildCommonMailVars(extra = {}) {
  return {
    appName: getAppName(),
    portalUrl: getPortalUrl(),
    ...extra
  };
}

async function renderMailTemplateByKey(key, vars = {}) {
  const normalizedKey = String(key || "").trim().toUpperCase();
  if (!normalizedKey) {
    throw new Error("template key is required");
  }

  const stored = await getTemplateByKey(normalizedKey);
  const fallback = getDefaultTemplateByKey(normalizedKey);
  const template = stored || fallback;

  if (!template) {
    throw new Error(`template not found: ${normalizedKey}`);
  }

  const mergedVars = buildCommonMailVars(vars);

  return {
    key: template.key,
    subject: renderString(template.subject, mergedVars, { htmlEscape: false }).trim(),
    text: renderString(template.text || "", mergedVars, { htmlEscape: false }),
    html: renderString(template.html || "", mergedVars, { htmlEscape: true })
  };
}

module.exports = {
  buildCommonMailVars,
  getDefaultTemplateByKey,
  getTemplateByKey,
  renderMailTemplateByKey,
  renderString
};

