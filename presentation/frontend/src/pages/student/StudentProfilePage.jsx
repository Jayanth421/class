import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PoweredByYeahzz } from "../../components/YeahzzBranding";
import api from "../../services/api";
import useAuth from "../../hooks/useAuth";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function getInitials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "ST";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function SettingsIcon({ type, className = "" }) {
  if (type === "profile") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3 2.9-5 7-5s7 2 7 5" />
      </svg>
    );
  }

  if (type === "password") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5.5" y="10" width="13" height="9" rx="2" />
        <path d="M8 10V8a4 4 0 1 1 8 0v2" />
      </svg>
    );
  }

  if (type === "notifications") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
    );
  }

  if (type === "about") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 10v6" />
        <circle cx="12" cy="7.5" r="0.7" fill="currentColor" />
      </svg>
    );
  }

  if (type === "help") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9.6 9a2.4 2.4 0 0 1 4.8 0c0 1.2-.8 1.8-1.7 2.5-.8.6-1.5 1.1-1.5 2.1v.4" />
        <circle cx="12" cy="17.5" r="0.7" fill="currentColor" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h8M8 12h8M8 17h8" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" />
    </svg>
  );
}

function SettingsRow({ icon, label, onClick, to, active = false, danger = false, trailing = null }) {
  const rowClass = `flex w-full items-center gap-3 px-3 py-3 text-left transition ${
    active ? "bg-slate-200" : "hover:bg-slate-100"
  }`;
  const textClass = danger ? "text-red-700" : "text-[#141414]";
  const iconClass = danger ? "text-red-700" : "text-slate-600";
  const rightNode = trailing || (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 ${danger ? "text-red-700" : "text-slate-500"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m7 4 6 6-6 6" />
    </svg>
  );

  const content = (
    <>
      <SettingsIcon type={icon} className={`h-[18px] w-[18px] ${iconClass}`} />
      <span className={`flex-1 text-[15px] font-medium ${textClass}`}>{label}</span>
      {rightNode}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={rowClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={rowClass}>
      {content}
    </button>
  );
}

function InfoRow({ label, value }) {
  const displayValue =
    value === undefined || value === null || String(value).trim() === "" ? "-" : String(value);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="text-sm font-semibold text-[#141414]">{displayValue}</p>
    </div>
  );
}

export default function StudentProfilePage() {
  const { user, updateUserSession, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    profilePhoto: ""
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [openSection, setOpenSection] = useState("profile");
  const [openSupportSection, setOpenSupportSection] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const profilePhoto = useMemo(() => form.profilePhoto || user?.profilePhoto || "", [form.profilePhoto, user?.profilePhoto]);
  const fullName = String(form.name || user?.name || "Student").trim();

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#141414] outline-none transition focus:border-[#141414] focus:ring-2 focus:ring-[#141414]/20";

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/student/profile");
        const profile = response.data.profile || {};
        if (user) {
          updateUserSession({ ...user, ...profile });
        } else {
          updateUserSession(profile);
        }
        setForm({
          name: profile.name || "",
          mobile: profile.mobile || "",
          profilePhoto: profile.profilePhoto || ""
        });
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const updateProfile = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingProfile(true);

    try {
      const response = await api.put("/student/profile", {
        name: form.name,
        mobile: form.mobile,
        profilePhoto: form.profilePhoto
      });
      const nextProfile = response.data.profile || {};
      updateUserSession({ ...user, ...nextProfile });
      setForm((prev) => ({ ...prev, profilePhoto: nextProfile.profilePhoto || prev.profilePhoto || "" }));
      setMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/student/profile/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setMessage("Password changed successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const onSelectPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, profilePhoto: dataUrl }));
      setMessage("Photo selected. Save profile to keep changes.");
      setError("");
    } catch (fileError) {
      setError(fileError?.message || "Failed to load image");
    }
  };

  const toggleSection = (section) => {
    setOpenSection((prev) => (prev === section ? "" : section));
  };

  const toggleSupportSection = (section) => {
    setOpenSupportSection((prev) => (prev === section ? "" : section));
  };

  const logoutFromProfile = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-[#141414]">
          Loading profile...
        </div>
      </section>
    );
  }

  return (
    <section className="student-profile-page mx-auto w-full max-w-6xl space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="student-profile-card rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(20,20,20,0.08)] sm:p-6">
          <div className="flex flex-col items-center text-center">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile preview"
                className="h-24 w-24 rounded-full border border-slate-300 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-2xl font-semibold text-[#141414]">
                {getInitials(fullName)}
              </div>
            )}

            <div className="mt-3 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                Student Profile
              </p>
              <h3 className="mt-1 break-words text-2xl font-semibold text-[#141414]">{fullName}</h3>
              <p className="mt-1 break-words text-sm text-slate-600">{user?.email || "Student account"}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                {user?.role || "STUDENT"} | {form.mobile || "Mobile not set"}
              </p>
            </div>

            <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-xl bg-gray5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white">
              Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={onSelectPhoto} />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="student-profile-stat rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Role</p>
              <p className="mt-1 text-sm font-semibold text-[#141414]">{user?.role || "STUDENT"}</p>
            </div>
            <div className="student-profile-stat rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Mobile</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#141414]">
                {form.mobile ? form.mobile : "Not set"}
              </p>
            </div>
            <div className="student-profile-stat rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Security</p>
              <p className="mt-1 text-sm font-semibold text-[#141414]">Password active</p>
            </div>
          </div>
        </div>

        <div className="student-profile-card rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(20,20,20,0.08)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
            College details
          </p>
          <h3 className="mt-2 font-display text-xl text-[#141414]">Academic Info</h3>
          <p className="mt-1 text-sm text-slate-600">
            Roll number, department, year, and class details.
          </p>

          <div className="mt-5 space-y-3">
            <InfoRow label="College Email" value={user?.email || ""} />
            <InfoRow label="Roll Number" value={user?.rollNumber || ""} />
            <InfoRow label="Department" value={user?.branch || ""} />
            <InfoRow label="Year" value={user?.year ? `Year ${user.year}` : ""} />
            <InfoRow label="Section" value={user?.section || ""} />
            <InfoRow
              label="Class"
              value={user?.year && user?.section ? `Year ${user.year} ${user.section}` : ""}
            />
            <InfoRow label="Class ID" value={user?.classId || ""} />
            <InfoRow
              label="Last Login"
              value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : ""}
            />
          </div>
        </div>

      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr] lg:items-start">
        <div className="student-profile-card rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(20,20,20,0.08)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Account settings</p>
          <div className="student-profile-panel mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200">
              <SettingsRow
                icon="profile"
                label="Profile details"
                active={openSection === "profile"}
                onClick={() => toggleSection("profile")}
              />
              {openSection === "profile" ? (
                <form className="space-y-3 px-3 pb-3" onSubmit={updateProfile}>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">Full name</span>
                    <input
                      className={inputClass}
                      placeholder="Full name"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">Mobile number</span>
                    <input
                      className={inputClass}
                      placeholder="Mobile number"
                      value={form.mobile}
                      onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">Photo URL</span>
                    <input
                      className={inputClass}
                      placeholder="Image URL (optional)"
                      value={form.profilePhoto.startsWith("data:image/") ? "" : form.profilePhoto}
                      onChange={(event) => setForm((prev) => ({ ...prev, profilePhoto: event.target.value }))}
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-70"
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </form>
              ) : null}
            </div>

            <div className="border-b border-slate-200">
              <SettingsRow
                icon="password"
                label="Password"
                active={openSection === "password"}
                onClick={() => toggleSection("password")}
              />
              {openSection === "password" ? (
                <form className="space-y-3 px-3 pb-3" onSubmit={changePassword}>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">Current password</span>
                    <input
                      type="password"
                      className={inputClass}
                      placeholder="Current password"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                      }
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">New password</span>
                    <input
                      type="password"
                      className={inputClass}
                      placeholder="New password"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                      }
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">Confirm password</span>
                    <input
                      type="password"
                      className={inputClass}
                      placeholder="Confirm new password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                      }
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-70"
                  >
                    {savingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              ) : null}
            </div>

            <div className="border-b border-slate-200">
              <SettingsRow icon="notifications" label="Notifications" to="/student/notifications" />
            </div>
          </div>
        </div>

        <div className="student-profile-card rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(20,20,20,0.08)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Support and privacy</p>
          <div className="student-profile-panel mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200">
              <SettingsRow
                icon="about"
                label="About application"
                active={openSupportSection === "about"}
                onClick={() => toggleSupportSection("about")}
              />
              {openSupportSection === "about" ? (
                <div className="space-y-1 px-3 pb-3 text-sm text-slate-600">
                  <p className="font-semibold text-[#141414]">CMR Smart Presentation Portal</p>
                  <p>Manage your profile, uploads, presentations, and notifications in one place.</p>
                  <p>Keep your account details updated for smooth access.</p>
                </div>
              ) : null}
            </div>
            <div>
              <SettingsRow
                icon="help"
                label="Help/FAQ"
                active={openSupportSection === "help"}
                onClick={() => toggleSupportSection("help")}
              />
              {openSupportSection === "help" ? (
                <div className="space-y-2 px-3 pb-3 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-[#141414]">How to edit profile?</span> Open{" "}
                    Profile details and click Save Profile.
                  </p>
                  <p>
                    <span className="font-semibold text-[#141414]">How to change password?</span> Open{" "}
                    Password and click Update Password.
                  </p>
                  <p>
                    <span className="font-semibold text-[#141414]">Photo not updating?</span> Upload a new{" "}
                    image or enter a valid image URL, then save.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <p className="student-profile-tip mt-4 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-[#141414]">
            Tip: keep your profile photo and mobile number updated for smooth login and approvals.
          </p>
        </div>
      </div>

      <div className="sm:hidden">
        <button
          type="button"
          onClick={logoutFromProfile}
          className="w-full rounded-xl border border-red-600 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Logout
        </button>
      </div>

      {message ? (
        <div className="student-profile-alert-success rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="student-profile-alert-error rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <PoweredByYeahzz textClassName="text-[#141414]" className="mt-6" />
    </section>
  );
}
