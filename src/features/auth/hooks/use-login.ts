import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/auth.api";
import { authQueryKeys } from "./use-current-user";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    retry: false,
    onSuccess: async (user) => {
      // Prevent an older in-flight /auth/me response from overwriting a new session.
      await queryClient.cancelQueries({ queryKey: authQueryKeys.currentUser });
      // Nothing from a previous authenticated user may survive a new login.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
      queryClient.setQueryData(authQueryKeys.currentUser, user);
    },
  });
}
