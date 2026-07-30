const nodemailer = require("nodemailer");
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const SmtpSetting = require("../mongoModels/SmtpSetting");
const ApiError = require("../utils/apiError");

let transporter;
let transporterSignature = "";

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return String(value).toLowerCase() === "true";
}

function isPlaceholderValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "example.com" ||
    normalized === "smtp.example.com" ||
    normalized === "your_smtp_user" ||
    normalized === "your_smtp_password" ||
    normalized.includes("replace_with") ||
    normalized.includes("<")
  );
}

function getMailProvider() {
  return String(process.env.MAIL_PROVIDER || "node").trim().toLowerCase();
}

function getEnvSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "",
    starttls: toBool(process.env.SMTP_STARTTLS, true),
    timeoutSeconds: Number(process.env.SMTP_TIMEOUT_SECONDS || 20),
    provider: getMailProvider()
  };
}

function mergeSmtpConfig(baseConfig, overrideConfig = null) {
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

function getSmtpConfig(overrideConfig = null) {
  const baseConfig = getEnvSmtpConfig();
  return mergeSmtpConfig(baseConfig, overrideConfig);
}

async function getActiveSmtpConfig(overrideConfig = null) {
  const envConfig = getEnvSmtpConfig();
  let storedConfig = null;

  try {
    if (mongoose.connection.readyState === 1) {
      const saved = await SmtpSetting.findOne({ key: "default" }).lean().exec();
      if (saved) {
        storedConfig = {
          provider: String(saved.provider || envConfig.provider || "node").trim().toLowerCase(),
          host: String(saved.host || envConfig.host || "").trim(),
          port: Number(saved.port || envConfig.port || 587),
          secure: Boolean(saved.secure ?? envConfig.secure),
          starttls: saved.starttls === undefined ? envConfig.starttls : Boolean(saved.starttls),
          timeoutSeconds: Number(saved.timeoutSeconds || envConfig.timeoutSeconds || 20),
          user: String(saved.user || envConfig.user || "").trim(),
          pass: String(saved.pass || envConfig.pass || "").trim(),
          apiKey: String(saved.apiKey || envConfig.apiKey || "").trim(),
          from: String(saved.from || envConfig.from || "").trim()
        };
      }
    }
  } catch (_error) {
    storedConfig = null;
  }

  const baseConfig = storedConfig ? mergeSmtpConfig(envConfig, storedConfig) : envConfig;
  return mergeSmtpConfig(baseConfig, overrideConfig);
}

function assertSmtpConfig(config) {
  if (config.provider === "resend") {
    if (!config.apiKey || !config.from) {
      throw new ApiError(500, "Resend API key and from address are required");
    }
    return;
  }

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

async function getTransporter(smtpConfigOverride = null) {
  const smtpConfig = await getActiveSmtpConfig(smtpConfigOverride);
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

async function sendWithPythonMailer(payload, smtpConfigOverride = null) {
  const smtpConfig = await getActiveSmtpConfig(smtpConfigOverride);
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
        new ApiError(502, "Failed to execute Python mailer", {
          error: error.message
        })
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new ApiError(502, "Python mailer exited with an error", {
            stderr: (stderr || stdout || "").trim() || `exit_code_${code}`
          })
        );
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse((stdout || "").trim() || "{}");
      } catch (error) {
        reject(new ApiError(502, "Python mailer returned invalid JSON"));
        return;
      }

      if (!parsed.ok) {
        reject(
          new ApiError(502, "Python mailer could not send email", {
            error: parsed.error || "unknown_error"
          })
        );
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

async function sendWithResend(payload, smtpConfigOverride = null) {
  const smtpConfig = await getActiveSmtpConfig(smtpConfigOverride);
  assertSmtpConfig(smtpConfig);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${smtpConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: smtpConfig.from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      text: payload.text || "",
      html: payload.html || ""
    })
  });

  let parsed;
  try {
    parsed = await response.json();
  } catch (_error) {
    parsed = null;
  }

  if (!response.ok) {
    const detail = parsed?.message || "Resend API request failed";
    throw new ApiError(502, "Failed to send email via Resend", {
      status: response.status,
      detail
    });
  }

  return { ok: true, id: parsed?.id || null };
}

async function sendMail({ to, subject, text, html, smtpConfig = null }) {
  const smtpConfigOverride = smtpConfig;
  const effectiveSmtpConfig = await getActiveSmtpConfig(smtpConfigOverride);
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

  if (effectiveSmtpConfig.provider === "resend") {
    return sendWithResend(payload, effectiveSmtpConfig);
  }

  const smtp = await getTransporter(smtpConfigOverride);
  return smtp.sendMail(payload);
}

module.exports = {
  sendMail
};
