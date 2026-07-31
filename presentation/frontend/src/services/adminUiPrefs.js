const ADMIN_UI_PREFS_KEY = "cmr_admin_ui_prefs";
export const ADMIN_UI_PREFS_EVENT = "cmr:admin-ui-prefs-updated";

export const DEFAULT_ADMIN_UI_PREFS = Object.freeze({
  mobileNavColumns: 3
});

function toValidMobileNavColumns(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_ADMIN_UI_PREFS.mobileNavColumns;
  if (parsed < 2) return 2;
  if (parsed > 4) return 4;
  return parsed;
}

function sanitizePrefs(rawPrefs = {}) {
  return {
    mobileNavColumns: toValidMobileNavColumns(rawPrefs.mobileNavColumns)
  };
}

export function getAdminUiPrefs() {
  try {
    const raw = localStorage.getItem(ADMIN_UI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_UI_PREFS };
    const parsed = JSON.parse(raw);
    return sanitizePrefs(parsed);
  } catch (error) {
    return { ...DEFAULT_ADMIN_UI_PREFS };
  }
}

export function setAdminUiPrefs(nextPrefs = {}) {
  const merged = sanitizePrefs({
    ...getAdminUiPrefs(),
    ...nextPrefs
  });
  localStorage.setItem(ADMIN_UI_PREFS_KEY, JSON.stringify(merged));

  window.dispatchEvent(
    new CustomEvent(ADMIN_UI_PREFS_EVENT, {
      detail: merged
    })
  );

  return merged;
}
