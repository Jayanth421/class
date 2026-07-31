const { verifyAccessToken } = require("../config/jwt");
const ApiError = require("../utils/apiError");

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing or invalid Authorization header"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    return next();
  } catch (error) {
    return next(new ApiError(401, "Invalid or expired access token"));
  }
}

module.exports = verifyJWT;
