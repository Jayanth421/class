const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  authorizeSmartboardSessionByFaculty,
  completeFacultySetup,
  completeStudentSetup,
  createSmartboardSession,
  exchangeSmartboardSession,
  forgotPassword,
  getFacultySetupOptions,
  getStudentSetupOptions,
  getSmartboardLibrary,
  login,
  logout,
  refreshAccessToken,
  register,
  resetPassword,
  requestSmartboardOtp,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  verifySmartboardOtp
} = require("../controllers/authController");
const { ROLES } = require("../config/constants");
const authorizeRoles = require("../middlewares/authorizeRoles");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const enableDevLoginRateLimit =
  String(process.env.ENABLE_DEV_LOGIN_RATE_LIMIT || "")
    .trim()
    .toLowerCase() === "true";

const loginLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || (isProduction ? 10 : 1000)),
  skip: () => !isProduction && !enableDevLoginRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts, please try again later."
  }
});

router.post("/register", register);
router.post("/verify-otp", verifyRegistrationOtp);
router.post("/resend-otp", resendRegistrationOtp);
router.post("/student-setup", completeStudentSetup);
router.get("/student-setup/options", getStudentSetupOptions);
router.post("/faculty-setup", completeFacultySetup);
router.get("/faculty-setup/options", getFacultySetupOptions);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/login", loginLimiter, login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

router.post("/smartboard/session", createSmartboardSession);
router.post(
  "/smartboard/authorize",
  verifyJWT,
  authorizeRoles(ROLES.FACULTY, ROLES.ADMIN),
  authorizeSmartboardSessionByFaculty
);
router.post("/smartboard/request-otp", requestSmartboardOtp);
router.post("/smartboard/verify-otp", verifySmartboardOtp);
router.post("/smartboard/exchange", exchangeSmartboardSession);
router.get(
  "/smartboard/library",
  verifyJWT,
  authorizeRoles(ROLES.SMARTBOARD, ROLES.FACULTY, ROLES.ADMIN),
  getSmartboardLibrary
);

module.exports = router;
