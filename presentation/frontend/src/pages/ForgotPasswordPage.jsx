import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import api from "../services/api";

const COLLEGE_EMAIL_REGEX = /^[^\s@]+@cmrcet\.ac\.in$/i;

export default function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromQuery = new URLSearchParams(location.search || "").get("email") || "";
  const [email, setEmail] = useState(emailFromQuery || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-[#141414] px-4 py-3 text-white outline-none placeholder:text-slate-400 transition focus:border-white focus:ring-2 focus:ring-white/20";

  const validateCollegeEmail = (value) => {
    const normalizedEmail = String(value || "").trim().toLowerCase();
    if (!COLLEGE_EMAIL_REGEX.test(normalizedEmail)) {
      throw new Error("Use your college email ID only (example: name@cmrcet.ac.in)");
    }
    return normalizedEmail;
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const normalizedEmail = validateCollegeEmail(email);
      const response = await api.post("/auth/forgot-password", { email: normalizedEmail });
      setEmail(normalizedEmail);
      setOtpSent(true);
      setMessage(response.data?.message || "OTP sent to your college email.");
    } catch (requestError) {
      if (requestError.message === "Use your college email ID only (example: name@cmrcet.ac.in)") {
        setError(requestError.message);
      } else {
        setError(requestError?.response?.data?.message || "Failed to send reset OTP");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      const normalizedEmail = validateCollegeEmail(email);

      const response = await api.post("/auth/reset-password", {
        email: normalizedEmail,
        otp: otp.trim(),
        newPassword
      });

      setMessage(response.data?.message || "Password reset successful.");
      setTimeout(() => navigate("/login"), 900);
    } catch (requestError) {
      if (requestError.message === "Passwords do not match") {
        setError("Passwords do not match");
      } else if (
        requestError.message === "Use your college email ID only (example: name@cmrcet.ac.in)"
      ) {
        setError(requestError.message);
      } else {
        setError(requestError?.response?.data?.message || "Failed to reset password");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      title="Reset Password."
      subtitle="Request OTP and set a new password."
      helperText="Remember your password?"
      helperLinkLabel="Sign In."
      helperLinkTo="/login"
      loading={submitting}
      loadingLabel="Processing..."
    >
      {!otpSent ? (
        <form className="mt-6 space-y-4" onSubmit={requestOtp}>
          <div>
            <label className="mb-2 block text-sm text-soft" htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              className={inputClass}
              type="email"
              placeholder="Enter college email (name@cmrcet.ac.in)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

          <button
            className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Sending..." : "Send Reset OTP"}
          </button>

          <p className="text-xs text-slate-400">
            OTP will be sent only to your college email ID.
          </p>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={resetPassword}>
          <div>
            <label className="mb-2 block text-sm text-soft" htmlFor="reset-email">
              Email
            </label>
            <input
              id="reset-email"
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-soft" htmlFor="reset-otp">
              OTP
            </label>
            <input
              id="reset-otp"
              className={inputClass}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-soft" htmlFor="reset-password">
              New Password
            </label>
            <input
              id="reset-password"
              className={inputClass}
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-soft" htmlFor="reset-confirm-password">
              Confirm New Password
            </label>
            <input
              id="reset-confirm-password"
              className={inputClass}
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

          <button
            className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Resetting..." : "Reset Password"}
          </button>

          <p className="text-sm text-soft">
            Didn't get OTP?{" "}
            <button
              type="button"
              className="text-brand-300 hover:text-brand-100"
              onClick={requestOtp}
              disabled={submitting}
            >
              Resend
            </button>
          </p>
        </form>
      )}

      <p className="mt-4 text-sm text-soft">
        <Link className="text-brand-300 rounded-xl bg-black px-4 py-3 bg-black hover:text-brand-100" to="/login">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

