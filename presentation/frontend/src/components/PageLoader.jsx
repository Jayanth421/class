import CmrLoading from "./CmrLoading";

export default function PageLoader({ label = "Loading...", size = "min(90px, 30vw)", className = "" }) {
  return (
    <div
      className={`content-fade-in flex min-h-[50vh] w-full items-center justify-center py-14 ${className}`}
    >
      <CmrLoading label={label} size={size} />
    </div>
  );
}
