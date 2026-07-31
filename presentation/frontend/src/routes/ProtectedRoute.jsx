import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({
  allowedRoles,
  unauthenticatedRedirect = "/login",
  unauthorizedRedirect = "/unauthorized"
}) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={unauthenticatedRedirect} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={unauthorizedRedirect} replace />;
  }

  return <Outlet />;
}
