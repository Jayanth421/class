import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PoweredByYeahzz } from "../../components/YeahzzBranding";
import api from "../../services/api";
import useAuth from "../../hooks/useAuth";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function getInitials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "FA";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function Toggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
        enabled ? "border-[#141414] bg-[#141414]" : "border-slate-300 bg-white"
      }`}
      aria-label="Toggle profile preview mode"
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function FacultyProfilePage() {
  const { user, updateUserSession } = useAuth();
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
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const profilePhoto = useMemo(
    () => form.profilePhoto || user?.profilePhoto || "",
    [form.profilePhoto, user?.profilePhoto]
  );
  const fullName = String(form.name || user?.name || "Faculty").trim();

  const profileCompleteness = useMemo(() => {
    let score = 34;
    if (form.name.trim()) score += 22;
    if (form.mobile.trim()) score += 22;
    if (profilePhoto) score += 22;
    return Math.min(score, 100);
  }, [form.mobile, form.name, profilePhoto]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/faculty/profile");
        const profile = response.data.profile || {};
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

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");

    try {
      const response = await api.put("/faculty/profile", {
        name: form.name,
        mobile: form.mobile,
        profilePhoto: form.profilePhoto
      });
      const nextProfile = response.data.profile || {};
      updateUserSession({ ...user, ...nextProfile });
      setForm((prev) => ({
        ...prev,
        profilePhoto: nextProfile.profilePhoto || prev.profilePhoto || ""
      }));
      setMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setError("");
    setMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match.");
      setSavingPassword(false);
      return;
    }

    try {
      await api.put("/faculty/profile/password", {
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
      setError(requestError?.response?.data?.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const onPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, profilePhoto: dataUrl }));
      setMessage("Photo selected. Save profile to keep changes.");
      setError("");
    } catch (fileError) {
      setError(fileError?.message || "Failed to process image");
    }
  };

  const handleComingSoon = (label) => {
    setError("");
    setMessage(`${label} will be available soon.`);
  };

  const fieldClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#141414] outline-none transition focus:border-[#141414] focus:ring-2 focus:ring-[#141414]/20";

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-700">
          Loading faculty profile...
        </div>
      </section>
    );
  }

  return (
    <section
      className={`faculty-profile-page mx-auto w-full max-w-6xl space-y-4 ${
        darkMode ? "rounded-3xl bg-slate-100 p-3" : ""
      }`}
    >
      <div className="faculty-profile-card rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile preview"
                className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-xl font-semibold text-[#141414]">
                {getInitials(fullName)}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                Faculty Profile
              </p>
              <h2 className="truncate text-2xl font-semibold text-[#141414]">{fullName}</h2>
              <p className="truncate text-sm text-slate-600">{user?.email || "Faculty account"}</p>
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#141414] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black">
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="faculty-profile-stat rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Role</p>
            <p className="mt-1 text-sm font-semibold text-[#141414]">{user?.role || "FACULTY"}</p>
          </div>
          <div className="faculty-profile-stat rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Mobile</p>
            <p className="mt-1 truncate text-sm font-semibold text-[#141414]">{form.mobile || "Not set"}</p>
          </div>
          <div className="faculty-profile-stat rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Profile Complete</p>
            <p className="mt-1 text-sm font-semibold text-[#141414]">{profileCompleteness}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div
                className="h-1.5 rounded-full bg-[#141414]"
                style={{ width: `${profileCompleteness}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="faculty-profile-card rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-[#141414]">Profile Details</h3>
          <p className="mt-1 text-sm text-slate-600">Update your name, contact number, and profile image URL.</p>

          <form className="mt-4 space-y-3" onSubmit={saveProfile}>
            <label className="block text-sm text-slate-700">
              Full Name
              <input
                className={fieldClass}
                placeholder="Full name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>

            <label className="block text-sm text-slate-700">
              Mobile Number
              <input
                className={fieldClass}
                placeholder="Mobile number"
                value={form.mobile}
                onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
              />
            </label>

            <label className="block text-sm text-slate-700">
              Photo URL (Optional)
              <input
                className={fieldClass}
                placeholder="https://..."
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
        </div>

        <div className="space-y-4">
          <div className="faculty-profile-card rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#141414]">Password & Security</h3>
            <p className="mt-1 text-sm text-slate-600">Change your password regularly for account safety.</p>

            <form className="mt-4 space-y-3" onSubmit={savePassword}>
              <label className="block text-sm text-slate-700">
                Current Password
                <input
                  type="password"
                  className={fieldClass}
                  placeholder="Current password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="block text-sm text-slate-700">
                New Password
                <input
                  type="password"
                  className={fieldClass}
                  placeholder="New password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="block text-sm text-slate-700">
                Confirm New Password
                <input
                  type="password"
                  className={fieldClass}
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
                className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white disabled:opacity-70"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>

          <div className="faculty-profile-accent-card rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#141414]">Quick Actions</h3>
            <div className="mt-3 space-y-2">
              <Link
                to="/faculty/notifications"
                className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-[#141414] transition hover:bg-slate-50"
              >
                Open Notifications
              </Link>
              <button
                type="button"
                onClick={() => handleComingSoon("Help / FAQ")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#141414] transition hover:bg-slate-50"
              >
                Help / FAQ
              </button>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                <span className="text-sm font-medium text-[#141414]">Profile Preview Mode</span>
                <Toggle enabled={darkMode} onChange={() => setDarkMode((prev) => !prev)} />
              </div>
            </div>

            <p className="faculty-profile-tip mt-4 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-[#141414]">
              Tip: keep your profile photo and mobile number updated for smooth approvals and communication.
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <PoweredByYeahzz className="mt-2" textClassName="text-[#141414]" />
    </section>
  );
}
