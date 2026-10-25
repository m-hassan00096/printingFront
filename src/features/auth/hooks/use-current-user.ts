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
    refetchOnWindowFocus: true,
  });
}
