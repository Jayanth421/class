const OtpCode = require("../mongoModels/OtpCode");

function mapOtpRecord(otpDoc) {
  if (!otpDoc) return null;

  return {
    id: otpDoc.id,
    email: otpDoc.email,
    userId: otpDoc.userId ? String(otpDoc.userId) : null,
    otpHash: otpDoc.otpHash,
    purpose: otpDoc.purpose,
    contextToken: otpDoc.contextToken,
    expiresAt: otpDoc.expiresAt,
    usedAt: otpDoc.usedAt,
    createdAt: otpDoc.createdAt
  };
}

async function createOtp({
  email,
  userId = null,
  otpHash,
  purpose,
  contextToken = null,
  expiresAt
}) {
  return OtpCode.create({
    email,
    userId,
    otpHash,
    purpose,
    contextToken,
    expiresAt
  });
}

async function getLatestActiveOtp({ email, purpose, contextToken = null }) {
  const filter = {
    email,
    purpose,
    usedAt: null
  };

  if (contextToken !== null && contextToken !== undefined) {
    filter.contextToken = contextToken;
  }

  const otpDoc = await OtpCode.findOne(filter).sort({ createdAt: -1 }).exec();
  return mapOtpRecord(otpDoc);
}

async function markOtpUsed(id) {
  return OtpCode.updateOne({ _id: id }, { $set: { usedAt: new Date() } });
}

async function revokeActiveOtps({ email, purpose, contextToken = null }) {
  const filter = {
    email,
    purpose,
    usedAt: null
  };

  if (contextToken !== null && contextToken !== undefined) {
    filter.contextToken = contextToken;
  }

  return OtpCode.updateMany(filter, { $set: { usedAt: new Date() } });
}

module.exports = {
  createOtp,
  getLatestActiveOtp,
  markOtpUsed,
  revokeActiveOtps
};
