import { useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import useAuth from "../hooks/useAuth";

export default function ProfilePage() {
  const { user } = useAuth();
  const [showPhoto, setShowPhoto] = useState(false);
  const initials =
    user?.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "ST";

  return (
    <GlassCard>
      <h3 className="font-display text-lg text-white">Profile</h3>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="relative">
          {user?.profilePhoto ? (
            <img
              src={user.profilePhoto}
              alt={`${user?.name || "User"} profile`}
              className="h-16 w-16 rounded-xl border border-white/20 object-cover"
              onClick={() => setShowPhoto(true)}
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white">
              {initials}
            </div>
          )}
          {user?.profilePhoto ? (
            <button
              type="button"
              onClick={() => setShowPhoto(true)}
              className="absolute -right-2 -top-2 rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold text-white shadow hover:bg-white/25"
            >
              View
            </button>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-soft">Account Details</p>
          <p className="text-white">{user?.name || "-"}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <p>
          <span className="text-soft">Name:</span> {user?.name}
        </p>
        <p>
          <span className="text-soft">Email:</span> {user?.email}
        </p>
        <p>
          <span className="text-soft">Role:</span> {user?.role}
        </p>
        <p>
          <span className="text-soft">Roll Number:</span> {user?.rollNumber || "-"}
        </p>
        <p>
          <span className="text-soft">Department:</span> {user?.branch || "-"}
        </p>
        <p>
          <span className="text-soft">Year:</span> {user?.year || "-"}
        </p>
        <p>
          <span className="text-soft">Section:</span> {user?.section || "-"}
        </p>
        <p>
          <span className="text-soft">Mobile:</span> {user?.mobile || "-"}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Quick actions</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {user?.role === "STUDENT" ? (
              <>
                <Link className="rounded-lg bg-white/15 px-3 py-2 text-white hover:bg-white/25" to="/student/upload">
                  Upload PPT
                </Link>
                <Link className="rounded-lg bg-white/15 px-3 py-2 text-white hover:bg-white/25" to="/student/subjects">
                  My Subjects
                </Link>
              </>
            ) : null}
            {user?.role === "FACULTY" ? (
              <Link className="rounded-lg bg-white/15 px-3 py-2 text-white hover:bg-white/25" to="/faculty/smartboard">
                Smartboard
              </Link>
            ) : null}
            {user?.role === "ADMIN" ? (
              <Link className="rounded-lg bg-white/15 px-3 py-2 text-white hover:bg-white/25" to="/admin/uploads">
                Manage Uploads
              </Link>
            ) : null}
            {user?.role === "SMARTBOARD" ? (
              <Link className="rounded-lg bg-white/15 px-3 py-2 text-white hover:bg-white/25" to="/smartboard/view">
                Presentation View
              </Link>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Profile settings</p>
          <p className="mt-2 text-xs text-soft">
            Want to update your display photo or details? Contact admin support or your faculty coordinator.
          </p>
        </div>
      </div>

      {showPhoto && user?.profilePhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-[#141414] p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPhoto(false)}
              className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
            >
              Close
            </button>
            <img
              src={user.profilePhoto}
              alt="Profile large view"
              className="mx-auto max-h-[70vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}
