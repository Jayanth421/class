import useAuth from "../hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import PortalIcon, { getNavIconName } from "./PortalIcon";
import { navByRole } from "../routes/navConfig";

export default function TopBar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = navByRole[role] || [];
  const isAdmin = role === "ADMIN";
  const isFaculty = role === "FACULTY";
  const isStudent = role === "STUDENT";
  const showPortalLogo = isFaculty || isStudent;

  const activeNav =
    navItems.find(
      (item) =>
        location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
    ) || null;

  const pageTitle = activeNav?.label || "Overview";
  const displayName = user?.name || "User";
  const initials =
    String(displayName || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";
  const hasProfilePhoto = Boolean(user?.profilePhoto && String(user.profilePhoto).trim());
  const avatarSrc =
    (user?.profilePhoto && String(user.profilePhoto).trim()) || "/auth-assets/profile-placeholder.svg";
  const onAvatarError = (event) => {
    if (event.currentTarget.src.includes("/auth-assets/profile-placeholder.svg")) return;
    event.currentTarget.src = "/auth-assets/profile-placeholder.svg";
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue/10 px-4 py-3 ${
        isAdmin ? "admin-topbar" : "bg-white/5"
      } ${isStudent ? "student-topbar" : ""}`}
    >
      <div className="flex items-center gap-3">
        {showPortalLogo ? (
          <img
            src="/auth-assets/logo.jpg"
            alt="CMR logo"
            className="h-12 w-12 rounded-xl border border-black/15 object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
            isAdmin ? "bg-[#CFCFCF] text-[#141414]" : "bg-white/10 text-white"
          }`}
        >
          <PortalIcon name={getNavIconName(activeNav?.href)} className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-soft">Current Page</p>
          <h2
            className={`font-display text-lg sm:text-xl ${
              isAdmin ? "text-[#141414]" : "text-white"
            }`}
          >
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className={`text-sm font-semibold ${isAdmin ? "text-[#141414]" : "text-white"}`}>
            {displayName}
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-soft">{role || "User"}</p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${
            isAdmin
              ? "border border-slate-300 bg-slate-200 text-[#141414]"
              : "bg-gradient-to-br from-brand-500 to-violetBrand-500 text-white"
          }`}
          title={displayName || "Account"}
        >
          {hasProfilePhoto ? (
            <img
              src={avatarSrc}
              alt="Profile"
              className="h-full w-full rounded-full object-cover"
              onError={onAvatarError}
            />
          ) : (
            <span className="text-sm font-semibold">{initials}</span>
          )}
        </span>
        
      </div>
    </header>
  );
}
