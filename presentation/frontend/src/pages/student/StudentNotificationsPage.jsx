import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

function getPriorityClass(priority, status) {
  if (status === "REJECTED") return "border-red-300/40 bg-red-400/15";
  if (status === "APPROVED") return "border-emerald-300/40 bg-emerald-400/15";
  if (priority === "HIGH") return "border-amber-300/40 bg-amber-300/15";
  return "border-white/10 bg-white/5";
}

export default function StudentNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/student/notifications");
      setNotifications(response.data.notifications || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  if (loading) return <PageLoader label="Loading notifications..." />;

  return (
    <section className="space-y-5">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">Notifications</h3>
            <p className="mt-1 text-sm text-soft">
              Announcements from faculty/admin and presentation review updates.
            </p>
          </div>
          <button
            type="button"
            onClick={loadNotifications}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>
      </GlassCard>

      {notifications.map((item) => (
        <GlassCard
          key={item.id}
          className={`rounded-2xl border ${getPriorityClass(item.priority, item.status)}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-white">{item.title}</p>
            <span className="rounded-full border border-white/20 px-2 py-1 text-[10px] uppercase text-soft">
              {item.priority || item.status || "INFO"}
            </span>
          </div>
          <p className="mt-2 text-sm text-soft">{item.message}</p>
          <p className="mt-3 text-xs text-soft">
            {item.subjectCode ? `${item.subjectCode} | ` : ""}
            {item.subjectName || ""}
            {item.createdAt ? ` | ${new Date(item.createdAt).toLocaleString()}` : ""}
          </p>
        </GlassCard>
      ))}

      {!error && notifications.length === 0 ? (
        <GlassCard>
          <p className="text-soft">No notifications available.</p>
        </GlassCard>
      ) : null}
      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
