import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout } from "../api/auth.api";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await logout();
      } catch (error: unknown) {
        // The session may already be gone. Treat 401 as logged out.
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return;
        }
        throw error;
      }
    },
    retry: false,
    onSuccess: () => {
      // Clear cached business data as well: it belongs to the old user's session.
      queryClient.clear();
    },
  });
}
