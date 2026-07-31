const jwt = require("jsonwebtoken");

const accessSecret = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me";
const uploadSecret = process.env.JWT_UPLOAD_SECRET || accessSecret;
const accessExpires = process.env.JWT_ACCESS_EXPIRES || "1h";
const refreshExpires = process.env.JWT_REFRESH_EXPIRES || "30d";
const uploadExpires = process.env.JWT_UPLOAD_EXPIRES || "15m";

function signAccessToken(payload) {
  return jwt.sign(payload, accessSecret, { expiresIn: accessExpires });
}

function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: "refresh" }, refreshSecret, {
    expiresIn: refreshExpires
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, accessSecret);
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, refreshSecret);
  if (decoded.type !== "refresh") {
    throw new Error("Invalid refresh token type");
  }
  return decoded;
}

function signUploadToken(payload) {
  return jwt.sign({ ...payload, type: "upload" }, uploadSecret, { expiresIn: uploadExpires });
}

function verifyUploadToken(token) {
  const decoded = jwt.verify(token, uploadSecret);
  if (decoded.type !== "upload") {
    throw new Error("Invalid upload token type");
  }
  return decoded;
}

function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  decodeToken,
  signAccessToken,
  signRefreshToken,
  signUploadToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyUploadToken
};
