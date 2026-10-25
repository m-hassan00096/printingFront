import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onPermissionDenied, onSessionExpired } from "@/shared/api/http";
import { authQueryKeys } from "../hooks/use-current-user";
import type { AuthUser } from "../types/auth.types";

export function AuthSessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unregisterSession = onSessionExpired(() => {
      // Don't manufacture an authenticated user for an ordinary guest /auth/me 401.
      const previousUser = queryClient.getQueryData<AuthUser | null>(authQueryKeys.currentUser);
      if (!previousUser) return;

      // Keep the active /auth/me query observed. Removing it while its
      // observers are mounted can leave React displaying stale protected UI.
      // Remove only user-owned business data, then update the active session.
      void queryClient.cancelQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      queryClient.setQueryData(authQueryKeys.currentUser, null);
    });

    const unregisterPermission = onPermissionDenied(() => {
      const user = queryClient.getQueryData<AuthUser | null>(authQueryKeys.currentUser);
      if (user) {
        void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser });
      }
    });

    return () => {
      unregisterSession();
      unregisterPermission();
    };
  }, [queryClient]);

  return <>{children}</>;
}
