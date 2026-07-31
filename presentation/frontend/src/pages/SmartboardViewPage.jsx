import { useEffect, useMemo, useState } from "react";
import { PoweredByYeahzz } from "../components/YeahzzBranding";
import api from "../services/api";
import useAuth from "../hooks/useAuth";

const ALL_CLASSES_KEY = "__ALL_CLASSES__";

function buildOfficeViewerUrl(fileUrl) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function isOfficePresentation(url = "", fileType = "") {
  const normalizedType = String(fileType || "").toLowerCase();
  if (
    normalizedType.includes("powerpoint") ||
    normalizedType.includes("presentationml.presentation")
  ) {
    return true;
  }

  const raw = String(url || "").trim();
  if (!raw) return false;

  try {
    const pathname = new URL(raw).pathname.toLowerCase();
    return pathname.endsWith(".ppt") || pathname.endsWith(".pptx");
  } catch (_error) {
    const withoutParams = raw.split("#")[0].split("?")[0].toLowerCase();
    return withoutParams.endsWith(".ppt") || withoutParams.endsWith(".pptx");
  }
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function getClassLabel(item) {
  if (!item) return "Class";
  if (item.name) return item.name;
  const dept = item.departmentCode || item.department || "Class";
  const section = item.section || "";
  return `${dept} ${section}`.trim();
}

export default function SmartboardViewPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Smart board ready.");

  const [faculty, setFaculty] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [presentations, setPresentations] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPresentationId, setSelectedPresentationId] = useState("");

  const loadLibrary = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/auth/smartboard/library");
      const payload = response.data || {};
      const nextClasses = payload.classes || [];
      const nextSubjects = payload.subjects || [];
      const nextPresentations = payload.presentations || [];

      setFaculty(
        payload.faculty || {
          name: user?.facultyName || user?.name || "Faculty",
          email: user?.email || ""
        }
      );
      setClasses(nextClasses);
      setSubjects(nextSubjects);
      setPresentations(nextPresentations);

      if (nextClasses.length > 0) {
        setSelectedClassId(ALL_CLASSES_KEY);
      } else {
        setSelectedClassId("");
      }
      setStatus("Smartboard library loaded.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load smartboard classes");
      setStatus("Unable to load smartboard library.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const subjectsByClass = useMemo(() => {
    const grouped = new Map();
    (subjects || []).forEach((item) => {
      const key = String(item.classId || "");
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return grouped;
  }, [subjects]);

  const presentationsByClass = useMemo(() => {
    const grouped = new Map();
    (presentations || []).forEach((item) => {
      const key = String(item.classId || "");
      if (!key || !item?.fileUrl) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });

    grouped.forEach((rows, key) => {
      rows.sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
      grouped.set(key, rows);
    });
    return grouped;
  }, [presentations]);

  const selectedClass = useMemo(
    () =>
      String(selectedClassId) === ALL_CLASSES_KEY
        ? null
        : classes.find((item) => String(item.id) === String(selectedClassId)) || null,
    [classes, selectedClassId]
  );

  const allClassPresentations = useMemo(() => {
    return (presentations || [])
      .filter((item) => item?.fileUrl)
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  }, [presentations]);

  const selectedSubjectCount = useMemo(() => {
    if (String(selectedClassId) === ALL_CLASSES_KEY) return (subjects || []).length;
    if (!selectedClass) return 0;
    return (subjectsByClass.get(String(selectedClass.id)) || []).length;
  }, [selectedClass, selectedClassId, subjects, subjectsByClass]);

  const selectedClassLabel = useMemo(() => {
    if (String(selectedClassId) === ALL_CLASSES_KEY) return "All Classes";
    if (!selectedClass) return "Select a Class";
    return getClassLabel(selectedClass);
  }, [selectedClass, selectedClassId]);

  const selectedClassPresentations = useMemo(
    () =>
      String(selectedClassId) === ALL_CLASSES_KEY
        ? allClassPresentations
        : presentationsByClass.get(String(selectedClassId || "")) || [],
    [allClassPresentations, presentationsByClass, selectedClassId]
  );

  const selectedClassSummaryText = useMemo(() => {
    if (String(selectedClassId) === ALL_CLASSES_KEY) {
      return `${classes.length} class(es) | ${selectedClassPresentations.length} PPT card(s)`;
    }
    if (!selectedClass) return "No class selected";
    return `${selectedSubjectCount} subject(s) | ${selectedClassPresentations.length} PPT card(s)`;
  }, [classes.length, selectedClass, selectedClassId, selectedClassPresentations.length, selectedSubjectCount]);

  useEffect(() => {
    if (!selectedClassPresentations.length) {
      setSelectedPresentationId("");
      return;
    }
    const exists = selectedClassPresentations.some((item) => String(item.id) === String(selectedPresentationId));
    if (!exists) {
      setSelectedPresentationId(String(selectedClassPresentations[0].id));
    }
  }, [selectedClassPresentations, selectedPresentationId]);

  const chooseClass = (classId) => {
    setSelectedClassId(String(classId));
    setStatus(String(classId) === ALL_CLASSES_KEY ? "All classes view opened." : "Class view opened.");
  };

  const openPresentation = (presentation) => {
    if (!presentation?.fileUrl) return;
    const launchUrl = isOfficePresentation(presentation.fileUrl, presentation.fileType)
      ? buildOfficeViewerUrl(presentation.fileUrl)
      : presentation.fileUrl;
    setSelectedPresentationId(String(presentation.id));
    window.open(launchUrl, "_blank", "noopener,noreferrer");
    setStatus(`Opened "${presentation.title || presentation.fileName || "presentation"}".`);
  };

  const facultyName = faculty?.name || user?.facultyName || user?.name || "Faculty";
  const facultyEmail = faculty?.email || user?.email || "";

  return (
    <div className="h-full overflow-auto bg-[#141414] p-3 text-white lg:p-4">
      <section className="mx-auto w-full max-w-[1700px] space-y-3 xl:w-[75%] 2xl:w-[75%]">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#141414] via-[#141414] to-[#141414] p-3 shadow-[0_20px_60px_rgba(20, 20, 20, 0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl text-white lg:text-3xl">Smart Classroom Board</h1>
              <p className="mt-1 text-xs text-slate-200">
                Click class, open student PPT, and write between slides with pen.
              </p>
            </div>
            <button
              type="button"
              onClick={loadLibrary}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[270px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-[#141414] p-2.5">
            <div className="rounded-2xl border border-white/12 bg-white/10 p-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Faculty</p>
              <p className="mt-1 text-sm font-semibold text-white">{facultyName}</p>
              <p className="text-[11px] text-slate-200">{facultyEmail || "faculty@cmrcet.ac.in"}</p>
            </div>

            <div className="mt-2.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Class View Cards</p>
              <div className="mt-2 space-y-1">
                <button
                  type="button"
                  onClick={() => chooseClass(ALL_CLASSES_KEY)}
                  className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                    String(selectedClassId) === ALL_CLASSES_KEY
                      ? "border-brand-300 bg-brand-500/20"
                      : "border-white/15 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">All Classes</p>
                  <p className="mt-1 text-[11px] text-slate-200">Show every uploaded PPT card</p>
                </button>
                {classes.map((item) => {
                  const active = String(item.id) === String(selectedClassId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseClass(item.id)}
                      className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                        active
                          ? "border-brand-300 bg-brand-500/20"
                          : "border-white/15 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{getClassLabel(item)}</p>
                      <p className="mt-1 text-[11px] text-slate-200">
                        {item.year ? `Year ${item.year}` : "Year N/A"} | {item.section || "Section N/A"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="space-y-2.5 rounded-3xl border border-white/10 bg-[#141414] p-2.5">
            <div className="rounded-2xl border border-white/12 bg-white/5 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Class</p>
                  <h2 className="text-xl font-semibold text-white">{selectedClassLabel}</h2>
                </div>
                <p className="text-xs text-slate-200">{selectedClassSummaryText}</p>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {selectedClassPresentations.map((ppt) => {
                  const active = String(selectedPresentationId) === String(ppt.id);
                  return (
                    <button
                      key={ppt.id}
                      type="button"
                      onClick={() => openPresentation(ppt)}
                      className={`group rounded-xl border text-left transition ${
                        active
                          ? "border-brand-300 bg-brand-500/20"
                          : "border-white/20 bg-white/10 hover:bg-white/20"
                      }`}
                    >
                      <div className="flex aspect-video items-center justify-center rounded-t-xl bg-gradient-to-br from-[#141414] to-[#141414]">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-base text-white transition group-hover:scale-105">
                          &gt;
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 text-xs font-semibold text-white">
                          {ppt.title || ppt.fileName || "Presentation"}
                        </p>
                        <p className="mt-1 text-xs text-slate-200">
                          {ppt.rollNumber || ppt.uploadedByName || "Student Upload"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-300">
                          Uploaded: {formatDateTime(ppt.uploadedAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!loading &&
              (selectedClass || String(selectedClassId) === ALL_CLASSES_KEY) &&
              selectedClassPresentations.length === 0 ? (
                <p className="mt-3 text-sm text-slate-200">
                  No student PPT cards found for this class.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/12 bg-[#141414] p-2.5 text-[11px] text-slate-300">
              Click any PPT card above to open it directly.
            </div>
          </main>
        </div>

        {loading ? <p className="text-[11px] text-slate-300">Loading smartboard data...</p> : null}
        {status ? <p className="text-[11px] text-[#14532d]">{status}</p> : null}
        {error ? <p className="text-[11px] text-[#7f1d1d]">{error}</p> : null}
        
        <div className="flex justify-center pt-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5">
            <img
              src="/auth-assets/logo.jpg"
              alt="CMR logo"
              className="h-6 w-6 rounded-full object-cover"
            />
            <span className="text-[11px] font-semibold text-white">CMR Smartboard</span>
          </div>
        </div>
      </section>
    </div>
  );
}
