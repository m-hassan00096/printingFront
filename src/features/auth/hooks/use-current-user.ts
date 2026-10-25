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
    // Deliberately avoid polling /auth/me: every successful session request
    // may extend Laravel's idle session lifetime while the user is away.
    // Refetch on window focus/reconnect, or immediately after a business 403.
  });
}
