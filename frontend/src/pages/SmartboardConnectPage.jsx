import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import useAuth from "../hooks/useAuth";
import { buildSmartboardUser } from "../services/smartboardSession";

export default function SmartboardConnectPage() {
  const { isAuthenticated, role, establishSession } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("Preparing automatic smartboard QR login...");
  const [error, setError] = useState("");
  const [startingSession, setStartingSession] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [manualAccessCode, setManualAccessCode] = useState("");
  const [manualSmartboardName, setManualSmartboardName] = useState("Classroom Smartboard");
  const [manualLoading, setManualLoading] = useState(false);
  const [showHeroImage, setShowHeroImage] = useState(true);

  useEffect(() => {
    if (isAuthenticated && (role === "SMARTBOARD" || role === "FACULTY" || role === "ADMIN")) {
      navigate("/smartboard/view", { replace: true });
    }
  }, [isAuthenticated, navigate, role]);

  const completeSmartboardLogin = useCallback(
    (exchangeData, activeSession) => {
      setStatus("Authorization complete. Opening smartboard...");
      establishSession({
        accessToken: exchangeData.accessToken,
        user: buildSmartboardUser(exchangeData, activeSession)
      });
      navigate("/smartboard/view", { replace: true });
    },
    [establishSession, navigate]
  );

  const startSession = useCallback(async () => {
    setStartingSession(true);
    setError("");
    setStatus("Generating QR session...");
    try {
      const response = await api.post("/auth/smartboard/session", {
        smartboardName: "Classroom Smartboard"
      });
      const created = response.data || null;
      setSession(created);
      if (created?.expiresAt) {
        const nextSeconds = Math.floor((new Date(created.expiresAt).getTime() - Date.now()) / 1000);
        setSecondsLeft(Math.max(nextSeconds, 0));
      } else {
        setSecondsLeft(0);
      }
      setStatus("Scan QR from faculty mobile camera. Waiting for authorization...");
      return created;
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to create smartboard session");
      setStatus("Failed to start camera login.");
      return null;
    } finally {
      setStartingSession(false);
    }
  }, []);

  // For this simplified Smartboard login UI we only expose manual access login (accessUser + accessKey)
  // Do not auto-start QR session or polling in this view.
  useEffect(() => {
    // intentionally empty - QR flow disabled for simplified UI
    return undefined;
  }, []);

  const loginWithSmartboardAccessKey = async () => {
    setManualLoading(true);
    setError("");
    setStatus("Logging in with smartboard access code...");

    // validate 4-digit code
    if (!/^\d{4}$/.test(manualAccessCode)) {
      setError("Please enter a 4-digit access code");
      setManualLoading(false);
      return;
    }

    try {
      const response = await api.post("/auth/smartboard/access-login", {
        accessUser: "",
        accessKey: manualAccessCode,
        smartboardName: manualSmartboardName
      });

      completeSmartboardLogin(response.data, {
        sessionToken: response.data.sessionToken,
        smartboardName: manualSmartboardName
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Manual smartboard login failed.");
      setStatus("Smartboard access login failed.");
    } finally {
      setManualLoading(false);
    }
  };

  const expiresInLabel = useMemo(() => {
    if (!session?.expiresAt) return "Waiting for QR...";
    if (secondsLeft > 0) return `Expires in ${secondsLeft}s`;
    return "Refreshing QR...";
  }, [secondsLeft, session?.expiresAt]);

  return (
    <div className="min-h-screen bg-[#EAF7E7] flex items-center justify-center p-4">
      <div className="mx-auto w-full max-w-[1100px] rounded-xl shadow-[0_22px_54px_rgba(0,0,0,0.15)] overflow-hidden bg-white flex flex-col lg:flex-row">
        {/* Left hero area (illustration) */}
        {showHeroImage ? (
          <div className="hidden lg:block lg:w-1/2 bg-gradient-to-b from-[#dff3d9] to-[#c9f0c4] p-10 flex items-center justify-center">
            <div className="w-full max-w-[520px] rounded-xl overflow-hidden bg-transparent p-4 flex items-center justify-center">
              <img src="/auth-assets/smartboard-hero.png" alt="Smartboard" className="max-w-full h-auto object-contain rounded-lg shadow" />
            </div>
          </div>
        ) : (
          <div className="hidden lg:block lg:w-1/2 bg-gradient-to-b from-[#dff3d9] to-[#c9f0c4] p-10" />
        )}

        {/* Right card - login form */}
        <div className="w-full lg:w-1/2 p-8">
          <div className="max-w-md mx-auto">
            <div className="text-center">
              <img src="/auth-assets/logo.jpg" alt="logo" className="mx-auto h-10 w-10 rounded-full object-cover" />
              <h1 className="mt-4 text-3xl font-bold text-[#141414]">Smartboard Login</h1>
              <p className="mt-2 text-sm text-slate-600">Sign in to the smartboard using the 4-digit access code provided by admin.</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); loginWithSmartboardAccessKey(); }}>
              <input
                type="text"
                value={manualAccessCode}
                onChange={(event) => setManualAccessCode((event.target.value || "").replace(/\D/g, "").slice(0,4))}
                placeholder="Access code (4 digits)"
                className="w-full rounded-full border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-300"
                required
              />

              <button
                type="submit"
                disabled={manualLoading}
                className="w-full rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-60"
              >
                {manualLoading ? "Signing in..." : "Sign in"}
              </button>

              {/* Toggle illustration button */}
              <button
                type="button"
                onClick={() => setShowHeroImage((v) => !v)}
                className="w-full mt-2 rounded-full border border-green-500 px-4 py-3 text-sm font-semibold text-green-600 hover:bg-green-50"
              >
                {showHeroImage ? "Hide illustration" : "Show illustration"}
              </button>

              <p className="mt-4 text-center text-xs text-slate-500">Or use QR login from the Smartboard Connect screen</p>
            </form>

            {status ? <p className="mt-4 text-sm text-green-700">{status}</p> : null}
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
