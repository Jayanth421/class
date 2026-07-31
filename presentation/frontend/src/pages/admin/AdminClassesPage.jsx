import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import api from "../../services/api";
import useRowSelection from "../../hooks/useRowSelection";

export default function AdminClassesPage() {
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [classForm, setClassForm] = useState({
    departmentId: "",
    name: "",
    year: "",
    section: ""
  });
  const [subjectForm, setSubjectForm] = useState({
    classId: "",
    name: "",
    code: "",
    facultyId: ""
  });

  const [editingClassId, setEditingClassId] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [editClassForm, setEditClassForm] = useState({
    departmentId: "",
    name: "",
    year: "",
    section: ""
  });
  const [editSubjectForm, setEditSubjectForm] = useState({
    classId: "",
    name: "",
    code: "",
    facultyId: ""
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showClassForm, setShowClassForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [bulkDeletingClasses, setBulkDeletingClasses] = useState(false);
  const [bulkDeletingSubjects, setBulkDeletingSubjects] = useState(false);

  const {
    selectedIdList: selectedClassIds,
    selectedCount: selectedClassCount,
    isSelected: isClassSelected,
    toggleSelected: toggleClassSelected,
    toggleAll: toggleAllClasses,
    clearSelection: clearClassSelection
  } = useRowSelection();

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
    clearClassSelection();
    clearSubjectSelection();
    try {
      const [departmentsResponse, classesResponse, subjectsResponse, facultyResponse] =
        await Promise.all([
          api.get("/admin/departments"),
          api.get("/admin/classes"),
          api.get("/admin/subjects"),
          api.get("/admin/users", { params: { role: "FACULTY" } })
        ]);

      setDepartments(departmentsResponse.data.departments || []);
      setClasses(classesResponse.data.classes || []);
      setSubjects(subjectsResponse.data.subjects || []);
      setFacultyUsers(facultyResponse.data.users || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load class management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClass = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post("/admin/classes", {
        departmentId: classForm.departmentId,
        name: classForm.name.trim(),
        year: Number(classForm.year),
        section: classForm.section.trim().toUpperCase()
      });
      setMessage("Class created successfully");
      setClassForm({ departmentId: "", name: "", year: "", section: "" });
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to create class");
    }
  };

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

  const startEditClass = (item) => {
    setEditingClassId(item.id);
    setEditClassForm({
      departmentId: item.departmentId || "",
      name: item.name || "",
      year: String(item.year || ""),
      section: item.section || ""
    });
  };

  const saveEditClass = async (classId) => {
    setError("");
    setMessage("");
    try {
      await api.put(`/admin/classes/${classId}`, {
        departmentId: editClassForm.departmentId,
        name: editClassForm.name.trim(),
        year: Number(editClassForm.year),
        section: editClassForm.section.trim().toUpperCase()
      });
      setMessage("Class updated");
      setEditingClassId("");
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update class");
    }
  };

  const deleteClass = async (classId) => {
    if (!window.confirm("Delete this class?")) return;
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/classes/${classId}`);
      setMessage("Class deleted");
      loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete class");
    }
  };

  const handleBulkDeleteClasses = async () => {
    if (selectedClassCount === 0) return;
    if (!window.confirm(`Delete ${selectedClassCount} classes?`)) return;

    setError("");
    setMessage("");
    setBulkDeletingClasses(true);

    let deletedCount = 0;
    let failedCount = 0;
    try {
      for (const classId of selectedClassIds) {
        try {
          await api.delete(`/admin/classes/${classId}`);
          deletedCount += 1;
        } catch (_deleteError) {
          failedCount += 1;
        }
      }

      if (failedCount === 0) {
        setMessage(`Deleted ${deletedCount} class${deletedCount === 1 ? "" : "es"}`);
      } else {
        setError(`Deleted ${deletedCount}, failed ${failedCount}`);
      }

      clearClassSelection();
      loadData();
    } finally {
      setBulkDeletingClasses(false);
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
    setBulkDeletingSubjects(true);

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
      setBulkDeletingSubjects(false);
    }
  };

  const classIds = classes.map((item) => item.id);
  const allClassesSelected = classIds.length > 0 && classIds.every((id) => isClassSelected(id));

  const subjectIds = subjects.map((item) => item.id);
  const allSubjectsSelected =
    subjectIds.length > 0 && subjectIds.every((id) => isSubjectSelected(id));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowClassForm((prev) => !prev)}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          {showClassForm ? "Hide Create Class" : "Create Class"}
        </button>
        <button
          type="button"
          onClick={() => setShowSubjectForm((prev) => !prev)}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          {showSubjectForm ? "Hide Create Subject" : "Create Subject"}
        </button>
      </div>

      {showClassForm ? (
        <GlassCard>
          <h3 className="font-display text-lg text-white">Create Class</h3>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateClass}>
            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              value={classForm.departmentId}
              onChange={(event) =>
                setClassForm((prev) => ({ ...prev, departmentId: event.target.value }))
              }
              required
            >
              <option value="">Select Department</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>

            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Class name"
              value={classForm.name}
              onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              value={classForm.year}
              onChange={(event) => setClassForm((prev) => ({ ...prev, year: event.target.value }))}
              required
            >
              <option value="">Select Year</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Section (A/B...)"
              value={classForm.section}
              onChange={(event) => setClassForm((prev) => ({ ...prev, section: event.target.value }))}
              required
            />
            <button
              className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white md:col-span-2"
              type="submit"
            >
              Create Class
            </button>
          </form>
        </GlassCard>
      ) : null}

      {showSubjectForm ? (
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
      ) : null}

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg text-white">Classes</h3>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>

        {loading ? <p className="mt-3 text-soft">Loading classes...</p> : null}
        {!loading && classes.length === 0 ? <p className="mt-3 text-soft">No classes available.</p> : null}

        {selectedClassCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-soft">{selectedClassCount} selected</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBulkDeleteClasses}
                disabled={bulkDeletingClasses}
                className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 disabled:opacity-70"
              >
                {bulkDeletingClasses ? "Deleting..." : "Delete Selected"}
              </button>
              <button
                type="button"
                onClick={clearClassSelection}
                className="rounded-lg bg-white/15 px-3 py-1 text-xs text-white"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {classes.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-soft">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allClassesSelected}
                      onChange={() => toggleAllClasses(classIds)}
                      aria-label="Select all classes"
                    />
                  </th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isClassSelected(item.id)}
                        onChange={() => toggleClassSelected(item.id)}
                        aria-label={`Select class ${item.name}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {editingClassId === item.id ? (
                        <input
                          className="w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editClassForm.name}
                          onChange={(event) =>
                            setEditClassForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingClassId === item.id ? (
                        <select
                          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editClassForm.departmentId}
                          onChange={(event) =>
                            setEditClassForm((prev) => ({
                              ...prev,
                              departmentId: event.target.value
                            }))
                          }
                        >
                          {departments.map((dep) => (
                            <option key={dep.id} value={dep.id}>
                              {dep.code}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.departmentCode || item.department
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingClassId === item.id ? (
                        <select
                          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editClassForm.year}
                          onChange={(event) =>
                            setEditClassForm((prev) => ({ ...prev, year: event.target.value }))
                          }
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                      ) : (
                        item.year
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingClassId === item.id ? (
                        <input
                          className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white"
                          value={editClassForm.section}
                          onChange={(event) =>
                            setEditClassForm((prev) => ({
                              ...prev,
                              section: event.target.value.toUpperCase()
                            }))
                          }
                        />
                      ) : (
                        item.section
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {editingClassId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditClass(item.id)}
                              className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClassId("")}
                              className="rounded-lg bg-white/15 px-2 py-1 text-xs text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditClass(item)}
                              className="rounded-lg bg-white/15 px-2 py-1 text-xs text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteClass(item.id)}
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

      <GlassCard>
        <h3 className="font-display text-lg text-white">Subjects</h3>
        {subjects.length === 0 ? <p className="mt-3 text-soft">No subjects available.</p> : null}

        {selectedSubjectCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-soft">{selectedSubjectCount} selected</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBulkDeleteSubjects}
                disabled={bulkDeletingSubjects}
                className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 disabled:opacity-70"
              >
                {bulkDeletingSubjects ? "Deleting..." : "Delete Selected"}
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
                              className="rounded-lg bg-red-100 px-2 py-1 text-xs text-black-100"
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
