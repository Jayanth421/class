import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { PoweredByYeahzz } from "../components/YeahzzBranding";
import useAuth from "../hooks/useAuth";

function getRoleLandingPath(role) {
  if (role === "STUDENT") return "/student/home";
  if (role === "FACULTY") return "/faculty/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "SMARTBOARD") return "/smartboard/view";
  return "/login";
}

function getPortalCopy(portalRole) {
  if (portalRole === "STUDENT") {
    return {
      title: "Student Portal Login",
      subtitle: "Use your student email or roll number to continue."
    };
  }
  if (portalRole === "FACULTY") {
    return {
      title: "Faculty Portal Login",
      subtitle: "Sign in with faculty email or username ID."
    };
  }
  if (portalRole === "ADMIN") {
    return {
      title: "Admin Portal Login",
      subtitle: "Sign in with administrator credentials only."
    };
  }
  return {
    title: "Welcome Back.",
    subtitle: "Please enter your account."
  };
}

function getSafeRedirectPath(location) {
  const params = new URLSearchParams(location.search || "");
  const fromQuery = String(params.get("redirect") || params.get("redirectTo") || "").trim();
  const fromState = String(location.state?.redirectTo || "").trim();
  const candidate = fromState || fromQuery;

  if (!candidate) return "";
  if (candidate.startsWith("/")) return candidate;

  try {
    const parsed = new URL(candidate);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_error) {
    // ignore and continue with smartboard fallback below
  }

  if (
    typeof window !== "undefined" &&
    location.pathname.startsWith("/faculty/login")
  ) {
    const pendingToken = String(window.sessionStorage.getItem("cmr_smartboard_auth_token") || "").trim();
    if (pendingToken) {
      return `/smartboard/authorize?token=${encodeURIComponent(pendingToken)}`;
    }
  }

  return "";
}

export default function LoginPage({ portalRole = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const routeRole = location.pathname.startsWith("/student/login")
    ? "STUDENT"
    : location.pathname.startsWith("/faculty/login")
      ? "FACULTY"
      : location.pathname.startsWith("/admin/login")
        ? "ADMIN"
      : null;
  const activePortalRole = portalRole || routeRole;
  const portalCopy = getPortalCopy(activePortalRole);
  const helperLinkTo =
    activePortalRole === "ADMIN"
      ? "/login"
      : activePortalRole === "FACULTY"
        ? "/faculty/register"
        : "/register";
  const loginLinkTo =
    activePortalRole === "FACULTY"
      ? "/faculty/login"
      : activePortalRole === "ADMIN"
        ? "/admin/login"
        : "/login";
  const registerLinkTo = activePortalRole === "FACULTY" ? "/faculty/register" : "/register";
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const inputClass =
    "w-full rounded-xl border border-white/15 bg-[#141414] px-4 py-3 text-white outline-none placeholder:text-slate-400 transition focus:border-white/60";
  const linkClass = "text-slate-200 hover:text-white";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const user = await login({ ...form, role: activePortalRole });
      const redirectTo = getSafeRedirectPath(location);
      const targetPath = redirectTo || getRoleLandingPath(user.role);
      navigate(targetPath, { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Login failed");
    }
  };

  return (
    <AuthShell
      mode="login"
      title={portalCopy.title}
      subtitle={portalCopy.subtitle}
      helperText={activePortalRole === "ADMIN" ? "Need student/faculty account?" : "Don't have an account?"}
      helperLinkLabel={activePortalRole === "ADMIN" ? "Go to Sign In." : "Sign Up."}
      helperLinkTo={helperLinkTo}
      loginLinkTo={loginLinkTo}
      registerLinkTo={registerLinkTo}
      loading={loading}
      loadingLabel="Signing in..."
    >
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm text-soft" htmlFor="login-identifier">
            Email or ID
          </label>
          <input
            id="login-identifier"
            className={inputClass}
            type="text"
            placeholder={activePortalRole === "STUDENT" ? "Roll Number or Email" : "Email or ID"}
            value={form.identifier}
            onChange={(event) => setForm((prev) => ({ ...prev, identifier: event.target.value }))}
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-soft" htmlFor="login-password">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              className={`${inputClass} pr-16`}
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
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
          <div className="mt-2 text-right">
            <Link className={`text-xs ${linkClass}`} to="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f1f1f] disabled:opacity-70"
          type="submit"
          disabled={loading}
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>
      
    </AuthShell>
  );
}
