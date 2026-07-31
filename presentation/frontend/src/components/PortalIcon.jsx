export function getNavIconName(href = "") {
  if (href.includes("/dashboard") || href.includes("/home")) return "dashboard";
  if (href.includes("/features")) return "analytics";
  if (href.includes("/departments")) return "departments";
  if (href.includes("/classes")) return "classes";
  if (href.includes("/students")) return "users";
  if (href.includes("/subjects")) return "subjects";
  if (href.includes("/presentations") || href.includes("/review")) return "classes";
  if (href.includes("/materials")) return "upload";
  if (href.includes("/upload")) return "upload";
  if (href.includes("/users")) return "users";
  if (href.includes("/notifications")) return "bell";
  if (href.includes("/activity")) return "analytics";
  if (href.includes("/analytics")) return "analytics";
  if (href.includes("/settings")) return "settings";
  if (href.includes("/profile")) return "profile";
  if (href.includes("/smartboard")) return "smartboard";
  return "dot";
}

function iconPath(name) {
  switch (name) {
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      );
    case "departments":
      return (
        <>
          <path d="M4 21V8l8-4 8 4v13" />
          <path d="M9 21v-4h6v4" />
          <path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
        </>
      );
    case "classes":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9h10M7 13h10M7 17h6" />
        </>
      );
    case "subjects":
      return (
        <>
          <path d="M4 6.5A3.5 3.5 0 0 1 7.5 3H20v15.5A2.5 2.5 0 0 0 17.5 16H7.5A3.5 3.5 0 0 0 4 19.5V6.5z" />
          <path d="M20 18.5A2.5 2.5 0 0 0 17.5 16H7.5A3.5 3.5 0 0 0 4 19.5V20a1 1 0 0 0 1 1h15v-2.5z" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M13.5 20a4 4 0 0 1 7 0" />
        </>
      );
    case "analytics":
      return (
        <>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20v-11" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M12 15V4" />
          <path d="M8 8l4-4 4 4" />
          <path d="M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2" />
        </>
      );
    case "profile":
      return (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </>
      );
    case "smartboard":
      return (
        <>
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M9 21h6M12 17v4" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4.2-4.2" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M15 18H9a2 2 0 0 1-2-2v-3a5 5 0 0 1 10 0v3a2 2 0 0 1-2 2z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </>
      );
    case "message":
      return (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M14 17l5-5-5-5" />
          <path d="M19 12H9" />
        </>
      );
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="2.5" />;
  }
}

export default function PortalIcon({ name, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {iconPath(name)}
    </svg>
  );
}
