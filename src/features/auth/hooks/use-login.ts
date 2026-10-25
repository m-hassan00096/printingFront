import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/auth.api";
import { authQueryKeys } from "./use-current-user";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    retry: false,
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser, user);
    },
  });
}
