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

      // Invalidate ALL private data when a formerly valid session is rejected.
      void queryClient.cancelQueries();
      queryClient.removeQueries();
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
