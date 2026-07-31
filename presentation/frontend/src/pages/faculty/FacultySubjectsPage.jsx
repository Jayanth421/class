import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

export default function FacultySubjectsPage() {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [subjectStudents, setSubjectStudents] = useState([]);
  const [subjectInfo, setSubjectInfo] = useState(null);
  const [error, setError] = useState("");

  const loadSubjects = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/faculty/subjects");
      const nextSubjects = response.data.subjects || [];
      setSubjects(nextSubjects);
      if (!selectedSubjectId && nextSubjects.length > 0) {
        setSelectedSubjectId(nextSubjects[0].id);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    async function loadSubjectStudents() {
      if (!selectedSubjectId) {
        setSubjectStudents([]);
        setSubjectInfo(null);
        return;
      }
      setError("");
      try {
        const response = await api.get(`/faculty/subjects/${selectedSubjectId}/students`);
        setSubjectStudents(response.data.students || []);
        setSubjectInfo(response.data.subject || null);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to load subject students");
      }
    }

    loadSubjectStudents();
  }, [selectedSubjectId]);

  if (loading) return <PageLoader label="Loading subject management..." />;

  return (
    <section className="space-y-5">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">Subject Management</h3>
            <p className="mt-1 text-sm text-soft">
              Manage assigned subjects, student lists, and presentation stats.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSubjects}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-soft">
              <tr>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Students</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Approved</th>
                <th className="px-3 py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-t border-white/10 transition hover:bg-white/5 ${
                    selectedSubjectId === item.id ? "bg-white/10" : ""
                  }`}
                  onClick={() => setSelectedSubjectId(item.id)}
                >
                  <td className="px-3 py-3">
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-soft">{item.code}</p>
                  </td>
                  <td className="px-3 py-3">
                    {item.className || "-"} ({item.year || "-"}-{item.section || "-"})
                  </td>
                  <td className="px-3 py-3">{item.studentCount || 0}</td>
                  <td className="px-3 py-3">{item.presentationStats?.total || 0}</td>
                  <td className="px-3 py-3">{item.presentationStats?.approved || 0}</td>
                  <td className="px-3 py-3">{item.presentationStats?.pending || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {subjects.length === 0 ? <p className="mt-3 text-soft">No subjects assigned.</p> : null}
      </GlassCard>

      <GlassCard>
        <h4 className="font-display text-base text-white">
          {subjectInfo ? `Students - ${subjectInfo.code} ${subjectInfo.name}` : "Students by Subject"}
        </h4>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-soft">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Roll No</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Uploads</th>
                <th className="px-3 py-2">Latest Status</th>
                <th className="px-3 py-2">Last Upload</th>
              </tr>
            </thead>
            <tbody>
              {subjectStudents.map((student) => (
                <tr key={student.id} className="border-t border-white/10">
                  <td className="px-3 py-3">{student.name}</td>
                  <td className="px-3 py-3">{student.rollNumber || "-"}</td>
                  <td className="px-3 py-3">{student.email}</td>
                  <td className="px-3 py-3">{student.uploadsCount || 0}</td>
                  <td className="px-3 py-3">{student.latestUploadStatus || "-"}</td>
                  <td className="px-3 py-3">
                    {student.latestUploadAt ? new Date(student.latestUploadAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedSubjectId && subjectStudents.length === 0 ? (
          <p className="mt-3 text-soft">No students found for this subject.</p>
        ) : null}
      </GlassCard>

      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
