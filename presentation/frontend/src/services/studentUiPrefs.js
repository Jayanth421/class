const STUDENT_UI_PREFS_KEY = "cmr_student_ui_prefs";
export const STUDENT_UI_PREFS_EVENT = "cmr:student-ui-prefs-updated";

export const DEFAULT_STUDENT_UI_PREFS = Object.freeze({
  darkMode: false
});

function sanitizePrefs(rawPrefs = {}) {
  return {
    darkMode: Boolean(rawPrefs.darkMode)
  };
}

export function getStudentUiPrefs() {
  try {
    const raw = localStorage.getItem(STUDENT_UI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_STUDENT_UI_PREFS };
    const parsed = JSON.parse(raw);
    return sanitizePrefs(parsed);
  } catch (_error) {
    return { ...DEFAULT_STUDENT_UI_PREFS };
  }
}

export function setStudentUiPrefs(nextPrefs = {}) {
  const merged = sanitizePrefs({
    ...getStudentUiPrefs(),
    ...nextPrefs
  });
  localStorage.setItem(STUDENT_UI_PREFS_KEY, JSON.stringify(merged));

  window.dispatchEvent(
    new CustomEvent(STUDENT_UI_PREFS_EVENT, {
      detail: merged
    })
  );

  return merged;
}
