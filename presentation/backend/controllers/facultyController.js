const bcrypt = require("bcrypt");
const { Types } = require("mongoose");
const { ROLES } = require("../config/constants");
const { getUserById, updateUserPassword } = require("../models/userModel");
const { getFacultyClasses } = require("../models/facultyClassModel");
const Announcement = require("../mongoModels/Announcement");
const Subject = require("../mongoModels/Subject");
const Upload = require("../mongoModels/Upload");
const User = require("../mongoModels/User");
const { signUploadToken, verifyUploadToken } = require("../config/jwt");
const { upsertUploadRecord } = require("../services/mysqlFileDbService");
const { buildFileUrl, buildUploadUrl, doesUploadedFileExist } = require("../services/storageService");
const { createUpload } = require("../models/uploadModel");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

function uniqueStrings(values = []) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function buildStudentFiltersForClasses({ classIds = [], classDescriptors = [] }) {
  const normalizedClassIds = uniqueStrings(classIds);
  const descriptorMap = new Map();

  (classDescriptors || []).forEach((item) => {
    const branch = String(item?.branch || item?.departmentCode || "").trim().toUpperCase();
    const year = Number(item?.year);
    const section = String(item?.section || "").trim().toUpperCase();
    if (!branch || !Number.isInteger(year) || year <= 0 || !section) return;

    const key = `${branch}|${year}|${section}`;
    if (!descriptorMap.has(key)) {
      descriptorMap.set(key, { branch, year, section });
    }
  });

  const normalizedDescriptors = Array.from(descriptorMap.values());

  const or = [];
  if (normalizedClassIds.length) {
    or.push({ classId: { $in: normalizedClassIds } });
  }
  normalizedDescriptors.forEach((item) => {
    or.push({ branch: item.branch, year: item.year, section: item.section });
  });

  return { classIds: normalizedClassIds, descriptors: normalizedDescriptors, or };
}

function sanitizeText(value, maxLength = 800) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function sanitizeFileName(fileName) {
  return String(fileName || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

function ensureObjectId(value, fieldName) {
  if (!value) throw new ApiError(400, `${fieldName} is required`);
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, `${fieldName} is invalid`);
  return String(value);
}

function buildOfficeViewerUrl(fileUrl) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function getRequestOrigin(req) {
  const proto = String(req.protocol || "http").trim();
  const host = String(req.get("host") || "").trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

async function ensureFaculty(facultyId) {
  const faculty = await getUserById(facultyId);
  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new ApiError(404, "Faculty not found");
  }
  return faculty;
}

async function getAssignedSubjects(facultyId) {
  return Subject.find({ facultyId })
    .populate({
      path: "classId",
      select: "name year section departmentId",
      populate: { path: "departmentId", select: "name code" }
    })
    .sort({ name: 1 })
    .lean()
    .exec();
}

function mapFacultyPresentation(uploadDoc) {
  return {
    id: String(uploadDoc._id),
    subjectId: uploadDoc.subjectId?._id ? String(uploadDoc.subjectId._id) : String(uploadDoc.subjectId || ""),
    subjectName: uploadDoc.subjectId?.name || null,
    subjectCode: uploadDoc.subjectId?.code || null,
    classId: uploadDoc.subjectId?.classId?._id
      ? String(uploadDoc.subjectId.classId._id)
      : uploadDoc.subjectId?.classId
        ? String(uploadDoc.subjectId.classId)
        : null,
    className: uploadDoc.subjectId?.classId?.name || null,
    title: uploadDoc.title || null,
    description: uploadDoc.description || null,
    fileName: uploadDoc.fileName || null,
    fileType: uploadDoc.fileType || null,
    fileUrl: uploadDoc.fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(uploadDoc.fileUrl),
    status: uploadDoc.status,
    feedback: uploadDoc.feedback || null,
    uploadedBy: uploadDoc.uploadedBy?._id ? String(uploadDoc.uploadedBy._id) : null,
    uploadedByName: uploadDoc.uploadedBy?.name || null,
    rollNumber: uploadDoc.uploadedBy?.rollNumber || null,
    uploadedByEmail: uploadDoc.uploadedBy?.email || null,
    reviewedBy: uploadDoc.reviewedBy?._id ? String(uploadDoc.reviewedBy._id) : null,
    reviewedByName: uploadDoc.reviewedBy?.name || null,
    reviewedAt: uploadDoc.reviewedAt || null,
    category: uploadDoc.category || "STUDENT_PRESENTATION",
    createdAt: uploadDoc.createdAt,
    updatedAt: uploadDoc.updatedAt
  };
}

const getFacultyDashboard = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  await ensureFaculty(facultyId);

  const [classes, subjects] = await Promise.all([
    getFacultyClasses(facultyId),
    getAssignedSubjects(facultyId)
  ]);

  const subjectClassIds = subjects
    .map((item) => String(item.classId?._id || item.classId || "").trim())
    .filter(Boolean);
  const facultyClassIds = (classes || []).map((item) => item.id).filter(Boolean);
  const classIds = uniqueStrings([...subjectClassIds, ...facultyClassIds]);
  const subjectIds = subjects.map((item) => item._id);
  const studentFilters = buildStudentFiltersForClasses({
    classIds,
    classDescriptors: [
      ...(classes || []),
      ...(subjects || []).map((item) => ({
        branch: item.classId?.departmentId?.code || null,
        year: item.classId?.year || null,
        section: item.classId?.section || null
      }))
    ]
  });

  const [studentsCount, totalPresentations, recentUploads, announcements] = await Promise.all([
    studentFilters.or.length
      ? User.countDocuments({ role: ROLES.STUDENT, isVerified: true, $or: studentFilters.or })
      : 0,
    subjectIds.length
      ? Upload.countDocuments({ subjectId: { $in: subjectIds }, category: "STUDENT_PRESENTATION" })
      : 0,
    subjectIds.length
      ? Upload.find({
          subjectId: { $in: subjectIds },
          category: "STUDENT_PRESENTATION"
        })
          .populate({ path: "subjectId", select: "name code classId" })
          .populate({ path: "uploadedBy", select: "name email rollNumber" })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
          .exec()
      : [],
    Announcement.find({
      $or: [
        { audienceRoles: { $in: [ROLES.FACULTY] } },
        { createdBy: facultyId }
      ]
    })
      .populate({ path: "createdBy", select: "name role" })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()
      .exec()
  ]);

  const pendingReviewCount = subjectIds.length
    ? await Upload.countDocuments({
        subjectId: { $in: subjectIds },
        category: "STUDENT_PRESENTATION",
        status: { $in: ["UPLOADED", "PENDING"] }
      })
    : 0;

  res.status(200).json({
    metrics: {
      assignedClasses: classes.length,
      subjectsCount: subjects.length,
      studentsCount,
      uploadedCount: totalPresentations,
      pendingCount: pendingReviewCount
    },
    classes,
    subjects: subjects.map((item) => ({
      id: String(item._id),
      name: item.name,
      code: item.code,
      classId: item.classId?._id ? String(item.classId._id) : null,
      className: item.classId?.name || null,
      year: item.classId?.year || null,
      section: item.classId?.section || null,
      department: item.classId?.departmentId?.name || null,
      departmentCode: item.classId?.departmentId?.code || null
    })),
    recentUploads: recentUploads.map(mapFacultyPresentation),
    notifications: announcements.map((item) => ({
      id: String(item._id),
      title: item.title,
      message: item.message,
      priority: item.priority || "NORMAL",
      createdBy: item.createdBy?.name || "System",
      createdByRole: item.createdBy?.role || null,
      createdAt: item.createdAt
    }))
  });
});

const getFacultyClassesList = asyncHandler(async (req, res) => {
  await ensureFaculty(req.user.userId);
  const classes = await getFacultyClasses(req.user.userId);
  res.status(200).json({ classes });
});

const getFacultySubjects = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  await ensureFaculty(facultyId);
  const subjects = await getAssignedSubjects(facultyId);

  const subjectIds = subjects.map((item) => item._id);
  const uploads = subjectIds.length
    ? await Upload.find({ subjectId: { $in: subjectIds }, category: "STUDENT_PRESENTATION" })
        .select("subjectId status")
        .lean()
        .exec()
    : [];

  const uploadStatsMap = uploads.reduce((acc, item) => {
    const key = String(item.subjectId);
    if (!acc[key]) {
      acc[key] = { total: 0, approved: 0, rejected: 0, pending: 0 };
    }
    acc[key].total += 1;
    if (item.status === "APPROVED") acc[key].approved += 1;
    else if (item.status === "REJECTED") acc[key].rejected += 1;
    else acc[key].pending += 1;
    return acc;
  }, {});

  const rows = await Promise.all(
    subjects.map(async (subject) => {
      const classId = subject.classId?._id ? String(subject.classId._id) : null;
      const studentOr = [];
      if (classId) studentOr.push({ classId });
      if (subject.classId?.departmentId?.code && subject.classId?.year && subject.classId?.section) {
        studentOr.push({
          branch: String(subject.classId.departmentId.code).trim().toUpperCase(),
          year: Number(subject.classId.year),
          section: String(subject.classId.section).trim().toUpperCase()
        });
      }

      const studentCount = studentOr.length
        ? await User.countDocuments({ role: ROLES.STUDENT, isVerified: true, $or: studentOr })
        : 0;

      return {
        id: String(subject._id),
        name: subject.name,
        code: subject.code,
        classId,
        className: subject.classId?.name || null,
        year: subject.classId?.year || null,
        section: subject.classId?.section || null,
        department: subject.classId?.departmentId?.name || null,
        departmentCode: subject.classId?.departmentId?.code || null,
        studentCount,
        presentationStats: uploadStatsMap[String(subject._id)] || {
          total: 0,
          approved: 0,
          rejected: 0,
          pending: 0
        }
      };
    })
  );

  res.status(200).json({ subjects: rows });
});

const getFacultySubjectStudents = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const { subjectId } = req.params;
  if (!Types.ObjectId.isValid(subjectId)) throw new ApiError(400, "subjectId is invalid");

  const subject = await Subject.findOne({ _id: subjectId, facultyId }).lean().exec();
  if (!subject) throw new ApiError(404, "Assigned subject not found");

  const students = await User.find({
    role: ROLES.STUDENT,
    classId: subject.classId,
    isVerified: true
  })
    .select("name email rollNumber branch year section mobile profilePhoto lastLoginAt createdAt")
    .sort({ name: 1 })
    .lean()
    .exec();

  const uploads = await Upload.find({
    subjectId,
    category: "STUDENT_PRESENTATION",
    uploadedBy: { $in: students.map((item) => item._id) }
  })
    .select("uploadedBy status createdAt reviewedAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const uploadsByStudent = uploads.reduce((acc, item) => {
    const key = String(item.uploadedBy);
    if (!acc[key]) {
      acc[key] = { total: 0, latestStatus: null, latestAt: null };
    }
    acc[key].total += 1;
    if (!acc[key].latestAt) {
      acc[key].latestStatus = item.status;
      acc[key].latestAt = item.createdAt;
    }
    return acc;
  }, {});

  res.status(200).json({
    subject: {
      id: String(subject._id),
      name: subject.name,
      code: subject.code
    },
    students: students.map((item) => {
      const activity = uploadsByStudent[String(item._id)] || { total: 0, latestStatus: "PENDING", latestAt: null };
      return {
        id: String(item._id),
        name: item.name,
        email: item.email,
        rollNumber: item.rollNumber || null,
        branch: item.branch || null,
        year: item.year || null,
        section: item.section || null,
        mobile: item.mobile || null,
        profilePhoto: item.profilePhoto || null,
        lastLoginAt: item.lastLoginAt || null,
        uploadsCount: activity.total,
        latestUploadStatus: activity.latestStatus || "PENDING",
        latestUploadAt: activity.latestAt || null
      };
    })
  });
});

const getFacultyPresentations = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const { subjectId = "", status = "", search = "" } = req.query;

  const assignedSubjects = await Subject.find({ facultyId }).select("_id").lean().exec();
  const assignedSubjectIds = assignedSubjects.map((item) => item._id);
  if (assignedSubjectIds.length === 0) {
    return res.status(200).json({ presentations: [] });
  }

  const filter = {
    subjectId: { $in: assignedSubjectIds },
    category: "STUDENT_PRESENTATION"
  };

  if (subjectId) {
    if (!Types.ObjectId.isValid(subjectId)) throw new ApiError(400, "subjectId is invalid");
    filter.subjectId = subjectId;
  }
  if (status) {
    filter.status = String(status).toUpperCase();
  }

  const docs = await Upload.find(filter)
    .populate({
      path: "subjectId",
      select: "name code classId",
      populate: { path: "classId", select: "name year section" }
    })
    .populate({ path: "uploadedBy", select: "name email rollNumber branch year section" })
    .populate({ path: "reviewedBy", select: "name email" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const query = String(search || "").trim().toLowerCase();
  const presentations = docs
    .map(mapFacultyPresentation)
    .filter((item) => {
      if (!query) return true;
      return (
        (item.subjectCode || "").toLowerCase().includes(query) ||
        (item.subjectName || "").toLowerCase().includes(query) ||
        (item.uploadedByName || "").toLowerCase().includes(query) ||
        (item.uploadedByEmail || "").toLowerCase().includes(query) ||
        (item.rollNumber || "").toLowerCase().includes(query) ||
        (item.title || "").toLowerCase().includes(query)
      );
    });

  res.status(200).json({ presentations });
});

const reviewFacultyPresentation = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const { presentationId } = req.params;
  const { status, feedback = "" } = req.body;

  if (!Types.ObjectId.isValid(presentationId)) {
    throw new ApiError(400, "presentationId is invalid");
  }
  const nextStatus = String(status || "").toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(nextStatus)) {
    throw new ApiError(400, "status must be APPROVED or REJECTED");
  }

  const upload = await Upload.findById(presentationId).populate({ path: "subjectId", select: "facultyId" }).exec();
  if (!upload || upload.category !== "STUDENT_PRESENTATION") {
    throw new ApiError(404, "Presentation not found");
  }
  if (String(upload.subjectId?.facultyId || "") !== String(facultyId)) {
    throw new ApiError(403, "You can review only your assigned subject presentations");
  }

  upload.status = nextStatus;
  upload.feedback = sanitizeText(feedback, 1200);
  upload.reviewedBy = facultyId;
  upload.reviewedAt = new Date();
  await upload.save();

  try {
    await upsertUploadRecord(upload);
  } catch (error) {
    console.warn("MySQL file DB sync failed:", error?.message || String(error));
  }

  const updated = await Upload.findById(presentationId)
    .populate({ path: "subjectId", select: "name code classId" })
    .populate({ path: "uploadedBy", select: "name email rollNumber" })
    .populate({ path: "reviewedBy", select: "name email" })
    .lean()
    .exec();

  res.status(200).json({
    message: "Presentation review updated",
    presentation: mapFacultyPresentation(updated)
  });
});

const requestLectureMaterialUploadUrl = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const {
    subjectId,
    fileName,
    fileType = "application/octet-stream",
    title = "",
    description = ""
  } = req.body;

  const normalizedSubjectId = ensureObjectId(subjectId, "subjectId");
  if (!fileName) throw new ApiError(400, "fileName is required");

  const subject = await Subject.findOne({ _id: normalizedSubjectId, facultyId }).lean().exec();
  if (!subject) throw new ApiError(403, "Subject is not assigned to you");

  const safeName = sanitizeFileName(fileName);
  const key = `faculty/${String(facultyId)}/${String(subject.code || "subject").toLowerCase()}/${Date.now()}-${safeName}`;
  const sanitizedFileName = sanitizeText(fileName, 240);
  const sanitizedFileType = sanitizeText(fileType, 120);

  const uploadToken = signUploadToken({
    purpose: "faculty_material_upload",
    userId: facultyId,
    subjectId: normalizedSubjectId,
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

  res.status(201).json({
    message: "Lecture material upload URL generated",
    uploadUrl,
    fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(fileUrl),
    uploadToken
  });
});

const completeLectureMaterialUpload = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const { uploadToken, title = "", description = "" } = req.body;
  if (!uploadToken) throw new ApiError(400, "uploadToken is required");

  let decoded;
  try {
    decoded = verifyUploadToken(String(uploadToken));
  } catch (_error) {
    throw new ApiError(400, "uploadToken is invalid or expired");
  }

  if (decoded.purpose !== "faculty_material_upload") {
    throw new ApiError(400, "uploadToken is invalid");
  }

  if (String(decoded.userId || "") !== String(facultyId)) {
    throw new ApiError(403, "Invalid upload token");
  }

  const normalizedSubjectId = ensureObjectId(decoded.subjectId, "subjectId");
  const subject = await Subject.findOne({ _id: normalizedSubjectId, facultyId }).lean().exec();
  if (!subject) throw new ApiError(403, "Subject is not assigned to you");

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
    uploadedBy: facultyId,
    s3Key: key,
    category: "LECTURE_MATERIAL"
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
    uploadedBy: facultyId,
    subjectId: normalizedSubjectId,
    s3Key: key,
    fileUrl,
    status: "UPLOADED",
    title: sanitizeText(title, 140),
    description: sanitizeText(description, 1200),
    fileName: sanitizeText(decoded.fileName, 240),
    fileType: sanitizeText(decoded.fileType, 120),
    category: "LECTURE_MATERIAL"
  });

  res.status(201).json({
    message: "Lecture material uploaded successfully",
    uploadId: created.insertId,
    fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(fileUrl)
  });
});

const getFacultyLectureMaterials = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const { subjectId = "" } = req.query;

  const filter = {
    uploadedBy: facultyId,
    category: "LECTURE_MATERIAL"
  };
  if (subjectId) {
    if (!Types.ObjectId.isValid(subjectId)) throw new ApiError(400, "subjectId is invalid");
    filter.subjectId = subjectId;
  }

  const docs = await Upload.find(filter)
    .populate({ path: "subjectId", select: "name code classId" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const materials = docs.map((item) => ({
    id: String(item._id),
    subjectId: item.subjectId?._id ? String(item.subjectId._id) : null,
    subjectName: item.subjectId?.name || null,
    subjectCode: item.subjectId?.code || null,
    title: item.title || null,
    description: item.description || null,
    fileName: item.fileName || null,
    fileType: item.fileType || null,
    fileUrl: item.fileUrl,
    officeViewerUrl: buildOfficeViewerUrl(item.fileUrl),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

  res.status(200).json({ materials });
});

const getFacultyStudents = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  await ensureFaculty(facultyId);
  const [classes, subjects] = await Promise.all([
    getFacultyClasses(facultyId),
    getAssignedSubjects(facultyId)
  ]);

  const subjectClassIds = subjects
    .map((item) => String(item.classId?._id || item.classId || "").trim())
    .filter(Boolean);
  const facultyClassIds = (classes || []).map((item) => item.id).filter(Boolean);
  const classIds = uniqueStrings([...subjectClassIds, ...facultyClassIds]);
  const studentFilters = buildStudentFiltersForClasses({
    classIds,
    classDescriptors: [
      ...(classes || []),
      ...(subjects || []).map((item) => ({
        branch: item.classId?.departmentId?.code || null,
        year: item.classId?.year || null,
        section: item.classId?.section || null
      }))
    ]
  });

  if (!studentFilters.or.length) {
    return res.status(200).json({ students: [] });
  }

  const students = await User.find({
    role: ROLES.STUDENT,
    isVerified: true,
    $or: studentFilters.or
  })
    .select("name email rollNumber branch year section mobile profilePhoto classId lastLoginAt")
    .sort({ name: 1 })
    .lean()
    .exec();

  const uploads = await Upload.find({
    uploadedBy: { $in: students.map((item) => item._id) },
    category: "STUDENT_PRESENTATION"
  })
    .select("uploadedBy status createdAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const statsByStudent = uploads.reduce((acc, item) => {
    const key = String(item.uploadedBy);
    if (!acc[key]) {
      acc[key] = { total: 0, approved: 0, rejected: 0, latestAt: null };
    }
    acc[key].total += 1;
    if (item.status === "APPROVED") acc[key].approved += 1;
    if (item.status === "REJECTED") acc[key].rejected += 1;
    if (!acc[key].latestAt) acc[key].latestAt = item.createdAt;
    return acc;
  }, {});

  res.status(200).json({
    students: students.map((item) => {
      const stats = statsByStudent[String(item._id)] || {
        total: 0,
        approved: 0,
        rejected: 0,
        latestAt: null
      };
      return {
        id: String(item._id),
        name: item.name,
        email: item.email,
        rollNumber: item.rollNumber || null,
        branch: item.branch || null,
        year: item.year || null,
        section: item.section || null,
        mobile: item.mobile || null,
        profilePhoto: item.profilePhoto || null,
        classId: item.classId ? String(item.classId) : null,
        lastLoginAt: item.lastLoginAt || null,
        activity: {
          totalUploads: stats.total,
          approvedUploads: stats.approved,
          rejectedUploads: stats.rejected,
          latestUploadAt: stats.latestAt
        }
      };
    })
  });
});

const createFacultyAnnouncement = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const { title, message, subjectId = null, classId = null, audienceRoles = [ROLES.STUDENT], priority = "NORMAL" } = req.body;

  const normalizedTitle = String(title || "").trim();
  const normalizedMessage = String(message || "").trim();
  if (!normalizedTitle || !normalizedMessage) {
    throw new ApiError(400, "title and message are required");
  }

  const normalizedPriority = String(priority || "NORMAL").toUpperCase();
  if (!["LOW", "NORMAL", "HIGH"].includes(normalizedPriority)) {
    throw new ApiError(400, "priority must be LOW, NORMAL, or HIGH");
  }

  const normalizedRoles = Array.isArray(audienceRoles)
    ? [...new Set(audienceRoles.map((item) => String(item || "").toUpperCase()).filter(Boolean))]
    : [];
  if (!normalizedRoles.length) {
    throw new ApiError(400, "audienceRoles must contain at least one role");
  }
  const invalidRole = normalizedRoles.find((item) => !Object.values(ROLES).includes(item));
  if (invalidRole) throw new ApiError(400, `Invalid audience role: ${invalidRole}`);

  let normalizedSubjectId = null;
  if (subjectId) {
    normalizedSubjectId = ensureObjectId(subjectId, "subjectId");
    const assigned = await Subject.findOne({ _id: normalizedSubjectId, facultyId }).lean().exec();
    if (!assigned) throw new ApiError(403, "Subject is not assigned to you");
  }

  let normalizedClassId = null;
  if (classId) {
    normalizedClassId = ensureObjectId(classId, "classId");
    const classes = await getFacultyClasses(facultyId);
    const allowed = classes.some((item) => String(item.id) === String(normalizedClassId));
    if (!allowed) throw new ApiError(403, "Class is not assigned to you");
  }

  const created = await Announcement.create({
    createdBy: facultyId,
    audienceRoles: normalizedRoles,
    subjectId: normalizedSubjectId,
    classId: normalizedClassId,
    title: normalizedTitle.slice(0, 140),
    message: normalizedMessage.slice(0, 3000),
    priority: normalizedPriority
  });

  res.status(201).json({
    message: "Announcement sent",
    announcementId: String(created._id)
  });
});

const getFacultyNotifications = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;
  const [announcements, subjects] = await Promise.all([
    Announcement.find({
      $or: [{ audienceRoles: { $in: [ROLES.FACULTY] } }, { createdBy: facultyId }]
    })
      .populate({ path: "createdBy", select: "name role" })
      .populate({ path: "subjectId", select: "name code" })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean()
      .exec(),
    Subject.find({ facultyId }).select("_id").lean().exec()
  ]);

  const subjectIds = subjects.map((item) => item._id);
  const pendingReviewCount = subjectIds.length
    ? await Upload.countDocuments({
        subjectId: { $in: subjectIds },
        category: "STUDENT_PRESENTATION",
        status: { $in: ["UPLOADED", "PENDING"] }
      })
    : 0;

  const notifications = announcements.map((item) => ({
    id: String(item._id),
    type: "ANNOUNCEMENT",
    title: item.title,
    message: item.message,
    priority: item.priority || "NORMAL",
    subjectName: item.subjectId?.name || null,
    subjectCode: item.subjectId?.code || null,
    createdBy: item.createdBy?.name || "System",
    createdByRole: item.createdBy?.role || null,
    createdAt: item.createdAt
  }));

  if (pendingReviewCount > 0) {
    notifications.unshift({
      id: "system-pending-review",
      type: "SYSTEM_ALERT",
      title: "Pending Presentation Reviews",
      message: `You have ${pendingReviewCount} presentation(s) waiting for review.`,
      priority: "HIGH",
      createdBy: "System",
      createdByRole: null,
      createdAt: new Date()
    });
  }

  res.status(200).json({
    notifications: notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 80)
  });
});

const getFacultyProfile = asyncHandler(async (req, res) => {
  const faculty = await ensureFaculty(req.user.userId);
  res.status(200).json({
    profile: {
      id: faculty.id,
      name: faculty.name,
      email: faculty.email,
      role: faculty.role,
      mobile: faculty.mobile,
      profilePhoto: faculty.profilePhoto,
      classId: faculty.classId,
      lastLoginAt: faculty.lastLoginAt || null
    }
  });
});

const updateFacultyProfile = asyncHandler(async (req, res) => {
  const faculty = await ensureFaculty(req.user.userId);
  const patch = {};

  if (req.body.name !== undefined) {
    const next = String(req.body.name || "").trim();
    if (!next) throw new ApiError(400, "name cannot be empty");
    patch.name = next;
  }
  if (req.body.mobile !== undefined) {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "");
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      throw new ApiError(400, "mobile must be a valid 10-digit number");
    }
    patch.mobile = mobile || null;
  }
  if (req.body.profilePhoto !== undefined) {
    const value = String(req.body.profilePhoto || "").trim();
    if (value && !value.startsWith("data:image/") && !/^https?:\/\//i.test(value)) {
      throw new ApiError(400, "profilePhoto must be an image data URL or valid URL");
    }
    patch.profilePhoto = value || null;
  }

  if (!Object.keys(patch).length) throw new ApiError(400, "No fields provided for update");

  const updated = await User.findByIdAndUpdate(faculty.id, { $set: patch }, { new: true })
    .lean()
    .exec();

  res.status(200).json({
    message: "Profile updated",
    profile: {
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      mobile: updated.mobile || null,
      profilePhoto: updated.profilePhoto || null,
      classId: updated.classId ? String(updated.classId) : null,
      lastLoginAt: updated.lastLoginAt || null
    }
  });
});

const changeFacultyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }
  if (String(newPassword).length < 8) {
    throw new ApiError(400, "newPassword must be at least 8 characters");
  }

  const faculty = await ensureFaculty(req.user.userId);
  const valid = await bcrypt.compare(String(currentPassword), faculty.passwordHash || "");
  if (!valid) throw new ApiError(401, "Current password is incorrect");

  const hash = await bcrypt.hash(String(newPassword), 12);
  await updateUserPassword(faculty.id, hash);

  res.status(200).json({ message: "Password changed successfully" });
});

const getSmartboardSummary = asyncHandler(async (req, res) => {
  const facultyId = req.user.userId;

  const subjectDocs = await Subject.find({ facultyId }).sort({ name: 1 }).lean().exec();
  if (subjectDocs.length === 0) {
    return res.status(200).json({ smartboardData: [] });
  }

  const subjectIdList = subjectDocs.map((item) => item._id);
  const uploads = await Upload.find({
    subjectId: { $in: subjectIdList },
    category: { $in: ["STUDENT_PRESENTATION", "LECTURE_MATERIAL"] }
  })
    .populate({ path: "uploadedBy", select: "email rollNumber name role" })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const uploadsBySubject = new Map();
  uploads.forEach((upload) => {
    const key = String(upload.subjectId);
    if (!uploadsBySubject.has(key)) uploadsBySubject.set(key, []);
    uploadsBySubject.get(key).push(upload);
  });

  const rows = [];
  subjectDocs.forEach((subject) => {
    const subjectId = String(subject._id);
    const subjectUploads = uploadsBySubject.get(subjectId) || [];

    if (subjectUploads.length === 0) {
      rows.push({
        subjectId,
        subjectName: subject.name,
        uploadId: null,
        studentId: null,
        rollNumber: null,
        fileUrl: null,
        uploadedAt: null,
        category: null
      });
      return;
    }

    subjectUploads.forEach((upload) => {
      rows.push({
        subjectId,
        subjectName: subject.name,
        uploadId: upload._id ? String(upload._id) : null,
        studentId: upload.uploadedBy?._id ? String(upload.uploadedBy._id) : null,
        rollNumber:
          upload.uploadedBy?.rollNumber ||
          upload.uploadedBy?.name ||
          upload.uploadedBy?.email ||
          null,
        fileUrl: upload.fileUrl || null,
        uploadedAt: upload.createdAt || null,
        category: upload.category || "STUDENT_PRESENTATION",
        title: upload.title || null,
        status: upload.status || null
      });
    });
  });

  res.status(200).json({
    smartboardData: rows
  });
});

module.exports = {
  changeFacultyPassword,
  completeLectureMaterialUpload,
  createFacultyAnnouncement,
  getFacultyClassesList,
  getFacultyDashboard,
  getFacultyLectureMaterials,
  getFacultyNotifications,
  getFacultyPresentations,
  getFacultyProfile,
  getFacultyStudents,
  getFacultySubjectStudents,
  getFacultySubjects,
  getSmartboardSummary,
  requestLectureMaterialUploadUrl,
  reviewFacultyPresentation,
  updateFacultyProfile
};
