const Upload = require("../mongoModels/Upload");
const { upsertUploadRecord } = require("../services/mysqlFileDbService");

async function createUpload({
  uploadedBy,
  subjectId,
  s3Key,
  fileUrl,
  status = "UPLOADED",
  title = null,
  description = null,
  fileName = null,
  fileType = null,
  category = "STUDENT_PRESENTATION"
}) {
  const created = await Upload.create({
    uploadedBy,
    subjectId,
    s3Key,
    fileUrl,
    status,
    title,
    description,
    fileName,
    fileType,
    category
  });

  try {
    await upsertUploadRecord(created);
  } catch (error) {
    console.warn("MySQL file DB sync failed:", error?.message || String(error));
  }

  return { insertId: created.id };
}

async function getUploadsByUserId(userId) {
  const rows = await Upload.find({ uploadedBy: userId })
    .populate({ path: "subjectId", select: "name code" })
    .sort({ createdAt: -1 })
    .exec();

  return rows.map((uploadDoc) => ({
    id: uploadDoc.id,
    subjectId: uploadDoc.subjectId?.id || null,
    subjectName: uploadDoc.subjectId?.name || null,
    subjectCode: uploadDoc.subjectId?.code || null,
    s3Key: uploadDoc.s3Key,
    fileUrl: uploadDoc.fileUrl,
    title: uploadDoc.title || null,
    description: uploadDoc.description || null,
    fileName: uploadDoc.fileName || null,
    fileType: uploadDoc.fileType || null,
    category: uploadDoc.category || "STUDENT_PRESENTATION",
    feedback: uploadDoc.feedback || null,
    reviewedAt: uploadDoc.reviewedAt || null,
    status: uploadDoc.status,
    createdAt: uploadDoc.createdAt
  }));
}

async function countUploadsByUserId(userId) {
  return Upload.countDocuments({ uploadedBy: userId });
}

module.exports = {
  countUploadsByUserId,
  createUpload,
  getUploadsByUserId
};
