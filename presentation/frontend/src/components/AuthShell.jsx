import { Link } from "react-router-dom";
import CmrLoading from "./CmrLoading";

const AUTH_TABS = [
  { id: "login", label: "Login", to: "/login" },
  { id: "register", label: "Register", to: "/register" }
];


    function AuthHeroIllustration() {
  return <img src="/auth-assets/002.svg" alt="Portal hero" className="w-full max-w-sm self-center" />;
}



export default function AuthShell({
  mode,
  title,
  subtitle,
  helperText,
  helperLinkLabel,
  helperLinkTo,
  loginLinkTo = "/login",
  registerLinkTo = "/register",
  cornerAction,
  showInstitutionLogo = true,
  loading = false,
  loadingLabel = "Loading...",
  children
}) {
  const tabs = AUTH_TABS.map((tab) => ({
    ...tab,
    to: tab.id === "login" ? loginLinkTo : registerLinkTo
  }));
  const heroGradientClass =
    mode === "register"
      ? "bg-gradient-to-b from-white via-[#f7f7f7] to-[#f1f1f1]"
      : "bg-gradient-to-b from-white via-[#f7f7f7] to-[#f1f1f1]";

  return (
    <div className="background min-h-screen px-4 py-6 md:px-8 md:py-8">
      {showInstitutionLogo ? (
        <div className="flex justify-center">
          
          <img
            src="/auth-assets/logo.jpg"
            alt="CMR institution logo"
            className="h-20 w-20 rounded-full border border-white/20 bg-white p-2 object-contain shadow-[0_10px_22px_rgba(20,20,20,0.35)]"
          />
        </div>
      ) : null}

      <div className="mx-auto mt-4 flex w-full max-w-6xl flex-col items-center">
        <div className="w-full rounded-[30px] border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
        <div className="grid gap-3 md:grid-cols-[132px_1.1fr_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-2">
            <nav className="flex gap-2 md:h-full md:flex-col">
              {tabs.map((tab) => {
                const active = tab.id === mode;
                const activeClass = "bg-black text-white";
                return (
                  <Link
                    key={tab.id}
                    to={tab.to}
                    className={`flex flex-1 items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold transition md:flex-none md:justify-center ${
                      active
                        ? activeClass
                        : "text-slate-600 hover:bg-slate-100 hover:text-black"
                    }`}
                  >
                    <span
                      className={`hidden h-6 w-1 rounded-full md:block ${active ? "bg-white" : "bg-transparent"}`}
                    />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className={`relative hidden overflow-hidden rounded-2xl p-8 md:flex md:flex-col md:justify-between ${heroGradientClass}`}>
            <div>
              <h1 className="font-display text-4xl text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            </div>
            <AuthHeroIllustration />
          </section>

          <section className="relative rounded-2xl border border-slate-200 bg-white p-5 md:p-8" aria-busy={loading}>
            {cornerAction ? <div className="absolute right-5 top-5 z-10">{cornerAction}</div> : null}
            {loading ? (
              <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-white/80 backdrop-blur-sm">
                <CmrLoading label={loadingLabel} size="min(220px, 70vw)" />
              </div>
            ) : null}
            <div className="mb-6 md:hidden">
              <h1 className="font-display text-3xl text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            </div>
            <p className="text-sm text-slate-600">
              {helperText}{" "}
              <Link className="font-semibold text-slate-900 hover:text-black" to={helperLinkTo}>
                {helperLinkLabel}
              </Link>
            </p>
            {children}
          </section>
        </div>
      </div>
      </div>
    </div>
  );
}
