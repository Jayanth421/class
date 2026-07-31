import { useEffect, useMemo, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

function getBadgeClass(type, status) {
  if (status === "REJECTED") return "bg-red-400/20 text-red-100";
  if (status === "APPROVED") return "bg-emerald-400/20 text-emerald-100";
  if (status === "UPLOADED" || status === "PENDING") return "bg-amber-400/20 text-amber-100";
  if (type === "LOGIN") return "bg-brand-400/20 text-brand-100";
  return "bg-white/10 text-white";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default function StudentActivityPage() {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");

  const loadActivity = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/student/activity");
      setActivity(response.data.activity || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const summary = useMemo(() => {
    const pending = activity.filter(
      (item) => item.status === "UPLOADED" || item.status === "PENDING"
    ).length;
    const approved = activity.filter((item) => item.status === "APPROVED").length;
    return {
      total: activity.length,
      pending,
      approved
    };
  }, [activity]);

  if (loading) return <PageLoader label="Loading activity..." />;

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="space-y-4 md:hidden">
        <GlassCard className="rounded-3xl border-white/20 bg-gradient-to-br from-[#7F49B433] via-[#7F49B444] to-[#14141455] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-blue-100/85">Student Activity</p>
              <h3 className="mt-1 font-display text-3xl text-white">Timeline</h3>
            </div>
            <button
              type="button"
              onClick={loadActivity}
              className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-blue-100/85">Total</p>
              <p className="mt-1 text-2xl font-semibold text-white">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-blue-100/85">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-white">{summary.pending}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-blue-100/85">Approved</p>
              <p className="mt-1 text-2xl font-semibold text-white">{summary.approved}</p>
            </div>
          </div>
        </GlassCard>

        {activity.map((item) => (
          <GlassCard key={item.id} className="rounded-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-soft">{item.message}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] uppercase ${getBadgeClass(
                  item.type,
                  item.status
                )}`}
              >
                {item.type}
              </span>
            </div>
            <p className="mt-3 text-[11px] text-soft">
              {item.status ? `${item.status} | ` : ""}
              {formatDateTime(item.createdAt)}
            </p>
          </GlassCard>
        ))}

        {!error && activity.length === 0 ? (
          <GlassCard className="rounded-3xl">
            <p className="text-soft">No activity recorded yet.</p>
          </GlassCard>
        ) : null}
      </div>

      <div className="hidden space-y-5 md:block">
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-white">Activity Timeline</h3>
              <p className="mt-1 text-sm text-soft">
                Upload history, review updates, and latest login activity.
              </p>
            </div>
            <button
              type="button"
              onClick={loadActivity}
              className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
            >
              Refresh
            </button>
          </div>
        </GlassCard>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard>
            <p className="text-xs uppercase tracking-[0.16em] text-soft">Total Events</p>
            <p className="mt-2 font-display text-3xl text-white">{summary.total}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs uppercase tracking-[0.16em] text-soft">Pending Review</p>
            <p className="mt-2 font-display text-3xl text-white">{summary.pending}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs uppercase tracking-[0.16em] text-soft">Approved</p>
            <p className="mt-2 font-display text-3xl text-white">{summary.approved}</p>
          </GlassCard>
        </div>

        {activity.map((item) => (
          <GlassCard key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-soft">{item.message}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] uppercase ${getBadgeClass(
                  item.type,
                  item.status
                )}`}
              >
                {item.type}
              </span>
            </div>
            <p className="mt-3 text-xs text-soft">
              {item.status ? `${item.status} | ` : ""}
              {formatDateTime(item.createdAt)}
            </p>
          </GlassCard>
        ))}

        {!error && activity.length === 0 ? (
          <GlassCard>
            <p className="text-soft">No activity recorded yet.</p>
          </GlassCard>
        ) : null}
      </div>

      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
