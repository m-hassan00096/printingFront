import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onSessionExpired } from "@/shared/api/http";
import { authQueryKeys } from "../hooks/use-current-user";

export function AuthSessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(
    () => onSessionExpired(() => {
      // Any protected endpoint returning 401 invalidates the entire user-scoped cache.
      void queryClient.cancelQueries();
      queryClient.removeQueries();
      queryClient.setQueryData(authQueryKeys.currentUser, null);
    }),
    [queryClient],
  );

  return <>{children}</>;
}
