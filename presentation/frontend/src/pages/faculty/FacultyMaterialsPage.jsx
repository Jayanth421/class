import { useEffect, useState } from "react";
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
    const originHint = origin ? `Add ${origin} to your S3 bucket CORS AllowedOrigins (and allow PUT).` : "";
    return `Storage upload request was blocked (usually S3 CORS). ${originHint} Or set backend S3_UPLOAD_MODE=proxy to upload via the backend API.`;
  }

  return "Storage upload request failed to reach the server. Check backend URL and network connectivity.";
}

export default function FacultyMaterialsPage() {
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({
    subjectId: "",
    title: "",
    description: ""
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [subjectsResponse, materialsResponse] = await Promise.all([
        api.get("/faculty/subjects"),
        api.get("/faculty/materials")
      ]);
      const nextSubjects = subjectsResponse.data.subjects || [];
      setSubjects(nextSubjects);
      setMaterials(materialsResponse.data.materials || []);
      if (!form.subjectId && nextSubjects.length > 0) {
        setForm((prev) => ({ ...prev, subjectId: nextSubjects[0].id }));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load lecture materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uploadMaterial = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.subjectId || !file) {
      setError("Subject and file are required");
      return;
    }

    setSubmitting(true);
    try {
      const fileType = getContentType(file);
      const title = String(form.title || "").trim();
      const description = String(form.description || "").trim();
      const response = await api.post("/faculty/materials/presign", {
        subjectId: form.subjectId,
        title,
        description,
        fileName: file.name,
        fileType
      });

      const uploadUrl = response.data.uploadUrl;
      const uploadToken = response.data.uploadToken;
      if (!uploadUrl || !uploadToken) {
        throw new Error("Upload URL could not be generated. Please try again.");
      }

      let uploadResponse;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": fileType },
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

      await api.post("/faculty/materials/complete", {
        uploadToken,
        title,
        description
      });

      setMessage("Lecture material uploaded.");
      setForm((prev) => ({ ...prev, title: "", description: "" }));
      setFile(null);
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader label="Loading lecture materials..." />;

  return (
    <section className="space-y-5">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Upload Lecture Materials</h3>
        <p className="mt-1 text-sm text-soft">
          Upload PPT/PPTX/PDF lecture resources and attach them to your subjects.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={uploadMaterial}>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={form.subjectId}
            onChange={(event) => setForm((prev) => ({ ...prev, subjectId: event.target.value }))}
            required
          >
            <option value="">Select subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Material title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <input
            type="file"
            accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-white/20 file:px-3 file:py-1 file:text-white focus:border-brand-300 md:col-span-2"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70 md:col-span-2"
          >
            {submitting ? "Uploading..." : "Upload Material"}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h4 className="font-display text-base text-white">Uploaded Materials</h4>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-soft">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">File</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-white">{item.title || item.fileName || "-"}</p>
                    <p className="text-xs text-soft">{item.description || "-"}</p>
                  </td>
                  <td className="px-3 py-3">
                    {item.subjectCode} {item.subjectName ? `- ${item.subjectName}` : ""}
                  </td>
                  <td className="px-3 py-3">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {materials.length === 0 ? <p className="mt-3 text-soft">No lecture materials uploaded yet.</p> : null}
      </GlassCard>

      {message ? <p className="text-emerald-300">{message}</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}
    </section>
  );
}
