import { useEffect, useMemo, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

function uniqueClasses(subjects) {
  const map = new Map();
  subjects.forEach((item) => {
    if (!item.classId) return;
    if (!map.has(item.classId)) {
      map.set(item.classId, {
        id: item.classId,
        name: item.className || "Class",
        year: item.year || "",
        section: item.section || ""
      });
    }
  });
  return Array.from(map.values());
}

export default function FacultyNotificationsPage() {
  const [subjects, setSubjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({
    title: "",
    message: "",
    subjectId: "",
    classId: "",
    priority: "NORMAL",
    audience: "STUDENT"
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const classOptions = useMemo(() => uniqueClasses(subjects), [subjects]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [subjectsResponse, notificationsResponse] = await Promise.all([
        api.get("/faculty/subjects"),
        api.get("/faculty/notifications")
      ]);
      setSubjects(subjectsResponse.data.subjects || []);
      setNotifications(notificationsResponse.data.notifications || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sendAnnouncement = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const audienceRoles =
        form.audience === "STUDENT_AND_FACULTY" ? ["STUDENT", "FACULTY"] : [form.audience];
      await api.post("/faculty/notifications", {
        title: form.title,
        message: form.message,
        subjectId: form.subjectId || null,
        classId: form.classId || null,
        priority: form.priority,
        audienceRoles
      });
      setForm((prev) => ({
        ...prev,
        title: "",
        message: "",
        subjectId: "",
        classId: "",
        priority: "NORMAL",
        audience: "STUDENT"
      }));
      setMessage("Announcement sent successfully.");
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to send announcement");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader label="Loading notifications..." />;

  return (
    <section className="space-y-5">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Notifications</h3>
        <p className="mt-1 text-sm text-soft">
          Send announcements to students and track system alerts.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={sendAnnouncement}>
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            placeholder="Announcement title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            rows={4}
            placeholder="Announcement message"
            value={form.message}
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
            required
          />
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={form.subjectId}
            onChange={(event) => {
              const nextSubjectId = event.target.value;
              const selected = subjects.find((item) => item.id === nextSubjectId);
              setForm((prev) => ({
                ...prev,
                subjectId: nextSubjectId,
                classId: selected?.classId || prev.classId
              }));
            }}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={form.classId}
            onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
          >
            <option value="">All classes</option>
            {classOptions.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name} ({classItem.year}-{classItem.section})
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={form.audience}
            onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
          >
            <option value="STUDENT">Students</option>
            <option value="FACULTY">Faculty</option>
            <option value="STUDENT_AND_FACULTY">Students + Faculty</option>
          </select>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={form.priority}
            onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
          >
            <option value="LOW">LOW</option>
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH">HIGH</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70 md:col-span-2"
          >
            {submitting ? "Sending..." : "Send Announcement"}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h4 className="font-display text-base text-white">Recent Notifications</h4>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {notifications.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{item.title}</p>
                <span className="rounded-full border border-white/20 px-2 py-1 text-[10px] uppercase text-soft">
                  {item.priority || item.type || "INFO"}
                </span>
              </div>
              <p className="mt-1 text-sm text-soft">{item.message}</p>
              <p className="mt-2 text-xs text-soft">
                {item.subjectCode ? `${item.subjectCode} | ` : ""}
                {item.createdBy || "System"} | {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
              </p>
            </div>
          ))}
        </div>
        {notifications.length === 0 ? <p className="mt-3 text-soft">No notifications found.</p> : null}
      </GlassCard>

      {message ? <p className="text-emerald-300">{message}</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
