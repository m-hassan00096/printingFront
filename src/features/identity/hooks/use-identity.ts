import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authQueryKeys } from "@/features/auth/hooks/use-current-user";
import {
  createRole, createUser, deleteRole, deleteUser, getRole, getUser, listRoles, listUsers, updateRole, updateUser,
} from "../api/identity.api";
import type { RoleFilters, RolePayload, UserFilters, UserPayload } from "../types/identity.types";

export const identityKeys = {
  users: ["identity", "users"] as const,
  roles: ["identity", "roles"] as const,
  user: (id: number) => ["identity", "user", id] as const,
  role: (id: number) => ["identity", "role", id] as const,
};
export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: [...identityKeys.users, filters],
    queryFn: () => listUsers(filters),
    placeholderData: (previous) => previous,
  });
}
export function useUser(id: number) {
  return useQuery({ queryKey: identityKeys.user(id), queryFn: () => getUser(id), enabled: Number.isInteger(id) && id > 0 });
}
export function useRoles(filters: RoleFilters) {
  return useQuery({
    queryKey: [...identityKeys.roles, filters],
    queryFn: () => listRoles(filters),
    placeholderData: (previous) => previous,
  });
}
export function useRole(id: number) {
  return useQuery({ queryKey: identityKeys.role(id), queryFn: () => getRole(id), enabled: Number.isInteger(id) && id > 0 });
}
export function useCreateUser() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => void q.invalidateQueries({ queryKey: identityKeys.users }),
  });
}
export function useUpdateUser() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserPayload }) => updateUser(id, payload),
    onSuccess: (_, { id }) => {
      void q.invalidateQueries({ queryKey: identityKeys.users });
      void q.invalidateQueries({ queryKey: identityKeys.user(id) });
      void q.invalidateQueries({ queryKey: authQueryKeys.currentUser });
    },
  });
}
export function useDeleteUser() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void q.invalidateQueries({ queryKey: identityKeys.users });
      void q.invalidateQueries({ queryKey: authQueryKeys.currentUser });
    },
  });
}
export function useCreateRole() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => void q.invalidateQueries({ queryKey: identityKeys.roles }),
  });
}
export function useUpdateRole() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RolePayload }) => updateRole(id, payload),
    onSuccess: (_, { id }) => {
      void q.invalidateQueries({ queryKey: identityKeys.roles });
      void q.invalidateQueries({ queryKey: identityKeys.role(id) });
      void q.invalidateQueries({ queryKey: identityKeys.users });
      void q.invalidateQueries({ queryKey: authQueryKeys.currentUser });
    },
  });
}
export function useDeleteRole() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => void q.invalidateQueries({ queryKey: identityKeys.roles }),
  });
}
