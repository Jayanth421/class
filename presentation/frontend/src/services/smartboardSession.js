export function buildSmartboardUser(exchangeData = {}, activeSession = null) {
  return {
    id: `smartboard-${Date.now()}`,
    name: activeSession?.smartboardName || "Smartboard",
    email: exchangeData?.faculty?.email || "",
    role: "SMARTBOARD",
    facultyName: exchangeData?.faculty?.name || "Faculty",
    classes: Array.isArray(exchangeData?.classes) ? exchangeData.classes : [],
    subjects: Array.isArray(exchangeData?.subjects) ? exchangeData.subjects : []
  };
}
