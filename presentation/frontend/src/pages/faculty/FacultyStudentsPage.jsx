import { useEffect, useMemo, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

export default function FacultyStudentsPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/faculty/students");
      setStudents(response.data.students || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((item) => {
      return (
        String(item.name || "").toLowerCase().includes(query) ||
        String(item.email || "").toLowerCase().includes(query) ||
        String(item.rollNumber || "").toLowerCase().includes(query) ||
        String(item.branch || "").toLowerCase().includes(query)
      );
    });
  }, [search, students]);

  if (loading) return <PageLoader label="Loading students..." />;

  return (
    <section className="space-y-5">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">Student Management</h3>
            <p className="mt-1 text-sm text-soft">
              Monitor students assigned to your subjects and track activity.
            </p>
          </div>
          <button
            type="button"
            onClick={loadStudents}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>
        <input
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-brand-300"
          placeholder="Search by name, email, roll number, branch"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </GlassCard>

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-soft">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Roll No</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Uploads</th>
                <th className="px-3 py-2">Approved</th>
                <th className="px-3 py-2">Rejected</th>
                <th className="px-3 py-2">Last Upload</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-soft">{item.email}</p>
                  </td>
                  <td className="px-3 py-3">{item.rollNumber || "-"}</td>
                  <td className="px-3 py-3">
                    {item.branch || "-"} | Year {item.year || "-"} | {item.section || "-"}
                  </td>
                  <td className="px-3 py-3">{item.activity?.totalUploads || 0}</td>
                  <td className="px-3 py-3">{item.activity?.approvedUploads || 0}</td>
                  <td className="px-3 py-3">{item.activity?.rejectedUploads || 0}</td>
                  <td className="px-3 py-3">
                    {item.activity?.latestUploadAt
                      ? new Date(item.activity.latestUploadAt).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!error && filtered.length === 0 ? <p className="mt-3 text-soft">No students found.</p> : null}
      </GlassCard>

      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
