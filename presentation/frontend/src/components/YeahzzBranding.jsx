export function YeahzzHeaderBadge({ className = "" }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 ${className}`}
    >
      <img src="/auth-assets/yeahzz-mark.svg" alt="Yeahzz logo" className="h-8 w-24 object-contain" />
      <span className="text-sm font-semibold tracking-wide text-white">Yeahzz</span>
    </div>
  );
}

export function PoweredByYeahzz({
  className = "",
  textClassName = "",
  showText = true,
  logoClassName = "h-12 w-40"
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 ${className}`}>
      {showText ? (
        <p className={`text-xs tracking-[0.14em] text-slate-200 ${textClassName}`}>
          Powered by <span className="font-semibold text-white"></span>
        </p>
      ) : null}
      <img
        src="/auth-assets/yeahzz-mark.svg"
        alt="Yeahzz logo"
        className={`${logoClassName} object-contain`}
        
      />
      
    </div>
  );
}

export default PoweredByYeahzz;
