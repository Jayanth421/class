import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PortalIcon, { getNavIconName } from "./PortalIcon";
import { ADMIN_UI_PREFS_EVENT, getAdminUiPrefs } from "../services/adminUiPrefs";
import useAuth from "../hooks/useAuth";

const FACULTY_MOBILE_HREFS = [
  "/faculty/dashboard",
  "/faculty/classes",
  "/faculty/review",
  "/faculty/smartboard",
  "/faculty/profile"
];

function isActivePath(currentPath, href) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function BottomNav({ items, role }) {
  const { logout } = useAuth();
  const location = useLocation();
  const [adminUiPrefs, setAdminUiPrefs] = useState(() => getAdminUiPrefs());
  const isAdmin = role === "ADMIN";
  const isStudent = role === "STUDENT";
  const isFaculty = role === "FACULTY";

  useEffect(() => {
    if (role !== "ADMIN") return undefined;

    const syncPrefs = () => {
      setAdminUiPrefs(getAdminUiPrefs());
    };

    window.addEventListener(ADMIN_UI_PREFS_EVENT, syncPrefs);
    window.addEventListener("storage", syncPrefs);
    return () => {
      window.removeEventListener(ADMIN_UI_PREFS_EVENT, syncPrefs);
      window.removeEventListener("storage", syncPrefs);
    };
  }, [role]);

  const visibleItems = items;
  const facultyMobileItems = useMemo(() => {
    if (!isFaculty) return [];
    return FACULTY_MOBILE_HREFS.map((href) => visibleItems.find((item) => item.href === href)).filter(Boolean);
  }, [isFaculty, visibleItems]);
  const navItems = useMemo(
    () => {
      if (isStudent) return visibleItems;
      if (isFaculty) return facultyMobileItems;
      return [...visibleItems, { label: "Logout", action: "logout" }];
    },
    [facultyMobileItems, isFaculty, isStudent, visibleItems]
  );

  const adminGridColumns = useMemo(() => {
    if (!isAdmin) return 4;
    return Math.min(Math.max(Number(adminUiPrefs.mobileNavColumns) || 3, 2), 4);
  }, [adminUiPrefs.mobileNavColumns, isAdmin]);

  if (isAdmin) {
    return (
      <nav className="glass-card admin-mobile-nav fixed bottom-4 left-1/2 z-50 max-h-[45vh] w-[calc(100%-1.25rem)] -translate-x-1/2 overflow-y-auto rounded-3xl p-2 lg:hidden">
        <ul
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${adminGridColumns}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.href);
            return (
              <li key={item.href || item.action}>
                {item.action === "logout" ? (
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-red-600 bg-red-600 px-2 py-2 text-center text-[11px] text-white transition hover:bg-red-700"
                  >
                    <PortalIcon name="logout" className="h-4 w-4" />
                    {item.label}
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] ${
                      active
                        ? "bg-white text-[#141414]"
                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <PortalIcon name={getNavIconName(item.href)} className="h-4 w-4" />
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  if (isFaculty || isStudent) {
    return (
      <nav className="glass-card fixed bottom-3 left-1/2 z-50 w-[calc(100%-1rem)] -translate-x-1/2 rounded-3xl border border-white/15 p-2 lg:hidden">
        <ul
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[10px] ${
                    active
                      ? "bg-slate-200 font-semibold text-[#141414]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-[#141414]"
                  }`}
                >
                  <PortalIcon name={getNavIconName(item.href)} className="h-4 w-4" />
                  <span className="leading-none">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="glass-card fixed bottom-3 left-1/2 z-50 w-[calc(100%-1rem)] -translate-x-1/2 rounded-3xl border border-white/15 p-2 lg:hidden">
      <ul className="flex items-end gap-1 overflow-x-auto pb-1 no-scrollbar">
        {navItems.map((item) => {
          const active = isActivePath(location.pathname, item.href);
          const isStudentUploadAction = role === "STUDENT" && item.href === "/student/upload";
          const key = item.href || item.action;
          return (
            <li key={key} className="min-w-[78px] flex-shrink-0">
              {item.action === "logout" ? (
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-red-600 bg-red-600 px-2 py-2 text-center text-[11px] text-white transition hover:bg-red-700"
                >
                  <PortalIcon name="logout" className="h-4 w-4" />
                  {item.label}
                </button>
              ) : (
                <Link
                  to={item.href}
                  className={`flex flex-col items-center justify-center gap-1 px-2 text-center text-[10px] ${
                    isStudentUploadAction
                      ? `mx-1 rounded-full px-3 py-3 ${
                          active
                            ? "bg-gradient-to-br from-brand-400 to-violetBrand-500 text-white shadow-[0_10px_25px_rgba(127, 73, 180, 0.55)]"
                            : "bg-gradient-to-br from-brand-500/85 to-violetBrand-500/85 text-white shadow-[0_10px_22px_rgba(127, 73, 180, 0.45)]"
                        }`
                      : active
                        ? "rounded-2xl bg-white/20 py-2 text-white"
                        : "rounded-2xl py-2 text-soft hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <PortalIcon
                    name={isStudentUploadAction ? "plus" : getNavIconName(item.href)}
                    className={isStudentUploadAction ? "h-5 w-5" : "h-4 w-4"}
                  />
                  <span className={isStudentUploadAction ? "text-[10px] font-semibold" : ""}>
                    {isStudentUploadAction ? "Upload" : item.label}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
