const RefreshToken = require("../mongoModels/RefreshToken");

function mapRefreshToken(tokenDoc) {
  if (!tokenDoc) return null;
  return {
    id: tokenDoc.id,
    userId: String(tokenDoc.userId),
    tokenHash: tokenDoc.tokenHash,
    expiresAt: tokenDoc.expiresAt
  };
}

async function saveRefreshToken(userId, tokenHash, expiresAt) {
  return RefreshToken.create({
    userId,
    tokenHash,
    expiresAt
  });
}

async function getRefreshToken(tokenHash) {
  const tokenDoc = await RefreshToken.findOne({ tokenHash }).exec();
  return mapRefreshToken(tokenDoc);
}

async function deleteRefreshToken(tokenHash) {
  return RefreshToken.deleteOne({ tokenHash });
}

async function deleteUserRefreshTokens(userId) {
  return RefreshToken.deleteMany({ userId });
}

module.exports = {
  deleteRefreshToken,
  deleteUserRefreshTokens,
  getRefreshToken,
  saveRefreshToken
};
