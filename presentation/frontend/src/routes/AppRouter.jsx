import { Navigate, Route, Routes } from "react-router-dom";
import PortalLayout from "../layouts/PortalLayout";
import AdminAnalyticsPage from "../pages/admin/AdminAnalyticsPage";
import AdminUploadsPage from "../pages/admin/AdminUploadsPage";
import AdminClassesPage from "../pages/admin/AdminClassesPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminDepartmentsPage from "../pages/admin/AdminDepartmentsPage";
import AdminFeatureMatrixPage from "../pages/admin/AdminFeatureMatrixPage";
import AdminSettingsPage from "../pages/admin/AdminSettingsPage";
import AdminSubjectsPage from "../pages/admin/AdminSubjectsPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import FacultyClassesPage from "../pages/faculty/FacultyClassesPage";
import FacultyDashboardPage from "../pages/faculty/FacultyDashboardPage";
import FacultyMaterialsPage from "../pages/faculty/FacultyMaterialsPage";
import FacultyNotificationsPage from "../pages/faculty/FacultyNotificationsPage";
import FacultyPresentationReviewPage from "../pages/faculty/FacultyPresentationReviewPage";
import FacultyProfilePage from "../pages/faculty/FacultyProfilePage";
import FacultySmartboardPage from "../pages/faculty/FacultySmartboardPage";
import FacultyStudentsPage from "../pages/faculty/FacultyStudentsPage";
import FacultySubjectsPage from "../pages/faculty/FacultySubjectsPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import FacultySetupPage from "../pages/FacultySetupPage";
import LoginPage from "../pages/LoginPage";
import NotFoundPage from "../pages/NotFoundPage";
import RegisterPage from "../pages/RegisterPage";
import SmartboardAuthorizePage from "../pages/SmartboardAuthorizePage";
import SmartboardConnectPage from "../pages/SmartboardConnectPage";
import SmartboardViewPage from "../pages/SmartboardViewPage";
import StudentSetupPage from "../pages/StudentSetupPage";
import StudentActivityPage from "../pages/student/StudentActivityPage";
import TermsAndConditionsPage from "../pages/TermsAndConditionsPage";
import StudentHomePage from "../pages/student/StudentHomePage";
import StudentNotificationsPage from "../pages/student/StudentNotificationsPage";
import StudentPresentationsPage from "../pages/student/StudentPresentationsPage";
import StudentProfilePage from "../pages/student/StudentProfilePage";
import StudentSubjectsPage from "../pages/student/StudentSubjectsPage";
import StudentUploadPage from "../pages/student/StudentUploadPage";
import UnauthorizedPage from "../pages/UnauthorizedPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";
import useAuth from "../hooks/useAuth";
import ProtectedRoute from "./ProtectedRoute";

function RoleLanding() {
  const { role } = useAuth();
  if (role === "STUDENT") return <Navigate to="/student/home" replace />;
  if (role === "FACULTY") return <Navigate to="/faculty/dashboard" replace />;
  if (role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (role === "SMARTBOARD") return <Navigate to="/smartboard/view" replace />;
  return <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RoleLanding />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/student/login" element={<LoginPage portalRole="STUDENT" />} />
      <Route path="/faculty/login" element={<LoginPage portalRole="FACULTY" />} />
      <Route path="/admin/login" element={<LoginPage portalRole="ADMIN" />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/faculty/register" element={<RegisterPage portalRole="FACULTY" />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/student/setup" element={<StudentSetupPage />} />
      <Route path="/faculty/setup" element={<FacultySetupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/smartboard/login" element={<SmartboardConnectPage />} />
      <Route path="/smartboard/authorize" element={<SmartboardAuthorizePage />} />

      <Route element={<PortalLayout />}>
        <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
          <Route path="/student/home" element={<StudentHomePage />} />
          <Route path="/student/subjects" element={<StudentSubjectsPage />} />
          <Route path="/student/upload" element={<StudentUploadPage />} />
          <Route path="/student/presentations" element={<StudentPresentationsPage />} />
          <Route path="/student/notifications" element={<StudentNotificationsPage />} />
          <Route path="/student/activity" element={<StudentActivityPage />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["FACULTY"]} />}>
          <Route path="/faculty/dashboard" element={<FacultyDashboardPage />} />
          <Route path="/faculty/classes" element={<FacultyClassesPage />} />
          <Route path="/faculty/subjects" element={<FacultySubjectsPage />} />
          <Route path="/faculty/review" element={<FacultyPresentationReviewPage />} />
          <Route path="/faculty/materials" element={<FacultyMaterialsPage />} />
          <Route path="/faculty/students" element={<FacultyStudentsPage />} />
          <Route path="/faculty/notifications" element={<FacultyNotificationsPage />} />
          <Route path="/faculty/smartboard" element={<FacultySmartboardPage />} />
          <Route path="/faculty/profile" element={<FacultyProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="/admin/classes" element={<AdminClassesPage />} />
          <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/uploads" element={<AdminUploadsPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/feature-matrix" element={<AdminFeatureMatrixPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["SMARTBOARD", "FACULTY", "ADMIN"]}
              unauthenticatedRedirect="/smartboard/login"
            />
          }
        >
          <Route path="/smartboard/view" element={<SmartboardViewPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
