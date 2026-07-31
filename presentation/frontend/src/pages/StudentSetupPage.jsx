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

export default function StudentSetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeStudentSetup, getStudentSetupOptions, login } = useAuth();
  const autoLogin = location.state?.autoLogin || null;
  const [form, setForm] = useState({
    email: location.state?.email || "",
    rollNumber: "",
    name: "",
    mobile: "",
    year: "",
    department: "",
    section: "",
    profilePhoto: ""
  });
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          .join("") || "ST"
      );
    }

    const emailPrefix = String(form.email || "").split("@")[0] || "";
    const trimmedPrefix = emailPrefix.replace(/[^a-zA-Z0-9]/g, "").trim();
    return (trimmedPrefix.slice(0, 2).toUpperCase() || "ST").trim();
  })();

  const availableYears = useMemo(() => {
    const unique = new Set(
      classes
        .map((item) => Number(item.year))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
    return Array.from(unique).sort((a, b) => a - b);
  }, [classes]);

  const availableSections = useMemo(() => {
    const yearNum = Number(form.year);
    if (!Number.isInteger(yearNum)) return [];
    const unique = new Set(
      classes
        .filter((item) => Number(item.year) === yearNum)
        .map((item) => String(item.section || "").trim().toUpperCase())
        .filter(Boolean)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [classes, form.year]);

  const loadOptions = async (departmentCode = "") => {
    setLoadingOptions(true);
    setError("");
    try {
      const response = await getStudentSetupOptions({
        departmentCode: departmentCode || undefined
      });
      setDepartments(response.departments || []);
      setClasses(response.classes || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load setup options");
      setDepartments([]);
      setClasses([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDepartmentChange = (value) => {
    setForm((prev) => ({
      ...prev,
      department: value,
      year: "",
      section: ""
    }));
  };

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    if (!form.department) {
      setClasses([]);
      return;
    }
    loadOptions(form.department);
  }, [form.department]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      handleChange("profilePhoto", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Profile photo must be 2MB or smaller");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, profilePhoto: String(reader.result || "") }));
      setError("");
    };
    reader.onerror = () => {
      setError("Unable to read selected image");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        email: form.email.trim(),
        rollNumber: form.rollNumber.trim().toUpperCase(),
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, ""),
        year: form.year ? Number(form.year) : null,
        branch: form.department,
        section: form.section,
        profilePhoto: form.profilePhoto
      };

      await completeStudentSetup(payload);

      if (autoLogin) {
        const user = await login(autoLogin);
        setMessage("Profile setup completed. Logging you in.");
        setTimeout(() => navigate(getRoleLandingPath(user.role), { replace: true }), 700);
      } else {
        setMessage("Profile setup completed. You can now sign in.");
        setTimeout(() => navigate("/login"), 900);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      mode="register"
      title="Student Profile Setup."
      subtitle="Step 3: Complete your profile details."
      helperText="Already completed setup?"
      helperLinkLabel="Sign In."
      helperLinkTo="/login"
      loading={submitting}
      loadingLabel="Saving profile..."
    >
      <form className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="setup-photo">
            Profile Photo (Optional)
          </label>
          <input
            id="setup-photo"
            className={fieldClass}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
          />
          {form.profilePhoto ? (
            <img
              src={form.profilePhoto}
              alt="Profile preview"
              className="mt-3 h-20 w-20 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold text-white">
              {setupInitials}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="setup-email">
            Account Email
          </label>
          <input
            id="setup-email"
            className={fieldClass}
            type="email"
            placeholder="Rollnumber@cmrcet.ac.in"
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="setup-roll-number">
            Roll Number
          </label>
          <input
            id="setup-roll-number"
            className={fieldClass}
            placeholder="Enter roll number"
            value={form.rollNumber}
            onChange={(event) => handleChange("rollNumber", event.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="setup-name">
            Student Name
          </label>
          <input
            id="setup-name"
            className={fieldClass}
            placeholder="Enter student name"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="setup-mobile">
            Mobile Number
          </label>
          <input
            id="setup-mobile"
            className={fieldClass}
            type="tel"
            placeholder="10-digit mobile number"
            value={form.mobile}
            onChange={(event) =>
              handleChange("mobile", event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="setup-department">
            Department
          </label>
          <select
            id="setup-department"
            className={fieldClass}
            value={form.department}
            onChange={(event) => handleDepartmentChange(event.target.value)}
            disabled={loadingOptions}
            required
          >
            <option value="">{loadingOptions ? "Loading departments..." : "Select Department..."}</option>
            {departments.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="setup-year">
            Year
          </label>
          <select
            id="setup-year"
            className={fieldClass}
            value={form.year}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, year: event.target.value, section: "" }))
            }
            disabled={!form.department || loadingOptions}
            required
          >
            <option value="">
              {loadingOptions ? "Loading years..." : form.department ? "Select Year..." : "Select department first"}
            </option>
            {availableYears.map((yearValue) => (
              <option key={yearValue} value={String(yearValue)}>
                {`${yearValue}${yearValue === 1 ? "st" : yearValue === 2 ? "nd" : yearValue === 3 ? "rd" : "th"} Year`}
              </option>
            ))}
          </select>
        </div>


        <div>
          <label className={labelClass} htmlFor="setup-section">
            Section
          </label>
          <select
            id="setup-section"
            className={fieldClass}
            value={form.section}
            onChange={(event) => handleChange("section", event.target.value)}
            disabled={!form.department || !form.year || loadingOptions}
            required
          >
            <option value="">
              {loadingOptions
                ? "Loading sections..."
                : form.department && form.year
                  ? "Select Section..."
                  : "Select department and year first"}
            </option>
            {availableSections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-sm text-red-300 lg:col-span-2">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300 lg:col-span-2">{message}</p> : null}

        <button
          className="lg:col-span-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-70"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Continue"}
        </button>

        <p className="text-xs text-slate-400 lg:col-span-2">
          Need to re-verify OTP?{" "}
          <Link className="text-brand-300 hover:text-brand-100" to="/verify-otp">
            Open Verify OTP
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
