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
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPresentationId, setSelectedPresentationId] = useState("");
  const [previewFileUrl, setPreviewFileUrl] = useState("");
  const [previewFileType, setPreviewFileType] = useState("");

  const loadLibrary = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/auth/smartboard/library");
      const payload = response.data || {};
      const nextClasses = payload.classes || [];
      const nextSubjects = payload.subjects || [];
      const nextPresentations = payload.presentations || [];
      const nextFacultyList = payload.facultyList || [];

      setFaculty(
        payload.faculty || {
          name: user?.facultyName || user?.name || "Faculty",
          email: user?.email || ""
        }
      );
      setClasses(nextClasses);
      setSubjects(nextSubjects);
      setPresentations(nextPresentations);
      setFacultyList(nextFacultyList);
      // default to all faculty for class-scoped smartboard sessions
      setSelectedFacultyId("");
 
      if (nextClasses.length > 0) {
        if (nextClasses.length === 1) {
          setSelectedClassId(String(nextClasses[0].id));
        } else {
          setSelectedClassId(ALL_CLASSES_KEY);
        }
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

  // Filtered presentations by selected faculty (if any)
  const filteredPresentationsByClass = useMemo(() => {
    if (!selectedFacultyId) return presentationsByClass;
    const filtered = new Map();
    presentationsByClass.forEach((rows, classId) => {
      const filteredRows = rows.filter((r) => String(r.facultyId || "") === String(selectedFacultyId));
      if (filteredRows.length) filtered.set(classId, filteredRows);
    });
    return filtered;
  }, [presentationsByClass, selectedFacultyId]);

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

  const subjectsByFaculty = useMemo(() => {
    const grouped = new Map();
    (subjects || []).forEach((subject) => {
      const facultyId = subject?.facultyId || subject?.faculty?.id;
      if (!facultyId) return;
      if (!grouped.has(String(facultyId))) grouped.set(String(facultyId), []);
      grouped.get(String(facultyId)).push(subject);
    });

    grouped.forEach((rows) => {
      rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
    });

    return grouped;
  }, [subjects]);

  const visibleSubjectsByFaculty = useMemo(() => {
    const grouped = new Map();
    (facultyList || []).forEach((faculty) => {
      const facultyId = String(faculty?.id || "");
      if (!facultyId) return;

      let rows = subjectsByFaculty.get(facultyId) || [];
      if (String(selectedClassId) !== ALL_CLASSES_KEY && selectedClass?.id) {
        rows = rows.filter((subject) => String(subject.classId || "") === String(selectedClass.id));
      }

      grouped.set(facultyId, rows);
    });

    return grouped;
  }, [facultyList, selectedClass, selectedClassId, subjectsByFaculty]);

  const selectedClassPresentations = useMemo(
    () => {
      const source = String(selectedClassId) === ALL_CLASSES_KEY
        ? allClassPresentations
        : (filteredPresentationsByClass.get(String(selectedClassId || "")) || []);
      // if viewing ALL_CLASSES and a faculty is selected, filter by faculty
      if (String(selectedClassId) === ALL_CLASSES_KEY && selectedFacultyId) {
        return source.filter((p) => String(p.facultyId || "") === String(selectedFacultyId));
      }
      return source;
    },
    [allClassPresentations, filteredPresentationsByClass, selectedClassId, selectedFacultyId]
  );

  const selectedClassSubtitle = useMemo(() => {
    if (String(selectedClassId) === ALL_CLASSES_KEY) return "All classes view";
    if (!selectedClass) return "Select a class to open";
    const parts = [];
    if (selectedClass.departmentCode || selectedClass.department) {
      parts.push(selectedClass.departmentCode || selectedClass.department);
    }
    if (selectedClass.year) parts.push(`Year ${selectedClass.year}`);
    if (selectedClass.section) parts.push(`Section ${selectedClass.section}`);
    return parts.length ? parts.join(" | ") : "Class details";
  }, [selectedClass, selectedClassId]);

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

  const chooseFaculty = (facultyId) => {
    setSelectedFacultyId(facultyId ? String(facultyId) : "");
    setStatus(facultyId ? "Faculty filter applied." : "Faculty filter cleared.");
  };

  const openPresentation = async (presentation) => {
    if (!presentation?.id) return;
    setStatus(`Opening "${presentation.title || presentation.fileName || "presentation"}"...`);
    try {
      const response = await api.get("/storage/file-url", {
        params: { uploadId: presentation.id }
      });
      const fileUrl = response.data?.url;
      if (!fileUrl) {
        throw new Error("Unable to retrieve file URL");
      }
      const launchUrl = isOfficePresentation(fileUrl, presentation.fileType)
        ? buildOfficeViewerUrl(fileUrl)
        : fileUrl;
      setSelectedPresentationId(String(presentation.id));
      // show in-page preview modal
      setPreviewFileUrl(launchUrl);
      setPreviewFileType(presentation.fileType || "");
      setStatus(`Previewing "${presentation.title || presentation.fileName || "presentation"}".`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Failed to open presentation");
      setStatus("Unable to open presentation.");
    }
  };

  const studentList = useMemo(() => {
    const students = new Map();
    selectedClassPresentations.forEach((item) => {
      const name = item.uploadedByName || item.rollNumber || "Student";
      if (!students.has(name)) {
        students.set(name, {
          id: name,
          label: item.uploadedByName ? `${item.uploadedByName}${item.rollNumber ? ` (${item.rollNumber})` : ""}` : item.rollNumber || "Student"
        });
      }
    });
    return Array.from(students.values());
  }, [selectedClassPresentations]);

  return (
    <div className="relative h-full overflow-auto bg-[#f8fafc] p-6 text-slate-900">
      {/* Subtle animated background blobs (light colours) */}
      <div className="absolute inset-0 pointer-events-none">
        <style>{`\n          @keyframes floaty {\n            0% { transform: translateY(0) scale(1); }\n            50% { transform: translateY(-24px) scale(1.04); }\n            100% { transform: translateY(0) scale(1); }\n          }\n          .animate-floaty { animation: floaty 9s ease-in-out infinite; }\n          .animate-floaty-delayed { animation: floaty 12s ease-in-out infinite 2s; }\n        `}</style>

        <div className="absolute -left-24 -top-12 w-80 h-80 rounded-full bg-gradient-to-br from-pink-100 via-purple-100 to-transparent opacity-40 blur-3xl animate-floaty" />
        <div className="absolute right-8 -bottom-12 w-64 h-64 rounded-full bg-gradient-to-br from-blue-100 via-teal-100 to-transparent opacity-30 blur-2xl animate-floaty-delayed" />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-[1400px]">
        <div className="grid grid-cols-[260px_1fr] gap-6">

          {/* Left sidebar: Departments / Faculty */}
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Departments</h3>
              <button className="text-xs text-slate-500">Filter</button>
            </div>

            <div className="mt-3">
              <input
                placeholder="Filter faculty..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="mt-3 space-y-3">
              {/* Faculty cards */}
              {facultyList.map((f) => {
                const active = String(f.id) === String(selectedFacultyId);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => chooseFaculty(f.id)}
                    className={`w-full flex items-center gap-3 rounded-md p-2 transition ${
                      active ? 'bg-violet-100 border border-violet-300' : 'hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={f.avatarUrl || '/auth-assets/people-svgrepo-com.svg'}
                      alt={f.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">{f.name || 'Faculty'}</p>
                      <p className="text-xs text-slate-500">{f.department || f.departmentCode || ''}</p>
                      {(() => {
                        const subjects = visibleSubjectsByFaculty.get(String(f.id)) || [];
                        if (!subjects.length) return null;
                        return (
                          <p className="mt-1 text-[11px] text-violet-600">
                            {subjects.slice(0, 2).map((subject) => subject.name || 'Subject').join(' • ')}
                            {subjects.length > 2 ? '' : ''}
                          </p>
                        );
                      })()}
                    </div>
                  </button>
                );
              })}
            </div>

            

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-sm">
              <button className="w-full text-left text-slate-600">Help Center</button>
            </div>
          </aside>

          {/* Main content */}
          <main>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {(facultyList.find(f=>String(f.id)===String(selectedFacultyId)) || faculty)?.department || ''}
                  {((facultyList.find(f=>String(f.id)===String(selectedFacultyId)) || faculty)?.name) ? ' > ' : ''}
                  {(facultyList.find(f=>String(f.id)===String(selectedFacultyId)) || faculty)?.name || ''}
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">Students Presentations</h1>
              </div>

             
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6">
              {selectedClassPresentations.map((ppt) => (
                <div key={ppt.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="relative">
                    <img src={ppt.thumbnailUrl || '/auth-assets/images.png'} alt={ppt.title || ppt.fileName} className="h-40 w-full rounded-t-lg object-cover" />
                    {ppt.isNew ? (
                      <span className="absolute top-2 right-2 rounded-full bg-blue-600 px-2 py-1 text-xs text-white">NEW</span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2">{ppt.title || ppt.fileName || 'Untitled'}</p>
                    <p className="mt-2 text-xs text-slate-500 h-12 overflow-hidden text-ellipsis">{ppt.description || ppt.summary || ''}</p>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8 4.03-8 9-8 9 3.582 9 8z"/></svg>
                        <span>{(ppt.slidesCount || ppt.slideCount || '—') + ' Slides'}</span>
                      </div>
                      <button onClick={() => openPresentation(ppt)} className="text-sm font-semibold text-violet-600">View Deck →</button>
                    </div>
                  </div>
                </div>
              ))}

              {selectedClassPresentations.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">No presentations available for this selection.</p>
              ) : null}
            </div>

            <div className="mt-6 text-sm text-slate-500">Click any card to preview the presentation.</div>

            {/* Preview modal (kept unchanged) */}
            {previewFileUrl ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="relative mx-4 w-full max-w-6xl rounded-lg bg-white p-2">
                  <div className="flex justify-end p-2">
                    <button onClick={() => { setPreviewFileUrl(''); setPreviewFileType(''); }} className="rounded bg-slate-100 px-3 py-1 text-sm text-slate-700">Close</button>
                  </div>
                  <div className="h-[70vh] w-full">
                    {isOfficePresentation(previewFileUrl, previewFileType) ? (
                      <iframe src={previewFileUrl} title="ppt-preview" className="h-full w-full" />
                    ) : (
                      <iframe src={previewFileUrl} title="file-preview" className="h-full w-full" />
                    )}
                  </div>
                </div>
              </div>
            ) : null}

          </main>
        </div>
      </section>
    </div>
  );
}
