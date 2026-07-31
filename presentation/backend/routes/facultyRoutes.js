const express = require("express");
const { ROLES } = require("../config/constants");
const {
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
} = require("../controllers/facultyController");
const authorizeRoles = require("../middlewares/authorizeRoles");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();

router.use(verifyJWT, authorizeRoles(ROLES.FACULTY));

router.get("/dashboard", getFacultyDashboard);
router.get("/classes", getFacultyClassesList);
router.get("/subjects", getFacultySubjects);
router.get("/subjects/:subjectId/students", getFacultySubjectStudents);
router.get("/presentations", getFacultyPresentations);
router.put("/presentations/:presentationId/review", reviewFacultyPresentation);
router.post("/materials/presign", requestLectureMaterialUploadUrl);
router.post("/materials/complete", completeLectureMaterialUpload);
router.get("/materials", getFacultyLectureMaterials);
router.get("/students", getFacultyStudents);
router.get("/notifications", getFacultyNotifications);
router.post("/notifications", createFacultyAnnouncement);
router.get("/profile", getFacultyProfile);
router.put("/profile", updateFacultyProfile);
router.put("/profile/password", changeFacultyPassword);
router.get("/smartboard/summary", getSmartboardSummary);

module.exports = router;
