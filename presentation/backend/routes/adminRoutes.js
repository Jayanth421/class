const express = require("express");
const multer = require("multer");
const path = require("path");
const { ROLES } = require("../config/constants");
const {
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
  getMailTemplates,
  getMySqlFileDbSettings,
  getSubjects,
  getAnalytics,
  getAnnouncementsForAdmin,
  getUsers,
  seedMailTemplates,
  sendBulkMail,
  sendTestMail,
  createMailTemplate,
  updateMailTemplate,
  deleteMailTemplate,
  testMySqlFileDbSettings,
  updateClass,
  updateDepartment,
  updateSubject,
  updateUserByAdmin,
  upsertMySqlFileDbSettings,
  upsertMailSettings
} = require("../controllers/adminController");
const authorizeRoles = require("../middlewares/authorizeRoles");
const verifyJWT = require("../middlewares/verifyJWT");
const ApiError = require("../utils/apiError");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").trim().toLowerCase();
    if (![".csv", ".xlsx", ".xls"].includes(extension)) {
      return cb(new ApiError(400, "Only .csv, .xlsx, and .xls files are supported"));
    }
    return cb(null, true);
  }
});
const uploadUserImportFile = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(400, "File size must be 5MB or less"));
    }
    return next(error);
  });
};
const uploadAcademicImportFile = uploadUserImportFile;

router.use(verifyJWT, authorizeRoles(ROLES.ADMIN));

router.get("/analytics", getAnalytics);
router.get("/users", getUsers);
router.get("/departments", getDepartments);
router.get("/classes", getClasses);
router.get("/subjects", getSubjects);
router.get("/uploads", getUploadsAdmin);
router.get("/downloads/uploads-zip", downloadUploadsZipBySection);
router.get("/templates/academic", downloadAcademicTemplate);
router.get("/templates/users", downloadUsersTemplate);
router.get("/settings/mail", getMailSettings);
router.get("/settings/mysql", getMySqlFileDbSettings);
router.get("/mail/templates", getMailTemplates);
router.get("/announcements", getAnnouncementsForAdmin);
router.post("/departments", createDepartment);
router.post("/classes", createClass);
router.post("/subjects", createSubject);
router.post("/subjects/bulk", createSubjectsBulk);
router.post("/users", createUserByAdmin);
router.post("/users/bulk-import", uploadUserImportFile, bulkImportUsersByAdmin);
router.post("/academic/bulk-import", uploadAcademicImportFile, bulkImportAcademicByAdmin);
router.post("/settings/mail/test", sendTestMail);
router.post("/settings/mysql/test", testMySqlFileDbSettings);
router.post("/mail/templates/seed", seedMailTemplates);
router.post("/mail/templates", createMailTemplate);
router.post("/mail/send", sendBulkMail);
router.post("/announcements", createAnnouncementByAdmin);
router.put("/departments/:departmentId", updateDepartment);
router.put("/classes/:classId", updateClass);
router.put("/subjects/:subjectId", updateSubject);
router.put("/users/:userId", updateUserByAdmin);
router.put("/settings/mail", upsertMailSettings);
router.put("/settings/mysql", upsertMySqlFileDbSettings);
router.put("/mail/templates/:templateId", updateMailTemplate);
router.delete("/departments/:departmentId", deleteDepartment);
router.delete("/classes/:classId", deleteClass);
router.delete("/subjects/:subjectId", deleteSubject);
router.delete("/users/:userId", deleteUserByAdmin);
router.delete("/mail/templates/:templateId", deleteMailTemplate);

module.exports = router;
