import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
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

export default function StudentUploadPage() {
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subjectId: ""
  });
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSubjects() {
      setLoadingSubjects(true);
      setError("");
      try {
        const response = await api.get("/student/subjects");
        setSubjects(response.data.subjects || []);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Failed to load subjects");
      } finally {
        setLoadingSubjects(false);
      }
    }

    loadSubjects();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!form.subjectId) {
      setError("Please select a subject");
      return; 
    }

    if (!form.title.trim()) {
      setError("Please enter presentation title");
      return;
    }

    if (!file) {
      setError("Please choose a PPT, PPTX, or PDF file");
      return;
    }

    if (subjects.length === 0) {
      setError("No subjects assigned. Contact admin.");
      return;
    }

    setSubmitting(true);
    try {
      const fileType = getContentType(file);
      const title = form.title.trim();
      const description = form.description.trim();

      const presignResponse = await api.post("/student/presentations/presign", {
        subjectId: form.subjectId,
        title,
        description,
        fileName: file.name,
        fileType
      });

      const uploadUrl = presignResponse.data.uploadUrl;
      const uploadToken = presignResponse.data.uploadToken;
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
        throw new Error(reason ? `Storage upload failed: ${reason}` : "Failed to upload file to storage");
      }

      const completeResponse = await api.post("/student/presentations/complete", {
        uploadToken,
        title,
        description
      });

      setResult({
        ...completeResponse.data,
        fileName: file.name
      });
      setForm({
        title: "",
        description: "",
        subjectId: ""
      });
      setFile(null);
      setFileInputKey((prev) => prev + 1);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to upload presentation"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassCard>
      <h3 className="font-display text-lg text-white">Upload Presentation</h3>
      <p className="mt-1 text-sm text-soft">
        Upload PPT/PPTX/PDF with title, description, and subject mapping.
      </p>

      {error ? <p className="mt-4 text-sm text-red-300 ">{error}</p> : null}
      {!loadingSubjects && !error && subjects.length === 0 ? (
        <p className="mt-4 text-sm text-red-500">
          No subjects assigned to your account yet. Please contact admin.
        </p>
      ) : null}

      <form className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
          placeholder="Presentation title"
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          required
        />

        <textarea
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
          rows={4}
          placeholder="Description"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />

        <select
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
          value={form.subjectId}
          onChange={(event) => setForm((prev) => ({ ...prev, subjectId: event.target.value }))}
          disabled={loadingSubjects || subjects.length === 0}
          required
        >
          <option value="">{loadingSubjects ? "Loading subjects..." : "Select Subject"}</option>
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>

        <input
          key={fileInputKey}
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-white/20 file:px-3 file:py-1 file:text-white focus:border-brand-300"
          type="file"
          accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          disabled={loadingSubjects || subjects.length === 0}
          required
        />

        <button
          className="w-full rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70 md:col-span-2"
          type="submit"
          disabled={submitting || loadingSubjects || subjects.length === 0}
        >
          {submitting ? "Uploading..." : "Upload Presentation"}
        </button>
      </form>

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200/30 bg-emerald-200/10 p-4 text-xs">
          <p className="text-emerald-100">Upload completed successfully.</p>
          <p className="mt-2 text-emerald-50">File: {result.fileName}</p>
          <a
            className="mt-2 inline-block text-brand-200 hover:text-brand-100"
            href={result.fileUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Uploaded File
          </a>
        </div>
      ) : null}
    </GlassCard>
  );
}
