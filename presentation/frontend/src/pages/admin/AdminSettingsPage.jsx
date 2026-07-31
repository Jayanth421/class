import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import api from "../../services/api";
import {
  DEFAULT_ADMIN_UI_PREFS,
  getAdminUiPrefs,
  setAdminUiPrefs
} from "../../services/adminUiPrefs";

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
  templateKey: "",
  templateVars: "",
  subject: "",
  text: "",
  html: ""
};

const initialTemplateForm = {
  key: "",
  name: "",
  description: "",
  subject: "",
  text: "",
  html: ""
};

const initialMySqlSettings = {
  enabled: false,
  host: "",
  port: "3306",
  user: "",
  pass: "",
  database: "",
  ssl: false,
  tableName: "file_uploads"
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
  const [mysqlSettings, setMysqlSettings] = useState(initialMySqlSettings);
  const [templates, setTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState(initialTemplateForm);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [editTemplateForm, setEditTemplateForm] = useState(initialTemplateForm);
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMysql, setLoadingMysql] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingUi, setSavingUi] = useState(false);
  const [savingMysql, setSavingMysql] = useState(false);
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [testingMysql, setTestingMysql] = useState(false);
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

  const loadMySqlSettings = async () => {
    setLoadingMysql(true);
    setError("");
    try {
      const response = await api.get("/admin/settings/mysql");
      const data = response.data.settings || {};
      setMysqlSettings({
        enabled: Boolean(data.enabled),
        host: data.host || "",
        port: String(data.port || 3306),
        user: data.user || "",
        pass: data.pass === "********" ? "" : data.pass || "",
        database: data.database || "",
        ssl: Boolean(data.ssl),
        tableName: data.tableName || "file_uploads"
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load MySQL settings");
    } finally {
      setLoadingMysql(false);
    }
  };

  const loadMailTemplates = async () => {
    setLoadingTemplates(true);
    setError("");
    try {
      const response = await api.get("/admin/mail/templates");
      setTemplates(response.data.templates || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to load mail templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadMailSettings();
    loadUiSettings();
    loadMySqlSettings();
    loadMailTemplates();
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

  const saveMySqlSettings = async (event) => {
    event.preventDefault();
    setSavingMysql(true);
    setMessage("");
    setError("");
    try {
      await api.put("/admin/settings/mysql", {
        enabled: Boolean(mysqlSettings.enabled),
        host: mysqlSettings.host.trim(),
        port: Number(mysqlSettings.port),
        user: mysqlSettings.user.trim(),
        pass: mysqlSettings.pass,
        database: mysqlSettings.database.trim(),
        ssl: Boolean(mysqlSettings.ssl),
        tableName: mysqlSettings.tableName.trim()
      });
      setMessage("MySQL file database settings saved");
      loadMySqlSettings();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to save MySQL settings");
    } finally {
      setSavingMysql(false);
    }
  };

  const testMySqlSettings = async () => {
    setTestingMysql(true);
    setMessage("");
    setError("");
    try {
      await api.post("/admin/settings/mysql/test", {
        host: mysqlSettings.host.trim(),
        port: Number(mysqlSettings.port),
        user: mysqlSettings.user.trim(),
        pass: mysqlSettings.pass,
        database: mysqlSettings.database.trim(),
        ssl: Boolean(mysqlSettings.ssl)
      });
      setMessage("MySQL connection successful");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "MySQL connection failed");
    } finally {
      setTestingMysql(false);
    }
  };

  const seedTemplates = async () => {
    setSeedingTemplates(true);
    setMessage("");
    setError("");
    try {
      const response = await api.post("/admin/mail/templates/seed");
      setMessage(
        response.data?.message ||
          `Template seeding completed (created ${response.data?.createdCount || 0})`
      );
      await loadMailTemplates();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to seed templates");
    } finally {
      setSeedingTemplates(false);
    }
  };

  const createTemplate = async (event) => {
    event.preventDefault();
    setSavingTemplate(true);
    setMessage("");
    setError("");
    try {
      await api.post("/admin/mail/templates", {
        key: templateForm.key.trim(),
        name: templateForm.name.trim(),
        description: templateForm.description.trim(),
        subject: templateForm.subject,
        text: templateForm.text,
        html: templateForm.html
      });
      setTemplateForm(initialTemplateForm);
      setMessage("Template created");
      await loadMailTemplates();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to create template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const startEditTemplate = (template) => {
    setEditingTemplateId(template.id);
    setEditTemplateForm({
      key: template.key || "",
      name: template.name || "",
      description: template.description || "",
      subject: template.subject || "",
      text: template.text || "",
      html: template.html || ""
    });
  };

  const cancelEditTemplate = () => {
    setEditingTemplateId("");
    setEditTemplateForm(initialTemplateForm);
  };

  const saveTemplateEdit = async () => {
    if (!editingTemplateId) return;
    setSavingTemplate(true);
    setMessage("");
    setError("");
    try {
      await api.put(`/admin/mail/templates/${editingTemplateId}`, {
        key: editTemplateForm.key.trim(),
        name: editTemplateForm.name.trim(),
        description: editTemplateForm.description.trim(),
        subject: editTemplateForm.subject,
        text: editTemplateForm.text,
        html: editTemplateForm.html
      });
      setMessage("Template updated");
      cancelEditTemplate();
      await loadMailTemplates();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!templateId) return;
    const confirmed = window.confirm("Delete this template?");
    if (!confirmed) return;

    setDeletingTemplateId(templateId);
    setMessage("");
    setError("");

    try {
      await api.delete(`/admin/mail/templates/${templateId}`);
      setMessage("Template deleted");
      if (editingTemplateId === templateId) {
        cancelEditTemplate();
      }
      await loadMailTemplates();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete template");
    } finally {
      setDeletingTemplateId("");
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

      const normalizedTemplateKey = String(bulkMail.templateKey || "").trim();
      let templateVars = null;
      if (normalizedTemplateKey) {
        const rawVars = String(bulkMail.templateVars || "").trim();
        if (!rawVars) {
          templateVars = {};
        } else {
          try {
            templateVars = JSON.parse(rawVars);
          } catch (_error) {
            throw new Error("Template vars must be valid JSON");
          }

          if (!templateVars || typeof templateVars !== "object" || Array.isArray(templateVars)) {
            throw new Error("Template vars must be a JSON object");
          }
        }
      }

      const response = await api.post("/admin/mail/send", {
        role: selectedRole,
        toEmails,
        ...(normalizedTemplateKey
          ? {
              templateKey: normalizedTemplateKey,
              templateVars
            }
          : {
              subject: bulkMail.subject,
              text: bulkMail.text,
              html: bulkMail.html
            })
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">Email Templates</h3>
            <p className="mt-1 text-xs text-soft">
              Use placeholders like <span className="text-slate-200">{"{{name}}"}</span>,{" "}
              <span className="text-slate-200">{"{{otp}}"}</span>,{" "}
              <span className="text-slate-200">{"{{portalUrl}}"}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadMailTemplates}
              className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
              disabled={loadingTemplates}
            >
              {loadingTemplates ? "Loading..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={seedTemplates}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-70"
              disabled={seedingTemplates}
            >
              {seedingTemplates ? "Seeding..." : "Seed Default Templates"}
            </button>
          </div>
        </div>

        {editingTemplateId ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <h4 className="font-display text-base text-white">Edit Template</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                placeholder="Key (WELCOME_EMAIL)"
                value={editTemplateForm.key}
                onChange={(event) => setEditTemplateForm((prev) => ({ ...prev, key: event.target.value }))}
                required
              />
              <input
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
                placeholder="Name"
                value={editTemplateForm.name}
                onChange={(event) => setEditTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <input
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                placeholder="Description (optional)"
                value={editTemplateForm.description}
                onChange={(event) =>
                  setEditTemplateForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <input
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                placeholder="Subject template"
                value={editTemplateForm.subject}
                onChange={(event) =>
                  setEditTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
                }
                required
              />
              <textarea
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                rows={4}
                placeholder="Text template"
                value={editTemplateForm.text}
                onChange={(event) =>
                  setEditTemplateForm((prev) => ({ ...prev, text: event.target.value }))
                }
              />
              <textarea
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
                rows={5}
                placeholder="HTML template"
                value={editTemplateForm.html}
                onChange={(event) =>
                  setEditTemplateForm((prev) => ({ ...prev, html: event.target.value }))
                }
              />
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={saveTemplateEdit}
                  disabled={savingTemplate}
                  className="rounded-xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-70"
                >
                  {savingTemplate ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditTemplate}
                  className="rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <h4 className="font-display text-base text-white">Create Template</h4>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={createTemplate}>
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Key (WELCOME_EMAIL)"
              value={templateForm.key}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, key: event.target.value }))}
              required
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
              placeholder="Name"
              value={templateForm.name}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              placeholder="Description (optional)"
              value={templateForm.description}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <input
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              placeholder="Subject template"
              value={templateForm.subject}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
              }
              required
            />
            <textarea
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              rows={4}
              placeholder="Text template"
              value={templateForm.text}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, text: event.target.value }))}
            />
            <textarea
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
              rows={5}
              placeholder="HTML template"
              value={templateForm.html}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, html: event.target.value }))}
            />
            <button
              className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white md:col-span-2 disabled:opacity-70"
              type="submit"
              disabled={savingTemplate}
            >
              {savingTemplate ? "Creating..." : "Create Template"}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-display text-base text-white">Templates</h4>
            <p className="text-xs text-soft">{templates.length} total</p>
          </div>

          {templates.length === 0 && !loadingTemplates ? (
            <p className="mt-3 text-sm text-soft">No templates yet. Seed defaults to get started.</p>
          ) : null}

          {templates.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-soft">
                  <tr>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="border-t border-white/10">
                      <td className="px-3 py-3 text-xs text-soft">{tpl.key}</td>
                      <td className="px-3 py-3 text-white">{tpl.name}</td>
                      <td className="px-3 py-3 text-soft">{tpl.subject}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditTemplate(tpl)}
                            className="rounded-lg bg-white/15 px-2 py-1 text-xs text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTemplate(tpl.id)}
                            disabled={deletingTemplateId === tpl.id}
                            className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-100 disabled:opacity-70"
                          >
                            {deletingTemplateId === tpl.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
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

          <select
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            value={bulkMail.templateKey}
            onChange={(event) =>
              setBulkMail((prev) => ({
                ...prev,
                templateKey: event.target.value,
                templateVars: event.target.value ? prev.templateVars : ""
              }))
            }
          >
            <option value="">No template (Custom subject/body)</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.key}>
                {tpl.key} — {tpl.name}
              </option>
            ))}
          </select>

          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-soft focus:border-brand-300 md:col-span-2 disabled:opacity-70"
            rows={3}
            placeholder={'Template vars (JSON). Example: {"title":"Update","message":"...","ctaUrl":"https://..."}'}
            value={bulkMail.templateVars}
            onChange={(event) =>
              setBulkMail((prev) => ({ ...prev, templateVars: event.target.value }))
            }
            disabled={!bulkMail.templateKey}
          />

          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            placeholder="Mail subject"
            value={bulkMail.subject}
            onChange={(event) =>
              setBulkMail((prev) => ({ ...prev, subject: event.target.value }))
            }
            required={!bulkMail.templateKey}
            disabled={Boolean(bulkMail.templateKey)}
          />
          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            rows={4}
            placeholder="Plain text mail body"
            value={bulkMail.text}
            onChange={(event) => setBulkMail((prev) => ({ ...prev, text: event.target.value }))}
            disabled={Boolean(bulkMail.templateKey)}
          />
          <textarea
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300 md:col-span-2"
            rows={4}
            placeholder="HTML body (optional)"
            value={bulkMail.html}
            onChange={(event) => setBulkMail((prev) => ({ ...prev, html: event.target.value }))}
            disabled={Boolean(bulkMail.templateKey)}
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

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-white">MySQL File Database (Uploads)</h3>
            <p className="mt-1 text-xs text-soft">
              Optional MySQL mirror for upload metadata (presentations/materials). When enabled, the
              backend will attempt to sync uploads to MySQL.
            </p>
          </div>
          <button
            type="button"
            onClick={loadMySqlSettings}
            className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
            disabled={loadingMysql}
          >
            {loadingMysql ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingMysql ? <p className="mt-3 text-sm text-soft">Loading MySQL settings...</p> : null}

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveMySqlSettings}>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mysqlSettings.enabled}
              onChange={(event) =>
                setMysqlSettings((prev) => ({ ...prev, enabled: event.target.checked }))
              }
            />
            Enable MySQL sync
          </label>

          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="MySQL Host"
            value={mysqlSettings.host}
            onChange={(event) => setMysqlSettings((prev) => ({ ...prev, host: event.target.value }))}
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="MySQL Port"
            value={mysqlSettings.port}
            onChange={(event) => setMysqlSettings((prev) => ({ ...prev, port: event.target.value }))}
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="MySQL User"
            value={mysqlSettings.user}
            onChange={(event) => setMysqlSettings((prev) => ({ ...prev, user: event.target.value }))}
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="MySQL Password (leave blank to keep)"
            type="password"
            value={mysqlSettings.pass}
            onChange={(event) => setMysqlSettings((prev) => ({ ...prev, pass: event.target.value }))}
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Database"
            value={mysqlSettings.database}
            onChange={(event) =>
              setMysqlSettings((prev) => ({ ...prev, database: event.target.value }))
            }
          />
          <input
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-300"
            placeholder="Table name (file_uploads)"
            value={mysqlSettings.tableName}
            onChange={(event) =>
              setMysqlSettings((prev) => ({ ...prev, tableName: event.target.value }))
            }
          />

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mysqlSettings.ssl}
              onChange={(event) => setMysqlSettings((prev) => ({ ...prev, ssl: event.target.checked }))}
            />
            SSL
          </label>

          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="button"
              onClick={testMySqlSettings}
              className="rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-70"
              disabled={testingMysql}
            >
              {testingMysql ? "Testing..." : "Test Connection"}
            </button>
            <button
              className="rounded-xl bg-gradient-to-r from-violetBrand-500 to-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
              type="submit"
              disabled={savingMysql}
            >
              {savingMysql ? "Saving..." : "Save MySQL Settings"}
            </button>
          </div>
        </form>
      </GlassCard>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
