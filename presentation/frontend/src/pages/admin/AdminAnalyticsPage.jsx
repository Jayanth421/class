import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import api from "../../services/api";

function Tile({ label, value }) {
  return (
    <GlassCard className="rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-soft">{label}</p>
      <h3 className="mt-2 font-display text-2xl text-white">{value}</h3>
    </GlassCard>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const response = await api.get("/admin/analytics");
        setData(response.data);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to load analytics");
      }
    }
    loadAnalytics();
  }, []);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!data) return <p className="text-soft">Loading analytics...</p>;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Total Uploads" value={data.totals?.uploads || 0} />
        <Tile label="Total Classes" value={data.totals?.classes || 0} />
        <Tile label="Total Subjects" value={data.totals?.subjects || 0} />
      </div>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Users by Role</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data.usersByRole || []).map((item) => (
            <div key={item.role} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-soft">{item.role}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{item.total}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
