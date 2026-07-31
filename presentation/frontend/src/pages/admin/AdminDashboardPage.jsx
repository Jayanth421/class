import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PortalIcon from "../../components/PortalIcon";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

function toPercent(value, total) {
  if (!total || total <= 0) return 0;
  return Math.round((Number(value || 0) / total) * 100);
}

function roleToIcon(role) {
  if (role === "STUDENT") return "subjects";
  if (role === "FACULTY") return "classes";
  if (role === "ADMIN") return "settings";
  if (role === "SMARTBOARD") return "smartboard";
  return "users";
}

function roleToTone(role) {
  if (role === "STUDENT") return "bg-[#CFCFCF] text-[#141414]";
  if (role === "FACULTY") return "bg-[#CFCFCF] text-[#141414]";
  if (role === "ADMIN") return "bg-[#CFCFCF] text-[#141414]";
  if (role === "SMARTBOARD") return "bg-[#CFCFCF] text-[#141414]";
  return "bg-[#CFCFCF] text-[#141414]";
}

function MetricCard({ label, value, note, toneClass }) {
  return (
    <div className={`admin-panel-outline rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-soft">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#141414]">{value}</p>
      <p className="mt-1 text-xs text-soft">{note}</p>
    </div>
  );
}

function TimelineItem({ label, value, maxValue, toneClass }) {
  const width = maxValue > 0 ? Math.max(Math.round((value / maxValue) * 100), 8) : 8;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-soft">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-9 rounded-full bg-[#CFCFCF] p-1">
        <div
          className={`h-full rounded-full ${toneClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    analytics: null,
    error: ""
  });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await api.get("/admin/analytics");
        setState({ loading: false, analytics: response.data, error: "" });
      } catch (requestError) {
        setState({
          loading: false,
          analytics: null,
          error: requestError?.response?.data?.message || "Failed to load admin dashboard"
        });
      }
    }

    loadDashboard();
  }, []);

  if (state.loading) return <PageLoader label="Loading admin dashboard..." />;
  if (state.error) return <p className="text-red-300">{state.error}</p>;

  const usersByRole = state.analytics?.usersByRole || [];
  const totals = state.analytics?.totals || {};
  const usersMap = usersByRole.reduce((acc, item) => {
    acc[item.role] = item.total;
    return acc;
  }, {});

  const totalUsers = Object.values(usersMap).reduce((sum, item) => sum + Number(item || 0), 0);
  const uploadHealth = Math.min(toPercent(totals.uploads || 0, (totals.subjects || 0) + 1), 100);

  const roleStats = ["STUDENT", "FACULTY", "ADMIN", "SMARTBOARD"].map((role) => ({
    role,
    value: usersMap[role] || 0
  }));

  const maxRoleValue = Math.max(...roleStats.map((item) => item.value), 1);

  const base =
    Number(totals.classes || 0) * 7 +
    Number(totals.subjects || 0) * 11 +
    Number(totals.uploads || 0) * 13 +
    Number(totalUsers || 0) * 5;
  const matrixValues = Array.from({ length: 24 }).map(
    (_, index) => ((base + (index + 3) * 17) % 93) + 7
  );

  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <GlassCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-soft">Operations</p>
              <h3 className="admin-heading text-4xl text-[#141414] md:text-5xl">Command Deck</h3>
            </div>
            <span className="admin-pill border-[#CFCFCF] bg-[#CFCFCF] text-xs uppercase tracking-[0.2em] text-[#141414]">
              Live
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Classes"
              value={totals.classes || 0}
              note="Active class structures"
              toneClass="text-[#141414]"
            />
            <MetricCard
              label="Subjects"
              value={totals.subjects || 0}
              note="Tracked course entries"
              toneClass="text-[#141414]"
            />
            <MetricCard
              label="Uploads"
              value={totals.uploads || 0}
              note="Presentation submissions"
              toneClass="text-[#141414]"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roleStats.map((item) => (
              <div key={item.role} className="admin-panel-outline rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${roleToTone(
                      item.role
                    )}`}
                  >
                    <PortalIcon name={roleToIcon(item.role)} className="h-4 w-4" />
                  </span>
                  <p className="text-2xl font-semibold text-[#141414]">{item.value}</p>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-soft">{item.role}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.22em] text-soft">System Health</p>
            <span className="rounded-full border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#141414]">
              Stability
            </span>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <div
              className="relative flex h-44 w-44 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#111827 ${uploadHealth * 3.6}deg, #6b7280 ${
                  uploadHealth * 3.6
                }deg ${Math.min(uploadHealth * 3.6 + 58, 350)}deg, #E5E7EB 350deg 360deg)`
              }}
            >
              <div className="absolute inset-[15px] rounded-full bg-[#CFCFCF]" />
              <div className="relative text-center">
                <p className="text-4xl font-bold text-[#141414]">{uploadHealth}%</p>
                <p className="text-xs uppercase tracking-[0.18em] text-soft">Upload Health</p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-2">
              <span className="text-soft">Total Users</span>
              <span className="font-semibold text-[#141414]">{totalUsers}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-2">
              <span className="text-soft">Content Density</span>
              <span className="font-semibold text-[#141414]">
                {totals.classes ? ((totals.subjects || 0) / totals.classes).toFixed(1) : "0.0"} / class
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <GlassCard className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h3 className="admin-heading text-3xl text-[#141414]">Resource Matrix</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-soft">Signal Grid</p>
          </div>

          <div className="mt-6 grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            {matrixValues.map((value, index) => {
              const pillColor =
                value > 66
                  ? "bg-[#111827] text-white"
                  : value > 38
                    ? "bg-[#6b7280] text-white"
                    : "bg-[#E5E7EB] text-[#141414]";
              return (
                <div key={`matrix-${index}`} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 rounded-full text-center text-[10px] font-semibold ${pillColor}`}
                    style={{
                      height: `${20 + Math.round((value / 100) * 52)}px`,
                      lineHeight: `${20 + Math.round((value / 100) * 52)}px`
                    }}
                  >
                    {value}
                  </div>
                  <span className="text-[9px] text-soft">{index + 1}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs">
            <span className="inline-flex items-center gap-2 text-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-[#111827]" />
              Healthy
            </span>
            <span className="inline-flex items-center gap-2 text-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6b7280]" />
              Medium
            </span>
            <span className="inline-flex items-center gap-2 text-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
              Idle
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h3 className="admin-heading text-3xl text-[#141414]">Projects Timeline</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-soft">Role Load</p>
          </div>

          <div className="mt-6 space-y-4">
            {roleStats.map((item) => (
              <TimelineItem
                key={`timeline-${item.role}`}
                label={item.role}
                value={item.value}
                maxValue={maxRoleValue}
                toneClass={
                  item.role === "STUDENT"
                    ? "bg-[#111827]"
                    : item.role === "FACULTY"
                      ? "bg-[#6b7280]"
                      : item.role === "ADMIN"
                        ? "bg-[#9ca3af]"
                        : "bg-[#E5E7EB]"
                }
              />
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#CFCFCF] bg-[#CFCFCF] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-soft">Admin Note</p>
            <p className="mt-2 text-sm text-[#141414]">
              Keep class and subject counts balanced to improve upload completion across student
              groups.
            </p>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
