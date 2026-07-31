import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import PortalIcon from "../../components/PortalIcon";

const STATUS = Object.freeze({
  LIVE: "LIVE",
  PLANNED: "PLANNED"
});

const FILTERS = ["ALL", STATUS.LIVE, STATUS.PLANNED];

function live(label, path, note = "") {
  return {
    label,
    status: STATUS.LIVE,
    path,
    note
  };
}

function planned(label, note = "") {
  return {
    label,
    status: STATUS.PLANNED,
    path: "",
    note
  };
}

const FEATURE_SECTIONS = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: "dashboard",
    tone: "bg-lime-500/15 border-lime-500/30 text-lime-100",
    modulePath: "/admin/dashboard",
    description: "Live system posture, quick actions and operational health.",
    groups: [
      {
        label: "Observability",
        items: [
          live("System overview", "/admin/dashboard"),
          live("Total users count", "/admin/dashboard"),
          live("Total students", "/admin/dashboard"),
          live("Total faculty", "/admin/dashboard"),
          live("Total admins", "/admin/dashboard"),
          live("Total presentations uploaded", "/admin/dashboard"),
          planned("Active smart boards", "Needs board heartbeat/session tracker"),
          planned("Storage usage summary", "Needs storage metrics API"),
          planned("Recent uploads", "Needs timeline aggregation"),
          planned("Recent user activity", "Needs activity feed API"),
          live("System health status", "/admin/dashboard", "Shown as upload health index"),
          planned("Server uptime", "Needs server health endpoint"),
          planned("Real-time traffic monitor", "Needs streaming analytics"),
          planned("Quick action buttons", "Needs action orchestration layer")
        ]
      }
    ]
  },
  {
    key: "user-management",
    title: "User Management",
    icon: "users",
    tone: "bg-sky-500/15 border-sky-500/30 text-sky-100",
    modulePath: "/admin/users",
    description: "Accounts, roles, access rules and live user oversight.",
    groups: [
      {
        label: "User Accounts",
        items: [
          live("Create new user", "/admin/users"),
          live("Edit user details", "/admin/users"),
          live("Delete user", "/admin/users"),
          live("View user profile", "/admin/users"),
          planned("Suspend / activate user", "Needs status flag + auth guard"),
          live("Reset password", "/admin/users", "Handled via edit user password"),
          planned("Force logout user", "Needs token revoke endpoint by user")
        ]
      },
      {
        label: "Role Management",
        items: [
          planned("Create roles", "Role model is static today"),
          planned("Edit roles", "Role model is static today"),
          planned("Delete roles", "Role model is static today"),
          live("Assign roles to users", "/admin/users"),
          planned("Role permission control", "Needs role-permission matrix")
        ]
      },
      {
        label: "Access Control",
        items: [
          live("Role-based access control", "/admin/users", "Backend enforces role guards"),
          planned("Module permission control", "Needs module permission table"),
          planned("Feature permission control", "Needs feature toggle and ACL checks")
        ]
      },
      {
        label: "User Monitoring",
        items: [
          planned("Login history", "Needs login audit storage"),
          planned("Device login tracking", "Needs device fingerprint logging"),
          planned("Active sessions", "Needs per-user session API"),
          planned("User activity logs", "Needs event tracking pipeline")
        ]
      }
    ]
  },
  {
    key: "student-management",
    title: "Student Management",
    icon: "subjects",
    tone: "bg-emerald-500/15 border-emerald-500/30 text-emerald-100",
    modulePath: "/admin/users?role=STUDENT",
    description: "Full lifecycle control for student records and activity.",
    groups: [
      {
        label: "Profiles & Assignments",
        items: [
          live("Add student", "/admin/users?role=STUDENT"),
          live("Edit student", "/admin/users?role=STUDENT"),
          live("Delete student", "/admin/users?role=STUDENT"),
          live("View student profile", "/admin/users?role=STUDENT"),
          live("Student presentation uploads", "/admin/uploads"),
          planned("Student activity tracking", "Needs activity log API"),
          planned("Assign subjects to students", "Needs enrollment mapping")
        ]
      }
    ]
  },
  {
    key: "faculty-management",
    title: "Faculty Management",
    icon: "classes",
    tone: "bg-amber-500/15 border-amber-500/30 text-amber-100",
    modulePath: "/admin/users?role=FACULTY",
    description: "Configure faculty records, teaching scope and outputs.",
    groups: [
      {
        label: "Profiles & Oversight",
        items: [
          live("Add faculty", "/admin/users?role=FACULTY"),
          live("Edit faculty", "/admin/users?role=FACULTY"),
          live("Delete faculty", "/admin/users?role=FACULTY"),
          live("Assign subjects", "/admin/subjects"),
          planned("Faculty activity reports", "Needs faculty analytics API"),
          planned("Faculty upload management", "Needs faculty upload filters")
        ]
      }
    ]
  },
  {
    key: "subject-management",
    title: "Subject / Course Management",
    icon: "departments",
    tone: "bg-indigo-500/15 border-indigo-500/30 text-indigo-100",
    modulePath: "/admin/subjects",
    description: "Course catalog, enrollments and related presentations.",
    groups: [
      {
        label: "Course Controls",
        items: [
          live("Create subject", "/admin/subjects"),
          live("Edit subject", "/admin/subjects"),
          live("Delete subject", "/admin/subjects"),
          live("Assign faculty to subject", "/admin/subjects"),
          planned("Assign students to subject", "Needs student-subject enrollment"),
          live("Subject presentation list", "/admin/uploads"),
          planned("Subject analytics", "Needs subject-level metrics API")
        ]
      }
    ]
  },
  {
    key: "presentation-management",
    title: "Presentation Management",
    icon: "upload",
    tone: "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-100",
    modulePath: "/admin/uploads",
    description: "End-to-end presentation intake, review and delivery.",
    groups: [
      {
        label: "Submissions",
        items: [
          planned("Upload presentation", "Admin-side upload UI not implemented"),
          live("View presentation", "/admin/uploads"),
          live("Download presentation", "/admin/uploads"),
          planned("Delete presentation", "Needs upload delete endpoint"),
          planned("Approve / reject presentation", "Needs moderation workflow"),
          planned("Edit presentation metadata", "Needs metadata edit endpoint")
        ]
      },
      {
        label: "Processing",
        items: [
          live("Preview PPT / PDF", "/admin/uploads"),
          planned("Convert PPT to PDF", "Needs conversion service"),
          planned("Presentation version control", "Needs version storage model"),
          live("Presentation analytics", "/admin/analytics", "Upload totals available")
        ]
      }
    ]
  },
  {
    key: "smartboard-management",
    title: "Smart Board Management",
    icon: "smartboard",
    tone: "bg-cyan-500/15 border-cyan-500/30 text-cyan-100",
    modulePath: "/smartboard/view",
    description: "Device registry, connectivity and live broadcast control.",
    groups: [
      {
        label: "Devices & Control",
        items: [
          planned("Register smart board", "Needs device inventory model"),
          planned("Edit smart board settings", "Needs board config API"),
          planned("Remove smart board", "Needs board delete API"),
          planned("Monitor connected boards", "Needs connection telemetry"),
          planned("Connect / disconnect board", "Needs board lifecycle API"),
          live("Broadcast presentation to board", "/smartboard/view"),
          planned("Remote slide control", "Needs bidirectional board channel"),
          planned("Multi-board sync", "Needs shared sync state"),
          planned("Smart board usage logs", "Needs board usage tracking")
        ]
      }
    ]
  },
  {
    key: "storage-management",
    title: "File & Storage Management",
    icon: "settings",
    tone: "bg-slate-500/20 border-slate-500/30 text-slate-100",
    modulePath: "/admin/uploads",
    description: "Storage policy, quotas and file-level permissions.",
    groups: [
      {
        label: "Files & Policies",
        items: [
          live("View uploaded files", "/admin/uploads"),
          planned("Delete files", "Needs upload delete endpoint"),
          live("File preview", "/admin/uploads"),
          planned("File permission control", "Needs file ACL model"),
          planned("Storage usage statistics", "Needs storage metrics API"),
          planned("Storage quota settings", "Needs quota policy storage"),
          planned("File type restrictions", "Needs upload policy engine"),
          planned("File version history", "Needs version snapshots"),
          planned("Auto file cleanup", "Needs retention scheduler")
        ]
      }
    ]
  },
  {
    key: "notifications",
    title: "Notifications & Communication",
    icon: "bell",
    tone: "bg-rose-500/15 border-rose-500/30 text-rose-100",
    modulePath: "/admin/settings",
    description: "Outbound messaging and templates across channels.",
    groups: [
      {
        label: "Channels",
        items: [
          live("Send announcements", "/admin/settings", "Use bulk mail to role groups"),
          live("Send email notifications", "/admin/settings"),
          planned("Send push notifications", "Needs push service integration"),
          planned("SMS notifications", "Needs SMS provider integration"),
          planned("Scheduled notifications", "Needs job scheduler"),
          planned("Email templates management", "Needs template CRUD"),
          live("Broadcast message to users", "/admin/settings")
        ]
      }
    ]
  },
  {
    key: "analytics",
    title: "Analytics & Reports",
    icon: "analytics",
    tone: "bg-teal-500/15 border-teal-500/30 text-teal-100",
    modulePath: "/admin/analytics",
    description: "KPI dashboards and exportable reporting.",
    groups: [
      {
        label: "Insights",
        items: [
          planned("User growth analytics", "Current analytics show totals only"),
          planned("Student activity reports", "Needs student activity capture"),
          planned("Faculty activity reports", "Needs faculty activity capture"),
          live("Presentation upload statistics", "/admin/analytics"),
          planned("Smart board usage analytics", "Needs smartboard telemetry"),
          planned("Storage usage charts", "Needs storage metrics + charting"),
          planned("System performance analytics", "Needs infra metrics"),
          planned("Custom report generator", "Needs report builder backend")
        ]
      }
    ]
  }
];

function getSectionCounts(section) {
  const total = section.groups.reduce((sum, group) => sum + group.items.length, 0);
  const liveCount = section.groups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.status === STATUS.LIVE).length,
    0
  );
  return {
    total,
    liveCount,
    plannedCount: total - liveCount
  };
}

function FeatureItem({ item, onOpen }) {
  const isLive = item.status === STATUS.LIVE;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-[#141414]">{item.label}</p>
        {item.note ? <p className="mt-1 text-xs text-soft">{item.note}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.14em] ${
            isLive
              ? "border border-emerald-300/70 bg-emerald-100 text-emerald-700"
              : "border border-amber-300/70 bg-amber-100 text-amber-700"
          }`}
        >
          {item.status}
        </span>
        {isLive && item.path ? (
          <button
            type="button"
            onClick={() => onOpen(item.path)}
            className="rounded-md bg-[#141414] px-2 py-1 text-xs text-white transition hover:bg-[#141414]"
          >
            Open
          </button>
        ) : null}
      </div>
    </li>
  );
}

function FeatureGroup({ group, onOpen }) {
  const liveCount = group.items.filter((item) => item.status === STATUS.LIVE).length;
  return (
    <div className="rounded-xl border border-[#CFCFCF] bg-[#CFCFCF] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-soft">{group.label}</p>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-soft">
          {liveCount}/{group.items.length} live
        </span>
      </div>
      <ul className="mt-2 space-y-2">
        {group.items.map((item) => (
          <FeatureItem key={`${group.label}-${item.label}`} item={item} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

function FeatureSection({ section, onOpen }) {
  const counts = getSectionCounts(section);
  return (
    <GlassCard className="admin-panel-outline border-[#CFCFCF] bg-[#CFCFCF]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${section.tone}`}
          >
            <PortalIcon name={section.icon} className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soft">{section.key}</p>
            <h3 className="admin-heading text-2xl text-[#141414]">{section.title}</h3>
            <p className="mt-1 text-sm text-soft">{section.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#141414]">
            {counts.liveCount}/{counts.total} live
          </span>
          {section.modulePath ? (
            <button
              type="button"
              onClick={() => onOpen(section.modulePath)}
              className="rounded-full border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#141414] transition hover:bg-[#CFCFCF]"
            >
              Open Module
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {section.groups.map((group) => (
          <FeatureGroup key={`${section.key}-${group.label}`} group={group} onOpen={onOpen} />
        ))}
      </div>
    </GlassCard>
  );
}

export default function AdminFeatureMatrixPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const totals = useMemo(() => {
    const totalCapabilities = FEATURE_SECTIONS.reduce(
      (sum, section) => sum + getSectionCounts(section).total,
      0
    );
    const liveCapabilities = FEATURE_SECTIONS.reduce(
      (sum, section) => sum + getSectionCounts(section).liveCount,
      0
    );
    const plannedCapabilities = totalCapabilities - liveCapabilities;
    const coverage = totalCapabilities ? Math.round((liveCapabilities / totalCapabilities) * 100) : 0;
    return {
      totalCapabilities,
      liveCapabilities,
      plannedCapabilities,
      coverage
    };
  }, []);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return FEATURE_SECTIONS.map((section) => {
      const sectionMatches =
        section.title.toLowerCase().includes(normalizedQuery) ||
        section.description.toLowerCase().includes(normalizedQuery) ||
        section.key.toLowerCase().includes(normalizedQuery);

      const groups = section.groups
        .map((group) => {
          const groupMatches = group.label.toLowerCase().includes(normalizedQuery);
          const items = group.items.filter((item) => {
            if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
            if (!normalizedQuery) return true;
            if (sectionMatches || groupMatches) return true;
            return (
              item.label.toLowerCase().includes(normalizedQuery) ||
              String(item.note || "").toLowerCase().includes(normalizedQuery)
            );
          });

          return {
            ...group,
            items
          };
        })
        .filter((group) => group.items.length > 0);

      if (groups.length === 0) return null;
      return {
        ...section,
        groups
      };
    }).filter(Boolean);
  }, [query, statusFilter]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-soft">Admin Panel</p>
          <h1 className="admin-heading text-4xl text-[#141414] md:text-5xl">Feature Matrix</h1>
          <p className="mt-2 text-sm text-soft">
            Interactive map of implemented and pending admin capabilities. Live entries open the
            working module directly.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#CFCFCF] bg-[#CFCFCF] px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-soft">Sections</p>
            <p className="text-2xl font-semibold text-[#141414]">{FEATURE_SECTIONS.length}</p>
          </div>
          <div className="rounded-2xl border border-[#CFCFCF] bg-[#CFCFCF] px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-soft">Live</p>
            <p className="text-2xl font-semibold text-emerald-700">{totals.liveCapabilities}</p>
          </div>
          <div className="rounded-2xl border border-[#CFCFCF] bg-[#CFCFCF] px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-soft">Planned</p>
            <p className="text-2xl font-semibold text-amber-700">{totals.plannedCapabilities}</p>
          </div>
          <div className="rounded-2xl border border-[#CFCFCF] bg-[#CFCFCF] px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-soft">Coverage</p>
            <p className="text-2xl font-semibold text-[#141414]">{totals.coverage}%</p>
          </div>
        </div>
      </div>

      <GlassCard className="admin-panel-outline border-[#CFCFCF] bg-[#CFCFCF] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#CFCFCF] bg-[#CFCFCF] px-3 py-2">
            <PortalIcon name="search" className="h-4 w-4 text-soft" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search feature, section, or note"
              className="w-full bg-transparent text-sm text-[#141414] outline-none placeholder:text-soft"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] transition ${
                  statusFilter === filter
                    ? "bg-[#141414] text-white"
                    : "border border-[#CFCFCF] bg-[#CFCFCF] text-[#141414] hover:bg-[#CFCFCF]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {filteredSections.length === 0 ? (
        <GlassCard className="border-[#CFCFCF] bg-[#CFCFCF]">
          <p className="text-soft">No feature matches current search/filter.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          {filteredSections.map((section) => (
            <FeatureSection
              key={section.key}
              section={section}
              onOpen={(path) => navigate(path)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
