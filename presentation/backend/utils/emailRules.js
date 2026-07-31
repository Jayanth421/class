const { ROLES } = require("../config/constants");

const studentEmailRegex = /^(2[1-5])h51[a-z][a-z0-9]{4}@cmrcet\.ac\.in$/i
const facultyEmailRegex = /^(?!\d+@)[a-z][a-z0-9._-]*@cmrcet\.ac\.in$/i;
const genericEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidStudentEmail(email) {
  return studentEmailRegex.test(normalizeEmail(email));
}

function isValidFacultyEmail(email) {
  return facultyEmailRegex.test(normalizeEmail(email));
}

function isValidEmail(email) {
  return genericEmailRegex.test(normalizeEmail(email));
}

function validateEmailByRole(email, role) {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === ROLES.STUDENT) return isValidStudentEmail(email);
  if (normalizedRole === ROLES.FACULTY) return isValidFacultyEmail(email);
  return false;
}

module.exports = {
  isValidEmail,
  isValidFacultyEmail,
  isValidStudentEmail,
  normalizeEmail,
  validateEmailByRole
};
