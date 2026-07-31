export const navByRole = {
  STUDENT: [
    { label: "Dashboard", href: "/student/home" },
    { label: "Upload", href: "/student/upload" },
    { label: "My Presentations", href: "/student/presentations" },
    { label: "My Subjects", href: "/student/subjects" },
    { label: "Profile", href: "/student/profile" }
  ],
  FACULTY: [
    { label: "Dashboard", href: "/faculty/dashboard" },
    { label: "Classes", href: "/faculty/classes" },
    { label: "Subjects", href: "/faculty/subjects" },
    { label: "Review", href: "/faculty/review" },
    { label: "Materials", href: "/faculty/materials" },
    { label: "Students", href: "/faculty/students" },
    { label: "Smartboard", href: "/faculty/smartboard" },
    { label: "Notifications", href: "/faculty/notifications" },
    { label: "Profile", href: "/faculty/profile" }
  ],
  ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Departments", href: "/admin/departments" },
    { label: "Classes", href: "/admin/classes" },
    { label: "Subjects", href: "/admin/subjects" },
    { label: "Users", href: "/admin/users" },
    { label: "Uploads", href: "/admin/uploads" },
    { label: "Presentations", href: "/smartboard/view" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Feature Matrix", href: "/admin/feature-matrix" },
    { label: "Settings", href: "/admin/settings" }
  ],
  SMARTBOARD: [{ label: "Presentations", href: "/smartboard/view" }]
};
