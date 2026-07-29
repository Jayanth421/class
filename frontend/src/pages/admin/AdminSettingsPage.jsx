import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import api from "../../services/api";
import {
  DEFAULT_ADMIN_UI_PREFS,
  getAdminUiPrefs,
  setAdminUiPrefs
} from "../../services/adminUiPrefs";
import { fetchSupabaseData } from "../../services/supabaseData";

const initialMailSettings = {
  provider: "node",
  host: "",
  port: "587",
  secure: false,
  starttls: true,
  timeoutSeconds: "20",
  user: "",
  pass: "",
  from: ""
};

const initialBulkMail = {
  role: "ALL",
  customEmails: "",
  subject: "",
  text: "",
  html: ""
};

const initialUiSettings = {
  mobileNavColumns: String(DEFAULT_ADMIN_UI_PREFS.mobileNavColumns)
};

const studentEmailRegex = /^(2[1-5])h51[a-z][a-z0-9]{4}@cmrcet\.ac\.in$/i;
const facultyEmailRegex = /^(?!\d+@)[a-z][a-z0-9._-]*@cmrcet\.ac\.in$/i;
const genericEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function parseCustomEmails(value) {
  return String(value || "")
    .split(/[,\n;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminSettingsPage() {
  const [mailSettings, setMailSettings] = useState(initialMailSettings);
  const [bulkMail, setBulkMail] = useState(initialBulkMail);
  const [uiSettings, setUiSettings] = useState(initialUiSettings);
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingUi, setSavingUi] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [supabaseBridge, setSupabaseBridge] = useState({
    table: "todos",
    select: "id,name",
    limit: "10"
  });
  const [supabaseBridgeLoading, setSupabaseBridgeLoading] = useState(false);
  const [supabaseBridgeResult, setSupabaseBridgeResult] = useState(null);
  const [supabaseBridgeError, setSupabaseBridgeError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMailSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/settings/mail");
      const data = response.data.settings || {};
      setMailSettings({
        provider: data.provider || "node",
        host: data.host || "",
        port: String(data.port || 587),
        secure: Boolean(data.secure),
        starttls: Boolean(data.starttls),
        timeoutSeconds: String(data.timeoutSeconds || 20),
        user: data.user || "",
        pass: data.pass === "********" ? "" : data.pass || "",
        from: data.from || ""
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load mail settings");
    } finally {
      setLoading(false);
    }
  };

  const loadUiSettings = () => {
    const prefs = getAdminUiPrefs();
    setUiSettings({
      mobileNavColumns: String(prefs.mobileNavColumns)
    });
  };

  useEffect(() => {
    loadMailSettings();
    loadUiSettings();
  }, []);

  const saveMailSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.put("/admin/settings/mail", {
        provider: mailSettings.provider,
        host: mailSettings.host.trim(),
        port: Number(mailSettings.port),
        secure: mailSettings.secure,
        starttls: mailSettings.starttls,
        timeoutSeconds: Number(mailSettings.timeoutSeconds),
        user: mailSettings.user.trim(),
        pass: mailSettings.pass,
        from: mailSettings.from.trim()
      });
      setMessage("Mail settings saved successfully");
      loadMailSettings();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to save mail settings");
    } finally {
      setSaving(false);
    }
  };

  const sendTestMail = async (event) => {
    event.preventDefault();
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setMessage("");
    setError("");
    try {
      await api.post("/admin/settings/mail/test", { to: testEmail.trim() });
      setMessage("Test email sent successfully");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const sendBulkMail = async (event) => {
    event.preventDefault();
    setSendingBulk(true);
    setMessage("");
    setError("");
    try {
      const selectedRole = bulkMail.role === "CUSTOM" ? null : bulkMail.role || null;
      const toEmails = parseCustomEmails(bulkMail.customEmails);
      const invalidGenericEmails = toEmails.filter((item) => !genericEmailRegex.test(item));
      if (invalidGenericEmails.length > 0) {
        throw new Error(`Invalid email list: ${invalidGenericEmails.slice(0, 5).join(", ")}`);
      }

      if (selectedRole === "STUDENT") {
        const invalidStudentEmails = toEmails.filter((item) => !studentEmailRegex.test(item));
        if (invalidStudentEmails.length > 0) {
          throw new Error(
            `Student role accepts student format only: ${invalidStudentEmails.slice(0, 5).join(", ")}`
          );
        }
      }

      if (selectedRole === "FACULTY") {
        const invalidFacultyEmails = toEmails.filter((item) => !facultyEmailRegex.test(item));
        if (invalidFacultyEmails.length > 0) {
          throw new Error(
            `Faculty role accepts faculty format only: ${invalidFacultyEmails.slice(0, 5).join(", ")}`
          );
        }
      }

      if (!selectedRole && toEmails.length === 0) {
        throw new Error("Add at least one custom email for Custom Only mode");
      }

      const response = await api.post("/admin/mail/send", {
        role: selectedRole,
        toEmails,
        subject: bulkMail.subject,
        text: bulkMail.text,
        html: bulkMail.html
      });

      const result = response.data || {};
      setMessage(
        `Bulk mail done. Sent: ${result.sentCount || 0}, Failed: ${result.failedCount || 0}, Recipients: ${result.recipientCount || 0}`
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to send bulk mail"
      );
    } finally {
      setSendingBulk(false);
    }
  };

  const saveUiSettings = (event) => {
    event.preventDefault();
    setSavingUi(true);
    setMessage("");
    setError("");

    try {
      const saved = setAdminUiPrefs({
        mobileNavColumns: Number(uiSettings.mobileNavColumns)
      });
      setUiSettings({
        mobileNavColumns: String(saved.mobileNavColumns)
      });
      setMessage("Admin UI settings updated");
    } catch (requestError) {
      setError(requestError?.message || "Failed to save UI settings");
    } finally {
      setSavingUi(false);
    }
  };

  const resetUiSettings = () => {
    const saved = setAdminUiPrefs(DEFAULT_ADMIN_UI_PREFS);
    setUiSettings({
      mobileNavColumns: String(saved.mobileNavColumns)
    });
    setMessage("Admin UI settings reset to default");
    setError("");
  };

  const fetchSupabaseBridgeData = async (event) => {
    event.preventDefault();
    setSupabaseBridgeLoading(true);
    setSupabaseBridgeError("");
    setSupabaseBridgeResult(null);

    try {
      const result = await fetchSupabaseData({
        table: supabaseBridge.table.trim() || "todos",
        select: supabaseBridge.select.trim() || "*",
        limit: Number(supabaseBridge.limit) || 10
      });
      setSupabaseBridgeResult(result);
    } catch (requestError) {
      setSupabaseBridgeError(
        requestError?.response?.data?.message || requestError?.message || "Failed to load Supabase data"
      );
    } finally {
      setSupabaseBridgeLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Admin UI Preferences</h3>
        <p className="mt-2 text-sm text-soft">
          Configure how admin navigation appears on mobile devices.
        </p>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveUiSettings}>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={uiSettings.mobileNavColumns}
            onChange={(event) =>
              setUiSettings((prev) => ({ ...prev, mobileNavColumns: event.target.value }))
            }
          >
            <option value="2">2 columns</option>
            <option value="3">3 columns</option>
            <option value="4">4 columns</option>
          </select>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white"
              type="submit"
              disabled={savingUi}
            >
              {savingUi ? "Saving..." : "Save UI Settings"}
            </button>
            <button
              className="rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25"
              type="button"
              onClick={resetUiSettings}
            >
              Reset
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Supabase API Bridge</h3>
        <p className="mt-2 text-sm text-soft">
          Fetch data from the backend Supabase bridge. The frontend calls the backend API, and the
          backend queries Supabase for the requested table.
        </p>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={fetchSupabaseBridgeData}>
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Table name"
            value={supabaseBridge.table}
            onChange={(event) =>
              setSupabaseBridge((prev) => ({ ...prev, table: event.target.value }))
            }
            required
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Select fields"
            value={supabaseBridge.select}
            onChange={(event) =>
              setSupabaseBridge((prev) => ({ ...prev, select: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Limit"
            type="number"
            min="1"
            value={supabaseBridge.limit}
            onChange={(event) =>
              setSupabaseBridge((prev) => ({ ...prev, limit: event.target.value }))
            }
          />
          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white"
            type="submit"
            disabled={supabaseBridgeLoading}
          >
            {supabaseBridgeLoading ? "Loading..." : "Load Supabase Data"}
          </button>
        </form>

        {supabaseBridgeError ? (
          <p className="mt-3 text-sm text-red-300">{supabaseBridgeError}</p>
        ) : null}

        {supabaseBridgeResult ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-sm text-soft">Status: {supabaseBridgeResult.ok ? "Success" : "Failed"}</p>
            <p className="mt-2 text-sm text-soft">Table: {supabaseBridgeResult.table || "n/a"}</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-200">
              {JSON.stringify(supabaseBridgeResult.data || [], null, 2)}
            </pre>
          </div>
        ) : null}
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Mail Configuration</h3>
        {loading ? <p className="mt-2 text-sm text-soft">Loading mail settings...</p> : null}

        <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={saveMailSettings}>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={mailSettings.provider}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, provider: event.target.value }))
            }
          >
            <option value="node">node</option>
            <option value="python">python</option>
          </select>
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="SMTP Host"
            value={mailSettings.host}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, host: event.target.value }))
            }
            required
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="SMTP Port"
            value={mailSettings.port}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, port: event.target.value }))
            }
            required
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="SMTP Timeout Seconds"
            value={mailSettings.timeoutSeconds}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, timeoutSeconds: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="SMTP User"
            value={mailSettings.user}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, user: event.target.value }))
            }
            required
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="SMTP Password"
            type="password"
            value={mailSettings.pass}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, pass: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            placeholder="From Address (Name <email@domain.com>)"
            value={mailSettings.from}
            onChange={(event) =>
              setMailSettings((prev) => ({ ...prev, from: event.target.value }))
            }
            required
          />

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mailSettings.secure}
              onChange={(event) =>
                setMailSettings((prev) => ({ ...prev, secure: event.target.checked }))
              }
            />
            SMTP Secure (SSL)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mailSettings.starttls}
              onChange={(event) =>
                setMailSettings((prev) => ({ ...prev, starttls: event.target.checked }))
              }
            />
            STARTTLS
          </label>

          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white md:col-span-2"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Mail Settings"}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Send Test Mail</h3>
        <form className="mt-4 flex flex-wrap gap-3" onSubmit={sendTestMail}>
          <input
            className="min-w-[260px] flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Recipient email"
            type="email"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            required
          />
          <button
            className="rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25"
            type="submit"
            disabled={sendingTest}
          >
            {sendingTest ? "Sending..." : "Send Test Mail"}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Bulk Mailing</h3>
        <p className="mt-2 text-xs text-soft">
          Mailing rules: Student/Faculty role enforces institutional email format. Choose Custom
          Only to send to manual recipients only. You can separate custom emails by comma, newline,
          or semicolon.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={sendBulkMail}>
          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            value={bulkMail.role}
            onChange={(event) =>
              setBulkMail((prev) => ({ ...prev, role: event.target.value }))
            }
          >
            <option value="ALL">All Roles</option>
            <option value="STUDENT">Students</option>
            <option value="FACULTY">Faculty</option>
            <option value="ADMIN">Admins</option>
            <option value="SMARTBOARD">Smartboard</option>
            <option value="CUSTOM">Custom Only</option>
          </select>
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Custom emails (comma-separated, optional)"
            value={bulkMail.customEmails}
            onChange={(event) =>
              setBulkMail((prev) => ({ ...prev, customEmails: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            placeholder="Mail subject"
            value={bulkMail.subject}
            onChange={(event) =>
              setBulkMail((prev) => ({ ...prev, subject: event.target.value }))
            }
            required
          />
          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            rows={4}
            placeholder="Plain text mail body"
            value={bulkMail.text}
            onChange={(event) => setBulkMail((prev) => ({ ...prev, text: event.target.value }))}
          />
          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            rows={4}
            placeholder="HTML body (optional)"
            value={bulkMail.html}
            onChange={(event) => setBulkMail((prev) => ({ ...prev, html: event.target.value }))}
          />
          <button
            className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white md:col-span-2"
            type="submit"
            disabled={sendingBulk}
          >
            {sendingBulk ? "Sending..." : "Send Bulk Mail"}
          </button>
        </form>
      </GlassCard>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
