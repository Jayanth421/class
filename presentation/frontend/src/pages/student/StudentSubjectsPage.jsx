import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

export default function StudentSubjectsPage() {
  const [state, setState] = useState({
    loading: true,
    subjects: [],
    error: ""
  });

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get("/student/subjects");
        setState({
          loading: false,
          subjects: response.data.subjects || [],
          error: ""
        });
      } catch (requestError) {
        setState({
          loading: false,
          subjects: [],
          error: requestError?.response?.data?.message || "Failed to load subjects"
        });
      }
    }
    loadSubjects();
  }, []);

  if (state.loading) return <PageLoader label="Loading subjects..." />;

  const getStatusClass = (status) => {
    if (status === "UPLOADED" || status === "APPROVED") return "bg-emerald-400/20 text-emerald-200";
    if (status === "REJECTED") return "bg-red-400/20 text-red-200";
    return "bg-amber-400/20 text-amber-200";
  };

  return (
    <section className="space-y-5">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Assigned Subjects</h3>
        <p className="mt-1 text-sm text-soft">
          Subject details, assigned faculty, and linked presentation history.
        </p>
        {state.error ? <p className="mt-3 text-red-300">{state.error}</p> : null}
      </GlassCard>

      {state.subjects.map((item) => (
        <GlassCard key={item.id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{item.name}</p>
              <p className="text-xs text-soft">{item.code}</p>
              <p className="mt-1 text-xs text-soft">
                Faculty: {item.facultyName || "-"} {item.facultyEmail ? `(${item.facultyEmail})` : ""}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${getStatusClass(item.uploadStatus)}`}
            >
              {item.uploadStatus}
            </span>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-soft">
            {item.uploadedAt ? (
              <p>Latest upload: {new Date(item.uploadedAt).toLocaleString()}</p>
            ) : (
              <p>No presentation uploaded yet.</p>
            )}
            {item.latestFileUrl ? (
              <a
                className="mt-2 inline-block text-brand-300 hover:text-brand-100"
                href={item.latestFileUrl}
                target="_blank"
                rel="noreferrer"
              >
                Download latest file
              </a>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Related Presentations</p>
            {(item.presentations || []).length === 0 ? (
              <p className="mt-2 text-xs text-soft">No presentations linked to this subject yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-soft">
                    <tr>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Uploaded</th>
                      <th className="px-3 py-2">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.presentations.map((presentation) => (
                      <tr key={presentation.id} className="border-t border-white/10">
                        <td className="px-3 py-3">{presentation.title || presentation.fileName || "-"}</td>
                        <td className="px-3 py-3">{presentation.status}</td>
                        <td className="px-3 py-3">
                          {presentation.createdAt ? new Date(presentation.createdAt).toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={presentation.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-300 hover:text-brand-100"
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </GlassCard>
      ))}

      {!state.error && state.subjects.length === 0 ? (
        <GlassCard>
          <p className="text-soft">No subjects assigned yet.</p>
        </GlassCard>
      ) : null}
    </section>
  );
}
