import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthError } from "./auth-error";
import { AuthLoading } from "./auth-loading";
import { useCurrentUser } from "../hooks/use-current-user";

export function RequireAuth() {
  const { data: user, isPending, isError, refetch, isFetching } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <AuthLoading />;
  if (isError) return <AuthError onRetry={() => void refetch()} isRetrying={isFetching} />;
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }

  return <Outlet />;
}
