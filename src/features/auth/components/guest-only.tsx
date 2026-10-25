import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthError } from "./auth-error";
import { AuthLoading } from "./auth-loading";
import { useCurrentUser } from "../hooks/use-current-user";

export function GuestOnly() {
  const { data: user, isPending, isError, refetch, isFetching } = useCurrentUser();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  const returnTo = typeof from === "string" && from.startsWith("/") &&
    !from.startsWith("//") && from !== "/login" ? from : "/";

  if (isPending) return <AuthLoading />;
  if (isError) return <AuthError onRetry={() => void refetch()} isRetrying={isFetching} />;
  if (user) return <Navigate to={returnTo} replace />;

  return <Outlet />;
}
