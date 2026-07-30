import { useEffect, useState } from "react";
import api from "../../services/api";

export default function SmartboardsPage() {
  const [smartboards, setSmartboards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ key: "", accessUser: "", accessKey: "", classIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        api.get("/admin/settings/smartboards"),
        api.get("/admin/classes")
      ]);
      setSmartboards(sRes.data.smartboards || []);
      setClasses(cRes.data.classes || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        key: form.key.trim(),
        accessUser: form.accessUser.trim(),
        accessKey: form.accessKey,
        classIds: form.classIds
      };
      await api.post("/admin/settings/smartboards", payload);
      setForm({ key: "", accessUser: "", accessKey: "", classIds: [] });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save smartboard");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this smartboard?")) return;
    try {
      await api.delete(`/admin/settings/smartboards/${id}`);
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete");
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Smartboards</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Create Smartboard</h3>
          <form onSubmit={save} className="space-y-3">
            <input
              value={form.key}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
              placeholder="Key / identifier (eg: ece-b-2-smartboard)"
              className="w-full border rounded px-3 py-2"
              required
            />
            <input
              value={form.accessUser}
              onChange={(e) => setForm((p) => ({ ...p, accessUser: e.target.value }))}
              placeholder="Access user (email or id)"
              className="w-full border rounded px-3 py-2"
            />
            <input
              type="password"
              value={form.accessKey}
              onChange={(e) => setForm((p) => ({ ...p, accessKey: e.target.value }))}
              placeholder="Access key (leave empty to keep unset)"
              className="w-full border rounded px-3 py-2"
            />

            <label className="block text-sm font-medium">Assign classes</label>
            <select
              multiple
              value={form.classIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                setForm((p) => ({ ...p, classIds: selected }));
              }}
              className="w-full border rounded px-3 py-2 h-32"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.year ? `- ${c.year}` : ""} {c.section ? ` (${c.section})` : ""}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-600 text-white rounded" disabled={saving}>
                {saving ? "Saving..." : "Create"}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded border"
                onClick={() => setForm({ key: "", accessUser: "", accessKey: "", classIds: [] })}
              >
                Reset
              </button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </form>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Existing Smartboards</h3>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="space-y-3">
              {smartboards.length === 0 ? (
                <p className="text-sm text-slate-500">No smartboards configured yet.</p>
              ) : (
                smartboards.map((s) => (
                  <div key={s.id} className="p-3 border rounded flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.key}</div>
                      <div className="text-sm text-slate-600">User: {s.accessUser || "(none)"}</div>
                      <div className="text-sm text-slate-600">Classes: {s.classNames?.join(", ") || "(none)"}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="px-3 py-1 bg-red-600 text-white rounded text-sm" onClick={() => remove(s.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
