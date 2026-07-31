const express = require("express");
const { ROLES } = require("../config/constants");
const {
  changeStudentPassword,
  completeStudentPresentationReplace,
  completeStudentPresentationUpload,
  deleteStudentPresentation,
  getStudentActivity,
  getStudentNotifications,
  getStudentProfile,
  getStudentHome,
  getStudentSubjects,
  getStudentUploads,
  requestPresentationReplaceUploadUrl,
  requestUploadUrl,
  updateStudentPresentation,
  updateStudentProfile
} = require("../controllers/studentController");
const authorizeRoles = require("../middlewares/authorizeRoles");
const verifyJWT = require("../middlewares/verifyJWT");

const router = express.Router();

router.use(verifyJWT, authorizeRoles(ROLES.STUDENT));

router.get("/home", getStudentHome);
router.get("/dashboard", getStudentHome);
router.get("/subjects", getStudentSubjects);
router.get("/uploads", getStudentUploads);
router.get("/presentations", getStudentUploads);
router.get("/notifications", getStudentNotifications);
router.get("/activity", getStudentActivity);
router.get("/profile", getStudentProfile);
router.post("/uploads/presign", requestUploadUrl);
router.post("/presentations/presign", requestUploadUrl);
router.post("/uploads/complete", completeStudentPresentationUpload);
router.post("/presentations/complete", completeStudentPresentationUpload);
router.post("/presentations/:presentationId/replace-presign", requestPresentationReplaceUploadUrl);
router.post("/presentations/:presentationId/replace-complete", completeStudentPresentationReplace);
router.put("/presentations/:presentationId", updateStudentPresentation);
router.delete("/presentations/:presentationId", deleteStudentPresentation);
router.put("/profile", updateStudentProfile);
router.put("/profile/password", changeStudentPassword);

module.exports = router;
