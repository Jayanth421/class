# PPT Presentation Platform - Production Blueprint

This blueprint translates your Admin, Faculty, Student, and Smart Board requirements into an implementation-ready backend and API structure for this project.

## 1) Domain Model

### Academic hierarchy
- `AcademicYear` (1, 2, 3, 4)
- `Department` (CSE, ECE, MECH, CIVIL, ...)
- `Classroom` (human-friendly class label, e.g. `CSE-B`)
- `Section` (A, B, C, ...)
- `Subject` (belongs to Section)

Hierarchy:
- AcademicYear -> Department -> Classroom -> Section -> Subject

### User model
- `User`
  - roles: `ADMIN`, `FACULTY`, `STUDENT`, `SMARTBOARD`
  - common fields: name, email, passwordHash, isVerified, profilePhoto
  - student fields: rollNumber, yearId, departmentId, classroomId, sectionId
  - faculty fields: facultyCode (optional)

### Teaching assignment
- `FacultySectionAssignment`
  - facultyId
  - yearId, departmentId, classroomId, sectionId
  - optional subjectIds[]

### Presentation model
- `Presentation`
  - studentId
  - subjectId
  - yearId, departmentId, classroomId, sectionId (denormalized for fast filters)
  - title, fileName, fileType, fileUrl, storageKey
  - status: `UPLOADED | APPROVED | REJECTED`
  - reviewedBy, reviewedAt, feedback
  - uploadedAt

### Smartboard session model
- `SmartboardSession`
  - sessionToken
  - status: `PENDING | AUTHORIZED | EXPIRED`
  - authorizedBy (facultyId)
  - selectedYearId, selectedDepartmentId, selectedClassroomId, selectedSectionId, selectedSubjectId
  - expiresAt

### OTP model
- `OtpCode`
  - email
  - purpose: `REGISTRATION | PASSWORD_RESET | SMARTBOARD_LOGIN`
  - contextToken
  - otpHash
  - expiresAt
  - usedAt

## 2) Recommended SQL Tables (if SQL mode)

- `academic_years(id, name, ordinal, is_active)`
- `departments(id, name, code, is_active)`
- `classrooms(id, department_id, year_id, name, code, is_active)`
- `sections(id, classroom_id, name, is_active)`
- `subjects(id, section_id, name, code, faculty_id nullable, is_active)`
- `users(id, role, name, email unique, password_hash, ...student/faculty fields)`
- `faculty_section_assignments(id, faculty_id, year_id, department_id, classroom_id, section_id)`
- `presentations(id, student_id, subject_id, year_id, department_id, classroom_id, section_id, title, file_name, file_url, status, reviewed_by, reviewed_at, feedback)`
- `smartboard_sessions(id, session_token unique, authorized_by, selected_classroom_id, selected_section_id, selected_subject_id, status, expires_at)`
- `otp_codes(id, email, purpose, context_token, otp_hash, expires_at, used_at)`

## 3) REST API Structure

## Auth
- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

## Admin - Academic structure
- `GET /api/admin/years`
- `POST /api/admin/years`
- `PUT /api/admin/years/:yearId`
- `DELETE /api/admin/years/:yearId`
- `GET /api/admin/departments`
- `POST /api/admin/departments`
- `PUT /api/admin/departments/:departmentId`
- `DELETE /api/admin/departments/:departmentId`
- `GET /api/admin/classes`
- `POST /api/admin/classes`
- `PUT /api/admin/classes/:classId`
- `DELETE /api/admin/classes/:classId`
- `GET /api/admin/sections`
- `POST /api/admin/sections`
- `PUT /api/admin/sections/:sectionId`
- `DELETE /api/admin/sections/:sectionId`
- `GET /api/admin/subjects`
- `POST /api/admin/subjects`
- `POST /api/admin/subjects/bulk` (multi-select insert)

## Admin - Import/export
- `GET /api/admin/templates/academic-excel`
- `GET /api/admin/templates/users-excel`
- `POST /api/admin/import/academic-excel`
- `POST /api/admin/import/users-excel`
- `GET /api/admin/export/presentations?yearId=&departmentId=&classId=&sectionId=&subjectId=&format=zip|csv|xlsx`

## Student
- `GET /api/student/subjects` (only assigned section subjects)
- `POST /api/student/presentations/presign`
- `POST /api/student/presentations/submit`
- `GET /api/student/presentations`

## Faculty
- `GET /api/faculty/assignments`
- `GET /api/faculty/presentations?yearId=&departmentId=&classId=&sectionId=&subjectId=&status=`
- `GET /api/faculty/presentations/:presentationId`
- `PUT /api/faculty/presentations/:presentationId/review`
- `GET /api/faculty/smartboard/library?classId=&sectionId=&subjectId=`

## Smartboard
- `POST /api/auth/smartboard/session` (QR generate)
- `POST /api/auth/smartboard/request-otp`
- `POST /api/auth/smartboard/verify-otp`
- `POST /api/auth/smartboard/authorize` (faculty app)
- `POST /api/auth/smartboard/exchange`
- `GET /api/auth/smartboard/library` (class/subject/ppt cards)

## 4) Access Control Rules

- Student:
  - can only list assigned subjects and own uploads
  - cannot access other section/class presentations
- Faculty:
  - can access only assigned class/section/subject content
- Admin:
  - full read/write
- Smartboard role:
  - read-only class content based on authorized faculty session context

## 5) Smartboard UX Flow (target)

- Smartboard login page
  - QR or Email OTP
- After successful faculty authorization
  - show class selection popup card
  - left side: faculty info card
  - right side: classes taught
- On class click
  - show PPT cards (YouTube-style)
  - click card -> open Office embed viewer
  - overlay pen/annotation canvas (draw, color, size, clear)

## 6) File Storage Convention

Store with deterministic hierarchical key:

`/uploads/{year}/{department}/{section}/{subject}/{studentRollOrName}_{timestamp}.pptx`

Persist both:
- `storageKey` (internal)
- `fileUrl` (public/cdn)

## 7) Excel Import Validation Rules

Reject row with:
- missing Year/Department/Class/Section/Subject
- invalid Year ordinal
- unknown role in user import
- malformed email

Conflict handling:
- upsert by natural key (`year+department+class+section+subjectCode`)
- report duplicates in response summary

## 8) Admin Dashboard Metrics

- totalStudents
- totalFaculty
- totalPresentations
- departmentWisePresentationCounts
- recentUploads
- activeSmartboardSessions

## 9) Implementation Plan (recommended)

1. Academic entities hardening
- add explicit `Section` + optional `AcademicYear` entity (if not already normalized)
- migrate existing class/subject references

2. Import/export pipeline
- template download endpoints
- parser, validator, bulk upsert service
- ZIP export streaming

3. Smartboard content scoping
- include selected class/section/subject context in smartboard session
- enforce filtering in `/auth/smartboard/library`

4. Faculty dashboard filters
- subject/class-wise list + review pipeline

5. Reporting
- CSV/XLSX/ZIP export endpoints

## 10) Current repo mapping (quick)

Already present in project:
- auth with OTP and smartboard session exchange
- department/class/subject models and admin/faculty/student panels
- student upload + faculty review workflow

Needs completion for full target:
- explicit section-wise normalization in all flows
- complete Excel templates + robust import validator + progress report
- section/subject scoped ZIP export
- richer smartboard session context persistence and enforcement

---

If needed, next step can be generated as code:
- migration tasks + model changes
- endpoint-by-endpoint implementation checklist
- Postman collection for all APIs
