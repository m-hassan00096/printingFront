import { Navigate, Outlet } from "react-router-dom";
import { AuthError } from "./auth-error";
import { AuthLoading } from "./auth-loading";
import { useCurrentUser } from "../hooks/use-current-user";

export function GuestOnly() {
  const { data: user, isPending, isError, refetch, isFetching } = useCurrentUser();

  if (isPending) return <AuthLoading />;
  if (isError) return <AuthError onRetry={() => void refetch()} isRetrying={isFetching} />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
