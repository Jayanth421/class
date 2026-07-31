import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <GlassCard className="max-w-2xl text-center">
        <img
          src="/auth-assets/404.svg"
          alt="404 not found illustration"
          className="mx-auto w-full max-w-lg rounded-2xl border border-white/10"
        />
        <h1 className="font-display text-2xl text-white">404 - Page Not Found</h1>
        <p className="mt-2 text-soft">The requested route does not exist.</p>
        <Link
          className="mt-5 inline-block rounded-xl bg-black px-4 py-3 text-brand-300 hover:text-brand-100"
          to="/login"
        >
          Go to Login
        </Link>
      </GlassCard>
    </div>
  );
}
