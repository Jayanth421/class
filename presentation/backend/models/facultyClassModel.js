const FacultyClass = require("../mongoModels/FacultyClass");

async function assignFacultyClasses(facultyId, classIds = []) {
  await FacultyClass.deleteMany({ facultyId });

  if (!Array.isArray(classIds) || classIds.length === 0) return;

  const uniqueClassIds = [...new Set(classIds.map((classId) => String(classId).trim()))].filter(
    Boolean
  );
  if (uniqueClassIds.length === 0) return;

  await FacultyClass.insertMany(
    uniqueClassIds.map((classId) => ({
      facultyId,
      classId
    }))
  );
}

async function getFacultyClasses(facultyId) {
  const rows = await FacultyClass.find({ facultyId })
    .populate({
      path: "classId",
      populate: {
        path: "departmentId",
        select: "name code"
      }
    })
    .exec();

  const mapped = rows
    .map((row) => row.classId)
    .filter(Boolean)
    .map((classDoc) => ({
      id: classDoc.id,
      name: classDoc.name,
      year: classDoc.year,
      section: classDoc.section,
      department: classDoc.departmentId?.name || null,
      departmentCode: classDoc.departmentId?.code || null
    }));

  return mapped.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return String(a.section).localeCompare(String(b.section));
  });
}

module.exports = {
  assignFacultyClasses,
  getFacultyClasses
};
