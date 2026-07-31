import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <GlassCard className="max-w-md text-center">
        <h1 className="font-display text-2xl text-white">403 - Unauthorized</h1>
        <p className="mt-2 text-soft">You do not have permission to view this page.</p>
        <Link className="mt-5 inline-block text-brand-300 hover:text-brand-100" to="/login">
          Go to Login
        </Link>
      </GlassCard>
    </div>
  );
}
