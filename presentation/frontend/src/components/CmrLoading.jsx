export default function CmrLoading({
  label = "Loading...",
  size = 180,
  logoSrc = "/auth-assets/logo.jpg",
  logoAlt = "CMR logo",
  className = ""
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`} role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 24 24"
          className="absolute inset-0 h-full w-full animate-spin text-slate-300 motion-reduce:animate-none"
          aria-hidden="true"
        >
          <circle
            className="opacity-30"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2.75"
            fill="none"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v2.6a5.4 5.4 0 00-5.4 5.4H4z"
          />
        </svg>

        <div className="absolute inset-[18%]">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-white p-3 shadow-[0_14px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-200">
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tracking-[0.22em] text-slate-500">
              CMR
            </div>
            <img
              src={logoSrc}
              alt={logoAlt}
              className="relative z-10 h-full w-full rounded-full object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
        </div>
      </div>

      {label ? <p className="mt-4 text-sm text-slate-600">{label}</p> : null}
    </div>
  );
}
