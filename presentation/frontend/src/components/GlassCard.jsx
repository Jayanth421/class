export default function GlassCard({ className = "", children }) {
  return (
    <div className={`glass-card rounded-2xl p-4 md:p-5 ${className}`}>
      {children}
    </div>
  );
}
