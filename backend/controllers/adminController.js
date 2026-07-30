const bcrypt = require("bcrypt");
const archiver = require("archiver");
const XLSX = require("xlsx");
const { Types } = require("mongoose");
const { ROLES } = require("../config/constants");
const Class = require("../mongoModels/Class");
const Announcement = require("../mongoModels/Announcement");
const Department = require("../mongoModels/Department");
const FacultyClass = require("../mongoModels/FacultyClass");
const OtpCode = require("../mongoModels/OtpCode");
const RefreshToken = require("../mongoModels/RefreshToken");
const SmartboardSession = require("../mongoModels/SmartboardSession");
const SmtpSetting = require("../mongoModels/SmtpSetting");
const SmartboardSetting = require("../mongoModels/SmartboardSetting");
const Subject = require("../mongoModels/Subject");
const Upload = require("../mongoModels/Upload");
const User = require("../mongoModels/User");
const { assignFacultyClasses } = require("../models/facultyClassModel");
const { listUsersByRole } = require("../models/userModel");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { isValidEmail, normalizeEmail, validateEmailByRole } = require("../utils/emailRules");
const { sendMail } = require("../services/mailerService");

function handleDuplicateKeyError(error, entityName) {
  if (error?.code === 11000) {
    throw new ApiError(409, `${entityName} already exists`);
  }
  throw error;
}

const ALLOWED_STUDENT_YEARS = new Set([1, 2, 3, 4]);
const STUDENT_SECTIONS_BY_BRANCH = Object.freeze({
  ECE: ["ECE-A", "ECE-B"],
  CSE: ["CSE-A", "CSE-B"],
  CSM: ["CSM-A", "CSM-B"],
  MEC: ["MEC-A", "MEC-B"]
});

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return String(value).trim().toLowerCase() === "true";
}

function getEnvMailSettings() {
  return {
    provider: String(process.env.MAIL_PROVIDER || "node").trim().toLowerCase(),
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    starttls: toBool(process.env.SMTP_STARTTLS, true),
    timeoutSeconds: Number(process.env.SMTP_TIMEOUT_SECONDS || 20),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    from: process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || ""
  };
}

async function getActiveMailSettings() {
  const envSettings = getEnvMailSettings();
  const saved = await SmtpSetting.findOne({ key: "default" }).lean().exec();
  if (!saved) return envSettings;

  return {
    provider: saved.provider || envSettings.provider,
    host: saved.host || envSettings.host,
    port: Number(saved.port || envSettings.port || 587),
    secure: Boolean(saved.secure),
    starttls: saved.starttls === undefined ? envSettings.starttls : Boolean(saved.starttls),
    timeoutSeconds: Number(saved.timeoutSeconds || envSettings.timeoutSeconds || 20),
    user: saved.user || envSettings.user,
    pass: saved.pass || envSettings.pass,
    apiKey: saved.apiKey || envSettings.apiKey,
    from: saved.from || envSettings.from
  };
}

function sanitizeMailSettingsForResponse(settings = {}) {
  return {
    provider: settings.provider || "node",
    host: settings.host || "",
    port: Number(settings.port || 587),
    secure: Boolean(settings.secure),
    starttls: settings.starttls === undefined ? true : Boolean(settings.starttls),
    timeoutSeconds: Number(settings.timeoutSeconds || 20),
    user: settings.user || "",
    pass: settings.pass ? "********" : "",
    apiKey: settings.apiKey ? "********" : "",
    from: settings.from || ""
  };
}

function getEnvSmartboardSettings() {
  return {
    accessUser: String(process.env.SMARTBOARD_ACCESS_USER || "").trim(),
    accessKeyPlain: String(process.env.SMARTBOARD_ACCESS_KEY || "").trim(),
    defaultFacultyEmail: String(process.env.SMARTBOARD_DEFAULT_FACULTY_EMAIL || "").trim(),
    classIds: [],
    classNames: []
  };
}

async function getActiveSmartboardSettings() {
  const envSettings = getEnvSmartboardSettings();
  const saved = await SmartboardSetting.findOne({ key: "default" }).lean().exec();
  if (!saved) return envSettings;

  return {
    accessUser: saved.accessUser || envSettings.accessUser,
    accessKeyHash: saved.accessKeyHash || "",
    accessKeyPlain: envSettings.accessKeyPlain,
    defaultFacultyEmail: saved.defaultFacultyEmail || envSettings.defaultFacultyEmail,
    classIds: Array.isArray(saved.classIds) ? saved.classIds.map((c) => String(c)) : [],
    classNames: Array.isArray(saved.classNames) ? saved.classNames : []
  };
}

function sanitizeSmartboardSettingsForResponse(settings) {
  return {
    accessUser: settings.accessUser || "",
    accessKey: settings.accessKeyHash ? "********" : "",
    defaultFacultyEmail: settings.defaultFacultyEmail || "",
    classIds: settings.classIds || [],
    classNames: settings.classNames || []
  };
}

// ===== Smartboard CRUD for multiple devices =====
const listSmartboards = asyncHandler(async (req, res) => {
  const rows = await SmartboardSetting.find({}).sort({ createdAt: -1 }).lean().exec();
  const smartboards = rows.map((r) => ({
    id: String(r._id),
    key: r.key,
    accessUser: r.accessUser || "",
    accessKey: r.accessKeyHash ? "********" : "",
    defaultFacultyEmail: r.defaultFacultyEmail || "",
    classIds: Array.isArray(r.classIds) ? r.classIds.map((c) => String(c)) : [],
    classNames: Array.isArray(r.classNames) ? r.classNames : [],
    updatedBy: r.updatedBy ? String(r.updatedBy) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));

  res.status(200).json({ smartboards });
});

const createSmartboard = asyncHandler(async (req, res) => {
  const { key, accessUser, accessKey, defaultFacultyEmail, classIds } = req.body;
  if (!key) throw new ApiError(400, "key (identifier) is required");
  const normalizedKey = String(key).trim();

  const validated = await validateSmartboardSettingsInput({
    accessUser,
    accessKey,
    defaultFacultyEmail,
    classIds
  });

  const payload = {
    key: normalizedKey,
    accessUser: validated.accessUser || "",
    accessKeyHash: validated.accessKey ? await bcrypt.hash(validated.accessKey, 12) : "",
    defaultFacultyEmail: validated.defaultFacultyEmail || "",
    classIds: validated.classIds || [],
    classNames: validated.classNames || [],
    updatedBy: req.user.userId
  };

  try {
    const created = await SmartboardSetting.create(payload);
    res.status(201).json({ message: "Smartboard created", smartboard: { id: String(created._id) } });
  } catch (error) {
    handleDuplicateKeyError(error, "Smartboard");
  }
});

const updateSmartboard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "id is invalid");

  const { key, accessUser, accessKey, defaultFacultyEmail, classIds } = req.body;
  const validated = await validateSmartboardSettingsInput({ accessUser, accessKey, defaultFacultyEmail, classIds });

  const patch = {
    accessUser: validated.accessUser || "",
    defaultFacultyEmail: validated.defaultFacultyEmail || "",
    classIds: validated.classIds || [],
    classNames: validated.classNames || [],
    updatedBy: req.user.userId
  };

  if (validated.accessKey) {
    patch.accessKeyHash = await bcrypt.hash(validated.accessKey, 12);
  }
  if (key) patch.key = String(key).trim();

  try {
    const updated = await SmartboardSetting.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean().exec();
    if (!updated) throw new ApiError(404, "Smartboard not found");
    res.status(200).json({ message: "Smartboard updated", smartboard: { id: String(updated._id) } });
  } catch (error) {
    handleDuplicateKeyError(error, "Smartboard");
  }
});

const deleteSmartboard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "id is invalid");
  const result = await SmartboardSetting.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new ApiError(404, "Smartboard not found");
  res.status(200).json({ message: "Smartboard deleted" });
});

// ===== end smartboard CRUD =====

async function validateSmartboardSettingsInput({ accessUser, accessKey, defaultFacultyEmail, classIds }) {
  const normalizedAccessUser = String(accessUser || "").trim();
  const normalizedAccessKey = String(accessKey || "").trim();
  const normalizedDefaultFacultyEmail = normalizeEmail(defaultFacultyEmail);
  const normalizedClassIds = parseClassIdsInput(classIds || []);

  if (normalizedAccessKey && !normalizedAccessUser) {
    throw new ApiError(400, "accessUser is required when setting a smartboard access key");
  }

  if (!normalizedAccessKey && normalizedAccessUser) {
    throw new ApiError(400, "accessKey is required when setting a smartboard access user");
  }

  if (normalizedDefaultFacultyEmail && !validateEmailByRole(normalizedDefaultFacultyEmail, ROLES.FACULTY)) {
    throw new ApiError(400, "defaultFacultyEmail must be a verified faculty email");
  }

  // validate classIds and resolve names
  const resolvedClassIds = [];
  const resolvedClassNames = [];
  for (const cid of normalizedClassIds) {
    if (!Types.ObjectId.isValid(cid)) {
      throw new ApiError(400, `classIds item is invalid: ${cid}`);
    }
    const classDoc = await Class.findById(cid).select("name year section").lean().exec();
    if (!classDoc) throw new ApiError(404, `Class not found: ${cid}`);
    resolvedClassIds.push(String(classDoc._id));
    resolvedClassNames.push(classDoc.name || `${classDoc.year}-${classDoc.section}`);
  }

  return {
    accessUser: normalizedAccessUser,
    accessKey: normalizedAccessKey,
    defaultFacultyEmail: normalizedDefaultFacultyEmail,
    classIds: resolvedClassIds,
    classNames: resolvedClassNames
  };
}

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRollNumber(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeBranch(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeSection(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeMobile(value) {
  const normalized = String(value || "").replace(/\D/g, "");
  return normalized || null;
}

function ensureObjectId(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${fieldName} is invalid`);
  }
  return String(value).trim();
}

function mapUserForResponse(userDoc) {
  return {
    id: String(userDoc._id),
    name: userDoc.name,
    email: userDoc.email,
    role: userDoc.role,
    rollNumber: userDoc.rollNumber || null,
    branch: userDoc.branch || null,
    year: userDoc.year || null,
    section: userDoc.section || null,
    mobile: userDoc.mobile || null,
    classId: userDoc.classId ? String(userDoc.classId) : null,
    isVerified: Boolean(userDoc.isVerified),
    createdAt: userDoc.createdAt
  };
}

function validateStudentAttributes({ year, branch, section, mobile }) {
  if (!ALLOWED_STUDENT_YEARS.has(Number(year))) {
    throw new ApiError(400, "Student year must be one of: 1, 2, 3, 4");
  }

  if (!branch || !STUDENT_SECTIONS_BY_BRANCH[branch]) {
    throw new ApiError(400, "Department must be one of: ECE, CSE, CSM, MEC");
  }

  const allowedSections = STUDENT_SECTIONS_BY_BRANCH[branch];
  if (!section || !allowedSections.includes(section)) {
    throw new ApiError(400, `Section must match selected department: ${allowedSections.join(", ")}`);
  }

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new ApiError(400, "Mobile must be a valid 10-digit number");
  }
}

function parseClassIdsInput(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanValue(value, defaultValue = true) {
  if (value === null || value === undefined || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function normalizeAndValidateCreateUserInput(input = {}, options = {}) {
  const defaultVerified = options.defaultVerified !== undefined ? options.defaultVerified : true;
  const {
    name,
    email,
    password,
    role,
    rollNumber = null,
    year = null,
    branch = null,
    section = null,
    mobile = null,
    profilePhoto = null,
    classId = null,
    classIds = [],
    isVerified = defaultVerified
  } = input;

  const normalizedRole = normalizeRole(role);
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || "").trim();
  const normalizedYear = year === null || year === undefined || year === "" ? null : Number(year);
  const normalizedBranch = normalizeBranch(branch);
  const normalizedSection = normalizeSection(section);
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedClassId = ensureObjectId(classId, "classId");
  const normalizedClassIds = parseClassIdsInput(classIds)
    .map((item) => ensureObjectId(item, "classIds item"))
    .filter(Boolean);
  const normalizedIsVerified = parseBooleanValue(isVerified, defaultVerified);

  if (!normalizedName || !normalizedEmail || !password || !normalizedRole) {
    throw new ApiError(400, "name, email, password, and role are required");
  }

  if (!Object.values(ROLES).includes(normalizedRole)) {
    throw new ApiError(400, "Invalid role");
  }

  if ([ROLES.STUDENT, ROLES.FACULTY].includes(normalizedRole)) {
    if (!validateEmailByRole(normalizedEmail, normalizedRole)) {
      throw new ApiError(400, "Email does not match institutional format for role");
    }
  }

  if (String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  if (normalizedRole === ROLES.STUDENT) {
    validateStudentAttributes({
      year: normalizedYear,
      branch: normalizedBranch,
      section: normalizedSection,
      mobile: normalizedMobile
    });
  }

  return {
    name: normalizedName,
    email: normalizedEmail,
    password: String(password),
    role: normalizedRole,
    rollNumber: normalizedRollNumber,
    year: normalizedYear,
    branch: normalizedBranch,
    section: normalizedSection,
    mobile: normalizedMobile,
    profilePhoto: String(profilePhoto || "").trim() || null,
    classId: normalizedClassId,
    classIds: normalizedClassIds,
    isVerified: normalizedIsVerified
  };
}

async function createUserFromPayload(input = {}, options = {}) {
  const normalized = normalizeAndValidateCreateUserInput(input, options);
  const passwordHash = await bcrypt.hash(normalized.password, 12);

  const created = await User.create({
    name: normalized.name,
    email: normalized.email,
    passwordHash,
    role: normalized.role,
    rollNumber: normalized.role === ROLES.STUDENT ? normalized.rollNumber : null,
    year: normalized.role === ROLES.STUDENT ? normalized.year : null,
    branch: normalized.role === ROLES.STUDENT ? normalized.branch : null,
    section: normalized.role === ROLES.STUDENT ? normalized.section : null,
    mobile: normalized.role === ROLES.STUDENT ? normalized.mobile : null,
    profilePhoto: normalized.role === ROLES.STUDENT ? normalized.profilePhoto : null,
    classId: normalized.classId,
    isVerified: normalized.isVerified
  });

  if (normalized.role === ROLES.FACULTY && normalized.classIds.length > 0) {
    await assignFacultyClasses(created.id, normalized.classIds);
  }

  return created;
}

function normalizeImportHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getImportFieldValue(row, aliases = []) {
  for (const key of aliases) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function mapSpreadsheetRowToUserPayload(rawRow = {}) {
  const row = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    const normalizedKey = normalizeImportHeader(key);
    if (normalizedKey) {
      row[normalizedKey] = value;
    }
  });

  return {
    name: getImportFieldValue(row, ["name", "fullname"]),
    email: getImportFieldValue(row, ["email", "mail"]),
    password: getImportFieldValue(row, ["password", "pass"]),
    role: getImportFieldValue(row, ["role", "usertype"]),
    rollNumber: getImportFieldValue(row, ["rollnumber", "rollno", "roll"]),
    year: getImportFieldValue(row, ["year"]),
    branch: getImportFieldValue(row, ["branch", "department", "dept"]),
    section: getImportFieldValue(row, ["section"]),
    mobile: getImportFieldValue(row, ["mobile", "phone", "phonenumber"]),
    profilePhoto: getImportFieldValue(row, ["profilephoto", "photo", "avatar"]),
    classId: getImportFieldValue(row, ["classid"]),
    classIds: getImportFieldValue(row, ["classids", "facultyclassids"]),
    className: getImportFieldValue(row, ["classname", "class"]),
    classDepartmentCode: getImportFieldValue(row, [
      "classdepartmentcode",
      "classdeptcode",
      "departmentcode",
      "deptcode",
      "classbranch"
    ]),
    classYear: getImportFieldValue(row, ["classyear", "yearforclass"]),
    classSection: getImportFieldValue(row, ["classsection", "sectionforclass"]),
    facultyClassAssignments: getImportFieldValue(row, [
      "facultyclassassignments",
      "classassignments",
      "facultyclasses",
      "classselectors",
      "classcodes"
    ]),
    isVerified: getImportFieldValue(row, ["isverified", "verified"])
  };
}

function isSpreadsheetRowEmpty(rawRow = {}) {
  return Object.values(rawRow).every(
    (value) => value === undefined || value === null || String(value).trim() === ""
  );
}

function extractRowsFromSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const [firstSheetName] = workbook.SheetNames || [];
  if (!firstSheetName) {
    throw new ApiError(400, "Uploaded file is empty");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
    blankrows: true
  });

  if (!rows.length) {
    throw new ApiError(400, "No data rows found in uploaded file");
  }

  return rows;
}

function sanitizePathSegment(value, fallback = "unknown") {
  const normalized = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");
  return normalized || fallback;
}

function sanitizeZipFileName(value, fallback = "file") {
  const normalized = sanitizePathSegment(value, fallback);
  return normalized.slice(0, 120);
}

function normalizeYearValue(value) {
  const yearNum = Number(value);
  if (!Number.isInteger(yearNum) || yearNum < 1 || yearNum > 10) {
    throw new ApiError(400, "Year must be an integer between 1 and 10");
  }
  return yearNum;
}

function normalizeExcelString(value) {
  return String(value || "").trim();
}

function normalizeDepartmentCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseClassAssignmentTokens(value) {
  return String(value || "")
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseClassDescriptorToken(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const compact = normalized.replace(/\s+/g, "");
  const match = compact.match(
    /^([A-Za-z0-9]+)[\-_:|\/]([0-9]{1,2})[\-_:|\/]([A-Za-z0-9-]+)$/
  );
  if (!match) return null;

  return {
    departmentCode: normalizeDepartmentCode(match[1]),
    year: Number(match[2]),
    section: normalizeSection(match[3]),
    className: ""
  };
}

function deriveSubjectCode(subjectName, usedCodes = new Set()) {
  const base = String(subjectName || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "SUBJECT";

  let candidate = base;
  let counter = 1;
  while (usedCodes.has(candidate)) {
    const suffix = String(counter).padStart(2, "0");
    candidate = `${base.slice(0, Math.max(1, 10 - suffix.length))}${suffix}`;
    counter += 1;
  }
  usedCodes.add(candidate);
  return candidate;
}

function sendWorkbook(res, fileName, sheetName, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  res.status(200).send(buffer);
}

const createDepartment = asyncHandler(async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) throw new ApiError(400, "name and code are required");

  try {
    const result = await Department.create({
      name: String(name).trim(),
      code: String(code).trim().toUpperCase()
    });

    res.status(201).json({
      message: "Department created",
      departmentId: result.id
    });
  } catch (error) {
    handleDuplicateKeyError(error, "Department");
  }
});

const updateDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  if (!Types.ObjectId.isValid(departmentId)) {
    throw new ApiError(400, "departmentId is invalid");
  }

  const payload = {};
  if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
  if (req.body.code !== undefined) payload.code = String(req.body.code).trim().toUpperCase();
  if (!Object.keys(payload).length) {
    throw new ApiError(400, "At least one field is required for update");
  }

  try {
    const result = await Department.findByIdAndUpdate(departmentId, { $set: payload }, { new: true })
      .lean()
      .exec();
    if (!result) throw new ApiError(404, "Department not found");

    res.status(200).json({
      message: "Department updated",
      department: {
        id: String(result._id),
        name: result.name,
        code: result.code
      }
    });
  } catch (error) {
    handleDuplicateKeyError(error, "Department");
  }
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  if (!Types.ObjectId.isValid(departmentId)) {
    throw new ApiError(400, "departmentId is invalid");
  }

  const linkedClasses = await Class.countDocuments({ departmentId });
  if (linkedClasses > 0) {
    throw new ApiError(409, "Cannot delete department with linked classes");
  }

  const result = await Department.deleteOne({ _id: departmentId });
  if (result.deletedCount === 0) throw new ApiError(404, "Department not found");

  res.status(200).json({ message: "Department deleted" });
});

const createClass = asyncHandler(async (req, res) => {
  const { departmentId, year, section, name, smartboardAccessUser, smartboardAccessKey } = req.body;
  if (!departmentId || !year || !section || !name) {
    throw new ApiError(400, "departmentId, year, section, and name are required");
  }

  if (!Types.ObjectId.isValid(departmentId)) {
    throw new ApiError(400, "departmentId is invalid");
  }

  if (!Number.isInteger(Number(year))) {
    throw new ApiError(400, "year must be a number");
  }

  try {
    const payload = {
      departmentId,
      year: Number(year),
      section: String(section).trim().toUpperCase(),
      name: String(name).trim()
    };

    if (smartboardAccessUser) payload.smartboardAccessUser = String(smartboardAccessUser).trim();
    if (smartboardAccessKey) payload.smartboardAccessKeyHash = await bcrypt.hash(String(smartboardAccessKey), 12);

    const result = await Class.create(payload);

    res.status(201).json({
      message: "Class created",
      classId: result.id
    });
  } catch (error) {
    handleDuplicateKeyError(error, "Class");
  }
});

const updateClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  if (!Types.ObjectId.isValid(classId)) {
    throw new ApiError(400, "classId is invalid");
  }

  const payload = {};
  if (req.body.departmentId !== undefined) {
    payload.departmentId = ensureObjectId(req.body.departmentId, "departmentId");
  }
  if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
  if (req.body.year !== undefined) payload.year = Number(req.body.year);
  if (req.body.section !== undefined) payload.section = String(req.body.section).trim().toUpperCase();

  // smartboard fields
  if (req.body.smartboardAccessUser !== undefined) {
    payload.smartboardAccessUser = String(req.body.smartboardAccessUser || "").trim();
  }
  if (req.body.smartboardAccessKey !== undefined) {
    // if empty string provided, clear stored hash
    const key = String(req.body.smartboardAccessKey || "").trim();
    if (key) payload.smartboardAccessKeyHash = await bcrypt.hash(key, 12);
    else payload.smartboardAccessKeyHash = "";
  }

  if (!Object.keys(payload).length) {
    throw new ApiError(400, "At least one field is required for update");
  }

  if (payload.year !== undefined && !Number.isInteger(payload.year)) {
    throw new ApiError(400, "year must be a number");
  }

  try {
    const updated = await Class.findByIdAndUpdate(classId, { $set: payload }, { new: true })
      .populate({ path: "departmentId", select: "name code" })
      .lean()
      .exec();
    if (!updated) throw new ApiError(404, "Class not found");

    res.status(200).json({
      message: "Class updated",
      classItem: {
        id: String(updated._id),
        name: updated.name,
        year: updated.year,
        section: updated.section,
        departmentId: updated.departmentId?._id ? String(updated.departmentId._id) : null,
        department: updated.departmentId?.name || null,
        departmentCode: updated.departmentId?.code || null,
        smartboardAccessUser: updated.smartboardAccessUser || "",
        hasSmartboardKey: Boolean(updated.smartboardAccessKeyHash)
      }
    });
  } catch (error) {
    handleDuplicateKeyError(error, "Class");
  }
});

const deleteClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  if (!Types.ObjectId.isValid(classId)) {
    throw new ApiError(400, "classId is invalid");
  }

  const linkedSubjects = await Subject.countDocuments({ classId });
  if (linkedSubjects > 0) {
    throw new ApiError(409, "Cannot delete class with linked subjects");
  }

  await Promise.all([
    FacultyClass.deleteMany({ classId }),
    User.updateMany({ classId }, { $set: { classId: null } })
  ]);

  const result = await Class.deleteOne({ _id: classId });
  if (result.deletedCount === 0) throw new ApiError(404, "Class not found");

  res.status(200).json({ message: "Class deleted" });
});

const createSubject = asyncHandler(async (req, res) => {
  const { classId, name, code, facultyId = null } = req.body;
  if (!classId || !name || !code) {
    throw new ApiError(400, "classId, name, and code are required");
  }

  if (!Types.ObjectId.isValid(classId)) {
    throw new ApiError(400, "classId is invalid");
  }

  if (facultyId && !Types.ObjectId.isValid(facultyId)) {
    throw new ApiError(400, "facultyId is invalid");
  }

  try {
    const result = await Subject.create({
      classId,
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      facultyId: facultyId || null
    });

    res.status(201).json({
      message: "Subject created",
      subjectId: result.id
    });
  } catch (error) {
    handleDuplicateKeyError(error, "Subject");
  }
});

const createSubjectsBulk = asyncHandler(async (req, res) => {
  const { classId, facultyId = null, subjects = [] } = req.body;
  if (!classId) throw new ApiError(400, "classId is required");
  if (!Types.ObjectId.isValid(classId)) throw new ApiError(400, "classId is invalid");
  if (facultyId && !Types.ObjectId.isValid(facultyId)) {
    throw new ApiError(400, "facultyId is invalid");
  }
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new ApiError(400, "subjects must be a non-empty array");
  }

  const classDoc = await Class.findById(classId).select("_id").lean().exec();
  if (!classDoc) throw new ApiError(404, "Class not found");

  const existingSubjects = await Subject.find({ classId }).select("name code").lean().exec();
  const usedCodes = new Set(existingSubjects.map((item) => String(item.code || "").toUpperCase()));

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const rows = [];

  for (const input of subjects) {
    const normalizedName =
      typeof input === "string" ? String(input).trim() : String(input?.name || "").trim();
    if (!normalizedName) {
      skippedCount += 1;
      continue;
    }

    const requestedCode =
      typeof input === "string" ? "" : String(input?.code || "").trim().toUpperCase();
    const resolvedCode = requestedCode || deriveSubjectCode(normalizedName, usedCodes);
    if (!requestedCode) usedCodes.add(resolvedCode);

    const existing = await Subject.findOne({ classId, code: resolvedCode }).select("_id name").exec();
    if (existing) {
      const patch = {};
      if (existing.name !== normalizedName) patch.name = normalizedName;
      if (facultyId !== null && facultyId !== undefined) patch.facultyId = facultyId || null;

      if (Object.keys(patch).length > 0) {
        await Subject.updateOne({ _id: existing._id }, { $set: patch });
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }
      rows.push({
        id: String(existing._id),
        name: normalizedName,
        code: resolvedCode
      });
      continue;
    }

    const created = await Subject.create({
      classId,
      facultyId: facultyId || null,
      name: normalizedName,
      code: resolvedCode
    });
    createdCount += 1;
    rows.push({
      id: String(created._id),
      name: created.name,
      code: created.code
    });
  }

  res.status(200).json({
    message: "Bulk subject operation completed",
    createdCount,
    updatedCount,
    skippedCount,
    subjects: rows
  });
});

const updateSubject = asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  if (!Types.ObjectId.isValid(subjectId)) {
    throw new ApiError(400, "subjectId is invalid");
  }

  const payload = {};
  if (req.body.classId !== undefined) payload.classId = ensureObjectId(req.body.classId, "classId");
  if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
  if (req.body.code !== undefined) payload.code = String(req.body.code).trim().toUpperCase();
  if (req.body.facultyId !== undefined) payload.facultyId = ensureObjectId(req.body.facultyId, "facultyId");

  if (!Object.keys(payload).length) {
    throw new ApiError(400, "At least one field is required for update");
  }

  try {
    const updated = await Subject.findByIdAndUpdate(subjectId, { $set: payload }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new ApiError(404, "Subject not found");

    res.status(200).json({
      message: "Subject updated",
      subject: {
        id: String(updated._id),
        classId: updated.classId ? String(updated.classId) : null,
        facultyId: updated.facultyId ? String(updated.facultyId) : null,
        name: updated.name,
        code: updated.code
      }
    });
  } catch (error) {
    handleDuplicateKeyError(error, "Subject");
  }
});

const deleteSubject = asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  if (!Types.ObjectId.isValid(subjectId)) {
    throw new ApiError(400, "subjectId is invalid");
  }

  await Upload.deleteMany({ subjectId });
  const result = await Subject.deleteOne({ _id: subjectId });
  if (result.deletedCount === 0) throw new ApiError(404, "Subject not found");

  res.status(200).json({ message: "Subject deleted" });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const usersCount = await User.aggregate([
    {
      $group: {
        _id: "$role",
        total: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        role: "$_id",
        total: 1
      }
    }
  ]);

  const [uploads, classes, subjects] = await Promise.all([
    Upload.countDocuments(),
    Class.countDocuments(),
    Subject.countDocuments()
  ]);

  res.status(200).json({
    usersByRole: usersCount,
    totals: {
      uploads,
      classes,
      subjects
    }
  });
});

const getUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const normalizedRole = role ? String(role).toUpperCase() : null;
  if (normalizedRole && !Object.values(ROLES).includes(normalizedRole)) {
    throw new ApiError(400, "Invalid role filter");
  }

  const users = await listUsersByRole(normalizedRole);

  const facultyIds = users.filter((user) => user.role === ROLES.FACULTY).map((user) => user.id);
  let facultyClassMap = new Map();

  if (facultyIds.length > 0) {
    const facultyClasses = await FacultyClass.find({ facultyId: { $in: facultyIds } })
      .select("facultyId classId")
      .lean()
      .exec();

    facultyClassMap = facultyClasses.reduce((map, item) => {
      const key = String(item.facultyId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(String(item.classId));
      return map;
    }, new Map());
  }

  const enrichedUsers = users.map((user) =>
    user.role === ROLES.FACULTY
      ? { ...user, classIds: facultyClassMap.get(user.id) || [] }
      : user
  );

  res.status(200).json({ users: enrichedUsers });
});

const createUserByAdmin = asyncHandler(async (req, res) => {
  try {
    const created = await createUserFromPayload(req.body, { defaultVerified: true });

    res.status(201).json({
      message: "User created",
      user: mapUserForResponse(created)
    });
  } catch (error) {
    handleDuplicateKeyError(error, "User");
  }
});

const bulkImportUsersByAdmin = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file || !file.buffer || !file.buffer.length) {
    throw new ApiError(400, "file is required");
  }

  const rows = extractRowsFromSpreadsheetBuffer(file.buffer);
  const createdUsers = [];
  const failed = [];
  let skippedCount = 0;
  const departmentCache = new Map();
  const classCache = new Map();

  async function getOrCreateDepartmentByCode(departmentCode, departmentName = "") {
    const normalizedCode = normalizeDepartmentCode(departmentCode);
    if (!normalizedCode) throw new ApiError(400, "DepartmentCode is required for class mapping");
    if (departmentCache.has(normalizedCode)) return departmentCache.get(normalizedCode);

    const normalizedName = normalizeExcelString(departmentName) || normalizedCode;
    let department = await Department.findOne({ code: normalizedCode }).exec();
    if (!department) {
      department = await Department.create({
        code: normalizedCode,
        name: normalizedName
      });
    } else if (normalizedName && department.name !== normalizedName) {
      department.name = normalizedName;
      await department.save();
    }

    departmentCache.set(normalizedCode, department);
    return department;
  }

  async function getOrCreateClassByDescriptor(descriptor = {}) {
    const departmentCode = normalizeDepartmentCode(descriptor.departmentCode);
    const section = normalizeSection(descriptor.section);
    if (!departmentCode || !section || descriptor.year === undefined || descriptor.year === null) {
      return null;
    }

    const year = normalizeYearValue(descriptor.year);
    const department = await getOrCreateDepartmentByCode(
      departmentCode,
      descriptor.departmentName || descriptor.departmentCode
    );

    const cacheKey = `${departmentCode}:${year}:${section}`;
    if (classCache.has(cacheKey)) return classCache.get(cacheKey);

    let classDoc = await Class.findOne({
      departmentId: department._id,
      year,
      section
    }).exec();

    const requestedClassName = normalizeExcelString(descriptor.className);
    const fallbackClassName = `${departmentCode}-${year}-${section}`;

    if (!classDoc) {
      classDoc = await Class.create({
        departmentId: department._id,
        year,
        section,
        name: requestedClassName || fallbackClassName
      });
    } else if (requestedClassName && classDoc.name !== requestedClassName) {
      classDoc.name = requestedClassName;
      await classDoc.save();
    }

    classCache.set(cacheKey, classDoc);
    return classDoc;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const rawRow = rows[index];
    const rowNumber = index + 2;

    if (isSpreadsheetRowEmpty(rawRow)) {
      skippedCount += 1;
      continue;
    }

    const payload = mapSpreadsheetRowToUserPayload(rawRow);
    try {
      const normalizedRole = normalizeRole(payload.role);
      const directClassIdRaw = normalizeExcelString(payload.classId);

      const defaultClassDescriptor = {
        departmentCode: normalizeDepartmentCode(payload.classDepartmentCode || payload.branch),
        departmentName: payload.classDepartmentCode || payload.branch,
        year:
          payload.classYear !== undefined && payload.classYear !== null && payload.classYear !== ""
            ? payload.classYear
            : payload.year,
        section: payload.classSection || payload.section,
        className: payload.className
      };

      if (directClassIdRaw) {
        if (Types.ObjectId.isValid(directClassIdRaw)) {
          payload.classId = directClassIdRaw;
        } else {
          const fromDescriptor = parseClassDescriptorToken(directClassIdRaw);
          if (!fromDescriptor) {
            throw new ApiError(
              400,
              "classId must be a valid id or DEPT-YEAR-SECTION descriptor (e.g., CSE-2-A)"
            );
          }
          const classDoc = await getOrCreateClassByDescriptor({
            ...fromDescriptor,
            className: defaultClassDescriptor.className
          });
          payload.classId = classDoc ? String(classDoc._id) : null;
        }
      } else {
        const classDoc = await getOrCreateClassByDescriptor(defaultClassDescriptor);
        payload.classId = classDoc ? String(classDoc._id) : null;
      }

      const resolvedFacultyClassIds = new Set();
      if (normalizedRole === ROLES.FACULTY) {
        const manualClassTokens = [
          ...parseClassIdsInput(payload.classIds),
          ...parseClassAssignmentTokens(payload.facultyClassAssignments)
        ];

        for (const token of manualClassTokens) {
          if (Types.ObjectId.isValid(token)) {
            resolvedFacultyClassIds.add(String(token));
            continue;
          }

          const descriptor = parseClassDescriptorToken(token);
          if (!descriptor) {
            throw new ApiError(
              400,
              `Invalid faculty class selector "${token}". Use id or DEPT-YEAR-SECTION`
            );
          }

          const classDoc = await getOrCreateClassByDescriptor(descriptor);
          if (classDoc?._id) resolvedFacultyClassIds.add(String(classDoc._id));
        }

        if (payload.classId && Types.ObjectId.isValid(payload.classId)) {
          resolvedFacultyClassIds.add(String(payload.classId));
        }

        payload.classIds = Array.from(resolvedFacultyClassIds);
      }

      const created = await createUserFromPayload(payload, { defaultVerified: true });
      createdUsers.push(mapUserForResponse(created));
    } catch (error) {
      let reason = error?.message || "Failed to import row";
      if (error?.code === 11000) {
        reason = "User already exists";
      }
      failed.push({
        row: rowNumber,
        reason
      });
    }
  }

  if (!createdUsers.length && failed.length > 0) {
    return res.status(400).json({
      message: "No users were imported",
      createdCount: 0,
      failedCount: failed.length,
      skippedCount,
      failed
    });
  }

  return res.status(200).json({
    message: "Bulk user import completed",
    createdCount: createdUsers.length,
    failedCount: failed.length,
    skippedCount,
    users: createdUsers,
    failed
  });
});

const updateUserByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!Types.ObjectId.isValid(userId)) throw new ApiError(400, "userId is invalid");

  const existing = await User.findById(userId).exec();
  if (!existing) throw new ApiError(404, "User not found");

  const roleFromBody = req.body.role !== undefined ? normalizeRole(req.body.role) : existing.role;
  if (!Object.values(ROLES).includes(roleFromBody)) {
    throw new ApiError(400, "Invalid role");
  }

  const patch = {};
  if (req.body.name !== undefined) patch.name = String(req.body.name).trim();
  if (req.body.email !== undefined) {
    const normalizedEmail = normalizeEmail(req.body.email);
    if (!normalizedEmail) throw new ApiError(400, "email cannot be empty");
    if ([ROLES.STUDENT, ROLES.FACULTY].includes(roleFromBody)) {
      if (!validateEmailByRole(normalizedEmail, roleFromBody)) {
        throw new ApiError(400, "Email does not match institutional format for role");
      }
    }
    patch.email = normalizedEmail;
  }
  if (req.body.password !== undefined) {
    if (String(req.body.password).length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }
    patch.passwordHash = await bcrypt.hash(String(req.body.password), 12);
  }
  if (req.body.role !== undefined) patch.role = roleFromBody;
  if (req.body.classId !== undefined) patch.classId = ensureObjectId(req.body.classId, "classId");
  if (req.body.isVerified !== undefined) patch.isVerified = Boolean(req.body.isVerified);
  if (req.body.profilePhoto !== undefined) {
    patch.profilePhoto = String(req.body.profilePhoto || "").trim() || null;
  }

  const nextYear =
    req.body.year !== undefined
      ? req.body.year === null || req.body.year === "" ? null : Number(req.body.year)
      : existing.year;
  const nextBranch = req.body.branch !== undefined ? normalizeBranch(req.body.branch) : existing.branch;
  const nextSection =
    req.body.section !== undefined ? normalizeSection(req.body.section) : existing.section;
  const nextMobile = req.body.mobile !== undefined ? normalizeMobile(req.body.mobile) : existing.mobile;
  const nextRollNumber =
    req.body.rollNumber !== undefined ? normalizeRollNumber(req.body.rollNumber) : existing.rollNumber;

  if (roleFromBody === ROLES.STUDENT) {
    validateStudentAttributes({
      year: nextYear,
      branch: nextBranch,
      section: nextSection,
      mobile: nextMobile
    });
    patch.year = nextYear;
    patch.branch = nextBranch;
    patch.section = nextSection;
    patch.mobile = nextMobile;
    patch.rollNumber = nextRollNumber;
  } else if (req.body.role !== undefined && roleFromBody !== ROLES.STUDENT) {
    patch.year = null;
    patch.branch = null;
    patch.section = null;
    patch.mobile = null;
    patch.rollNumber = null;
    patch.profilePhoto = null;
  }

  if (!Object.keys(patch).length && req.body.classIds === undefined) {
    throw new ApiError(400, "No fields provided for update");
  }

  try {
    if (Object.keys(patch).length) {
      await User.updateOne({ _id: userId }, { $set: patch });
    }

    if (roleFromBody === ROLES.FACULTY && req.body.classIds !== undefined) {
      const normalizedClassIds = Array.isArray(req.body.classIds)
        ? req.body.classIds.map((item) => ensureObjectId(item, "classIds item")).filter(Boolean)
        : [];
      await assignFacultyClasses(userId, normalizedClassIds);
    }

    if (roleFromBody !== ROLES.FACULTY) {
      await FacultyClass.deleteMany({ facultyId: userId });
    }

    const updated = await User.findById(userId).lean().exec();
    res.status(200).json({
      message: "User updated",
      user: mapUserForResponse(updated)
    });
  } catch (error) {
    handleDuplicateKeyError(error, "User");
  }
});

const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!Types.ObjectId.isValid(userId)) throw new ApiError(400, "userId is invalid");

  if (String(req.user.userId) === String(userId)) {
    throw new ApiError(400, "You cannot delete your own admin account");
  }

  const existing = await User.findById(userId).lean().exec();
  if (!existing) throw new ApiError(404, "User not found");

  await Promise.all([
    RefreshToken.deleteMany({ userId }),
    OtpCode.deleteMany({ userId }),
    FacultyClass.deleteMany({ facultyId: userId }),
    Upload.deleteMany({ uploadedBy: userId }),
    Subject.updateMany({ facultyId: userId }, { $set: { facultyId: null } }),
    SmartboardSession.updateMany({ authorizedBy: userId }, { $set: { authorizedBy: null } }),
    User.deleteOne({ _id: userId })
  ]);

  res.status(200).json({ message: "User deleted" });
});

const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({})
    .sort({ name: 1 })
    .lean()
    .exec();

  res.status(200).json({
    departments: departments.map((item) => ({
      id: String(item._id),
      name: item.name,
      code: item.code
    }))
  });
});

const getClasses = asyncHandler(async (req, res) => {
  const { departmentId, year, section } = req.query;
  const filter = {};

  if (departmentId) {
    if (!Types.ObjectId.isValid(departmentId)) {
      throw new ApiError(400, "departmentId is invalid");
    }
    filter.departmentId = departmentId;
  }

  if (year !== undefined && year !== "") {
    filter.year = normalizeYearValue(year);
  }

  if (section !== undefined && section !== "") {
    filter.section = String(section).trim().toUpperCase();
  }

  const classes = await Class.find(filter)
    .populate({ path: "departmentId", select: "name code" })
    .sort({ year: 1, section: 1 })
    .lean()
    .exec();

  res.status(200).json({
    classes: classes.map((item) => ({
      id: String(item._id),
      name: item.name,
      year: item.year,
      section: item.section,
      departmentId: item.departmentId?._id ? String(item.departmentId._id) : null,
      department: item.departmentId?.name || null,
      departmentCode: item.departmentId?.code || null,
      smartboardAccessUser: item.smartboardAccessUser || "",
      hasSmartboardKey: Boolean(item.smartboardAccessKeyHash)
    }))
  });
});

const getSubjects = asyncHandler(async (req, res) => {
  const { classId, facultyId } = req.query;
  const filter = {};

  if (classId) {
    if (!Types.ObjectId.isValid(classId)) {
      throw new ApiError(400, "classId is invalid");
    }
    filter.classId = classId;
  }

  if (facultyId) {
    if (!Types.ObjectId.isValid(facultyId)) {
      throw new ApiError(400, "facultyId is invalid");
    }
    filter.facultyId = facultyId;
  }

  const subjects = await Subject.find(filter)
    .populate({
      path: "classId",
      select: "name year section departmentId",
      populate: { path: "departmentId", select: "name code" }
    })
    .populate({ path: "facultyId", select: "name email" })
    .sort({ name: 1 })
    .lean()
    .exec();

  res.status(200).json({
    subjects: subjects.map((item) => ({
      id: String(item._id),
      name: item.name,
      code: item.code,
      classId: item.classId?._id ? String(item.classId._id) : null,
      className: item.classId?.name || null,
      year: item.classId?.year || null,
      section: item.classId?.section || null,
      department: item.classId?.departmentId?.name || null,
      departmentCode: item.classId?.departmentId?.code || null,
      facultyId: item.facultyId?._id ? String(item.facultyId._id) : null,
      facultyName: item.facultyId?.name || null,
      facultyEmail: item.facultyId?.email || null
    }))
  });
});

const getUploadsAdmin = asyncHandler(async (req, res) => {
  const { status = null, subjectId = null, classId = null, limit = 200 } = req.query;
  const filter = {};

  if (status) filter.status = String(status).trim().toUpperCase();

  if (subjectId) {
    if (!Types.ObjectId.isValid(subjectId)) throw new ApiError(400, "subjectId is invalid");
    filter.subjectId = subjectId;
  }

  if (classId) {
    if (!Types.ObjectId.isValid(classId)) throw new ApiError(400, "classId is invalid");
    const subjectDocs = await Subject.find({ classId }).select("_id").lean().exec();
    const subjectIds = subjectDocs.map((item) => item._id);
    filter.subjectId = subjectIds.length ? { $in: subjectIds } : { $in: [] };
  }

  const uploads = await Upload.find(filter)
    .populate({
      path: "subjectId",
      select: "name code classId",
      populate: {
        path: "classId",
        select: "name year section departmentId",
        populate: { path: "departmentId", select: "name code" }
      }
    })
    .populate({
      path: "uploadedBy",
      select: "name email rollNumber branch year section"
    })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 500))
    .lean()
    .exec();

  res.status(200).json({
    uploads: uploads.map((item) => ({
      id: String(item._id),
      subjectId: item.subjectId?._id ? String(item.subjectId._id) : null,
      subjectName: item.subjectId?.name || null,
      subjectCode: item.subjectId?.code || null,
      classId: item.subjectId?.classId?._id
        ? String(item.subjectId.classId._id)
        : item.subjectId?.classId
          ? String(item.subjectId.classId)
          : null,
      className: item.subjectId?.classId?.name || null,
      classYear: item.subjectId?.classId?.year || null,
      classSection: item.subjectId?.classId?.section || null,
      classDepartment: item.subjectId?.classId?.departmentId?.name || null,
      classDepartmentCode: item.subjectId?.classId?.departmentId?.code || null,
      studentId: item.uploadedBy?._id ? String(item.uploadedBy._id) : null,
      studentName: item.uploadedBy?.name || null,
      rollNumber: item.uploadedBy?.rollNumber || null,
      email: item.uploadedBy?.email || null,
      branch: item.uploadedBy?.branch || null,
      year: item.uploadedBy?.year || null,
      section: item.uploadedBy?.section || null,
      status: item.status,
      category: item.category || "STUDENT_PRESENTATION",
      fileUrl: item.fileUrl,
      createdAt: item.createdAt
    }))
  });
});

const downloadAcademicTemplate = asyncHandler(async (req, res) => {
  sendWorkbook(res, "academic-import-template.xlsx", "AcademicData", [
    {
      Year: 2,
      Department: "Computer Science and Engineering",
      DepartmentCode: "CSE",
      Class: "CSE-B",
      Section: "A",
      Subject: "Data Structures",
      SubjectCode: "CS201"
    },
    {
      Year: 2,
      Department: "Computer Science and Engineering",
      DepartmentCode: "CSE",
      Class: "CSE-B",
      Section: "A",
      Subject: "Database Management Systems",
      SubjectCode: "CS202"
    }
  ]);
});

const downloadUsersTemplate = asyncHandler(async (req, res) => {
  sendWorkbook(res, "users-import-template.xlsx", "Users", [
    {
      Name: "Demo Student",
      Email: "22h51a0501@cmrcet.ac.in",
      Password: "Student@123",
      Role: "STUDENT",
      RollNumber: "22H51A0501",
      Year: 2,
      Branch: "CSE",
      Section: "CSE-A",
      Mobile: "9000000001",
      ClassDepartmentCode: "CSE",
      ClassYear: 2,
      ClassSection: "A",
      ClassName: "CSE-A",
      ClassId: "",
      ClassIds: "",
      FacultyClassAssignments: "",
      IsVerified: true
    },
    {
      Name: "Demo Faculty",
      Email: "faculty.demo@cmrcet.ac.in",
      Password: "Faculty@123",
      Role: "FACULTY",
      RollNumber: "",
      Year: "",
      Branch: "",
      Section: "",
      Mobile: "",
      ClassId: "",
      ClassDepartmentCode: "",
      ClassYear: "",
      ClassSection: "",
      ClassName: "",
      ClassIds: "65f0...e2a,65f0...b47",
      FacultyClassAssignments: "CSE-2-A;ECE-3-B",
      IsVerified: true
    }
  ]);
});

function mapSpreadsheetRowToAcademicPayload(rawRow = {}) {
  const row = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    const normalizedKey = normalizeImportHeader(key);
    if (normalizedKey) row[normalizedKey] = value;
  });

  return {
    year: getImportFieldValue(row, ["year", "academicyear"]),
    departmentName: getImportFieldValue(row, ["department", "departmentname", "dept"]),
    departmentCode: getImportFieldValue(row, ["departmentcode", "deptcode", "branch"]),
    className: getImportFieldValue(row, ["class", "classname"]),
    section: getImportFieldValue(row, ["section"]),
    subjectName: getImportFieldValue(row, ["subject", "subjectname"]),
    subjectCode: getImportFieldValue(row, ["subjectcode", "code"])
  };
}

const bulkImportAcademicByAdmin = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file || !file.buffer || !file.buffer.length) {
    throw new ApiError(400, "file is required");
  }

  const rows = extractRowsFromSpreadsheetBuffer(file.buffer);
  const departmentCache = new Map();
  const classCache = new Map();
  const classSubjectCodeCache = new Map();
  const classSubjectNameCache = new Map();
  const failed = [];
  let skippedCount = 0;
  let createdDepartments = 0;
  let createdClasses = 0;
  let createdSubjects = 0;
  let updatedSubjects = 0;

  async function getOrCreateDepartment({ departmentName, departmentCode }) {
    const normalizedCode = String(departmentCode || departmentName || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!normalizedCode) throw new ApiError(400, "Department or DepartmentCode is required");
    if (departmentCache.has(normalizedCode)) return departmentCache.get(normalizedCode);

    const normalizedName = String(departmentName || normalizedCode).trim();
    let department = await Department.findOne({ code: normalizedCode }).exec();
    if (!department) {
      department = await Department.create({
        code: normalizedCode,
        name: normalizedName
      });
      createdDepartments += 1;
    } else if (normalizedName && department.name !== normalizedName) {
      department.name = normalizedName;
      await department.save();
    }

    departmentCache.set(normalizedCode, department);
    return department;
  }

  async function getOrCreateClass({ departmentId, year, section, className }) {
    const key = `${String(departmentId)}:${year}:${String(section).toUpperCase()}`;
    if (classCache.has(key)) return classCache.get(key);

    const normalizedName = String(className || "").trim() || `Class ${year}-${section}`;
    const normalizedSection = String(section || "").trim().toUpperCase();
    let classDoc = await Class.findOne({
      departmentId,
      year,
      section: normalizedSection
    }).exec();

    if (!classDoc) {
      classDoc = await Class.create({
        departmentId,
        year,
        section: normalizedSection,
        name: normalizedName
      });
      createdClasses += 1;
    } else if (normalizedName && classDoc.name !== normalizedName) {
      classDoc.name = normalizedName;
      await classDoc.save();
    }

    classCache.set(key, classDoc);
    return classDoc;
  }

  async function hydrateClassSubjectCaches(classId) {
    const key = String(classId);
    if (classSubjectCodeCache.has(key) && classSubjectNameCache.has(key)) return;

    const existingSubjects = await Subject.find({ classId })
      .select("name code")
      .lean()
      .exec();
    const codeSet = new Set(
      existingSubjects.map((item) => String(item.code || "").trim().toUpperCase()).filter(Boolean)
    );
    const nameMap = new Map(
      existingSubjects.map((item) => [String(item.name || "").trim().toLowerCase(), String(item.code || "")])
    );
    classSubjectCodeCache.set(key, codeSet);
    classSubjectNameCache.set(key, nameMap);
  }

  for (let index = 0; index < rows.length; index += 1) {
    const rawRow = rows[index];
    const rowNumber = index + 2;
    if (isSpreadsheetRowEmpty(rawRow)) {
      skippedCount += 1;
      continue;
    }

    try {
      const payload = mapSpreadsheetRowToAcademicPayload(rawRow);
      const year = normalizeYearValue(payload.year);
      const section = normalizeSection(payload.section);
      const subjectName = normalizeExcelString(payload.subjectName);
      if (!section) throw new ApiError(400, "Section is required");
      if (!subjectName) throw new ApiError(400, "Subject is required");

      const department = await getOrCreateDepartment({
        departmentName: payload.departmentName,
        departmentCode: payload.departmentCode
      });
      const classDoc = await getOrCreateClass({
        departmentId: department._id,
        year,
        section,
        className: payload.className
      });

      await hydrateClassSubjectCaches(classDoc._id);
      const classKey = String(classDoc._id);
      const usedCodes = classSubjectCodeCache.get(classKey);
      const nameMap = classSubjectNameCache.get(classKey);

      let requestedCode = normalizeExcelString(payload.subjectCode).toUpperCase();
      if (requestedCode) requestedCode = requestedCode.replace(/[^A-Z0-9]/g, "");
      if (!requestedCode && nameMap.has(subjectName.toLowerCase())) {
        requestedCode = nameMap.get(subjectName.toLowerCase());
      }
      const resolvedCode = requestedCode || deriveSubjectCode(subjectName, usedCodes);
      usedCodes.add(resolvedCode);
      nameMap.set(subjectName.toLowerCase(), resolvedCode);

      const existing = await Subject.findOne({ classId: classDoc._id, code: resolvedCode }).exec();
      if (!existing) {
        await Subject.create({
          classId: classDoc._id,
          name: subjectName,
          code: resolvedCode
        });
        createdSubjects += 1;
      } else if (existing.name !== subjectName) {
        existing.name = subjectName;
        await existing.save();
        updatedSubjects += 1;
      }
    } catch (error) {
      failed.push({
        row: rowNumber,
        reason: error?.message || "Failed to import row"
      });
    }
  }

  if (
    createdDepartments === 0 &&
    createdClasses === 0 &&
    createdSubjects === 0 &&
    updatedSubjects === 0 &&
    failed.length > 0
  ) {
    return res.status(400).json({
      message: "No academic records were imported",
      createdDepartments,
      createdClasses,
      createdSubjects,
      updatedSubjects,
      failedCount: failed.length,
      skippedCount,
      failed
    });
  }

  return res.status(200).json({
    message: "Academic Excel import completed",
    createdDepartments,
    createdClasses,
    createdSubjects,
    updatedSubjects,
    failedCount: failed.length,
    skippedCount,
    failed
  });
});

const downloadUploadsZipBySection = asyncHandler(async (req, res) => {
  const {
    year = "",
    departmentId = "",
    departmentCode = "",
    section = "",
    classId = "",
    subjectId = "",
    category = "STUDENT_PRESENTATION"
  } = req.query;

  const classFilter = {};
  if (year !== "") classFilter.year = normalizeYearValue(year);
  if (section) classFilter.section = String(section).trim().toUpperCase();
  if (classId) {
    if (!Types.ObjectId.isValid(classId)) throw new ApiError(400, "classId is invalid");
    classFilter._id = classId;
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
    if (!department?._id) throw new ApiError(404, "Department not found for departmentCode");
    classFilter.departmentId = department._id;
  }

  const classDocs = await Class.find(classFilter)
    .populate({ path: "departmentId", select: "name code" })
    .lean()
    .exec();
  if (!classDocs.length) {
    throw new ApiError(404, "No classes found for the selected filters");
  }

  const classIds = classDocs.map((item) => item._id);
  const subjectFilter = { classId: { $in: classIds } };
  if (subjectId) {
    if (!Types.ObjectId.isValid(subjectId)) throw new ApiError(400, "subjectId is invalid");
    subjectFilter._id = subjectId;
  }
  const subjectDocs = await Subject.find(subjectFilter).select("_id classId name code").lean().exec();
  if (!subjectDocs.length) throw new ApiError(404, "No subjects found for selected filters");

  const subjectIds = subjectDocs.map((item) => item._id);
  const uploads = await Upload.find({
    subjectId: { $in: subjectIds },
    category: String(category || "STUDENT_PRESENTATION").toUpperCase()
  })
    .populate({ path: "uploadedBy", select: "name rollNumber email" })
    .select("subjectId fileUrl fileName fileType createdAt")
    .lean()
    .exec();

  if (!uploads.length) throw new ApiError(404, "No uploads found for selected filters");

  const classById = new Map(classDocs.map((item) => [String(item._id), item]));
  const subjectById = new Map(subjectDocs.map((item) => [String(item._id), item]));

  const zipLabelBase = [
    departmentCode || classDocs[0]?.departmentId?.code || "DEPT",
    year || classDocs[0]?.year || "YEAR",
    section || classDocs[0]?.section || "SECTION"
  ]
    .map((item) => sanitizePathSegment(item, "ALL"))
    .join("_");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename=\"${zipLabelBase}.zip\"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (archiveError) => {
    const message = archiveError?.message || "Failed to build zip archive";
    if (!res.headersSent) {
      res.status(500).json({ message });
      return;
    }
    res.end();
  });
  archive.pipe(res);

  const failedDownloads = [];
  for (const upload of uploads) {
    const subject = subjectById.get(String(upload.subjectId));
    const classDoc = subject ? classById.get(String(subject.classId)) : null;
    if (!subject || !classDoc || !upload.fileUrl) continue;

    const studentLabel =
      upload.uploadedBy?.rollNumber ||
      upload.uploadedBy?.name ||
      upload.uploadedBy?.email ||
      "student";
    const originalName = upload.fileName || `presentation-${String(upload._id)}.pptx`;
    const fileName = `${sanitizeZipFileName(studentLabel)}_${sanitizeZipFileName(originalName)}`;
    const filePath = [
      sanitizePathSegment(`${classDoc.year}Year`, "Year"),
      sanitizePathSegment(classDoc.departmentId?.code || classDoc.departmentId?.name || "Department"),
      sanitizePathSegment(classDoc.section || "Section"),
      sanitizePathSegment(subject.code || subject.name || "Subject"),
      fileName
    ].join("/");

    try {
      const response = await fetch(upload.fileUrl);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      archive.append(Buffer.from(arrayBuffer), { name: filePath });
    } catch (downloadError) {
      failedDownloads.push(`${filePath} -> ${downloadError.message || "download_failed"}`);
    }
  }

  if (failedDownloads.length > 0) {
    archive.append(failedDownloads.join("\n"), { name: "_failed_downloads.txt" });
  }

  archive.finalize();
});

const getMailSettings = asyncHandler(async (req, res) => {
  const settings = await getActiveMailSettings();
  res.status(200).json({
    settings: sanitizeMailSettingsForResponse(settings)
  });
});

const upsertMailSettings = asyncHandler(async (req, res) => {
  const existing = await SmtpSetting.findOne({ key: "default" }).lean().exec();
  const provider = String(req.body.provider ?? existing?.provider ?? "node")
    .trim()
    .toLowerCase();
  const host = req.body.host !== undefined ? String(req.body.host || "").trim() : String(existing?.host || "").trim();
  const port = req.body.port !== undefined ? Number(req.body.port || 587) : Number(existing?.port || 587);
  const secure = req.body.secure !== undefined ? Boolean(req.body.secure) : Boolean(existing?.secure);
  const starttls =
    req.body.starttls !== undefined ? Boolean(req.body.starttls) : existing?.starttls ?? true;
  const timeoutSeconds =
    req.body.timeoutSeconds !== undefined
      ? Number(req.body.timeoutSeconds || 20)
      : Number(existing?.timeoutSeconds || 20);
  const user = req.body.user !== undefined ? String(req.body.user || "").trim() : String(existing?.user || "").trim();
  const pass = req.body.pass !== undefined ? String(req.body.pass || "").trim() : String(existing?.pass || "").trim();
  const apiKey =
    req.body.apiKey !== undefined ? String(req.body.apiKey || "").trim() : String(existing?.apiKey || "").trim();
  const from = req.body.from !== undefined ? String(req.body.from || "").trim() : String(existing?.from || "").trim();
  const merged = {
    ...(existing || {}),
    provider,
    host,
    port,
    secure,
    starttls,
    timeoutSeconds,
    user,
    pass,
    apiKey,
    from
  };

  if (provider === "resend") {
    if (!apiKey && !pass) {
      throw new ApiError(400, "apiKey is required when provider is resend");
    }
    if (!from) {
      throw new ApiError(400, "from is required");
    }
  } else if (!host || !user || !pass || !from || !port) {
    throw new ApiError(400, "host, port, user, pass, and from are required");
  }

  await SmtpSetting.updateOne(
    { key: "default" },
    {
      $set: {
        key: "default",
        provider: merged.provider,
        host: merged.host,
        port: merged.port,
        secure: merged.secure,
        starttls: merged.starttls,
        timeoutSeconds: merged.timeoutSeconds,
        user: merged.user,
        pass: provider === "resend" ? "" : merged.pass,
        apiKey: merged.apiKey,
        from: merged.from,
        updatedBy: req.user.userId
      }
    },
    { upsert: true }
  );

  res.status(200).json({
    message: "Mail settings saved",
    settings: sanitizeMailSettingsForResponse(merged)
  });
});

const getSmartboardSettings = asyncHandler(async (req, res) => {
  const settings = await getActiveSmartboardSettings();
  res.status(200).json({
    settings: sanitizeSmartboardSettingsForResponse(settings)
  });
});

const upsertSmartboardSettings = asyncHandler(async (req, res) => {
  const existing = await SmartboardSetting.findOne({ key: "default" }).lean().exec();
  const normalized = await validateSmartboardSettingsInput({
    accessUser: req.body.accessUser,
    accessKey: req.body.accessKey,
    defaultFacultyEmail: req.body.defaultFacultyEmail,
    classIds: req.body.classIds
  });

  const updatePayload = {
    key: "default",
    accessUser: normalized.accessUser,
    defaultFacultyEmail: normalized.defaultFacultyEmail,
    classIds: normalized.classIds,
    classNames: normalized.classNames,
    updatedBy: req.user.userId
  };

  if (normalized.accessKey) {
    updatePayload.accessKeyHash = await bcrypt.hash(normalized.accessKey, 12);
  } else if (!normalized.accessUser) {
    updatePayload.accessKeyHash = "";
  }

  await SmartboardSetting.updateOne(
    { key: "default" },
    { $set: updatePayload },
    { upsert: true }
  );

  const saved = await SmartboardSetting.findOne({ key: "default" }).lean().exec();

  res.status(200).json({
    message: "Smartboard settings saved",
    settings: sanitizeSmartboardSettingsForResponse(saved || updatePayload)
  });
});

const sendTestMail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  const recipient = normalizeEmail(to);
  if (!recipient) throw new ApiError(400, "to is required");

  const mailSettings = await getActiveMailSettings();
  await sendMail({
    to: recipient,
    subject: "CMR Portal - SMTP Test Email",
    text: "This is a test email from CMR Smart Presentation Portal admin settings.",
    html: "<p>This is a <strong>test email</strong> from CMR Smart Presentation Portal admin settings.</p>",
    smtpConfig: mailSettings
  });

  res.status(200).json({ message: "Test email sent successfully" });
});

const sendBulkMail = asyncHandler(async (req, res) => {
  const { role = null, toEmails = [], subject, text = "", html = "" } = req.body;
  if (!subject) throw new ApiError(400, "subject is required");
  if (!text && !html) throw new ApiError(400, "Either text or html body is required");

  const normalizedRole = role ? String(role).trim().toUpperCase() : null;
  if (normalizedRole && normalizedRole !== "ALL" && !Object.values(ROLES).includes(normalizedRole)) {
    throw new ApiError(400, "Invalid role filter");
  }

  let customEmailList = [];
  if (Array.isArray(toEmails)) {
    customEmailList = toEmails;
  } else if (typeof toEmails === "string") {
    customEmailList = String(toEmails)
      .split(/[,\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const customRecipients = new Set();
  const invalidCustomEmails = [];
  customEmailList.forEach((item) => {
    const normalized = normalizeEmail(item);
    if (!normalized) return;
    if (!isValidEmail(normalized)) {
      invalidCustomEmails.push(normalized);
      return;
    }

    if (
      [ROLES.STUDENT, ROLES.FACULTY].includes(normalizedRole) &&
      !validateEmailByRole(normalized, normalizedRole)
    ) {
      invalidCustomEmails.push(normalized);
      return;
    }

    customRecipients.add(normalized);
  });

  if (invalidCustomEmails.length > 0) {
    const sample = invalidCustomEmails.slice(0, 5).join(", ");
    const suffix = invalidCustomEmails.length > 5 ? "..." : "";
    throw new ApiError(400, `Invalid custom emails: ${sample}${suffix}`);
  }

  if (!normalizedRole && customRecipients.size === 0) {
    throw new ApiError(400, "Provide a role or at least one custom email");
  }

  const roleRecipients = new Set();
  if (normalizedRole) {
    const roleFilter = normalizedRole === "ALL" ? {} : { role: normalizedRole };
    const users = await User.find({ ...roleFilter, isVerified: true }).select("email").lean().exec();
    users.forEach((item) => {
      const normalized = normalizeEmail(item.email);
      if (normalized) roleRecipients.add(normalized);
    });
  }

  const recipients = new Set([...customRecipients, ...roleRecipients]);
  if (!recipients.size) {
    throw new ApiError(400, "No recipients found");
  }

  const mailSettings = await getActiveMailSettings();
  const targets = Array.from(recipients);
  const results = await Promise.allSettled(
    targets.map((email) =>
      sendMail({
        to: email,
        subject: String(subject),
        text: String(text || ""),
        html: String(html || ""),
        smtpConfig: mailSettings
      })
    )
  );

  const failed = [];
  let sentCount = 0;
  results.forEach((item, index) => {
    if (item.status === "fulfilled") {
      sentCount += 1;
    } else {
      failed.push({
        email: targets[index],
        reason: item.reason?.message || "send_failed"
      });
    }
  });

  res.status(200).json({
    message: "Bulk mail processing completed",
    targetRole: normalizedRole || "CUSTOM",
    customRecipientCount: customRecipients.size,
    roleRecipientCount: roleRecipients.size,
    recipientCount: recipients.size,
    sentCount,
    failedCount: failed.length,
    failed
  });
});

const createAnnouncementByAdmin = asyncHandler(async (req, res) => {
  const {
    title,
    message,
    audienceRoles = [ROLES.STUDENT, ROLES.FACULTY],
    subjectId = null,
    classId = null,
    priority = "NORMAL"
  } = req.body;

  const normalizedTitle = String(title || "").trim();
  const normalizedMessage = String(message || "").trim();
  if (!normalizedTitle || !normalizedMessage) {
    throw new ApiError(400, "title and message are required");
  }

  const normalizedRoles = Array.isArray(audienceRoles)
    ? [...new Set(audienceRoles.map((item) => String(item || "").toUpperCase()).filter(Boolean))]
    : [];
  if (!normalizedRoles.length) {
    throw new ApiError(400, "audienceRoles must contain at least one role");
  }
  const invalidRole = normalizedRoles.find((item) => !Object.values(ROLES).includes(item));
  if (invalidRole) throw new ApiError(400, `Invalid audience role: ${invalidRole}`);

  const normalizedPriority = String(priority || "NORMAL").toUpperCase();
  if (!["LOW", "NORMAL", "HIGH"].includes(normalizedPriority)) {
    throw new ApiError(400, "priority must be LOW, NORMAL, or HIGH");
  }

  const normalizedSubjectId = subjectId ? ensureObjectId(subjectId, "subjectId") : null;
  const normalizedClassId = classId ? ensureObjectId(classId, "classId") : null;

  const created = await Announcement.create({
    createdBy: req.user.userId,
    audienceRoles: normalizedRoles,
    subjectId: normalizedSubjectId,
    classId: normalizedClassId,
    title: normalizedTitle.slice(0, 140),
    message: normalizedMessage.slice(0, 3000),
    priority: normalizedPriority
  });

  res.status(201).json({
    message: "Announcement created",
    announcementId: String(created._id)
  });
});

const getAnnouncementsForAdmin = asyncHandler(async (req, res) => {
  const { audienceRole = "" } = req.query;
  const filter = {};
  if (audienceRole) {
    const normalizedRole = String(audienceRole).toUpperCase();
    if (!Object.values(ROLES).includes(normalizedRole)) {
      throw new ApiError(400, "audienceRole is invalid");
    }
    filter.audienceRoles = { $in: [normalizedRole] };
  }

  const rows = await Announcement.find(filter)
    .populate({ path: "createdBy", select: "name role email" })
    .populate({ path: "subjectId", select: "name code" })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
    .exec();

  res.status(200).json({
    announcements: rows.map((item) => ({
      id: String(item._id),
      title: item.title,
      message: item.message,
      priority: item.priority || "NORMAL",
      audienceRoles: item.audienceRoles || [],
      classId: item.classId ? String(item.classId) : null,
      subjectId: item.subjectId?._id ? String(item.subjectId._id) : null,
      subjectName: item.subjectId?.name || null,
      subjectCode: item.subjectId?.code || null,
      createdBy: item.createdBy?.name || null,
      createdByRole: item.createdBy?.role || null,
      createdByEmail: item.createdBy?.email || null,
      createdAt: item.createdAt
    }))
  });
});

module.exports = {
  bulkImportAcademicByAdmin,
  bulkImportUsersByAdmin,
  createSubjectsBulk,
  createAnnouncementByAdmin,
  createUserByAdmin,
  createClass,
  createDepartment,
  createSubject,
  deleteClass,
  deleteDepartment,
  deleteSubject,
  deleteUserByAdmin,
  downloadAcademicTemplate,
  downloadUploadsZipBySection,
  downloadUsersTemplate,
  getClasses,
  getDepartments,
  getUploadsAdmin,
  getMailSettings,
  getSmartboardSettings,
  listSmartboards,
  createSmartboard,
  updateSmartboard,
  deleteSmartboard,
  getSubjects,
  getAnalytics,
  getAnnouncementsForAdmin,
  getUsers,
  sendBulkMail,
  sendTestMail,
  updateClass,
  updateDepartment,
  updateSubject,
  updateUserByAdmin,
  upsertMailSettings,
  upsertSmartboardSettings
};
