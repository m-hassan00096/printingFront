import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/auth.api";

export const authQueryKeys = {
  currentUser: ["auth", "current-user"] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: authQueryKeys.currentUser,
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    // There is no permissions-version header in the backend yet. Recheck the
    // logged-in user occasionally so revoked permissions disappear from the UI.
    refetchInterval: (query) => query.state.status === "error" ? false : 60_000,
  });
}
