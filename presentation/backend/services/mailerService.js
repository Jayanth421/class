const nodemailer = require("nodemailer");
const path = require("path");
const { spawn } = require("child_process");
const ApiError = require("../utils/apiError");

let transporter;
let transporterSignature = "";

const COMMON_SMTP_AUTH_FAILURE_CODES = new Set([535]);
const COMMON_SMTP_CONNECTION_ERROR_CODES = new Set([
  "ECONNECTION",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ESOCKET",
  "EHOSTUNREACH"
]);

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return String(value).toLowerCase() === "true";
}

function getMailProvider() {
  return String(process.env.MAIL_PROVIDER || "node").trim().toLowerCase();
}

function extractSmtpStatusCode(message) {
  const text = String(message || "");
  // Avoid matching ports like ":587" by ensuring the code isn't preceded by ":"
  const match = text.match(/(?:^|[^0-9:])([45]\d{2})(?!\d)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isSmtpAuthFailure({ code, responseCode, message }) {
  if (code === "EAUTH") return true;
  if (COMMON_SMTP_AUTH_FAILURE_CODES.has(Number(responseCode))) return true;

  const text = String(message || "");
  if (!text) return false;
  if (/\b535\b/.test(text)) return true;
  if (/auth(entication)?\s+failed/i.test(text)) return true;
  if (/username and password not accepted/i.test(text)) return true;
  if (/invalid login/i.test(text)) return true;

  return false;
}

function toMailSendApiError(error, provider) {
  if (error instanceof ApiError) return error;

  const originalMessage = String(error?.message || error || "").trim();
  const code = error && typeof error === "object" ? error.code : null;
  const resolvedResponseCode =
    error && typeof error === "object" && Number.isFinite(Number(error.responseCode))
      ? Number(error.responseCode)
      : extractSmtpStatusCode(originalMessage);

  const details = {
    provider,
    ...(code ? { code } : null),
    ...(resolvedResponseCode ? { responseCode: resolvedResponseCode } : null),
    ...(originalMessage ? { originalMessage } : null)
  };

  if (isSmtpAuthFailure({ code, responseCode: resolvedResponseCode, message: originalMessage })) {
    const suffix = resolvedResponseCode ? ` (SMTP ${resolvedResponseCode})` : "";
    return new ApiError(
      502,
      `SMTP authentication failed${suffix}. Check SMTP credentials (for Gmail/Workspace use an App Password).`,
      details
    );
  }

  if (COMMON_SMTP_CONNECTION_ERROR_CODES.has(String(code || "").trim().toUpperCase())) {
    return new ApiError(
      502,
      "Unable to connect to SMTP server. Check SMTP host/port and network access.",
      details
    );
  }

  return new ApiError(502, "Failed to send email.", details);
}

function getSmtpConfig(overrideConfig = null) {
  const baseConfig = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    starttls: toBool(process.env.SMTP_STARTTLS, true),
    timeoutSeconds: Number(process.env.SMTP_TIMEOUT_SECONDS || 20),
    provider: getMailProvider()
  };

  if (!overrideConfig) return baseConfig;

  return {
    ...baseConfig,
    ...overrideConfig,
    port: Number(overrideConfig.port ?? baseConfig.port),
    secure:
      overrideConfig.secure !== undefined
        ? Boolean(overrideConfig.secure)
        : baseConfig.secure,
    starttls:
      overrideConfig.starttls !== undefined
        ? Boolean(overrideConfig.starttls)
        : baseConfig.starttls,
    timeoutSeconds: Number(overrideConfig.timeoutSeconds ?? baseConfig.timeoutSeconds),
    provider: String(overrideConfig.provider || baseConfig.provider || "node")
      .trim()
      .toLowerCase()
  };
}

function assertSmtpConfig(config) {
  if (!config.host || !config.port || !config.user || !config.pass || !config.from) {
    throw new ApiError(500, "SMTP configuration is incomplete");
  }
}

function buildTransporter(smtpConfig) {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    },
    requireTLS: smtpConfig.starttls
  });
}

function getTransporter(smtpConfigOverride = null) {
  const smtpConfig = getSmtpConfig(smtpConfigOverride);
  assertSmtpConfig(smtpConfig);

  if (smtpConfigOverride) {
    return buildTransporter(smtpConfig);
  }

  const signature = `${smtpConfig.host}:${smtpConfig.port}:${smtpConfig.user}:${smtpConfig.secure}:${smtpConfig.starttls}`;
  if (!transporter || transporterSignature !== signature) {
    transporter = buildTransporter(smtpConfig);
    transporterSignature = signature;
  }

  return transporter;
}

function sendWithPythonMailer(payload, smtpConfigOverride = null) {
  const smtpConfig = getSmtpConfig(smtpConfigOverride);
  assertSmtpConfig(smtpConfig);

  const pythonBin =
    process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  const scriptPath =
    process.env.PYTHON_MAIL_SCRIPT || path.join(__dirname, "..", "scripts", "send_mail.py");

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        toMailSendApiError(
          new ApiError(502, "Failed to execute Python mailer", {
            error: error.message
          }),
          "python"
        )
      );
    });

    child.on("close", (code) => {
      const trimmedStdout = (stdout || "").trim();
      const trimmedStderr = (stderr || "").trim();

      if (code !== 0) {
        let parsedFailure = null;
        try {
          parsedFailure = JSON.parse(trimmedStdout || "{}");
        } catch (_error) {
          parsedFailure = null;
        }

        const failureMessage = String(
          parsedFailure?.error || trimmedStderr || trimmedStdout || `exit_code_${code}`
        ).trim();

        reject(toMailSendApiError({ message: failureMessage }, "python"));
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(trimmedStdout || "{}");
      } catch (error) {
        reject(new ApiError(502, "Python mailer returned invalid JSON"));
        return;
      }

      if (!parsed.ok) {
        reject(toMailSendApiError({ message: parsed.error || "unknown_error" }, "python"));
        return;
      }

      resolve(parsed);
    });

    child.stdin.write(
      JSON.stringify({
        smtp: smtpConfig,
        message: payload
      })
    );
    child.stdin.end();
  });
}

async function sendMail({ to, subject, text, html, smtpConfig = null }) {
  const smtpConfigOverride = smtpConfig;
  const effectiveSmtpConfig = getSmtpConfig(smtpConfigOverride);
  const payload = {
    from: effectiveSmtpConfig.from,
    to,
    subject,
    text,
    html
  };

  if (effectiveSmtpConfig.provider === "python") {
    return sendWithPythonMailer(payload, effectiveSmtpConfig);
  }

  try {
    const smtp = getTransporter(smtpConfigOverride);
    return await smtp.sendMail(payload);
  } catch (error) {
    throw toMailSendApiError(error, "node");
  }
}

module.exports = {
  sendMail
};
