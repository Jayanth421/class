const https = require("https");
const ApiError = require("../utils/apiError");

function getResendApiKey() {
  return String(process.env.RESEND_API_KEY || "").trim();
}

function getResendFromAddress() {
  return String(process.env.RESEND_FROM || process.env.SMTP_FROM || "").trim();
}

function normalizeEmailList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function resolveMailConfig(overrideConfig = null) {
  const baseConfig = {
    apiKey: getResendApiKey(),
    from: getResendFromAddress()
  };

  if (!overrideConfig) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    ...overrideConfig,
    apiKey: String(overrideConfig.apiKey || baseConfig.apiKey || "").trim(),
    from: String(overrideConfig.from || baseConfig.from || "").trim()
  };
}

function assertResendConfig(config) {
  if (!config.apiKey || !config.from) {
    throw new ApiError(500, "Resend configuration is incomplete", {
      missing: {
        apiKey: !config.apiKey,
        from: !config.from
      }
    });
  }
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(responseBody || "{}");
          } catch (_error) {
            parsed = null;
          }

          resolve({
            statusCode: res.statusCode || 0,
            body: responseBody,
            parsed
          });
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function sendWithResend(payload, smtpConfigOverride = null) {
  const config = resolveMailConfig(smtpConfigOverride);
  assertResendConfig(config);

  const recipients = normalizeEmailList(payload.to);
  if (!recipients.length) {
    throw new ApiError(400, "At least one recipient email is required");
  }

  const body = {
    from: config.from,
    to: recipients,
    subject: payload.subject,
    html: payload.html || payload.text || "",
    text: payload.text || ""
  };

  let response;
  try {
    response = await postJson(
      "https://api.resend.com/emails",
      {
        Authorization: `Bearer ${config.apiKey}`
      },
      body
    );
  } catch (error) {
    throw new ApiError(502, "Failed to send email via Resend", {
      detail: error.message || String(error)
    });
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const detail = response.parsed?.error?.message || response.parsed?.message || response.body || "Resend API request failed";
    throw new ApiError(502, "Failed to send email via Resend", {
      status: response.statusCode,
      detail
    });
  }

  return {
    ok: true,
    id: response.parsed?.id || response.parsed?.message_id || null
  };
}

async function sendMail({ to, subject, text, html, smtpConfig = null }) {
  const payload = {
    to,
    subject,
    text,
    html
  };

  return sendWithResend(payload, smtpConfig);
}

module.exports = {
  sendMail
};
