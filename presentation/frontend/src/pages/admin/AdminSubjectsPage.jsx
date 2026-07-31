import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import api from "../../services/api";
import useRowSelection from "../../hooks/useRowSelection";

export default function AdminSubjectsPage() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [subjectForm, setSubjectForm] = useState({
    classId: "",
    name: "",
    code: "",
    facultyId: ""
  });
  const [bulkSubjectForm, setBulkSubjectForm] = useState({
    classId: "",
    facultyId: "",
    subjectLines: ""
  });

  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [editSubjectForm, setEditSubjectForm] = useState({
    classId: "",
    name: "",
    code: "",
    facultyId: ""
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const {
    selectedIdList: selectedSubjectIds,
    selectedCount: selectedSubjectCount,
    isSelected: isSubjectSelected,
    toggleSelected: toggleSubjectSelected,
    toggleAll: toggleAllSubjects,
    clearSelection: clearSubjectSelection
  } = useRowSelection();

  const loadData = async () => {
    setLoading(true);
    setError("");
    clearSubjectSelection();
    try {
      const [classesResponse, subjectsResponse, facultyResponse] = await Promise.all([
        api.get("/admin/classes"),
        api.get("/admin/subjects"),
        api.get("/admin/users", { params: { role: "FACULTY" } })
      ]);

      setClasses(classesResponse.data.classes || []);
      setSubjects(subjectsResponse.data.subjects || []);
      setFacultyUsers(facultyResponse.data.users || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load subject management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubject = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post("/admin/subjects", {
        classId: subjectForm.classId,
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        facultyId: subjectForm.facultyId || null
      });
      setMessage("Subject created successfully");
      setSubjectForm({ classId: "", name: "", code: "", facultyId: "" });
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to create subject");
    }
  };

  const handleCreateSubjectsBulk = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBulkSaving(true);
    try {
      const subjects = String(bulkSubjectForm.subjectLines || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      if (!bulkSubjectForm.classId || subjects.length === 0) {
        throw new Error("Select class and add at least one subject");
      }

      const response = await api.post("/admin/subjects/bulk", {
        classId: bulkSubjectForm.classId,
        facultyId: bulkSubjectForm.facultyId || null,
        subjects
      });

      setMessage(
        `Bulk subjects completed: created ${response.data?.createdCount || 0}, updated ${
          response.data?.updatedCount || 0
        }, skipped ${response.data?.skippedCount || 0}`
      );
      setBulkSubjectForm({ classId: "", facultyId: "", subjectLines: "" });
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Bulk create failed");
    } finally {
      setBulkSaving(false);
    }
  };

  const startEditSubject = (item) => {
    setEditingSubjectId(item.id);
    setEditSubjectForm({
      classId: item.classId || "",
      name: item.name || "",
      code: item.code || "",
      facultyId: item.facultyId || ""
    });
  };

  const saveEditSubject = async (subjectId) => {
    setError("");
    setMessage("");
    try {
      await api.put(`/admin/subjects/${subjectId}`, {
        classId: editSubjectForm.classId,
        name: editSubjectForm.name.trim(),
        code: editSubjectForm.code.trim().toUpperCase(),
        facultyId: editSubjectForm.facultyId || null
      });
      setMessage("Subject updated");
      setEditingSubjectId("");
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update subject");
    }
  };

  const deleteSubject = async (subjectId) => {
    if (!window.confirm("Delete this subject and linked uploads?")) return;
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/subjects/${subjectId}`);
      setMessage("Subject deleted");
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete subject");
    }
  };

  const handleBulkDeleteSubjects = async () => {
    if (selectedSubjectCount === 0) return;
    if (!window.confirm(`Delete ${selectedSubjectCount} subjects and linked uploads?`)) return;

    setError("");
    setMessage("");
    setBulkDeleting(true);

    let deletedCount = 0;
    let failedCount = 0;
    try {
      for (const subjectId of selectedSubjectIds) {
        try {
          await api.delete(`/admin/subjects/${subjectId}`);
          deletedCount += 1;
        } catch (_deleteError) {
          failedCount += 1;
        }
      }

      if (failedCount === 0) {
        setMessage(`Deleted ${deletedCount} subject${deletedCount === 1 ? "" : "s"}`);
      } else {
        setError(`Deleted ${deletedCount}, failed ${failedCount}`);
      }

      clearSubjectSelection();
      loadData();
    } finally {
      setBulkDeleting(false);
    }
  };

  const subjectIds = subjects.map((item) => item.id);
  const allSubjectsSelected =
    subjectIds.length > 0 && subjectIds.every((id) => isSubjectSelected(id));

  return (
    <section className="space-y-5">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Create Subject</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateSubject}>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={subjectForm.classId}
            onChange={(event) =>
              setSubjectForm((prev) => ({ ...prev, classId: event.target.value }))
            }
            required
          >
            <option value="">Select Class</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - Year {item.year} {item.section} ({item.departmentCode})
              </option>
            ))}
          </select>

          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Subject name"
            value={subjectForm.name}
            onChange={(event) => setSubjectForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Subject code"
            value={subjectForm.code}
            onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))}
            required
          />
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={subjectForm.facultyId}
            onChange={(event) =>
              setSubjectForm((prev) => ({ ...prev, facultyId: event.target.value }))
            }
          >
            <option value="">Assign Faculty (Optional)</option>
            {facultyUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.email}
              </option>
            ))}
          </select>

          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white md:col-span-2"
            type="submit"
          >
            Create Subject
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Bulk Add Subjects (Multi Select)</h3>
        <p className="mt-1 text-xs text-soft">
          Add one subject per line or comma separated. Example: Data Structures, DBMS, Operating Systems
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateSubjectsBulk}>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={bulkSubjectForm.classId}
            onChange={(event) =>
              setBulkSubjectForm((prev) => ({ ...prev, classId: event.target.value }))
            }
            required
          >
            <option value="">Select Class</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - Year {item.year} {item.section} ({item.departmentCode})
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={bulkSubjectForm.facultyId}
            onChange={(event) =>
              setBulkSubjectForm((prev) => ({ ...prev, facultyId: event.target.value }))
            }
          >
            <option value="">Assign Faculty (Optional)</option>
            {facultyUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.email}
              </option>
            ))}
          </select>

          <textarea
            className="min-h-32 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-soft focus:border-brand-300 md:col-span-2"
            placeholder={"Data Structures\nOperating Systems\nComputer Networks"}
            value={bulkSubjectForm.subjectLines}
            onChange={(event) =>
              setBulkSubjectForm((prev) => ({ ...prev, subjectLines: event.target.value }))
            }
            required
          />

          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white md:col-span-2"
            type="submit"
            disabled={bulkSaving}
          >
            {bulkSaving ? "Saving..." : "Create Subjects in Bulk"}
          </button>
        </form>
      </GlassCard>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg text-white">Subjects</h3>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>

        {loading ? <p className="mt-3 text-soft">Loading subjects...</p> : null}
        {!loading && subjects.length === 0 ? <p className="mt-3 text-soft">No subjects available.</p> : null}

        {selectedSubjectCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-soft">{selectedSubjectCount} selected</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBulkDeleteSubjects}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 disabled:opacity-70"
              >
                {bulkDeleting ? "Deleting..." : "Delete Selected"}
              </button>
              <button
                type="button"
                onClick={clearSubjectSelection}
                className="rounded-lg bg-white/15 px-3 py-1 text-xs text-white"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {subjects.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-soft">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSubjectsSelected}
                      onChange={() => toggleAllSubjects(subjectIds)}
                      aria-label="Select all subjects"
                    />
                  </th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Faculty</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSubjectSelected(item.id)}
                        onChange={() => toggleSubjectSelected(item.id)}
                        aria-label={`Select subject ${item.code}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {editingSubjectId === item.id ? (
                        <input
                          className="w-24 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editSubjectForm.code}
                          onChange={(event) =>
                            setEditSubjectForm((prev) => ({
                              ...prev,
                              code: event.target.value.toUpperCase()
                            }))
                          }
                        />
                      ) : (
                        item.code
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingSubjectId === item.id ? (
                        <input
                          className="w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editSubjectForm.name}
                          onChange={(event) =>
                            setEditSubjectForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingSubjectId === item.id ? (
                        <select
                          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editSubjectForm.classId}
                          onChange={(event) =>
                            setEditSubjectForm((prev) => ({ ...prev, classId: event.target.value }))
                          }
                        >
                          {classes.map((classItem) => (
                            <option key={classItem.id} value={classItem.id}>
                              {classItem.name} ({classItem.departmentCode}) Y{classItem.year}-{classItem.section}
                            </option>
                          ))}
                        </select>
                      ) : (
                        `${item.className} (${item.departmentCode}) Y${item.year}-${item.section}`
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingSubjectId === item.id ? (
                        <select
                          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editSubjectForm.facultyId}
                          onChange={(event) =>
                            setEditSubjectForm((prev) => ({
                              ...prev,
                              facultyId: event.target.value
                            }))
                          }
                        >
                          <option value="">Unassigned</option>
                          {facultyUsers.map((faculty) => (
                            <option key={faculty.id} value={faculty.id}>
                              {faculty.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.facultyName || "-"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {editingSubjectId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditSubject(item.id)}
                              className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSubjectId("")}
                              className="rounded-lg bg-white/15 px-2 py-1 text-xs text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditSubject(item)}
                              className="rounded-lg bg-white/15 px-2 py-1 text-xs text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSubject(item.id)}
                              className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-100"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>
    </section>
  );
}
