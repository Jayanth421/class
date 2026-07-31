import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import PortalIcon from "../../components/PortalIcon";
import api from "../../services/api";
import useRowSelection from "../../hooks/useRowSelection";

const ROLE_OPTIONS = ["ALL", "STUDENT", "FACULTY", "ADMIN", "SMARTBOARD"];
const YEAR_OPTIONS = ["1", "2", "3", "4"];
const SECTION_OPTIONS_BY_BRANCH = {
  ECE: ["ECE-A", "ECE-B"],
  CSE: ["CSE-A", "CSE-B"],
  CSM: ["CSM-A", "CSM-B"],
  MEC: ["MEC-A", "MEC-B"]
};

function getRoleFilterFromSearch(searchValue = "") {
  const params = new URLSearchParams(searchValue);
  const normalized = String(params.get("role") || "ALL").toUpperCase();
  return ROLE_OPTIONS.includes(normalized) ? normalized : "ALL";
}

function getInitials(name, email) {
  const clean = String(name || "").trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return String(email || "U").slice(0, 2).toUpperCase();
}

function getRoleIcon(role) {
  switch (role) {
    case "ADMIN":
      return "settings";
    case "FACULTY":
      return "classes";
    case "STUDENT":
      return "subjects";
    case "SMARTBOARD":
      return "smartboard";
    default:
      return "users";
  }
}

function getRoleTone(role) {
  switch (role) {
    case "ADMIN":
      return "border border-slate-200 bg-slate-100 text-slate-900";
    case "FACULTY":
      return "border border-slate-200 bg-slate-50 text-slate-900";
    case "STUDENT":
      return "border border-slate-200 bg-slate-50 text-slate-900";
    case "SMARTBOARD":
      return "border border-slate-200 bg-slate-50 text-slate-900";
    default:
      return "border border-slate-200 bg-white text-slate-900";
  }
}

const initialCreateForm = {
  name: "",
  email: "",
  password: "",
  role: "STUDENT",
  rollNumber: "",
  branch: "ECE",
  year: "1",
  section: "ECE-A",
  mobile: "",
  classId: "",
  facultyClassIds: "",
  isVerified: true
};

const initialEditForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "STUDENT",
  rollNumber: "",
  branch: "ECE",
  year: "1",
  section: "ECE-A",
  mobile: "",
  classId: "",
  facultyClassIds: "",
  isVerified: true
};

export default function AdminUsersPage() {
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedRole, setSelectedRole] = useState(() => getRoleFilterFromSearch(location.search));
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const [academicImporting, setAcademicImporting] = useState(false);
  const [academicSummary, setAcademicSummary] = useState(null);
  const [academicInputKey, setAcademicInputKey] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState("");
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const {
    selectedIdList: selectedUserIds,
    selectedCount: selectedUserCount,
    isSelected: isUserSelected,
    toggleSelected: toggleUserSelected,
    toggleAll: toggleAllUsers,
    clearSelection: clearUserSelection
  } = useRowSelection();

  const loadUsers = async (roleFilter = selectedRole) => {
    setLoading(true);
    setError("");
    clearUserSelection();
    try {
      const params = roleFilter && roleFilter !== "ALL" ? { role: roleFilter } : undefined;
      const [usersResponse, classesResponse] = await Promise.all([
        api.get("/admin/users", { params }),
        api.get("/admin/classes")
      ]);
      setUsers(usersResponse.data.users || []);
      setClasses(classesResponse.data.classes || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(selectedRole);
  }, [selectedRole]);

  useEffect(() => {
    setSelectedRole(getRoleFilterFromSearch(location.search));
  }, [location.search]);

  const parseFacultyClassIds = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const normalizeUserPayload = (form, includePassword = true) => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      isVerified: Boolean(form.isVerified),
      classId: form.classId || null
    };

    if (includePassword && form.password) {
      payload.password = form.password;
    } else if (!includePassword && form.password) {
      payload.password = form.password;
    }

    if (form.role === "STUDENT") {
      payload.rollNumber = form.rollNumber.trim().toUpperCase();
      payload.branch = form.branch;
      payload.year = Number(form.year);
      payload.section = form.section;
      payload.mobile = form.mobile.replace(/\D/g, "");
    }

    if (form.role === "FACULTY") {
      payload.classIds = parseFacultyClassIds(form.facultyClassIds);
    }

    return payload;
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!confirmCreateOpen) {
      setConfirmCreateOpen(true);
      return;
    }
    setConfirmCreateOpen(false);
    await doCreate();
  };

  const doCreate = async () => {
    setShowCreateForm(true);
    setError("");
    setMessage("");
    setCreating(true);
    try {
      const payload = normalizeUserPayload(createForm, true);
      if (!payload.password || payload.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      await api.post("/admin/users", payload);
      setMessage("User created successfully");
      setCreateForm(initialCreateForm);
      loadUsers();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleBulkImport = async (event) => {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.importFile;
    const file = fileInput?.files?.[0];

    if (!file) {
      setError("Please select a CSV/Excel file");
      setMessage("");
      return;
    }

    setError("");
    setMessage("");
    setImportSummary(null);
    setImporting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/admin/users/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setImportSummary(response.data || null);
      setMessage(
        `Bulk import completed. Created ${response.data?.createdCount || 0} users.`
      );
      setImportInputKey((prev) => prev + 1);
      await loadUsers();
    } catch (requestError) {
      const responseData = requestError?.response?.data;
      if (responseData && typeof responseData === "object") {
        setImportSummary(responseData);
      }
      setError(responseData?.message || "Failed to import users");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async (type) => {
    const endpoint = type === "academic" ? "/admin/templates/academic" : "/admin/templates/users";
    const fallbackFileName =
      type === "academic" ? "academic-import-template.xlsx" : "users-import-template.xlsx";
    setDownloadLoading(type);
    setError("");
    setMessage("");
    try {
      const response = await api.get(endpoint, { responseType: "blob" });
      const disposition = String(response.headers?.["content-disposition"] || "");
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || fallbackFileName;
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
      setMessage(`Downloaded ${fileName}`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Template download failed");
    } finally {
      setDownloadLoading("");
    }
  };

  const handleAcademicImport = async (event) => {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.academicImportFile;
    const file = fileInput?.files?.[0];

    if (!file) {
      setError("Please select an academic Excel file");
      setMessage("");
      return;
    }

    setError("");
    setMessage("");
    setAcademicSummary(null);
    setAcademicImporting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/admin/academic/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setAcademicSummary(response.data || null);
      setMessage("Academic Excel import completed.");
      setAcademicInputKey((prev) => prev + 1);
      await loadUsers();
    } catch (requestError) {
      const responseData = requestError?.response?.data;
      if (responseData && typeof responseData === "object") {
        setAcademicSummary(responseData);
      }
      setError(responseData?.message || "Failed to import academic data");
    } finally {
      setAcademicImporting(false);
    }
  };

  const startEdit = (user) => {
    setEditForm({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "STUDENT",
      rollNumber: user.rollNumber || "",
      branch: user.branch || "ECE",
      year: String(user.year || "1"),
      section: user.section || "ECE-A",
      mobile: user.mobile || "",
      classId: user.classId || "",
      facultyClassIds:
        user.role === "FACULTY" && Array.isArray(user.classIds)
          ? user.classIds.join(",")
          : "",
      isVerified: Boolean(user.isVerified)
    });
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editForm.id) return;

    setError("");
    setMessage("");
    setEditing(true);
    try {
      const payload = normalizeUserPayload(editForm, false);
      await api.put(`/admin/users/${editForm.id}`, payload);
      setMessage("User updated successfully");
      setEditForm(initialEditForm);
      loadUsers();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update user");
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/users/${userId}`);
      setMessage("User deleted successfully");
      if (editForm.id === userId) {
        setEditForm(initialEditForm);
      }
      loadUsers();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete user");
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUserCount === 0) return;

    const confirmed = window.confirm(`Delete ${selectedUserCount} users?`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    setBulkDeleting(true);

    let deletedCount = 0;
    let failedCount = 0;

    try {
      for (const userId of selectedUserIds) {
        try {
          await api.delete(`/admin/users/${userId}`);
          deletedCount += 1;
        } catch (_deleteError) {
          failedCount += 1;
        }
      }

      if (failedCount === 0) {
        setMessage(`Deleted ${deletedCount} user${deletedCount === 1 ? "" : "s"}`);
      } else {
        setError(`Deleted ${deletedCount}, failed ${failedCount}`);
      }

      clearUserSelection();
      if (editForm.id && selectedUserIds.includes(String(editForm.id))) {
        setEditForm(initialEditForm);
      }
      loadUsers();
    } finally {
      setBulkDeleting(false);
    }
  };

  const getSectionsForBranch = (branch) => SECTION_OPTIONS_BY_BRANCH[branch] || [];

  const userIds = users.map((user) => user.id);
  const allUsersSelected = userIds.length > 0 && userIds.every((id) => isUserSelected(id));

  return (
    <section className="space-y-5">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Demo Excel Templates</h3>
        <p className="mt-2 text-sm text-soft">
          Download, modify, and upload these files to create users, departments, classes, sections, and
          subjects in bulk.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadTemplate("users")}
            className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-70"
            disabled={downloadLoading === "users"}
          >
            {downloadLoading === "users" ? "Downloading..." : "Download Users Template"}
          </button>
          <button
            type="button"
            onClick={() => downloadTemplate("academic")}
            className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-70"
            disabled={downloadLoading === "academic"}
          >
            {downloadLoading === "academic" ? "Downloading..." : "Download Academic Template"}
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Bulk Import Academic Structure</h3>
        <p className="mt-2 text-sm text-soft">
          Upload academic Excel to auto-create Year, Department, Class, Section, and Subject data.
        </p>
        <form className="mt-4 flex flex-wrap items-center gap-3" onSubmit={handleAcademicImport}>
          <input
            key={academicInputKey}
            name="academicImportFile"
            type="file"
            accept=".csv,.xls,.xlsx"
            className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-xs file:text-white hover:file:bg-white/25"
          />
          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
            type="submit"
            disabled={academicImporting}
          >
            {academicImporting ? "Importing..." : "Import Academic Excel"}
          </button>
        </form>

        {academicSummary ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-slate-200">
              Departments:{" "}
              <span className="font-semibold text-emerald-300">
                {academicSummary.createdDepartments || 0}
              </span>{" "}
              | Classes:{" "}
              <span className="font-semibold text-emerald-300">
                {academicSummary.createdClasses || 0}
              </span>{" "}
              | Subjects:{" "}
              <span className="font-semibold text-emerald-300">
                {academicSummary.createdSubjects || 0}
              </span>{" "}
              | Updated Subjects:{" "}
              <span className="font-semibold text-amber-300">
                {academicSummary.updatedSubjects || 0}
              </span>{" "}
              | Failed:{" "}
              <span className="font-semibold text-red-300">
                {academicSummary.failedCount || 0}
              </span>
            </p>
            {Array.isArray(academicSummary.failed) && academicSummary.failed.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-red-200">
                {academicSummary.failed.map((item, index) => (
                  <p key={`${item.row || index}-${index}`}>
                    Row {item.row || "-"}: {item.reason || "Failed"}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Bulk Import Users</h3>
        <p className="mt-2 text-sm text-soft">
          Upload a <span className="text-white">.csv</span>, <span className="text-white">.xls</span>, or{" "}
          <span className="text-white">.xlsx</span> file.
        </p>
        <p className="mt-2 text-xs text-soft">
          Required columns: name, email, password, role. Optional: rollNumber, year, branch,
          section, mobile, classId, classIds, classDepartmentCode, classYear, classSection,
          className, facultyClassAssignments, isVerified.
        </p>
        <form className="mt-4 flex flex-wrap items-center gap-3" onSubmit={handleBulkImport}>
          <input
            key={importInputKey}
            name="importFile"
            type="file"
            accept=".csv,.xls,.xlsx"
            className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-xs file:text-white hover:file:bg-white/25"
          />
          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
            type="submit"
            disabled={importing}
          >
            {importing ? "Importing..." : "Import File"}
          </button>
        </form>

        {importSummary ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-slate-200">
              Created:{" "}
              <span className="font-semibold text-emerald-300">
                {importSummary.createdCount || 0}
              </span>{" "}
              | Failed:{" "}
              <span className="font-semibold text-red-300">{importSummary.failedCount || 0}</span> |
              Skipped:{" "}
              <span className="font-semibold text-amber-300">
                {importSummary.skippedCount || 0}
              </span>
            </p>
            {Array.isArray(importSummary.failed) && importSummary.failed.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-red-200">
                {importSummary.failed.map((item, index) => (
                  <p key={`${item.row || index}-${index}`}>
                    Row {item.row || "-"}: {item.reason || "Failed"}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-soft">
            Click "New User" to open the form. Stays hidden until needed.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            {showCreateForm ? "Hide Form" : "New User"}
          </button>
        </div>

        {showCreateForm ? (
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Name"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Email"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Password"
              type="password"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, password: event.target.value }))
              }
              minLength={8}
              required
            />
            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              value={createForm.role}
              onChange={(event) => {
                const role = event.target.value;
                const sections = getSectionsForBranch(createForm.branch);
                setCreateForm((prev) => ({
                  ...prev,
                  role,
                  section: sections.includes(prev.section) ? prev.section : sections[0] || ""
                }));
              }}
            >
              {ROLE_OPTIONS.filter((item) => item !== "ALL").map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            {createForm.role === "STUDENT" ? (
              <>
                <input
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  placeholder="Roll Number"
                  value={createForm.rollNumber}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, rollNumber: event.target.value }))
                  }
                  required
                />
                <input
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  placeholder="Mobile"
                  value={createForm.mobile}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      mobile: event.target.value.replace(/\D/g, "").slice(0, 10)
                    }))
                  }
                  required
                />
                <select
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  value={createForm.branch}
                  onChange={(event) => {
                    const branch = event.target.value;
                    const sections = getSectionsForBranch(branch);
                    setCreateForm((prev) => ({
                      ...prev,
                      branch,
                      section: sections.includes(prev.section) ? prev.section : sections[0] || ""
                    }));
                  }}
                >
                  {Object.keys(SECTION_OPTIONS_BY_BRANCH).map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  value={createForm.year}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, year: event.target.value }))}
                >
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                  value={createForm.section}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, section: event.target.value }))
                  }
                >
                  {getSectionsForBranch(createForm.branch).map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {createForm.role === "FACULTY" ? (
              <input
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                placeholder="Faculty class IDs (comma separated)"
                value={createForm.facultyClassIds}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, facultyClassIds: event.target.value }))
                }
              />
            ) : null}

            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              value={createForm.classId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, classId: event.target.value }))}
            >
              <option value="">Class Assignment (Optional)</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} ({classItem.departmentCode}) Y{classItem.year}-{classItem.section}
                </option>
              ))}
            </select>

            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={createForm.isVerified}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, isVerified: event.target.checked }))
                }
              />
              Mark as verified
            </label>

            <button
              className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70 md:col-span-2"
              type="submit"
              disabled={creating}
            >
              {creating ? "Creating..." : "Create User"}
            </button>
          </form>
        ) : null}
      </GlassCard>

      {confirmCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#CFCFCF] bg-[#CFCFCF] p-5 shadow-2xl">
            <p className="text-lg font-display text-slate-900">Create this user?</p>
            <p className="mt-2 text-sm text-slate-600">
              Name: <span className="text-slate-900">{createForm.name || "-"}</span>
              <br />
              Email: <span className="text-slate-900">{createForm.email || "-"}</span>
              <br />
              Role: <span className="text-slate-900">{createForm.role}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={doCreate}
                className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm & Create
              </button>
              <button
                type="button"
                onClick={() => setConfirmCreateOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <GlassCard>
        <h3 className="font-display text-lg text-white">Edit Selected User</h3>
        {!editForm.id ? (
          <p className="mt-2 text-sm text-soft">Select a user from table to edit.</p>
        ) : (
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleUpdate}>
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Name"
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Email"
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="New Password (optional)"
              type="password"
              value={editForm.password}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, password: event.target.value }))
              }
            />
            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              value={editForm.role}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, role: event.target.value }))
              }
            >
              {ROLE_OPTIONS.filter((item) => item !== "ALL").map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            {editForm.role === "STUDENT" ? (
              <>
                <input
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  placeholder="Roll Number"
                  value={editForm.rollNumber}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, rollNumber: event.target.value }))
                  }
                  required
                />
                <input
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  placeholder="Mobile"
                  value={editForm.mobile}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      mobile: event.target.value.replace(/\D/g, "").slice(0, 10)
                    }))
                  }
                  required
                />
                <select
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  value={editForm.branch}
                  onChange={(event) => {
                    const branch = event.target.value;
                    const sections = getSectionsForBranch(branch);
                    setEditForm((prev) => ({
                      ...prev,
                      branch,
                      section: sections.includes(prev.section) ? prev.section : sections[0] || ""
                    }));
                  }}
                >
                  {Object.keys(SECTION_OPTIONS_BY_BRANCH).map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                  value={editForm.year}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, year: event.target.value }))}
                >
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                  value={editForm.section}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, section: event.target.value }))
                  }
                >
                  {getSectionsForBranch(editForm.branch).map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {editForm.role === "FACULTY" ? (
              <input
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                placeholder="Faculty class IDs (comma separated)"
                value={editForm.facultyClassIds}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, facultyClassIds: event.target.value }))
                }
              />
            ) : null}

            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              value={editForm.classId}
              onChange={(event) => setEditForm((prev) => ({ ...prev, classId: event.target.value }))}
            >
              <option value="">Class Assignment (Optional)</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} ({classItem.departmentCode}) Y{classItem.year}-{classItem.section}
                </option>
              ))}
            </select>

            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={editForm.isVerified}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, isVerified: event.target.checked }))
                }
              />
              Verified
            </label>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-70"
                type="submit"
                disabled={editing}
              >
                {editing ? "Updating..." : "Update User"}
              </button>
              <button
                className="rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25"
                type="button"
                onClick={() => setEditForm(initialEditForm)}
              >
                Clear Selection
              </button>
            </div>
          </form>
        )}
      </GlassCard>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg text-white">Users</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.12em] text-soft" htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-300"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <p className="mt-3 text-soft">Loading users...</p> : null}
        {!loading && users.length === 0 ? <p className="mt-3 text-soft">No users found.</p> : null}

        {selectedUserCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-soft">{selectedUserCount} selected</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBulkDeleteUsers}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 disabled:opacity-70"
              >
                {bulkDeleting ? "Deleting..." : "Delete Selected"}
              </button>
              <button
                type="button"
                onClick={clearUserSelection}
                className="rounded-lg bg-white/15 px-3 py-1 text-xs text-white"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {users.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-soft">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allUsersSelected}
                      onChange={() => toggleAllUsers(userIds)}
                      aria-label="Select all users"
                    />
                  </th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Verified</th>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-white/10">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isUserSelected(user.id)}
                        onChange={() => toggleUserSelected(user.id)}
                        aria-label={`Select user ${user.email}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {user.profilePhoto ? (
                          <img
                            src={user.profilePhoto}
                            alt={`${user.name || "User"} avatar`}
                            className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
                          />
                        ) : (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-xs font-semibold text-[#141414]">
                            {getInitials(user.name, user.email)}
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-soft">{user.rollNumber || user.mobile || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{user.email}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getRoleTone(
                          user.role
                        )}`}
                      >
                        <PortalIcon name={getRoleIcon(user.role)} className="h-3.5 w-3.5" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">{user.isVerified ? "Yes" : "No"}</td>
                    <td className="px-3 py-3">{user.branch || "-"}</td>
                    <td className="px-3 py-3">{user.year || "-"}</td>
                    <td className="px-3 py-3">{user.section || "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-white/15 px-2 py-1 text-xs text-white"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-100"
                          onClick={() => handleDelete(user.id)}
                        >
                          Delete
                        </button>
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
        <h3 className="font-display text-lg text-white">Class IDs Quick Reference</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-soft">
              <tr>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">ID</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">
                    {item.departmentCode} Y{item.year}-{item.section}
                  </td>
                  <td className="px-2 py-2 text-soft">{item.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </section>
  );
}
