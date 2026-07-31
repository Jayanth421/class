import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import useAuth from "../hooks/useAuth";

const SMARTBOARD_AUTH_TOKEN_KEY = "cmr_smartboard_auth_token";

function readSessionToken(search) {
  const params = new URLSearchParams(search || "");
  return String(params.get("token") || "").trim();
}

export default function SmartboardAuthorizePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const sessionToken = useMemo(() => readSessionToken(location.search), [location.search]);
  const [status, setStatus] = useState("Preparing smartboard authorization...");
  const [error, setError] = useState("");

  const redirectTo = useMemo(() => {
    if (!sessionToken) return "/smartboard/authorize";
    return `/smartboard/authorize?token=${encodeURIComponent(sessionToken)}`;
  }, [sessionToken]);

  const allowAuthorization = role === "FACULTY" || role === "ADMIN";

  const returnToFacultyDashboard = () => {
    navigate("/faculty/dashboard", { replace: true });
  };

  const openFacultyLogin = () => {
    const encodedRedirect = encodeURIComponent(redirectTo);
    navigate(`/faculty/login?redirect=${encodedRedirect}`, {
      replace: true,
      state: { redirectTo }
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionToken) {
      window.sessionStorage.removeItem(SMARTBOARD_AUTH_TOKEN_KEY);
      return;
    }
    window.sessionStorage.setItem(SMARTBOARD_AUTH_TOKEN_KEY, sessionToken);
  }, [sessionToken]);

  useEffect(() => {
    let cancelled = false;

    const authorize = async () => {
      if (!sessionToken) {
        setError("Invalid QR token. Please rescan from smartboard.");
        setStatus("");
        return;
      }

      if (!isAuthenticated) {
        setError("");
        setStatus("Faculty login required to authorize this smartboard.");
        return;
      }

      if (!allowAuthorization) {
        setError("Please sign in with faculty account to authorize smartboard.");
        setStatus("");
        return;
      }

      setError("");
      setStatus("Authorizing smartboard session...");
      try {
        await api.post("/auth/smartboard/authorize", { sessionToken });
        if (cancelled) return;
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(SMARTBOARD_AUTH_TOKEN_KEY);
        }
        setStatus("Smartboard authorized successfully. Return to board screen.");
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError?.response?.data?.message || "Authorization failed");
        setStatus("");
      }
    };

    authorize();

    return () => {
      cancelled = true;
    };
  }, [allowAuthorization, isAuthenticated, sessionToken]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-[#141414]">
      <header className="mx-auto mb-4 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <img
          src="/auth-assets/logo.jpg"
          alt="CMR logo"
          className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#141414]">Current Page</p>
          <p className="truncate text-sm font-semibold text-[#141414]">Smartboard Authorization</p>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-6.5rem)] items-center justify-center">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#141414]">Smartboard QR Authorization</h1>
          <p className="mt-2 text-xs text-[#141414]">Authorize board access with your faculty account.</p>

          {status ? (
            <p className="mt-4 rounded-xl border border-[#14532d] bg-[#14532d] px-3 py-2 text-sm font-medium text-white">
              {status}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-[#7f1d1d] bg-[#7f1d1d] px-3 py-2 text-sm font-medium text-white">
              {error}
            </p>
          ) : null}

          <div className="mt-5 space-y-2">
            {!isAuthenticated || !allowAuthorization ? (
              <button
                type="button"
                onClick={openFacultyLogin}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#141414] transition hover:bg-slate-50"
              >
                Login as Faculty
              </button>
            ) : null}

            
            <Link
              to="/faculty/smartboard"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#141414] transition hover:bg-slate-50"
            >
              Open Faculty Scanner
            </Link>

            <button
              type="button"
              onClick={returnToFacultyDashboard}
              className="inline-flex w-full items-center justify-center rounded-xl border border-black bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Return to Faculty Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
