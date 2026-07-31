import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import useAuth from "../hooks/useAuth";

function getRoleLandingPath(role) {
  if (role === "STUDENT") return "/student/home";
  if (role === "FACULTY") return "/faculty/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "SMARTBOARD") return "/smartboard/view";
  return "/login";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });
}

export default function FacultySetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeFacultySetup, getFacultySetupOptions, login } = useAuth();
  const autoLogin = location.state?.autoLogin || null;

  const [form, setForm] = useState({
    email: location.state?.email || "",
    name: "",
    mobile: "",
    profilePhoto: "",
    departmentId: "",
    year: "",
    section: ""
  });
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fieldClass =
    "w-full rounded-xl border border-white/15 bg-[#141414] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 transition focus:border-brand-300";
  const labelClass = "mb-2 block text-xs uppercase tracking-[0.12em] text-slate-300";
  const setupInitials = (() => {
    const cleanName = String(form.name || "").trim();
    if (cleanName) {
      return (
        cleanName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() || "")
          .join("") || "FC"
      );
    }

    const emailPrefix = String(form.email || "").split("@")[0] || "";
    const trimmedPrefix = emailPrefix.replace(/[^a-zA-Z0-9]/g, "").trim();
    return (trimmedPrefix.slice(0, 2).toUpperCase() || "FC").trim();
  })();

  const sectionOptions = useMemo(() => {
    const unique = new Set(
      classes
        .map((item) => String(item.section || "").trim().toUpperCase())
        .filter(Boolean)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    setError("");
    try {
      const response = await getFacultySetupOptions({
        departmentId: form.departmentId || undefined,
        year: form.year || undefined,
        section: form.section || undefined
      });
      setDepartments(response.departments || []);
      setClasses(response.classes || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load class options");
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, [form.departmentId, form.year, form.section]);

  const toggleClassSelection = (classId) => {
    setSelectedClassIds((prev) => {
      if (prev.includes(classId)) {
        return prev.filter((item) => item !== classId);
      }
      return [...prev, classId];
    });
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({ ...prev, profilePhoto: "" }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Profile photo must be an image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Profile photo must be 2MB or less");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, profilePhoto: dataUrl }));
      setError("");
    } catch (photoError) {
      setError(photoError?.message || "Failed to process image");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (!selectedClassIds.length) {
        throw new Error("Select at least one class");
      }

      await completeFacultySetup({
        email: form.email.trim(),
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, ""),
        profilePhoto: form.profilePhoto,
        classIds: selectedClassIds
      });

      if (autoLogin) {
        const user = await login(autoLogin);
        setMessage("Faculty setup completed. Logging you in.");
        setTimeout(() => navigate(getRoleLandingPath(user.role), { replace: true }), 700);
      } else {
        setMessage("Faculty setup completed. You can now sign in.");
        setTimeout(() => navigate("/faculty/login"), 900);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      mode="register"
      title="Faculty Profile Setup."
      subtitle="Step 3: Add faculty details and select assigned classes."
      helperText="Already completed setup?"
      helperLinkLabel="Faculty Sign In."
      helperLinkTo="/faculty/login"
      loginLinkTo="/faculty/login"
      registerLinkTo="/faculty/register"
      loading={submitting}
      loadingLabel="Saving profile..."
    >
      <form className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="faculty-setup-photo">
            Profile Photo (optional)
          </label>
          <input
            id="faculty-setup-photo"
            className={fieldClass}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
          />
          {form.profilePhoto ? (
            <img
              src={form.profilePhoto}
              alt="Faculty profile preview"
              className="mt-3 h-20 w-20 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold text-white">
              {setupInitials}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="faculty-setup-email">
            Account Email
          </label>
          <input
            id="faculty-setup-email"
            className={fieldClass}
            type="email"
            placeholder="faculty@cmrcet.ac.in"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="faculty-setup-name">
            Faculty Name
          </label>
          <input
            id="faculty-setup-name"
            className={fieldClass}
            type="text"
            placeholder="Enter faculty name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="faculty-setup-mobile">
            Mobile Number (optional)
          </label>
          <input
            id="faculty-setup-mobile"
            className={fieldClass}
            type="tel"
            placeholder="10-digit mobile number"
            value={form.mobile}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                mobile: event.target.value.replace(/\D/g, "").slice(0, 10)
              }))
            }
            pattern="[6-9][0-9]{9}"
            maxLength={10}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="faculty-filter-department">
            Filter Department
          </label>
          <select
            id="faculty-filter-department"
            className={fieldClass}
            value={form.departmentId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, departmentId: event.target.value }))
            }
          >
            <option value="">All Departments</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="faculty-filter-year">
            Filter Year
          </label>
          <select
            id="faculty-filter-year"
            className={fieldClass}
            value={form.year}
            onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
          >
            <option value="">All Years</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="faculty-filter-section">
            Filter Section
          </label>
          <select
            id="faculty-filter-section"
            className={fieldClass}
            value={form.section}
            onChange={(event) => setForm((prev) => ({ ...prev, section: event.target.value }))}
          >
            <option value="">All Sections</option>
            {sectionOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-white/12 bg-[#141414] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
              Select Assigned Classes
            </p>
            <button
              type="button"
              onClick={loadOptions}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Refresh
            </button>
          </div>

          {loadingOptions ? <p className="mt-3 text-sm text-slate-300">Loading classes...</p> : null}
          {!loadingOptions && classes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">No classes available for selected filters.</p>
          ) : null}

          {classes.length > 0 ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {classes.map((item) => {
                const selected = selectedClassIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                      selected
                        ? "border-brand-300 bg-brand-500/20 text-white"
                        : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected}
                      onChange={() => toggleClassSelection(item.id)}
                    />
                    <span>
                      {item.name} ({item.departmentCode}) Year {item.year} - {item.section}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <p className="mt-3 text-xs text-slate-300">Selected classes: {selectedClassIds.length}</p>
        </div>

        {error ? <p className="text-sm text-red-300 lg:col-span-2">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300 lg:col-span-2">{message}</p> : null}

        <button
          className="lg:col-span-2 rounded-xl bg-[#7F49B4] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7F49B4] disabled:opacity-70"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Complete Faculty Setup"}
        </button>

        <p className="text-xs text-slate-400 lg:col-span-2">
          Need to verify OTP again?{" "}
          <Link className="text-brand-300 hover:text-brand-100" to="/verify-otp">
            Open Verify OTP
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

