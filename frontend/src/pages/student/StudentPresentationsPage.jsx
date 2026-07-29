import { useEffect, useMemo, useState } from "react";
import GlassCard from "../../components/GlassCard";
import PageLoader from "../../components/PageLoader";
import api from "../../services/api";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf"
]);

function getContentType(file) {
  if (!file) return "application/octet-stream";
  if (ALLOWED_CONTENT_TYPES.has(file.type)) return file.type;

  const lowerName = String(file.name || "").toLowerCase();
  if (lowerName.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lowerName.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function getStorageUploadNetworkHint(uploadUrl) {
  const url = String(uploadUrl || "");
  const origin = typeof window !== "undefined" ? String(window.location.origin || "") : "";

  if (/amazonaws\.com/i.test(url)) {
    const originHint = origin ? `Add ${origin} to your storage bucket CORS AllowedOrigins (and allow PUT).` : "";
    return `Storage upload request was blocked by CORS. ${originHint} Or set backend STORAGE_PROVIDER=supabase and SUPABASE_UPLOAD_MODE=proxy to upload via the backend API.`;
  }

  return "Storage upload request failed to reach the server. Check backend URL and network connectivity.";
}

export default function StudentPresentationsPage() {
  const [subjects, setSubjects] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [filters, setFilters] = useState({ subjectId: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [editState, setEditState] = useState({
    id: "",
    title: "",
    description: "",
    subjectId: ""
  });

  const isEditing = Boolean(editState.id);

  const statusOptions = useMemo(() => ["UPLOADED", "PENDING", "APPROVED", "REJECTED"], []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [subjectsResponse, presentationsResponse] = await Promise.all([
        api.get("/student/subjects"),
        api.get("/student/presentations", {
          params: {
            subjectId: filters.subjectId || undefined,
            status: filters.status || undefined
          }
        })
      ]);
      setSubjects(subjectsResponse.data.subjects || []);
      setPresentations(presentationsResponse.data.uploads || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load presentations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.status, filters.subjectId]);

  const startEdit = (item) => {
    setError("");
    setMessage("");
    setEditState({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      subjectId: item.subjectId || ""
    });
  };

  const cancelEdit = () => {
    setEditState({ id: "", title: "", description: "", subjectId: "" });
  };

  const [activeMenuItem, setActiveMenuItem] = useState(null);

  const fetchSignedUrl = async (uploadId) => {
    const response = await api.get("/storage/file-url", { params: { uploadId } });
    const url = response.data?.url;
    if (!url) {
      throw new Error("Failed to get the file URL from the server.");
    }
    return url;
  };

  const openRemoteFile = async (uploadId) => {
    const url = await fetchSignedUrl(uploadId);
    window.open(url, "_blank");
  };

  const viewRemoteFile = async (uploadId) => {
    const url = await fetchSignedUrl(uploadId);
    window.open(url, "_blank");
  };

  const closeActionMenu = () => {
    setActiveMenuItem(null);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editState.id) return;

    setError("");
    setMessage("");
    setProcessingId(editState.id);
    try {
      await api.put(`/student/presentations/${editState.id}`, {
        title: editState.title,
        description: editState.description,
        subjectId: editState.subjectId
      });
      setMessage("Presentation details updated.");
      cancelEdit();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update presentation");
    } finally {
      setProcessingId("");
    }
  };

  const replacePresentationFile = async (presentation, file) => {
    if (!file || !presentation?.id) return;

    setError("");
    setMessage("");
    setProcessingId(presentation.id);
    try {
      const fileType = getContentType(file);
      const replaceResponse = await api.post(
        `/student/presentations/${presentation.id}/replace-presign`,
        {
          fileName: file.name,
          fileType
        }
      );

      const uploadUrl = replaceResponse.data.uploadUrl;
      const uploadToken = replaceResponse.data.uploadToken;
      if (!uploadUrl || !uploadToken) {
        throw new Error("Upload URL could not be generated. Please try again.");
      }

      let uploadResponse;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": fileType
          },
          body: file
        });
      } catch (_fetchError) {
        throw new Error(getStorageUploadNetworkHint(uploadUrl));
      }
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        const reason = String(errorText || "").trim();
        throw new Error(reason ? `Storage upload failed: ${reason}` : "Storage upload failed");
      }

      await api.post(`/student/presentations/${presentation.id}/replace-complete`, {
        uploadToken
      });

      setMessage("Presentation file replaced successfully.");
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Failed to replace file");
    } finally {
      setProcessingId("");
    }
  };

  const deletePresentation = async (presentationId) => {
    const confirmed = window.confirm("Delete this presentation?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    setProcessingId(presentationId);
    try {
      await api.delete(`/student/presentations/${presentationId}`);
      setMessage("Presentation deleted.");
      if (editState.id === presentationId) cancelEdit();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete presentation");
    } finally {
      setProcessingId("");
    }
  };

  if (loading) return <PageLoader label="Loading presentations..." />;

  return (
    <section className="space-y-5">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">My Presentations</h3>
            <p className="mt-1 text-sm text-soft">
              View, edit metadata, replace files, download, and delete uploads.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-brand-300"
            value={filters.subjectId}
            onChange={(event) => setFilters((prev) => ({ ...prev, subjectId: event.target.value }))}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-brand-300"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </GlassCard>

      {isEditing ? (
        <GlassCard>
          <h4 className="font-display text-base text-white">Edit Presentation</h4>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveEdit}>
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              placeholder="Presentation title"
              value={editState.title}
              onChange={(event) =>
                setEditState((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
            <textarea
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              rows={4}
              placeholder="Description"
              value={editState.description}
              onChange={(event) =>
                setEditState((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <select
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              value={editState.subjectId}
              onChange={(event) =>
                setEditState((prev) => ({ ...prev, subjectId: event.target.value }))
              }
              required
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} - {subject.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={processingId === editState.id}
                className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
              >
                {processingId === editState.id ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      ) : null}

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-soft">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {presentations.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-white">{item.title || item.fileName || "-"}</p>
                    <p className="text-xs text-soft">{item.description || "-"}</p>
                  </td>
                  <td className="px-3 py-3">
                    {item.subjectCode} {item.subjectName ? `- ${item.subjectName}` : ""}
                  </td>
                  <td className="px-3 py-3">{item.status}</td>
                  <td className="px-3 py-3">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setActiveMenuItem(item)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-white transition hover:bg-white/15"
                      aria-haspopup="true"
                      aria-expanded={activeMenuItem?.id === item.id}
                    >
                      ⋯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {presentations.length === 0 ? <p className="mt-4 text-soft">No presentations found.</p> : null}
      </GlassCard>

      {activeMenuItem ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={closeActionMenu}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Actions</p>
                <p className="text-xs text-soft">{activeMenuItem.title || activeMenuItem.fileName}</p>
              </div>
              <button
                type="button"
                onClick={closeActionMenu}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                className="w-full rounded-2xl bg-white/10 px-4 py-3 text-left text-sm text-white hover:bg-white/15"
                onClick={() => {
                  startEdit(activeMenuItem);
                  closeActionMenu();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="w-full rounded-2xl bg-white/10 px-4 py-3 text-left text-sm text-white hover:bg-white/15"
                onClick={async () => {
                  try {
                    await openRemoteFile(activeMenuItem.id);
                  } catch (err) {
                    setError(err?.response?.data?.message || err.message || 'Failed to open file');
                  } finally {
                    closeActionMenu();
                  }
                }}
              >
                Download
              </button>
              <button
                type="button"
                className="w-full rounded-2xl bg-white/10 px-4 py-3 text-left text-sm text-white hover:bg-white/15"
                onClick={async () => {
                  try {
                    await viewRemoteFile(activeMenuItem.id);
                  } catch (err) {
                    setError(err?.response?.data?.message || err.message || 'Failed to view file');
                  } finally {
                    closeActionMenu();
                  }
                }}
              >
                View
              </button>
              <label className="block cursor-pointer rounded-2xl bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/15">
                Replace
                <input
                  type="file"
                  accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
                  className="hidden"
                  disabled={processingId === activeMenuItem.id}
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] || null;
                    replacePresentationFile(activeMenuItem, selectedFile);
                    event.target.value = "";
                    closeActionMenu();
                  }}
                />
              </label>
              <button
                type="button"
                className="w-full rounded-2xl bg-red-500/10 px-4 py-3 text-left text-sm text-red-200 hover:bg-red-500/20"
                onClick={() => {
                  deletePresentation(activeMenuItem.id);
                  closeActionMenu();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-emerald-300">{message}</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
