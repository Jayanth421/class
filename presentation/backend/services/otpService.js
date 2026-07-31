const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { Types } = require("mongoose");
const { OTP_PURPOSES } = require("../config/constants");
const ApiError = require("../utils/apiError");
const {
  createOtp,
  getLatestActiveOtp,
  markOtpUsed,
  revokeActiveOtps
} = require("../models/otpModel");
const { sendMail } = require("./mailerService");
const { getActiveMailSettings } = require("./mailSettingsService");
const { renderMailTemplateByKey } = require("./mailTemplateRenderer");
const User = require("../mongoModels/User");

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getOtpPolicy() {
  const expiryMinutes = Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES || 5));
  const resendCooldownSeconds = Math.max(
    0,
    Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60)
  );
  return { expiryMinutes, resendCooldownSeconds };
}

function buildExpiryDate(expiryMinutes) {
  return new Date(Date.now() + expiryMinutes * 60 * 1000);
}

function getRemainingCooldownSeconds(createdAt, cooldownSeconds) {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  return Math.max(0, cooldownSeconds - elapsed);
}

function deriveRecipientName(email) {
  const localPart = String(email || "").split("@")[0] || "";
  const sanitized = localPart.replace(/[^a-zA-Z0-9]/g, " ").trim();
  return sanitized || "User";
}

function buildActionUrl({ purpose, email }) {
  const portalUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (!portalUrl) return "";

  const encodedEmail = encodeURIComponent(String(email || "").trim());
  if (purpose === OTP_PURPOSES.PASSWORD_RESET) {
    return `${portalUrl}/forgot-password?email=${encodedEmail}`;
  }

  if (purpose === OTP_PURPOSES.REGISTRATION) {
    return `${portalUrl}/verify-otp?email=${encodedEmail}`;
  }

  return portalUrl;
}

async function createAndSendOtp({
  email,
  userId = null,
  purpose = OTP_PURPOSES.REGISTRATION,
  contextToken = null
}) {
  const { expiryMinutes, resendCooldownSeconds } = getOtpPolicy();
  const latestActiveOtp = await getLatestActiveOtp({ email, purpose, contextToken });
  if (latestActiveOtp && resendCooldownSeconds > 0) {
    const retryAfterSeconds = getRemainingCooldownSeconds(
      latestActiveOtp.createdAt,
      resendCooldownSeconds
    );
    if (retryAfterSeconds > 0) {
      throw new ApiError(429, "OTP requested too frequently. Please try again shortly.", {
        retryAfterSeconds
      });
    }
  }

  const otp = generateOtpCode();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = buildExpiryDate(expiryMinutes);

  await revokeActiveOtps({ email, purpose, contextToken });
  await createOtp({
    email,
    userId,
    otpHash,
    purpose,
    contextToken,
    expiresAt
  });

  let name = deriveRecipientName(email);
  if (userId && Types.ObjectId.isValid(String(userId))) {
    const userDoc = await User.findById(userId).select("name").lean().exec();
    if (userDoc?.name) {
      name = String(userDoc.name).trim() || name;
    }
  }

  const actionUrl = buildActionUrl({ purpose, email });
  const templateKey = purpose === OTP_PURPOSES.PASSWORD_RESET ? "PASSWORD_RESET_OTP" : "OTP_VERIFICATION";
  const rendered = await renderMailTemplateByKey(templateKey, {
    name,
    otp,
    expiryMinutes,
    actionUrl,
    purpose
  });

  const mailSettings = await getActiveMailSettings();
  await sendMail({
    to: email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    smtpConfig: mailSettings
  });

  return { expiresAt };
}

async function verifyOtp({ email, otp, purpose, contextToken = null }) {
  const record = await getLatestActiveOtp({ email, purpose, contextToken });
  if (!record) {
    return { valid: false, reason: "OTP_NOT_FOUND" };
  }

  if (record.usedAt) {
    return { valid: false, reason: "OTP_USED" };
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: "OTP_EXPIRED" };
  }

  const isMatch = await bcrypt.compare(String(otp), record.otpHash);
  if (!isMatch) {
    return { valid: false, reason: "OTP_INVALID" };
  }

  await markOtpUsed(record.id);
  return { valid: true, userId: record.userId };
}

module.exports = {
  createAndSendOtp,
  verifyOtp
};
