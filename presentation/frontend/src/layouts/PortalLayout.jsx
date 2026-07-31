import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import SidebarNav from "../components/SidebarNav";
import TopBar from "../components/TopBar";
import useAuth from "../hooks/useAuth";
import { navByRole } from "../routes/navConfig";
import { getStudentUiPrefs, STUDENT_UI_PREFS_EVENT } from "../services/studentUiPrefs";

export default function PortalLayout() {
  const { role, logout } = useAuth();
  const navItems = navByRole[role] || [];
  const isAdmin = role === "ADMIN";
  const isStudent = role === "STUDENT";
  const [studentUiPrefs, setStudentUiPrefs] = useState(() => getStudentUiPrefs());

  useEffect(() => {
    document.body.classList.toggle("admin-mode", isAdmin);
    document.body.classList.toggle("student-mode", isStudent);
    return () => {
      document.body.classList.remove("admin-mode");
      document.body.classList.remove("student-mode");
    };
  }, [isAdmin, isStudent]);

  useEffect(() => {
    if (!isStudent) return undefined;

    const syncPrefs = () => {
      setStudentUiPrefs(getStudentUiPrefs());
    };

    window.addEventListener(STUDENT_UI_PREFS_EVENT, syncPrefs);
    window.addEventListener("storage", syncPrefs);
    return () => {
      window.removeEventListener(STUDENT_UI_PREFS_EVENT, syncPrefs);
      window.removeEventListener("storage", syncPrefs);
    };
  }, [isStudent]);

  useEffect(() => {
    const isStudentDarkMode = isStudent && Boolean(studentUiPrefs.darkMode);
    document.body.classList.toggle("student-dark-mode", isStudentDarkMode);
    return () => {
      document.body.classList.remove("student-dark-mode");
    };
  }, [isStudent, studentUiPrefs.darkMode]);

  if (role === "SMARTBOARD") {
    return (
      <div className="min-h-screen p-3 md:p-4">
        <main className="content-fade-in h-[calc(100vh-1.5rem)] pb-16">
          <Outlet />
        </main>
        <div className="fixed bottom-4 left-4 z-50">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`portal-shell min-h-screen lg:flex ${isAdmin ? "admin-shell" : ""} ${isStudent ? "student-shell" : ""}`}>
      <div className={isAdmin ? "hidden lg:block lg:w-72 admin-sidebar-wrap" : ""}>
        <SidebarNav items={navItems} role={role} />
      </div>
      <div className={`flex-1 p-4 pb-28 lg:p-6 lg:pl-0 ${isAdmin ? "admin-content-wrap" : ""} ${isStudent ? "student-content-wrap" : ""}`}>
        <div className="portal-content-inner">
          <TopBar />
          <main className={`content-fade-in ${isAdmin ? "admin-main" : ""} ${isStudent ? "student-main" : ""}`}>
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav items={navItems} role={role} />
    </div>
  );
}
