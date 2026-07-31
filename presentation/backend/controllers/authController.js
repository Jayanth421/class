const bcrypt = require("bcrypt");
const os = require("os");
const { Types } = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { decodeToken, signAccessToken, signRefreshToken, verifyRefreshToken } = require("../config/jwt");
const {
  OTP_PURPOSES,
  ROLES,
  SMARTBOARD_SESSION_STATUS
} = require("../config/constants");
const {
  createUser,
  getUserByEmail,
  getUserByLoginIdentifier,
  getUserById,
  markUserLogin,
  markUserAsVerified,
  updateStudentSetup,
  updatePendingUser,
  updateUserPassword
} = require("../models/userModel");
const {
  deleteUserRefreshTokens,
  deleteRefreshToken,
  getRefreshToken,
  saveRefreshToken
} = require("../models/refreshTokenModel");
const {
  authorizeSession,
  consumeSession,
  createSession,
  expireSession,
  getSessionByToken
} = require("../models/smartboardSessionModel");
const { assignFacultyClasses, getFacultyClasses } = require("../models/facultyClassModel");
const { getSubjectsByFacultyId } = require("../models/subjectModel");
const Class = require("../mongoModels/Class");
const Department = require("../mongoModels/Department");
const SmartboardSession = require("../mongoModels/SmartboardSession");
const Subject = require("../mongoModels/Subject");
const Upload = require("../mongoModels/Upload");
const User = require("../mongoModels/User");
const { createAndSendOtp, verifyOtp } = require("../services/otpService");
const { getActiveMailSettings } = require("../services/mailSettingsService");
const { renderMailTemplateByKey } = require("../services/mailTemplateRenderer");
const { generateQrDataUrl } = require("../services/qrService");
const { createPresignedDownloadUrl } = require("../services/s3Service");
const { sendMail } = require("../services/mailerService");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { hashToken } = require("../utils/crypto");
const { normalizeEmail, validateEmailByRole } = require("../utils/emailRules");

function mapOtpReasonToError(reason) {
  if (reason === "OTP_EXPIRED") return new ApiError(410, "OTP expired");
  if (reason === "OTP_INVALID") return new ApiError(400, "Invalid OTP");
  if (reason === "OTP_USED") return new ApiError(400, "OTP already used");
  return new ApiError(400, "OTP not found");
}

const MAX_PROFILE_PHOTO_LENGTH = 3_000_000;
const STUDENT_DEFAULT_NAME = "Student";
const STUDENT_ROLL_NUMBER_REGEX = /^[A-Za-z0-9][A-Za-z0-9-]{4,19}$/;
const SMARTBOARD_FILE_URL_EXPIRES_SECONDS = 4 * 60 * 60;
const COLLEGE_EMAIL_DOMAIN_REGEX = /^[^\s@]+@cmrcet\.ac\.in$/i;

async function resolveSmartboardFileUrl(uploadDoc) {
  if (!uploadDoc?.s3Key) return uploadDoc?.fileUrl || null;
  try {
    return await createPresignedDownloadUrl({
      key: uploadDoc.s3Key,
      expiresIn: SMARTBOARD_FILE_URL_EXPIRES_SECONDS
    });
  } catch (error) {
    return uploadDoc?.fileUrl || null;
  }
}

function deriveStudentName(email) {
  const localPart = String(email || "").split("@")[0] || "";
  const sanitized = localPart.replace(/[^a-zA-Z0-9]/g, " ").trim();
  return sanitized || STUDENT_DEFAULT_NAME;
}

function tryReadOrigin(value) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate === "null") return "";
  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch (_error) {
    return "";
  }
}

function isPlaceholderHost(origin) {
  const host = String(origin || "").toLowerCase();
  return (
    host.includes("your-frontend-domain.com") ||
    host.includes("example.com") ||
    host.includes("<")
  );
}

function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = String(parsed.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch (_error) {
    return false;
  }
}

function getLanIpv4Address() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces || {})) {
    for (const entry of entries || []) {
      if (!entry) continue;
      if (entry.family !== "IPv4" || entry.internal) continue;
      const ip = String(entry.address || "");
      if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(ip)) {
        return ip;
      }
    }
  }
  return "";
}

function derivePortFromOrigin(origin, fallback = "5173") {
  try {
    const parsed = new URL(String(origin || "").trim());
    return parsed.port || fallback;
  } catch (_error) {
    return fallback;
  }
}

function convertLocalOriginToLan(origin, portFallback = "5173") {
  const safeOrigin = tryReadOrigin(origin);
  if (!safeOrigin || !isLocalOrigin(safeOrigin)) {
    return safeOrigin;
  }

  const lanIp = getLanIpv4Address();
  if (!lanIp) {
    return safeOrigin;
  }

  const port = derivePortFromOrigin(safeOrigin, portFallback);
  return `http://${lanIp}:${port}`;
}

function resolveSmartboardActionBase(req) {
  const explicitActionBase = tryReadOrigin(
    process.env.SMARTBOARD_ACTION_BASE_URL || process.env.SMARTBOARD_PUBLIC_BASE_URL
  );
  if (explicitActionBase && !isPlaceholderHost(explicitActionBase)) {
    return explicitActionBase;
  }

  const requestOrigin =
    tryReadOrigin(req.get("origin")) ||
    tryReadOrigin(req.get("referer"));
  // Prefer the requesting frontend origin (e.g. smartboard UI) so the QR opens the app domain,
  // even when APP_BASE_URL/CORS_ORIGINS are configured for the API domain.
  if (requestOrigin && !isPlaceholderHost(requestOrigin)) {
    return convertLocalOriginToLan(requestOrigin);
  }

  const configuredAppBase = tryReadOrigin(process.env.APP_BASE_URL);
  if (configuredAppBase && !isPlaceholderHost(configuredAppBase)) {
    return convertLocalOriginToLan(configuredAppBase);
  }

  const firstCorsOrigin = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => tryReadOrigin(item))
    .find(Boolean);
  if (firstCorsOrigin && !isPlaceholderHost(firstCorsOrigin)) {
    return convertLocalOriginToLan(firstCorsOrigin);
  }

  const forwardedHost = String(req.get("x-forwarded-host") || req.get("host") || "").trim();
  if (forwardedHost) {
    const forwardedProto = String(req.get("x-forwarded-proto") || req.protocol || "http")
      .split(",")[0]
      .trim();
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;
    return convertLocalOriginToLan(forwardedOrigin);
  }

  const lanIp = getLanIpv4Address();
  if (lanIp) {
    const appBase = tryReadOrigin(process.env.APP_BASE_URL);
    const corsBase = String(process.env.CORS_ORIGINS || "")
      .split(",")
      .map((item) => tryReadOrigin(item))
      .find(Boolean);
    const source = appBase || corsBase || requestOrigin || "http://localhost:5173";
    const port = derivePortFromOrigin(source, "5173");
    return `http://${lanIp}:${port}`;
  }

  return "http://localhost:5173";
}

const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    role = ROLES.STUDENT,
    classId = null,
    classIds = []
  } = req.body;

  const normalizedName = String(name || "").trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = String(role || ROLES.STUDENT).toUpperCase();
  const normalizedClassId =
    classId === null || classId === undefined || classId === ""
      ? null
      : String(classId).trim();
  const normalizedClassIds = Array.isArray(classIds)
    ? classIds
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  if (!normalizedEmail || !password) {
    throw new ApiError(400, "email and password are required");
  }

  if (![ROLES.STUDENT, ROLES.FACULTY].includes(normalizedRole)) {
    throw new ApiError(400, "Only STUDENT or FACULTY can self-register");
  }

  if (!validateEmailByRole(normalizedEmail, normalizedRole)) {
    throw new ApiError(400, "Email does not match institutional format for role");
  }

  if (String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  if (normalizedClassId !== null && !Types.ObjectId.isValid(normalizedClassId)) {
    throw new ApiError(400, "classId must be a valid id");
  }

  if (
    normalizedRole === ROLES.FACULTY &&
    normalizedClassIds.some((item) => !Types.ObjectId.isValid(item))
  ) {
    throw new ApiError(400, "classIds must contain valid ids");
  }

  if (normalizedRole === ROLES.FACULTY && !normalizedName) {
    throw new ApiError(400, "name is required for faculty registration");
  }

  const effectiveName =
    normalizedName ||
    (normalizedRole === ROLES.STUDENT
      ? deriveStudentName(normalizedEmail)
      : normalizedEmail.split("@")[0] || STUDENT_DEFAULT_NAME);
  const passwordHash = await bcrypt.hash(String(password), 12);
  const existingUser = await getUserByEmail(normalizedEmail);

  let userId;
  if (existingUser?.isVerified) {
    throw new ApiError(409, "Email already registered");
  }

  if (existingUser && !existingUser.isVerified) {
    const pendingUpdate = {
      name: effectiveName,
      passwordHash,
      role: normalizedRole
    };
    if (normalizedClassId !== null) {
      pendingUpdate.classId = normalizedClassId;
    }

    await updatePendingUser(existingUser.id, {
      ...pendingUpdate
    });
    userId = existingUser.id;
  } else {
    const createResult = await createUser({
      name: effectiveName,
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole,
      classId: normalizedClassId,
      isVerified: false
    });
    userId = createResult.insertId;
  }

  if (normalizedRole === ROLES.FACULTY && normalizedClassIds.length) {
    await assignFacultyClasses(userId, normalizedClassIds);
  }

  await createAndSendOtp({
    email: normalizedEmail,
    userId,
    purpose: OTP_PURPOSES.REGISTRATION
  });

  res.status(201).json({
    message: "Account created. OTP sent to email.",
    email: normalizedEmail,
    otpExpiresInMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5)
  });
});

const verifyRegistrationOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) {
    throw new ApiError(400, "email and otp are required");
  }

  const otpResult = await verifyOtp({
    email: normalizedEmail,
    otp,
    purpose: OTP_PURPOSES.REGISTRATION
  });

  if (!otpResult.valid) throw mapOtpReasonToError(otpResult.reason);

  const user = await getUserByEmail(normalizedEmail);
  if (!user) throw new ApiError(404, "User not found");

  await markUserAsVerified(user.id);

  try {
    const mailSettings = await getActiveMailSettings();
    const rendered = await renderMailTemplateByKey("WELCOME_EMAIL", {
      name: user.name || "User"
    });
    await sendMail({
      to: normalizedEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      smtpConfig: mailSettings
    });
  } catch (error) {
    console.warn("Welcome email send failed:", error?.message || String(error));
  }

  res.status(200).json({
    message: "Account verified successfully"
  });
});

const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new ApiError(400, "email is required");

  const user = await getUserByEmail(normalizedEmail);
  if (!user) throw new ApiError(404, "User not found");
  if (user.isVerified) throw new ApiError(409, "Account is already verified");

  await createAndSendOtp({
    email: normalizedEmail,
    userId: user.id,
    purpose: OTP_PURPOSES.REGISTRATION
  });

  res.status(200).json({
    message: "OTP resent successfully"
  });
});

const completeStudentSetup = asyncHandler(async (req, res) => {
  const { email, rollNumber, name, year, branch, section, mobile, profilePhoto } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const normalizedRollNumber = String(rollNumber || "").trim().toUpperCase();
  const normalizedName = String(name || "").trim();
  const normalizedYear =
    year === null || year === undefined || year === "" ? null : Number(year);
  const normalizedBranch = String(branch || "").trim().toUpperCase();
  const normalizedSection = String(section || "").trim().toUpperCase();
  const normalizedMobile = String(mobile || "").replace(/\D/g, "");
  const normalizedProfilePhoto = String(profilePhoto || "").trim();

  if (
    !normalizedEmail ||
    !normalizedRollNumber ||
    !normalizedName ||
    !normalizedBranch ||
    !normalizedSection ||
    !normalizedMobile ||
    normalizedYear === null
  ) {
    throw new ApiError(
      400,
      "email, rollNumber, name, year, branch, section, and mobile are required"
    );
  }

  if (!STUDENT_ROLL_NUMBER_REGEX.test(normalizedRollNumber)) {
    throw new ApiError(
      400,
      "Roll number must be 5-20 characters (letters, numbers, hyphen)"
    );
  }

  if (!Number.isInteger(normalizedYear) || normalizedYear < 1 || normalizedYear > 10) {
    throw new ApiError(400, "Student year must be an integer between 1 and 10");
  }

  const department = await Department.findOne({ code: normalizedBranch })
    .select("_id code")
    .lean()
    .exec();
  if (!department?._id) {
    throw new ApiError(400, "Selected department does not exist");
  }

  const classDoc = await Class.findOne({
    departmentId: department._id,
    year: normalizedYear,
    section: normalizedSection
  })
    .select("_id year section")
    .lean()
    .exec();

  if (!classDoc?._id) {
    throw new ApiError(400, "Selected class/section does not exist for this department and year");
  }

  if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
    throw new ApiError(400, "Mobile must be a valid 10-digit number");
  }

  if (normalizedProfilePhoto) {
    if (!normalizedProfilePhoto.startsWith("data:image/")) {
      throw new ApiError(400, "Profile photo must be an image");
    }

    if (normalizedProfilePhoto.length > MAX_PROFILE_PHOTO_LENGTH) {
      throw new ApiError(400, "Profile photo is too large");
    }
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user || user.role !== ROLES.STUDENT) {
    throw new ApiError(404, "Student account not found");
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Verify account OTP before setup");
  }

  try {
    await updateStudentSetup(user.id, {
      rollNumber: normalizedRollNumber,
      name: normalizedName,
      year: classDoc.year,
      branch: department.code,
      section: classDoc.section,
      mobile: normalizedMobile,
      profilePhoto: normalizedProfilePhoto || null,
      classId: String(classDoc._id)
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.rollNumber) {
      throw new ApiError(409, "Roll number already exists");
    }
    throw error;
  }

  const updatedUser = await getUserById(user.id);
  res.status(200).json({
    message: "Student profile setup completed",
    user: {
      id: updatedUser.id,
      rollNumber: updatedUser.rollNumber,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      year: updatedUser.year,
      branch: updatedUser.branch,
      section: updatedUser.section,
      mobile: updatedUser.mobile,
      profilePhoto: updatedUser.profilePhoto,
      classId: updatedUser.classId || null
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, identifier, password, role = null } = req.body;
  const normalizedIdentifier = String(identifier || email || "").trim();
  const normalizedRole = role ? String(role).toUpperCase() : null;

  if (!normalizedIdentifier || !password) {
    throw new ApiError(400, "identifier (email or ID) and password are required");
  }

  const user = await getUserByLoginIdentifier(normalizedIdentifier);
  if (!user || !user.passwordHash) {
    throw new ApiError(401, "Invalid credentials");
  }
  if (normalizedRole && user.role !== normalizedRole) {
    throw new ApiError(403, `This account is not registered for ${normalizedRole} login`);
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Account is not verified");
  }

  if (user.role === ROLES.SMARTBOARD) {
    throw new ApiError(403, "Smartboard accounts cannot use password login");
  }

  const validPassword = await bcrypt.compare(String(password), user.passwordHash);
  if (!validPassword) throw new ApiError(401, "Invalid credentials");

  const payload = { userId: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const decodedRefresh = decodeToken(refreshToken);

  await saveRefreshToken(
    user.id,
    hashToken(refreshToken),
    new Date(decodedRefresh.exp * 1000)
  );
  await markUserLogin(user.id);

  res.status(200).json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rollNumber: user.rollNumber,
      year: user.year,
      branch: user.branch,
      section: user.section,
      mobile: user.mobile,
      profilePhoto: user.profilePhoto,
      classId: user.classId
    }
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new ApiError(400, "email is required");
  }

  if (!COLLEGE_EMAIL_DOMAIN_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, "Use your college email ID only");
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user || !user.isVerified || user.role === ROLES.SMARTBOARD) {
    return res.status(200).json({
      message: "If the account exists, a reset OTP has been sent to email."
    });
  }

  await createAndSendOtp({
    email: normalizedEmail,
    userId: user.id,
    purpose: OTP_PURPOSES.PASSWORD_RESET
  });

  return res.status(200).json({
    message: "Password reset OTP sent to email."
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp || !newPassword) {
    throw new ApiError(400, "email, otp, and newPassword are required");
  }

  if (!COLLEGE_EMAIL_DOMAIN_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, "Use your college email ID only");
  }

  if (String(newPassword).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.SMARTBOARD) {
    throw new ApiError(403, "Smartboard accounts cannot reset password here");
  }

  const otpResult = await verifyOtp({
    email: normalizedEmail,
    otp,
    purpose: OTP_PURPOSES.PASSWORD_RESET
  });

  if (!otpResult.valid) {
    throw mapOtpReasonToError(otpResult.reason);
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await updateUserPassword(user.id, passwordHash);
  await deleteUserRefreshTokens(user.id);

  return res.status(200).json({
    message: "Password reset successful. Please sign in."
  });
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, "refreshToken is required");

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const storedToken = await getRefreshToken(hashToken(refreshToken));
  if (!storedToken) throw new ApiError(401, "Refresh token revoked");

  if (new Date(storedToken.expiresAt).getTime() < Date.now()) {
    await deleteRefreshToken(hashToken(refreshToken));
    throw new ApiError(401, "Refresh token expired");
  }

  const user = await getUserById(decoded.userId);
  if (!user) throw new ApiError(401, "User not found");

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role
  });

  res.status(200).json({ accessToken });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await deleteRefreshToken(hashToken(refreshToken));
  }
  res.status(204).send();
});

const createSmartboardSession = asyncHandler(async (req, res) => {
  const { smartboardName = null } = req.body;
  const sessionToken = uuidv4();
  const expiryMinutes = Number(process.env.SMARTBOARD_QR_EXPIRES_MINUTES || 2);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await createSession({
    sessionToken,
    smartboardName,
    expiresAt
  });

  const actionBase = resolveSmartboardActionBase(req);
  const qrActionUrl = `${String(actionBase).replace(/\/$/, "")}/smartboard/authorize?token=${encodeURIComponent(sessionToken)}`;
  const qrDataUrl = await generateQrDataUrl(qrActionUrl);

  res.status(201).json({
    sessionToken,
    smartboardName,
    expiresAt,
    qrActionUrl,
    qrDataUrl
  });
});

const authorizeSmartboardSessionByFaculty = asyncHandler(async (req, res) => {
  const { sessionToken } = req.body;
  if (!sessionToken) throw new ApiError(400, "sessionToken is required");

  const session = await getSessionByToken(sessionToken);
  if (!session) throw new ApiError(404, "Smartboard session not found");

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await expireSession(sessionToken);
    throw new ApiError(410, "Smartboard session expired");
  }

  if (session.status !== SMARTBOARD_SESSION_STATUS.PENDING) {
    throw new ApiError(409, "Smartboard session already processed");
  }

  await authorizeSession(sessionToken, req.user.userId);

  res.status(200).json({
    message: "Smartboard authorized successfully"
  });
});

const requestSmartboardOtp = asyncHandler(async (req, res) => {
  const { sessionToken, facultyEmail } = req.body;
  const normalizedEmail = normalizeEmail(facultyEmail);

  if (!sessionToken || !normalizedEmail) {
    throw new ApiError(400, "sessionToken and facultyEmail are required");
  }

  if (!validateEmailByRole(normalizedEmail, ROLES.FACULTY)) {
    throw new ApiError(400, "Invalid faculty email format");
  }

  const faculty = await getUserByEmail(normalizedEmail);
  if (!faculty || faculty.role !== ROLES.FACULTY || !faculty.isVerified) {
    throw new ApiError(404, "Faculty account not found or not verified");
  }

  const session = await getSessionByToken(sessionToken);
  if (!session) throw new ApiError(404, "Smartboard session not found");

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await expireSession(sessionToken);
    throw new ApiError(410, "Smartboard session expired");
  }

  if (session.status !== SMARTBOARD_SESSION_STATUS.PENDING) {
    throw new ApiError(409, "Session is not pending authorization");
  }

  await createAndSendOtp({
    email: normalizedEmail,
    userId: faculty.id,
    purpose: OTP_PURPOSES.SMARTBOARD_LOGIN,
    contextToken: sessionToken
  });

  res.status(200).json({
    message: "Smartboard OTP sent to faculty email"
  });
});

const verifySmartboardOtp = asyncHandler(async (req, res) => {
  const { sessionToken, facultyEmail, otp } = req.body;
  const normalizedEmail = normalizeEmail(facultyEmail);

  if (!sessionToken || !normalizedEmail || !otp) {
    throw new ApiError(400, "sessionToken, facultyEmail, and otp are required");
  }

  const session = await getSessionByToken(sessionToken);
  if (!session) throw new ApiError(404, "Smartboard session not found");

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await expireSession(sessionToken);
    throw new ApiError(410, "Smartboard session expired");
  }

  if (session.status !== SMARTBOARD_SESSION_STATUS.PENDING) {
    throw new ApiError(409, "Session already processed");
  }

  const otpResult = await verifyOtp({
    email: normalizedEmail,
    otp,
    purpose: OTP_PURPOSES.SMARTBOARD_LOGIN,
    contextToken: sessionToken
  });
  if (!otpResult.valid) throw mapOtpReasonToError(otpResult.reason);

  const faculty = await getUserByEmail(normalizedEmail);
  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new ApiError(404, "Faculty account not found");
  }

  await authorizeSession(sessionToken, faculty.id);
  res.status(200).json({
    message: "Smartboard authorized through OTP"
  });
});

const exchangeSmartboardSession = asyncHandler(async (req, res) => {
  const { sessionToken } = req.body;
  if (!sessionToken) throw new ApiError(400, "sessionToken is required");

  const session = await getSessionByToken(sessionToken);
  if (!session) throw new ApiError(404, "Smartboard session not found");

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await expireSession(sessionToken);
    throw new ApiError(410, "Smartboard session expired");
  }

  if (session.status === SMARTBOARD_SESSION_STATUS.PENDING) {
    return res.status(200).json({ status: SMARTBOARD_SESSION_STATUS.PENDING });
  }

  if (session.status !== SMARTBOARD_SESSION_STATUS.AUTHORIZED) {
    throw new ApiError(401, "Session authorization failed");
  }

  const faculty = await getUserById(session.authorizedBy);
  if (!faculty) throw new ApiError(401, "Faculty authorization is invalid");

  const classes = await getFacultyClasses(faculty.id);
  const subjects = await getSubjectsByFacultyId(faculty.id);

  const accessToken = signAccessToken({
    userId: `smartboard:${session.id}`,
    role: ROLES.SMARTBOARD
  });

  await consumeSession(sessionToken);

  return res.status(200).json({
    status: SMARTBOARD_SESSION_STATUS.AUTHORIZED,
    accessToken,
    faculty: {
      id: faculty.id,
      name: faculty.name,
      email: faculty.email
    },
    classes,
    subjects
  });
});

const completeFacultySetup = asyncHandler(async (req, res) => {
  const { email, name, mobile = "", profilePhoto = "", classIds = [] } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || "").trim();
  const normalizedMobile = String(mobile || "").replace(/\D/g, "");
  const normalizedProfilePhoto = String(profilePhoto || "").trim();
  const normalizedClassIds = Array.isArray(classIds)
    ? [...new Set(classIds.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];

  if (!normalizedEmail || !normalizedName) {
    throw new ApiError(400, "email and name are required");
  }

  if (!validateEmailByRole(normalizedEmail, ROLES.FACULTY)) {
    throw new ApiError(400, "Email does not match institutional format for faculty role");
  }

  if (normalizedMobile && !/^[6-9]\d{9}$/.test(normalizedMobile)) {
    throw new ApiError(400, "Mobile must be a valid 10-digit number");
  }

  if (
    normalizedProfilePhoto &&
    !normalizedProfilePhoto.startsWith("data:image/") &&
    !/^https?:\/\//i.test(normalizedProfilePhoto)
  ) {
    throw new ApiError(400, "profilePhoto must be an image data URL or valid URL");
  }

  if (normalizedProfilePhoto.length > MAX_PROFILE_PHOTO_LENGTH) {
    throw new ApiError(400, "Profile photo is too large");
  }

  if (normalizedClassIds.some((item) => !Types.ObjectId.isValid(item))) {
    throw new ApiError(400, "classIds must contain valid ids");
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user || user.role !== ROLES.FACULTY) {
    throw new ApiError(404, "Faculty account not found");
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Verify account OTP before faculty setup");
  }

  const updatedUser = await User.findByIdAndUpdate(
    user.id,
    {
      $set: {
        name: normalizedName,
        mobile: normalizedMobile || null,
        profilePhoto: normalizedProfilePhoto || null
      }
    },
    { new: true }
  )
    .lean()
    .exec();

  if (normalizedClassIds.length > 0) {
    await assignFacultyClasses(user.id, normalizedClassIds);
  }

  const assignedClasses = await getFacultyClasses(user.id);

  res.status(200).json({
    message: "Faculty profile setup completed",
    user: {
      id: String(updatedUser._id),
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      mobile: updatedUser.mobile || null,
      profilePhoto: updatedUser.profilePhoto || null
    },
    classes: assignedClasses
  });
});

const getStudentSetupOptions = asyncHandler(async (req, res) => {
  const { departmentCode = "" } = req.query;
  const normalizedDepartmentCode = String(departmentCode || "").trim().toUpperCase();

  const departments = await Department.find({}).sort({ name: 1 }).lean().exec();
  const departmentsById = new Map(
    departments.map((item) => [String(item._id), { name: item.name, code: item.code }])
  );

  let classes = [];
  if (normalizedDepartmentCode) {
    const department = departments.find((item) => item.code === normalizedDepartmentCode);
    if (department?._id) {
      classes = await Class.find({ departmentId: department._id })
        .sort({ year: 1, section: 1, name: 1 })
        .lean()
        .exec();
    }
  }

  res.status(200).json({
    departments: departments.map((item) => ({
      id: String(item._id),
      name: item.name,
      code: item.code
    })),
    classes: classes.map((item) => {
      const department = departmentsById.get(String(item.departmentId)) || null;
      return {
        id: String(item._id),
        name: item.name || null,
        year: item.year,
        section: item.section,
        departmentId: item.departmentId ? String(item.departmentId) : null,
        department: department?.name || null,
        departmentCode: department?.code || null
      };
    })
  });
});

const getFacultySetupOptions = asyncHandler(async (req, res) => {
  const { departmentId = "", year = "", section = "" } = req.query;

  const classFilter = {};
  if (departmentId) {
    if (!Types.ObjectId.isValid(departmentId)) {
      throw new ApiError(400, "departmentId is invalid");
    }
    classFilter.departmentId = departmentId;
  }
  if (year !== undefined && year !== "") {
    const yearNum = Number(year);
    if (!Number.isInteger(yearNum) || yearNum < 1 || yearNum > 10) {
      throw new ApiError(400, "year must be an integer between 1 and 10");
    }
    classFilter.year = yearNum;
  }
  if (section) {
    classFilter.section = String(section).trim().toUpperCase();
  }

  const [departments, classes] = await Promise.all([
    Department.find({}).sort({ name: 1 }).lean().exec(),
    Class.find(classFilter)
      .populate({ path: "departmentId", select: "name code" })
      .sort({ year: 1, section: 1, name: 1 })
      .lean()
      .exec()
  ]);

  res.status(200).json({
    departments: departments.map((item) => ({
      id: String(item._id),
      name: item.name,
      code: item.code
    })),
    classes: classes.map((item) => ({
      id: String(item._id),
      name: item.name,
      year: item.year,
      section: item.section,
      departmentId: item.departmentId?._id ? String(item.departmentId._id) : null,
      department: item.departmentId?.name || null,
      departmentCode: item.departmentId?.code || null
    }))
  });
});

const getSmartboardLibrary = asyncHandler(async (req, res) => {
  const {
    classId = "",
    section = "",
    year = "",
    departmentId = "",
    departmentCode = "",
    subjectId = ""
  } = req.query;
  const role = String(req.user?.role || "").toUpperCase();
  let facultyId = null;

  if (role === ROLES.FACULTY) {
    facultyId = String(req.user.userId);
  } else if (role === ROLES.SMARTBOARD) {
    const tokenUserId = String(req.user?.userId || "");
    const parts = tokenUserId.split(":");
    if (parts.length !== 2 || parts[0] !== "smartboard" || !parts[1]) {
      throw new ApiError(401, "Invalid smartboard session context");
    }

    const smartboardSession = await SmartboardSession.findById(parts[1]).lean().exec();
    if (!smartboardSession?.authorizedBy) {
      throw new ApiError(401, "Smartboard session is not mapped to a faculty");
    }
    facultyId = String(smartboardSession.authorizedBy);
  } else if (role === ROLES.ADMIN) {
    const requestedFacultyId = String(req.query.facultyId || "").trim();
    if (requestedFacultyId && !Types.ObjectId.isValid(requestedFacultyId)) {
      throw new ApiError(400, "facultyId query is invalid");
    }

    if (requestedFacultyId) {
      facultyId = requestedFacultyId;
    } else {
      const firstFaculty = await User.findOne({ role: ROLES.FACULTY, isVerified: true })
        .select("_id")
        .lean()
        .exec();
      if (!firstFaculty?._id) {
        return res.status(200).json({
          faculty: null,
          classes: [],
          subjects: [],
          presentations: []
        });
      }
      facultyId = String(firstFaculty._id);
    }
  } else {
    throw new ApiError(403, "Forbidden role for smartboard library");
  }

  const faculty = await User.findById(facultyId).select("name email").lean().exec();
  if (!faculty) throw new ApiError(404, "Faculty not found");

  const classFilter = {};
  if (classId) {
    if (!Types.ObjectId.isValid(classId)) throw new ApiError(400, "classId is invalid");
    classFilter._id = classId;
  }
  if (year !== undefined && year !== "") {
    const yearNum = Number(year);
    if (!Number.isInteger(yearNum) || yearNum < 1 || yearNum > 10) {
      throw new ApiError(400, "year must be an integer between 1 and 10");
    }
    classFilter.year = yearNum;
  }
  if (section) {
    classFilter.section = String(section).trim().toUpperCase();
  }
  if (departmentId) {
    if (!Types.ObjectId.isValid(departmentId)) throw new ApiError(400, "departmentId is invalid");
    classFilter.departmentId = departmentId;
  }
  if (departmentCode) {
    const department = await Department.findOne({
      code: String(departmentCode).trim().toUpperCase()
    })
      .select("_id")
      .lean()
      .exec();
    if (!department?._id) {
      return res.status(200).json({
        faculty: {
          id: String(faculty._id),
          name: faculty.name,
          email: faculty.email
        },
        classes: [],
        subjects: [],
        presentations: []
      });
    }
    classFilter.departmentId = department._id;
  }

  let scopedClassIds = [];
  if (Object.keys(classFilter).length > 0) {
    const classDocs = await Class.find(classFilter).select("_id").lean().exec();
    scopedClassIds = classDocs.map((item) => item._id);
    if (scopedClassIds.length === 0) {
      return res.status(200).json({
        faculty: {
          id: String(faculty._id),
          name: faculty.name,
          email: faculty.email
        },
        classes: [],
        subjects: [],
        presentations: []
      });
    }
  }

  const subjectFilter = { facultyId };
  if (scopedClassIds.length > 0) {
    subjectFilter.classId = { $in: scopedClassIds };
  }
  if (subjectId) {
    if (!Types.ObjectId.isValid(subjectId)) throw new ApiError(400, "subjectId is invalid");
    subjectFilter._id = subjectId;
  }

  const subjectDocs = await Subject.find(subjectFilter)
    .populate({
      path: "classId",
      select: "name year section departmentId",
      populate: { path: "departmentId", select: "name code" }
    })
    .sort({ name: 1 })
    .lean()
    .exec();

  if (!subjectDocs.length) {
    return res.status(200).json({
      faculty: {
        id: String(faculty._id),
        name: faculty.name,
        email: faculty.email
      },
      classes: [],
      subjects: [],
      presentations: []
    });
  }

  const subjectIds = subjectDocs.map((item) => item._id);
  const uploads = await Upload.find({
    subjectId: { $in: subjectIds },
    category: { $in: ["STUDENT_PRESENTATION", "LECTURE_MATERIAL"] }
  })
    .populate({ path: "uploadedBy", select: "name email rollNumber" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const classesMap = new Map();
  const subjects = subjectDocs.map((item) => {
    const classDoc = item.classId || null;
    const classId = classDoc?._id ? String(classDoc._id) : null;

    if (classDoc && classId && !classesMap.has(classId)) {
      classesMap.set(classId, {
        id: classId,
        name: classDoc.name || null,
        year: classDoc.year || null,
        section: classDoc.section || null,
        department: classDoc?.departmentId?.name || null,
        departmentCode: classDoc?.departmentId?.code || null
      });
    }

    return {
      id: String(item._id),
      name: item.name || null,
      code: item.code || null,
      classId,
      className: classDoc?.name || null,
      year: classDoc?.year || null,
      section: classDoc?.section || null,
      department: classDoc?.departmentId?.name || null,
      departmentCode: classDoc?.departmentId?.code || null
    };
  });

  const subjectToClassMap = new Map(
    subjects.map((item) => [String(item.id), item.classId || null])
  );

  const presentations = await Promise.all(
    uploads.map(async (item) => {
      const subjectId = item.subjectId ? String(item.subjectId) : null;
      const fileUrl = await resolveSmartboardFileUrl(item);

      return {
        id: String(item._id),
        subjectId,
        classId: subjectId ? subjectToClassMap.get(subjectId) || null : null,
        title: item.title || item.fileName || null,
        fileName: item.fileName || null,
        fileType: item.fileType || null,
        fileUrl,
        category: item.category || "STUDENT_PRESENTATION",
        status: item.status || "UPLOADED",
        uploadedAt: item.createdAt || null,
        uploadedByName: item.uploadedBy?.name || null,
        uploadedByEmail: item.uploadedBy?.email || null,
        rollNumber: item.uploadedBy?.rollNumber || null
      };
    })
  );

  return res.status(200).json({
    faculty: {
      id: String(faculty._id),
      name: faculty.name,
      email: faculty.email
    },
    classes: Array.from(classesMap.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    ),
    subjects,
    presentations
  });
});

module.exports = {
  authorizeSmartboardSessionByFaculty,
  completeFacultySetup,
  completeStudentSetup,
  createSmartboardSession,
  getStudentSetupOptions,
  getFacultySetupOptions,
  getSmartboardLibrary,
  exchangeSmartboardSession,
  forgotPassword,
  login,
  logout,
  refreshAccessToken,
  register,
  resetPassword,
  requestSmartboardOtp,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  verifySmartboardOtp
};
