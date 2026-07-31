import { Link } from "react-router-dom";

const sections = [
  {
    title: "1. Account Responsibility",
    content:
      "You are responsible for keeping your account credentials secure. You must not share your password or OTP with anyone."
  },
  {
    title: "2. Acceptable Use",
    content:
      "This portal is only for academic and institutional work. Any misuse, unauthorized access, or harmful activity may lead to account suspension."
  },
  {
    title: "3. Student Profile Data",
    content:
      "Student profile fields such as photo, mobile number, year, department, and section are collected to support campus operations and class workflows."
  },
  {
    title: "4. Smartboard Access",
    content:
      "Smartboard sessions are time-bound and must be authorized through approved login flows. Do not attempt to bypass the session process."
  },
  {
    title: "5. Email and OTP Notices",
    content:
      "System notifications and verification codes are sent to registered email addresses. Expired or used OTPs cannot be reused."
  },
  {
    title: "6. Service Changes",
    content:
      "Features and policies may be updated periodically. Continued use of the portal means you accept the latest terms."
  }
];

export default function TermsAndConditionsPage() {
  return (
    <div className="background min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-[#141414]/85 p-6 shadow-[0_30px_80px_rgba(20, 20, 20, 0.45)] backdrop-blur-xl md:p-8">
        <h1 className="font-display text-3xl text-white md:text-4xl">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-slate-300">Last updated: March 4, 2026</p>

        <div className="mt-6 space-y-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-[#141414]/80 p-4"
            >
              <h2 className="text-base font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.content}</p>
            </section>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-300">
          By using this portal, you agree to these terms.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7F49B4]"
            to="/login"
          >
            Back to Sign In
          </Link>
          <Link
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            to="/register"
          >
            Go to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

