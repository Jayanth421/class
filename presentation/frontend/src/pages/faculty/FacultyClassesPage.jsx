import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import api from "../../services/api";
import useAuth from "../../hooks/useAuth";

export default function FacultyClassesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState("");

  useEffect(() => {
    async function loadClasses() {
      try {
        const response = await api.get("/faculty/classes");
        setClasses(response.data.classes || []);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to load classes");
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  const classGroups = useMemo(() => {
    const groupsByKey = new Map();

    (classes || []).forEach((item) => {
      const departmentCode = String(item.departmentCode || "").trim() || "DEPT";
      const year = Number(item.year) || 0;
      const key = `${departmentCode}|${year}`;
      if (!groupsByKey.has(key)) {
        groupsByKey.set(key, { key, departmentCode, year, classes: [] });
      }
      groupsByKey.get(key).classes.push(item);
    });

    const groups = Array.from(groupsByKey.values());
    groups.forEach((group) => {
      group.classes.sort((a, b) => String(a.section || "").localeCompare(String(b.section || "")));
    });

    groups.sort((a, b) => {
      if (a.departmentCode !== b.departmentCode) return a.departmentCode.localeCompare(b.departmentCode);
      return Number(a.year) - Number(b.year);
    });

    return groups;
  }, [classes]);

  useEffect(() => {
    if (activeGroupKey) return;
    if (classGroups.length === 0) return;
    setActiveGroupKey(classGroups[0].key);
  }, [activeGroupKey, classGroups]);

  const activeGroup = useMemo(() => {
    if (!activeGroupKey) return classGroups[0] || null;
    return classGroups.find((group) => group.key === activeGroupKey) || classGroups[0] || null;
  }, [activeGroupKey, classGroups]);

  const openTeachingClass = (item) => {
    const params = new URLSearchParams({
      classId: item.id || "",
      className: item.name || "",
      year: String(item.year || ""),
      section: String(item.section || ""),
      department: item.department || ""
    });
    navigate(`/faculty/smartboard?${params.toString()}`);
  };

  const facultyName = String(user?.name || "Faculty").trim();
  const initials =
    facultyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "FA";
  const avatarSrc = String(user?.profilePhoto || "").trim();

  return (
    <section className="space-y-5">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">Teaching Classes</h3>
            <p className="mt-1 text-sm text-soft">
              Pick a class and start the smartboard teaching session.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClassPickerOpen(true)}
            disabled={loading || classes.length === 0}
            className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60"
          >
            Open Class Popup
          </button>
        </div>
        {error ? <p className="mt-3 text-red-300">{error}</p> : null}
        {loading ? <p className="mt-3 text-soft">Loading classes...</p> : null}

        {!loading && classes.length === 0 ? (
          <p className="mt-4 text-soft">No classes assigned yet.</p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {classes.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm"
            >
              <p className="font-semibold text-white">{item.name}</p>
              <p className="mt-1 text-soft">
                Year {item.year} | Section {item.section}
              </p>
              <p className="text-soft">{item.department || "Department not set"}</p>
              <button
                type="button"
                onClick={() => openTeachingClass(item)}
                className="mt-3 rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                Start Teaching
              </button>
            </div>
          ))}
        </div>
      </GlassCard>

      {classPickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setClassPickerOpen(false)}
        >
          <div
            className="content-fade-in flex h-[320px] w-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(20, 20, 20, 0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Faculty profile"
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-900">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Faculty</p>
                  <p className="text-sm font-semibold text-slate-900">{facultyName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClassPickerOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid flex-1 grid-cols-2">
              <div className="border-r border-slate-200 p-2">
                <p className="px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Class
                </p>
                <div className="mt-2 space-y-1 overflow-y-auto pr-1">
                  {classGroups.map((group) => {
                    const active = group.key === activeGroupKey;
                    const label = `${group.departmentCode} - Year ${group.year || "-"}`;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setActiveGroupKey(group.key)}
                        className={`w-full rounded-xl border px-2 py-2 text-left text-xs font-semibold transition ${
                          active
                            ? "border-slate-300 bg-slate-200 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {!loading && classGroups.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-500">No classes found.</p>
                  ) : null}
                </div>
              </div>

              <div className="p-2">
                <p className="px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Sections
                </p>
                <div className="mt-2 space-y-1 overflow-y-auto pr-1">
                  {activeGroup?.classes?.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setClassPickerOpen(false);
                        openTeachingClass(item);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-left text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                    >
                      {item.section || "Section"}
                      <span className="ml-2 text-[10px] font-medium text-slate-500">
                        {item.departmentCode ? `${item.departmentCode} ` : ""}Year {item.year || "-"}
                      </span>
                    </button>
                  ))}
                  {!loading && activeGroup && (!activeGroup.classes || activeGroup.classes.length === 0) ? (
                    <p className="px-2 py-2 text-xs text-slate-500">No sections found.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
