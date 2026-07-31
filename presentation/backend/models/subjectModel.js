const { Types } = require("mongoose");
const Subject = require("../mongoModels/Subject");

function mapSubject(subjectDoc) {
  if (!subjectDoc) return null;

  return {
    id: subjectDoc.id,
    name: subjectDoc.name,
    code: subjectDoc.code,
    classId: subjectDoc.classId ? String(subjectDoc.classId) : null,
    facultyId: subjectDoc.facultyId ? String(subjectDoc.facultyId) : null
  };
}

async function getSubjectById(subjectId) {
  if (!Types.ObjectId.isValid(subjectId)) return null;
  const subjectDoc = await Subject.findById(subjectId).exec();
  return mapSubject(subjectDoc);
}

async function getSubjectsByClassId(classId) {
  if (!Types.ObjectId.isValid(classId)) return [];
  const rows = await Subject.find({ classId }).sort({ name: 1 }).exec();
  return rows.map(mapSubject);
}

async function getSubjectsByFacultyId(facultyId) {
  if (!Types.ObjectId.isValid(facultyId)) return [];
  const rows = await Subject.find({ facultyId })
    .populate({ path: "classId", select: "name" })
    .sort({ name: 1 })
    .exec();

  return rows.map((subjectDoc) => ({
    id: subjectDoc.id,
    name: subjectDoc.name,
    code: subjectDoc.code,
    classId: subjectDoc.classId?.id || null,
    className: subjectDoc.classId?.name || null
  }));
}

module.exports = {
  getSubjectById,
  getSubjectsByClassId,
  getSubjectsByFacultyId
};
