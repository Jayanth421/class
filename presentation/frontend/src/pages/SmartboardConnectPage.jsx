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

  useEffect(() => {
    startSession();
  }, [startSession]);

  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const tick = () => {
      const nextSeconds = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(nextSeconds, 0));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!session?.expiresAt || secondsLeft > 0 || startingSession) return;
    startSession();
  }, [secondsLeft, session?.expiresAt, startingSession, startSession]);

  useEffect(() => {
    if (!session?.sessionToken) return undefined;
    let polling = false;

    const interval = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await api.post("/auth/smartboard/exchange", {
          sessionToken: session.sessionToken
        });
        if (response.data?.status === "AUTHORIZED") {
          completeSmartboardLogin(response.data, session);
        }
      } catch (requestError) {
        const code = requestError?.response?.status;
        if (code === 410) {
          setStatus("QR expired. Regenerating...");
          await startSession();
        } else if (code && code !== 401 && code !== 404) {
          setError(requestError?.response?.data?.message || "Smartboard polling failed");
        }
      } finally {
        polling = false;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [completeSmartboardLogin, session, startSession]);

  const expiresInLabel = useMemo(() => {
    if (!session?.expiresAt) return "Waiting for QR...";
    if (secondsLeft > 0) return `Expires in ${secondsLeft}s`;
    return "Refreshing QR...";
  }, [secondsLeft, session?.expiresAt]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#CFCFCF] via-[#CFCFCF] to-[#CFCFCF] px-4 py-6 text-[#141414]">
      <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-white/75 blur-2xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-80 w-80 rounded-full bg-white/70 blur-2xl" />
      <div className="pointer-events-none absolute left-1/2 top-14 h-40 w-40 -translate-x-1/2 rounded-full bg-white/35 blur-3xl" />

      <div className="mx-auto w-full max-w-md">
        <aside className="rounded-3xl border border-white/60 bg-white/45 p-4 shadow-[0_22px_54px_rgba(20, 20, 20, 0.25)] backdrop-blur-xl lg:p-5">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-[#141414]">
            Smartboard Camera Login
          </h1>
          <p className="mt-1.5 text-center text-xs text-[#141414]">
            Scan this QR code using faculty mobile camera to open the smartboard.
          </p>

          <div className="mt-3 rounded-2xl border border-white/70 bg-white/55 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
              Waiting for Camera Scan
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/75 bg-white p-2">
              {session?.qrDataUrl ? (
                <div
                  key={session?.sessionToken || "qr"}
                  className="content-fade-in relative mx-auto aspect-square w-full max-w-[320px]"
                >
                  <img
                    src={session.qrDataUrl}
                    alt="Smartboard QR login"
                    className="h-full w-full rounded-lg object-contain"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-white p-1.5 shadow-[0_4px_16px_rgba(20, 20, 20, 0.2)]">
                      <img
                        src="/auth-assets/logo.jpg"
                        alt="CMR logo"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-square w-full max-w-[320px] items-center justify-center text-xs text-[#CFCFCF]">
                  Preparing QR...
                </div>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-xs text-[#141414]">{expiresInLabel}</p>
              <button
                type="button"
                onClick={startSession}
                disabled={startingSession}
                className="rounded-xl border border-[#CFCFCF] bg-white/80 px-3 py-2 text-xs font-semibold text-[#141414] transition hover:bg-white disabled:opacity-60"
              >
                {startingSession ? "Generating..." : "Regenerate QR"}
              </button>
            </div>
          </div>

          {status ? <p className="mt-3 text-xs text-[#141414]">{status}</p> : null}
          {error ? <p className="mt-2 text-xs text-[#7f1d1d]">{error}</p> : null}
         
        </aside>
      </div>
    </div>
  );
}
