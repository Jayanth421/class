const bcrypt = require("bcrypt");
const { Types } = require("mongoose");
const { ROLES } = require("../config/constants");
const { getUserById, updateUserPassword } = require("../models/userModel");
const { getSubjectById } = require("../models/subjectModel");
const { createUpload } = require("../models/uploadModel");
const Announcement = require("../mongoModels/Announcement");
const Class = require("../mongoModels/Class");
const Department = require("../mongoModels/Department");
const Subject = require("../mongoModels/Subject");
const Upload = require("../mongoModels/Upload");
const User = require("../mongoModels/User");
const { signUploadToken, verifyUploadToken } = require("../config/jwt");
const { deleteUploadRecord, upsertUploadRecord } = require("../services/mysqlFileDbService");
const { buildFileUrl, buildUploadUrl, doesUploadedFileExist } = require("../services/storageService");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

function buildOfficeViewerUrl(fileUrl) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function getRequestOrigin(req) {
  const proto = String(req.protocol || "http").trim();
  const host = String(req.get("host") || "").trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

function sanitizeFileName(fileName) {
  return String(fileName || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

function sanitizeText(value, maxLength = 600) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function ensureObjectId(value, fieldName) {
  if (!value) throw new ApiError(400, `${fieldName} is required`);
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, `${fieldName} is invalid`);
  return String(value);
}

function sanitizePathPart(value, fallback = "unknown") {
  const normalized = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  return normalized || fallback;
}

async function getClassStorageContext(classId) {
  if (!classId || !Types.ObjectId.isValid(classId)) return null;

  const classDoc = await Class.findById(classId)
    .select("year section departmentId")
    .populate({ path: "departmentId", select: "code" })
    .lean()
    .exec();

  if (!classDoc) return null;
  return {
    year: classDoc.year || null,
    section: classDoc.section || null,
    departmentCode: classDoc.departmentId?.code || null
  };
}

async function resolveStudentClassId(user) {
  if (!user) return null;
  if (user.classId) return user.classId;

  if (!user.branch || !user.year || !user.section) return null;

  const department = await Department.findOne({ code: String(user.branch).toUpperCase() })
    .select("_id")
    .lean()
    .exec();
  if (!department?._id) return null;

  const classDoc = await Class.findOne({
    departmentId: department._id,
    year: Number(user.year),
    section: String(user.section).toUpperCase()
  })
    .select("_id")
    .lean()
    .exec();

  return classDoc?._id ? String(classDoc._id) : null;
}

async function ensureStudentAndClass(userId) {
  const user = await getUserById(userId);
  if (!user || user.role !== ROLES.STUDENT) throw new ApiError(404, "Student not found");
  const classId = await resolveStudentClassId(user);
  return { user, classId };
}

async function getClassSubjects(classId) {
  if (!classId || !Types.ObjectId.isValid(classId)) return [];
  const subjects = await Subject.find({ classId })
    .populate({ path: "facultyId", select: "name email" })
    .sort({ name: 1 })
    .lean()
    .exec();

  return subjects.map((item) => ({
    id: String(item._id),
    name: item.name,
    code: item.code,
    classId: item.classId ? String(item.classId) : null,
    facultyId: item.facultyId?._id ? String(item.facultyId._id) : null,
    facultyName: item.facultyId?.name || null,
    facultyEmail: item.facultyId?.email || null
  }));
}

function mapPresentation(uploadDoc) {
  return {
    id: String(uploadDoc._id),
    subjectId: uploadDoc.subjectId?._id ? String(uploadDoc.subjectId._id) : String(uploadDoc.subjectId || ""),
    subjectName: uploadDoc.subjectId?.name || null,
    subjectCode: uploadDoc.subjectId?.code || null,
    title: uploadDoc.title || null,
    description: uploadDoc.description || null,
    fileName: uploadDoc.fileName || null,
    fileType: uploadDoc.fileType || null,
    s3Key: uploadDoc.s3Key || null,
    fileUrl: uploadDoc.fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(uploadDoc.fileUrl),
    status: uploadDoc.status,
    feedback: uploadDoc.feedback || null,
    reviewedBy: uploadDoc.reviewedBy?._id ? String(uploadDoc.reviewedBy._id) : null,
    reviewedByName: uploadDoc.reviewedBy?.name || null,
    reviewedAt: uploadDoc.reviewedAt || null,
    category: uploadDoc.category || "STUDENT_PRESENTATION",
    createdAt: uploadDoc.createdAt,
    updatedAt: uploadDoc.updatedAt
  };
}

async function getStudentPresentations(studentId, options = {}) {
  const filter = {
    uploadedBy: studentId,
    category: "STUDENT_PRESENTATION"
  };

  if (options.subjectId && Types.ObjectId.isValid(options.subjectId)) {
    filter.subjectId = options.subjectId;
  }
  if (options.status) {
    filter.status = String(options.status).toUpperCase();
  }

  const docs = await Upload.find(filter)
    .populate({ path: "subjectId", select: "name code classId" })
    .populate({ path: "reviewedBy", select: "name email" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return docs.map(mapPresentation);
}

async function validateSubjectForStudentClass(subjectId, classId) {
  const subject = await getSubjectById(subjectId);
  if (!subject) throw new ApiError(404, "Subject not found");
  if (String(classId || "") !== String(subject.classId || "")) {
    throw new ApiError(403, "You can upload only for your assigned class subjects");
  }
  return subject;
}

function buildStudentUploadKey({ user, subject, fileName, storageContext = null }) {
  const safeName = sanitizeFileName(fileName);
  const yearSegment = sanitizePathPart(storageContext?.year || user.year || "year-unknown");
  const departmentSegment = sanitizePathPart(
    String(storageContext?.departmentCode || user.branch || "department-unknown").toLowerCase()
  );
  const sectionSegment = sanitizePathPart(
    String(storageContext?.section || user.section || "section-unknown").toLowerCase()
  );
  const subjectSegment = sanitizePathPart(
    String(subject.code || subject.id || "subject").toLowerCase()
  );
  const studentSegment = sanitizePathPart(
    String(user.rollNumber || user.name || user.id || "student").toLowerCase(),
    "student"
  );

  return `${yearSegment}/${departmentSegment}/${sectionSegment}/${subjectSegment}/student/${studentSegment}_${Date.now()}-${safeName}`;
}

async function createPresentationUploadIntent({
  student,
  classId,
  subjectId,
  fileName,
  fileType
}) {
  const normalizedSubjectId = ensureObjectId(subjectId, "subjectId");
  const subject = await validateSubjectForStudentClass(normalizedSubjectId, classId);
  const storageContext = await getClassStorageContext(classId);

  const key = buildStudentUploadKey({ user: student, subject, fileName, storageContext });
  return {
    message: "Upload URL generated",
    subjectId: normalizedSubjectId,
    key,
    fileName: sanitizeText(fileName, 240),
    fileType: sanitizeText(fileType, 120)
  };
}

async function getStudentAnnouncements({ classId }) {
  const docs = await Announcement.find({
    audienceRoles: { $in: [ROLES.STUDENT] },
    $or: [
      { classId: null },
      ...(classId && Types.ObjectId.isValid(classId) ? [{ classId }] : [])
    ]
  })
    .populate({ path: "createdBy", select: "name role" })
    .populate({ path: "subjectId", select: "name code" })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean()
    .exec();

  return docs.map((item) => ({
    id: String(item._id),
    type: "ANNOUNCEMENT",
    title: item.title,
    message: item.message,
    priority: item.priority || "NORMAL",
    subjectId: item.subjectId?._id ? String(item.subjectId._id) : null,
    subjectName: item.subjectId?.name || null,
    subjectCode: item.subjectId?.code || null,
    createdBy: item.createdBy?.name || "System",
    createdByRole: item.createdBy?.role || null,
    createdAt: item.createdAt
  }));
}

const getStudentHome = asyncHandler(async (req, res) => {
  const { user, classId } = await ensureStudentAndClass(req.user.userId);
  const subjects = await getClassSubjects(classId);
  const subjectIdList = subjects.map((item) => item.id);

  const uploads = await Upload.find({
    uploadedBy: user.id,
    category: "STUDENT_PRESENTATION",
    ...(subjectIdList.length > 0 ? { subjectId: { $in: subjectIdList } } : {})
  })
    .populate({ path: "subjectId", select: "name code" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const latestUploadBySubject = new Map();
  uploads.forEach((item) => {
    const key = item.subjectId?._id ? String(item.subjectId._id) : String(item.subjectId || "");
    if (key && !latestUploadBySubject.has(key)) {
      latestUploadBySubject.set(key, item);
    }
  });

  const subjectsWithStatus = subjects.map((subject) => {
    const latest = latestUploadBySubject.get(subject.id);
    return {
      ...subject,
      uploadStatus: latest?.status || "PENDING",
      uploadedAt: latest?.createdAt || null,
      latestFileUrl: latest?.fileUrl || null
    };
  });

  const uploadedCount = uploads.length;
  const subjectsCount = subjects.length;
  const pendingCount = Math.max(subjectsCount - subjectsWithStatus.filter((s) => s.uploadedAt).length, 0);
  const recentUploads = uploads.slice(0, 6).map(mapPresentation);
  const notifications = await getStudentAnnouncements({ classId });

  const activityHistory = uploads.slice(0, 10).map((item) => ({
    id: String(item._id),
    type: "UPLOAD",
    title: item.title || item.subjectId?.name || "Presentation",
    message: `Uploaded ${item.fileName || "file"} (${item.status})`,
    status: item.status,
    createdAt: item.createdAt
  }));

  res.status(200).json({
    profile: {
      id: user.id,
      rollNumber: user.rollNumber,
      name: user.name,
      email: user.email,
      year: user.year,
      branch: user.branch,
      section: user.section,
      mobile: user.mobile,
      profilePhoto: user.profilePhoto,
      lastLoginAt: user.lastLoginAt || null
    },
    metrics: {
      subjectsCount,
      uploadedCount,
      pendingCount
    },
    subjects: subjectsWithStatus,
    recentUploads,
    notifications: notifications.slice(0, 8),
    activityHistory
  });
});

const getStudentSubjects = asyncHandler(async (req, res) => {
  const { user, classId } = await ensureStudentAndClass(req.user.userId);
  const subjects = await getClassSubjects(classId);
  const uploads = await getStudentPresentations(user.id);
  const uploadsBySubject = uploads.reduce((acc, item) => {
    const key = String(item.subjectId || "");
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const rows = subjects.map((subject) => {
    const related = uploadsBySubject[subject.id] || [];
    const latest = related[0] || null;
    return {
      ...subject,
      uploadStatus: latest?.status || "PENDING",
      uploadedAt: latest?.createdAt || null,
      latestFileUrl: latest?.fileUrl || null,
      presentations: related.slice(0, 8)
    };
  });

  res.status(200).json({ subjects: rows });
});

const getStudentUploads = asyncHandler(async (req, res) => {
  const { status = "", subjectId = "" } = req.query;
  const uploads = await getStudentPresentations(req.user.userId, { status, subjectId });
  res.status(200).json({ uploads });
});

const requestUploadUrl = asyncHandler(async (req, res) => {
  const { subjectId, fileName, fileType = "application/octet-stream" } = req.body;
  if (!subjectId || !fileName) {
    throw new ApiError(400, "subjectId and fileName are required");
  }

  const { user, classId } = await ensureStudentAndClass(req.user.userId);
  const intent = await createPresentationUploadIntent({
    student: user,
    classId,
    subjectId,
    fileName,
    fileType
  });

  const uploadToken = signUploadToken({
    purpose: "student_presentation_upload",
    userId: user.id,
    subjectId: intent.subjectId,
    key: intent.key,
    fileName: intent.fileName,
    fileType: intent.fileType
  });

  const origin = getRequestOrigin(req);
  const uploadUrl = await buildUploadUrl({
    origin,
    key: intent.key,
    contentType: intent.fileType,
    uploadToken
  });
  const fileUrl = buildFileUrl({ origin, key: intent.key });

  res.status(201).json({
    message: intent.message,
    uploadUrl,
    fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(fileUrl),
    uploadToken
  });
});

const completeStudentPresentationUpload = asyncHandler(async (req, res) => {
  const { uploadToken, title = "", description = "" } = req.body;
  if (!uploadToken) throw new ApiError(400, "uploadToken is required");

  let decoded;
  try {
    decoded = verifyUploadToken(String(uploadToken));
  } catch (_error) {
    throw new ApiError(400, "uploadToken is invalid or expired");
  }

  if (decoded.purpose !== "student_presentation_upload") {
    throw new ApiError(400, "uploadToken is invalid");
  }

  if (String(decoded.userId || "") !== String(req.user.userId)) {
    throw new ApiError(403, "Invalid upload token");
  }

  const { user, classId } = await ensureStudentAndClass(req.user.userId);

  const normalizedSubjectId = ensureObjectId(decoded.subjectId, "subjectId");
  await validateSubjectForStudentClass(normalizedSubjectId, classId);

  const key = String(decoded.key || "").trim();
  if (!key) throw new ApiError(400, "uploadToken is invalid");

  let exists = false;
  try {
    exists = await doesUploadedFileExist({ key });
  } catch (_error) {
    throw new ApiError(500, "Failed to verify uploaded file in storage");
  }

  if (!exists) {
    throw new ApiError(400, "Storage upload not found. Please retry uploading the file.");
  }

  const alreadyCompleted = await Upload.findOne({
    uploadedBy: user.id,
    s3Key: key,
    category: "STUDENT_PRESENTATION"
  })
    .select("_id fileUrl")
    .lean()
    .exec();

  const origin = getRequestOrigin(req);
  const fileUrl = alreadyCompleted?.fileUrl || buildFileUrl({ origin, key });

  if (alreadyCompleted?._id) {
    return res.status(200).json({
      message: "Upload already completed",
      uploadId: String(alreadyCompleted._id),
      fileUrl,
      officeViewerUrl: buildOfficeViewerUrl(fileUrl)
    });
  }

  const created = await createUpload({
    uploadedBy: user.id,
    subjectId: normalizedSubjectId,
    s3Key: key,
    fileUrl,
    status: "UPLOADED",
    title: sanitizeText(title, 140),
    description: sanitizeText(description, 1200),
    fileName: sanitizeText(decoded.fileName, 240),
    fileType: sanitizeText(decoded.fileType, 120),
    category: "STUDENT_PRESENTATION"
  });

  res.status(201).json({
    message: "Upload completed successfully",
    uploadId: created.insertId,
    fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(fileUrl)
  });
});

const updateStudentPresentation = asyncHandler(async (req, res) => {
  const { presentationId } = req.params;
  if (!Types.ObjectId.isValid(presentationId)) {
    throw new ApiError(400, "presentationId is invalid");
  }

  const { user, classId } = await ensureStudentAndClass(req.user.userId);
  const existing = await Upload.findOne({
    _id: presentationId,
    uploadedBy: user.id,
    category: "STUDENT_PRESENTATION"
  })
    .lean()
    .exec();
  if (!existing) throw new ApiError(404, "Presentation not found");

  const patch = {};
  if (req.body.title !== undefined) patch.title = sanitizeText(req.body.title, 140);
  if (req.body.description !== undefined) patch.description = sanitizeText(req.body.description, 1200);
  if (req.body.subjectId !== undefined) {
    const nextSubjectId = ensureObjectId(req.body.subjectId, "subjectId");
    await validateSubjectForStudentClass(nextSubjectId, classId);
    patch.subjectId = nextSubjectId;
  }

  if (!Object.keys(patch).length) throw new ApiError(400, "No fields provided for update");

  const updated = await Upload.findByIdAndUpdate(
    presentationId,
    { $set: patch },
    { new: true }
  )
    .populate({ path: "subjectId", select: "name code classId" })
    .populate({ path: "reviewedBy", select: "name email" })
    .lean()
    .exec();

  try {
    await upsertUploadRecord(updated);
  } catch (error) {
    console.warn("MySQL file DB sync failed:", error?.message || String(error));
  }

  res.status(200).json({
    message: "Presentation updated",
    presentation: mapPresentation(updated)
  });
});

const requestPresentationReplaceUploadUrl = asyncHandler(async (req, res) => {
  const { presentationId } = req.params;
  const { fileName, fileType = "application/octet-stream" } = req.body;
  if (!Types.ObjectId.isValid(presentationId)) {
    throw new ApiError(400, "presentationId is invalid");
  }
  if (!fileName) throw new ApiError(400, "fileName is required");

  const { user } = await ensureStudentAndClass(req.user.userId);
  const existing = await Upload.findOne({
    _id: presentationId,
    uploadedBy: user.id,
    category: "STUDENT_PRESENTATION"
  })
    .populate({
      path: "subjectId",
      select: "code classId",
      populate: {
        path: "classId",
        select: "year section departmentId",
        populate: { path: "departmentId", select: "code" }
      }
    })
    .exec();
  if (!existing) throw new ApiError(404, "Presentation not found");

  const subjectCode = existing.subjectId?.code || "subject";
  const storageContext = {
    year: existing.subjectId?.classId?.year || user.year || null,
    section: existing.subjectId?.classId?.section || user.section || null,
    departmentCode:
      existing.subjectId?.classId?.departmentId?.code || user.branch || null
  };
  const key = buildStudentUploadKey({
    user,
    subject: { code: subjectCode },
    fileName,
    storageContext
  });

  const sanitizedFileName = sanitizeText(fileName, 240);
  const sanitizedFileType = sanitizeText(fileType, 120);
  const uploadToken = signUploadToken({
    purpose: "student_presentation_replace",
    userId: user.id,
    presentationId: String(existing._id),
    key,
    fileName: sanitizedFileName,
    fileType: sanitizedFileType
  });

  const origin = getRequestOrigin(req);
  const uploadUrl = await buildUploadUrl({
    origin,
    key,
    contentType: sanitizedFileType || fileType,
    uploadToken
  });
  const fileUrl = buildFileUrl({ origin, key });

  res.status(200).json({
    message: "Replacement upload URL generated",
    uploadUrl,
    fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(fileUrl),
    uploadToken
  });
});

const completeStudentPresentationReplace = asyncHandler(async (req, res) => {
  const { presentationId } = req.params;
  const { uploadToken } = req.body;

  if (!Types.ObjectId.isValid(presentationId)) {
    throw new ApiError(400, "presentationId is invalid");
  }
  if (!uploadToken) throw new ApiError(400, "uploadToken is required");

  let decoded;
  try {
    decoded = verifyUploadToken(String(uploadToken));
  } catch (_error) {
    throw new ApiError(400, "uploadToken is invalid or expired");
  }

  if (decoded.purpose !== "student_presentation_replace") {
    throw new ApiError(400, "uploadToken is invalid");
  }

  if (String(decoded.userId || "") !== String(req.user.userId)) {
    throw new ApiError(403, "Invalid upload token");
  }

  if (String(decoded.presentationId || "") !== String(presentationId)) {
    throw new ApiError(400, "uploadToken does not match presentationId");
  }

  const { user } = await ensureStudentAndClass(req.user.userId);

  const key = String(decoded.key || "").trim();
  if (!key) throw new ApiError(400, "uploadToken is invalid");

  let exists = false;
  try {
    exists = await doesUploadedFileExist({ key });
  } catch (_error) {
    throw new ApiError(500, "Failed to verify uploaded file in storage");
  }

  if (!exists) {
    throw new ApiError(400, "Storage upload not found. Please retry uploading the file.");
  }

  const upload = await Upload.findOne({
    _id: presentationId,
    uploadedBy: user.id,
    category: "STUDENT_PRESENTATION"
  }).exec();
  if (!upload) throw new ApiError(404, "Presentation not found");

  const origin = getRequestOrigin(req);
  const fileUrl = buildFileUrl({ origin, key });

  upload.s3Key = key;
  upload.fileUrl = fileUrl;
  upload.fileName = sanitizeText(decoded.fileName, 240);
  upload.fileType = sanitizeText(decoded.fileType, 120);
  upload.status = "UPLOADED";
  upload.feedback = null;
  upload.reviewedBy = null;
  upload.reviewedAt = null;
  await upload.save();

  try {
    await upsertUploadRecord(upload);
  } catch (error) {
    console.warn("MySQL file DB sync failed:", error?.message || String(error));
  }

  res.status(200).json({
    message: "Presentation file replaced successfully",
    fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(fileUrl)
  });
});

const deleteStudentPresentation = asyncHandler(async (req, res) => {
  const { presentationId } = req.params;
  if (!Types.ObjectId.isValid(presentationId)) {
    throw new ApiError(400, "presentationId is invalid");
  }

  const { user } = await ensureStudentAndClass(req.user.userId);
  const deleted = await Upload.deleteOne({
    _id: presentationId,
    uploadedBy: user.id,
    category: "STUDENT_PRESENTATION"
  });
  if (!deleted.deletedCount) throw new ApiError(404, "Presentation not found");

  try {
    await deleteUploadRecord(presentationId);
  } catch (error) {
    console.warn("MySQL file DB delete failed:", error?.message || String(error));
  }

  res.status(200).json({ message: "Presentation deleted" });
});

const getStudentNotifications = asyncHandler(async (req, res) => {
  const { user, classId } = await ensureStudentAndClass(req.user.userId);
  const [announcements, reviewUpdates] = await Promise.all([
    getStudentAnnouncements({ classId }),
    Upload.find({
      uploadedBy: user.id,
      category: "STUDENT_PRESENTATION",
      status: { $in: ["APPROVED", "REJECTED"] }
    })
      .populate({ path: "subjectId", select: "name code" })
      .sort({ reviewedAt: -1, updatedAt: -1 })
      .limit(40)
      .lean()
      .exec()
  ]);

  const reviewNotifications = reviewUpdates.map((item) => ({
    id: `review-${String(item._id)}`,
    type: "REVIEW_STATUS",
    title: item.status === "APPROVED" ? "Presentation Approved" : "Presentation Rejected",
    message:
      item.feedback ||
      `Your presentation for ${item.subjectId?.name || item.subjectId?.code || "subject"} is ${item.status}.`,
    status: item.status,
    subjectId: item.subjectId?._id ? String(item.subjectId._id) : null,
    subjectName: item.subjectId?.name || null,
    subjectCode: item.subjectId?.code || null,
    createdAt: item.reviewedAt || item.updatedAt || item.createdAt
  }));

  const notifications = [...announcements, ...reviewNotifications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 80);

  res.status(200).json({ notifications });
});

const getStudentActivity = asyncHandler(async (req, res) => {
  const { user } = await ensureStudentAndClass(req.user.userId);
  const uploads = await getStudentPresentations(user.id);

  const uploadActivity = uploads.slice(0, 50).map((item) => ({
    id: `upload-${item.id}`,
    type: "UPLOAD",
    title: item.title || item.subjectName || "Presentation",
    message: `Uploaded ${item.fileName || "presentation"} (${item.status})`,
    status: item.status,
    createdAt: item.createdAt
  }));

  const reviewActivity = uploads
    .filter((item) => item.reviewedAt && ["APPROVED", "REJECTED"].includes(item.status))
    .slice(0, 50)
    .map((item) => ({
      id: `review-${item.id}`,
      type: "REVIEW",
      title: item.status === "APPROVED" ? "Approved" : "Rejected",
      message: item.feedback || `${item.subjectName || "Presentation"} review updated`,
      status: item.status,
      createdAt: item.reviewedAt
    }));

  const loginActivity = [];
  if (user.lastLoginAt) {
    loginActivity.push({
      id: "last-login",
      type: "LOGIN",
      title: "Last Login",
      message: "You logged in successfully.",
      status: "SUCCESS",
      createdAt: user.lastLoginAt
    });
  }

  const activity = [...loginActivity, ...uploadActivity, ...reviewActivity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.status(200).json({ activity });
});

const getStudentProfile = asyncHandler(async (req, res) => {
  const { user } = await ensureStudentAndClass(req.user.userId);
  res.status(200).json({
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rollNumber: user.rollNumber,
      branch: user.branch,
      year: user.year,
      section: user.section,
      mobile: user.mobile,
      profilePhoto: user.profilePhoto,
      classId: user.classId,
      lastLoginAt: user.lastLoginAt || null
    }
  });
});

const updateStudentProfile = asyncHandler(async (req, res) => {
  const { user } = await ensureStudentAndClass(req.user.userId);
  const patch = {};

  if (req.body.name !== undefined) {
    const value = String(req.body.name || "").trim();
    if (!value) throw new ApiError(400, "name cannot be empty");
    patch.name = value;
  }
  if (req.body.mobile !== undefined) {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      throw new ApiError(400, "mobile must be a valid 10-digit number");
    }
    patch.mobile = mobile;
  }
  if (req.body.profilePhoto !== undefined) {
    const value = String(req.body.profilePhoto || "").trim();
    if (value && !value.startsWith("data:image/") && !/^https?:\/\//i.test(value)) {
      throw new ApiError(400, "profilePhoto must be an image data URL or valid URL");
    }
    patch.profilePhoto = value || null;
  }

  if (!Object.keys(patch).length) {
    throw new ApiError(400, "No fields provided for update");
  }

  const updated = await User
    .findByIdAndUpdate(user.id, { $set: patch }, { new: true })
    .lean()
    .exec();

  res.status(200).json({
    message: "Profile updated",
    profile: {
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      rollNumber: updated.rollNumber || null,
      branch: updated.branch || null,
      year: updated.year || null,
      section: updated.section || null,
      mobile: updated.mobile || null,
      profilePhoto: updated.profilePhoto || null,
      classId: updated.classId ? String(updated.classId) : null,
      lastLoginAt: updated.lastLoginAt || null
    }
  });
});

const changeStudentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }
  if (String(newPassword).length < 8) {
    throw new ApiError(400, "newPassword must be at least 8 characters");
  }

  const { user } = await ensureStudentAndClass(req.user.userId);
  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash || "");
  if (!valid) throw new ApiError(401, "Current password is incorrect");

  const hash = await bcrypt.hash(String(newPassword), 12);
  await updateUserPassword(user.id, hash);

  res.status(200).json({ message: "Password changed successfully" });
});

module.exports = {
  changeStudentPassword,
  completeStudentPresentationReplace,
  completeStudentPresentationUpload,
  deleteStudentPresentation,
  getStudentActivity,
  getStudentHome,
  getStudentNotifications,
  getStudentProfile,
  getStudentSubjects,
  getStudentUploads,
  requestPresentationReplaceUploadUrl,
  requestUploadUrl,
  updateStudentPresentation,
  updateStudentProfile
};
