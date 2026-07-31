import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import useAuth from "../hooks/useAuth";

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

function getRegisterCopy(portalRole) {
  if (portalRole === "FACULTY") {
    return {
      title: "Create Faculty Account.",
      subtitle: "Step 1: Register with faculty email and password.",
      helperLinkTo: "/faculty/login",
      loginLinkTo: "/faculty/login",
      registerLinkTo: "/faculty/register",
      emailPlaceholder: "faculty@cmrcet.ac.in",
      successMessage: "OTP sent to faculty email. Verify to continue faculty setup.",
      nextStep: "faculty-setup"
    };
  }

  return {
    title: "Create Account.",
    subtitle: " Create your account with college email and password.",
    helperLinkTo: "/login",
    loginLinkTo: "/login",
    registerLinkTo: "/register",
    emailPlaceholder: "rollnumber@cmrcet.ac.in",
    successMessage: "OTP sent to your email. Verify to continue setup.",
    nextStep: "student-setup"
  };
}

export default function RegisterPage({ portalRole = "STUDENT" }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const activeRole = portalRole === "FACULTY" ? "FACULTY" : "STUDENT";
  const copy = getRegisterCopy(activeRole);
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fieldClass =
    "w-full rounded-xl border border-white/15 bg-[#141414] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 transition focus:border-white/60 focus:ring-2 focus:ring-white/15";
  const labelClass = "mb-2 block text-xs uppercase tracking-[0.12em] text-slate-300";
  const linkClass = "text-slate-200 hover:text-white";

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const normalizedEmail = form.email.trim();

      await register({
        name: activeRole === "FACULTY" ? form.name.trim() : undefined,
        email: normalizedEmail,
        password: form.password,
        role: activeRole
      });

      setMessage(copy.successMessage);
      navigate("/verify-otp", {
        state: {
          email: normalizedEmail,
          next: copy.nextStep,
          autoLogin: {
            identifier: normalizedEmail,
            password: form.password,
            role: activeRole
          }
        }
      });
    } catch (requestError) {
      if (requestError.message === "Passwords do not match") {
        setError("Passwords do not match");
      } else {
        setError(requestError?.response?.data?.message || "Account creation failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <AuthShell
       mode="register"
       title={copy.title}
       subtitle={copy.subtitle}
       helperText="Already have an account?"
       helperLinkLabel="Sign In."
       helperLinkTo={copy.helperLinkTo}
       loginLinkTo={copy.loginLinkTo}
       registerLinkTo={copy.registerLinkTo}
       loading={submitting}
       loadingLabel="Sending OTP..."
      >
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {activeRole === "FACULTY" ? (
          <div>
            <label className={labelClass} htmlFor="register-name">
              Faculty Name
            </label>
            <input
              id="register-name"
              className={fieldClass}
              type="text"
              placeholder="Enter faculty name"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              required
            />
          </div>
        ) : null}

        <div>
          <label className={labelClass} htmlFor="register-email">
            Email
          </label>
          <input
            id="register-email"
            className={fieldClass}
            type="email"
            placeholder={copy.emailPlaceholder}
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="register-password">
            Password
          </label>
          <div className="relative">
            <input
              id="register-password"
              className={`${fieldClass} pr-16`}
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${linkClass}`}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="register-confirm-password">
            Re-enter Password
          </label>
          <div className="relative">
            <input
              id="register-confirm-password"
              className={`${fieldClass} pr-16`}
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={form.confirmPassword}
              onChange={(event) => handleChange("confirmPassword", event.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${linkClass}`}
              aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

        <button
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f1f1f] disabled:opacity-70"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create Account & Send OTP"}
        </button>

        <p className="text-xs text-slate-400">
          By registering, you agree to our{" "}
          <Link className={linkClass} to="/terms-and-conditions">
            Terms and Conditions
          </Link>
          .
        </p>
      </form>
   
    </AuthShell>
  );
}
