import { useEffect, useRef, useState } from "react";
import { PoweredByYeahzz } from "../../components/YeahzzBranding";
import api from "../../services/api";

const SESSION_TOKEN_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

function extractSessionToken(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const url = new URL(input);
    const tokenFromQuery = String(url.searchParams.get("token") || "").trim();
    if (SESSION_TOKEN_REGEX.test(tokenFromQuery)) {
      return tokenFromQuery.match(SESSION_TOKEN_REGEX)?.[0] || "";
    }
  } catch (_error) {
    // Not a URL; continue with plain token extraction.
  }

  return input.match(SESSION_TOKEN_REGEX)?.[0] || "";
}

export default function FacultySmartboardPage() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerRequested, setScannerRequested] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [authorizingSession, setAuthorizingSession] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const scanInProgressRef = useRef(false);

  const stopScanner = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const authorizeSessionToken = async (token) => {
    const normalized = extractSessionToken(token);
    if (!normalized) {
      setScannerError("Invalid QR code. Please scan again.");
      return;
    }

    setAuthorizingSession(true);
    setError("");
    setMessage("");
    setScannerError("");
    try {
      await api.post("/auth/smartboard/authorize", { sessionToken: normalized });
      setMessage("Board login successful. Smartboard session authorized.");
      setScannerOpen(false);
      setScannerRequested(false);
      stopScanner();
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.message || "Failed to authorize smartboard session";
      setScannerError(apiMessage);
      setError(apiMessage);
    } finally {
      setAuthorizingSession(false);
    }
  };

  useEffect(() => {
    if (!scannerOpen || !scannerRequested) {
      stopScanner();
      return undefined;
    }

    let cancelled = false;

    const startScanner = async () => {
      setScannerError("");

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setScannerError(
          "Camera requires HTTPS (or localhost). Open this page on https:// (Vercel/tunnel) or scan the QR using your phone camera app."
        );
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setScannerError("Camera is unavailable in this browser. Try Chrome/Safari, and allow camera permission.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!("BarcodeDetector" in window)) {
          setScannerError("QR auto-scan is not supported in this browser. Use a mobile browser with camera QR support.");
          return;
        }

        let detector;
        try {
          detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch (_error) {
          setScannerError("QR scanner is unavailable in this browser. Use a mobile browser with camera QR support.");
          return;
        }

        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || scanInProgressRef.current) return;
          scanInProgressRef.current = true;
          try {
            const codes = await detector.detect(videoRef.current);
            if (!codes || !codes.length) return;
            const rawValue = String(codes[0]?.rawValue || "").trim();
            const token = extractSessionToken(rawValue);
            if (token) {
              await authorizeSessionToken(token);
            }
          } catch (_error) {
            // Keep scanner running; intermittent decode errors are expected.
          } finally {
            scanInProgressRef.current = false;
          }
        }, 700);
      } catch (cameraError) {
        setScannerError(cameraError?.message || "Unable to access camera.");
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scannerOpen, scannerRequested]);

  useEffect(() => {
    // Safety reset: opening page should never auto-start camera.
    setScannerOpen(false);
    setScannerRequested(false);
    stopScanner();

    return () => {
      stopScanner();
    };
  }, []);

  return (
    <section className="mx-auto flex min-h-[68vh] w-full max-w-3xl items-center justify-center px-2">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#141414] p-5 text-center shadow-[0_20px_50px_rgba(20, 20, 20, 0.35)]">
        <h2 className="font-display text-2xl text-white">Smartboard QR Scanner</h2>
        <p className="mt-2 text-sm text-slate-300">Open scanner, scan board QR, and login instantly.</p>

        <button
          type="button"
          onClick={() => {
            setScannerRequested(true);
            setScannerOpen(true);
          }}
          className="mt-5 w-full rounded-xl border border-black bg-black px-3 py-3 text-sm font-semibold text-white transition hover:bg-gray-900"
        >
          Open Scanner
        </button>

        {message ? <p className="mt-4 text-sm font-medium text-[#22e300]">{message}</p> : null}
        {error ? <p className="mt-2 text-sm font-medium text-[#ff0303]">{error}</p> : null}

        <PoweredByYeahzz className="mt-5" />
      </div>

      {scannerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-[#141414] p-4 shadow-[0_20px_50px_rgba(20, 20, 20, 0.4)]">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-white">Scan Smartboard QR</h4>
              <button
                type="button"
                onClick={() => {
                  setScannerOpen(false);
                  setScannerRequested(false);
                }}
                className="rounded-xl border border-white  bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
              >
                Close
              </button>
            </div>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="mt-3 aspect-square w-full rounded-2xl border border-white/20 bg-black/40 object-cover"
            />

            <p className="mt-3 text-xs text-slate-300">
              Point your camera at smartboard QR. It will authorize automatically.
            </p>

            {authorizingSession ? <p className="mt-3 text-xs text-slate-200">Authorizing...</p> : null}
            {scannerError ? <p className="mt-3 text-sm text-[#7f1d1d]">{scannerError}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
