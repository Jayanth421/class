import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import useAuth from "../hooks/useAuth";

function getRoleLandingPath(role) {
  if (role === "STUDENT") return "/student/home";
  if (role === "FACULTY") return "/faculty/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "SMARTBOARD") return "/smartboard/view";
  return "/login";
}

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp, login } = useAuth();
  const emailFromQuery = new URLSearchParams(location.search || "").get("email") || "";
  const [email, setEmail] = useState(location.state?.email || emailFromQuery || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await verifyOtp({ email, otp });
      const autoLogin = location.state?.autoLogin || null;

      if (location.state?.next === "student-setup") {
        setMessage("Account verified successfully. Continue profile setup.");
        setTimeout(
          () =>
            navigate("/student/setup", {
              state: { email: email.trim(), autoLogin }
            }),
          900
        );
      } else if (location.state?.next === "faculty-setup") {
        setMessage("Account verified successfully. Continue faculty setup.");
        setTimeout(
          () =>
            navigate("/faculty/setup", {
              state: { email: email.trim(), autoLogin }
            }),
          900
        );
      } else if (autoLogin) {
        const user = await login(autoLogin);
        setMessage("Account verified. Logging you in.");
        setTimeout(() => navigate(getRoleLandingPath(user.role), { replace: true }), 700);
      } else {
        setMessage("Account verified successfully. You can now sign in.");
        setTimeout(() => navigate("/login"), 900);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "OTP verification failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-md p-6">
        <h1 className="font-display text-2xl text-white">Verify OTP</h1>
        <p className="mt-1 text-sm text-soft">Enter the OTP sent to your email.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-300 focus:border-brand-300"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white tracking-[0.25em] outline-none placeholder:text-slate-300 focus:border-brand-300"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            required
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          <button
            className="w-full rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            type="submit"
          >
            Verify Account
          </button>
        </form>
        <p className="mt-4 text-sm text-soft">
          <Link className="text-brand-300 hover:text-brand-100" to="/login">
            Back to login
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
