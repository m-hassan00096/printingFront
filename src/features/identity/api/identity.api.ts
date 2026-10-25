import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  IdentityUser, IdentityRole, Pagination, UserFilters, RoleFilters, UserPayload, RolePayload,
} from "../types/identity.types";

const nonempty = (value: string | undefined) => value !== undefined && value !== "";
function query(filters: UserFilters | RoleFilters) {
  const params = new URLSearchParams();
  if (nonempty(filters.search)) params.set("filter[search]", filters.search!);
  if (nonempty(filters.status)) params.set("filter[status]", filters.status!);
  if ("role" in filters && nonempty(filters.role)) params.set("filter[role]", filters.role!);
  params.set("page", String(filters.page ?? 1));
  params.set("perPage", String(filters.perPage ?? 15));
  return params;
}

export async function listUsers(filters: UserFilters) {
  const { data } = await apiClient.get<ApiResponse<{ users: IdentityUser[]; pagination: Pagination }>>("/users", { params: query(filters) });
  return data.data;
}
export async function getUser(id: number) {
  const { data } = await apiClient.get<ApiResponse<IdentityUser>>(`/users/${id}`);
  return data.data;
}
export async function listRoles(filters: RoleFilters) {
  const { data } = await apiClient.get<ApiResponse<{ roles: IdentityRole[]; pagination: Pagination }>>("/roles", { params: query(filters) });
  return data.data;
}
export async function getRole(id: number) {
  const { data } = await apiClient.get<ApiResponse<IdentityRole>>(`/roles/${id}`);
  return data.data;
}

function userFormData(payload: UserPayload) {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value instanceof File) form.append(key, value);
    else form.append(key, value === null ? "" : String(value));
  }
  return form;
}
export async function createUser(payload: UserPayload) {
  const { data } = await apiClient.post<ApiResponse<IdentityUser>>("/users", userFormData(payload));
  return data.data;
}
export async function updateUser(id: number, payload: UserPayload) {
  // Browsers encode files with multipart POST and Laravel recognizes the method override.
  // For non-file updates use native PATCH with JSON instead.
  if (payload.avatar) {
    const form = userFormData(payload);
    form.append("_method", "PATCH");
    const { data } = await apiClient.post<ApiResponse<IdentityUser>>(`/users/${id}`, form);
    return data.data;
  }
  const { data } = await apiClient.patch<ApiResponse<IdentityUser>>(`/users/${id}`, payload);
  return data.data;
}
export async function deleteUser(id: number) {
  await apiClient.delete(`/users/${id}`);
}
export async function createRole(payload: Required<Pick<RolePayload, "nameAr" | "status" | "permissionIds">>) {
  const { data } = await apiClient.post<ApiResponse<IdentityRole>>("/roles", payload);
  return data.data;
}
export async function updateRole(id: number, payload: RolePayload) {
  const { data } = await apiClient.patch<ApiResponse<IdentityRole>>(`/roles/${id}`, payload);
  return data.data;
}
export async function deleteRole(id: number) {
  await apiClient.delete(`/roles/${id}`);
}

/** Shared Selects endpoint registered by IdentitySelectServiceProvider. */
export type PermissionOption = { value: number; label: string };
export async function listPermissionOptions(): Promise<PermissionOption[]> {
  const response = await apiClient.get<ApiResponse<Array<{
    label: string;
    options: PermissionOption[];
  }>>>("/selects", { params: { selects: "permissions" } });
  const entry = response.data.data.find((item) => item.label === "permissions");
  if (!entry || !Array.isArray(entry.options) ||
      !entry.options.every((option) => Number.isSafeInteger(option.value) &&
        option.value > 0 && typeof option.label === "string")) {
    throw new Error("تعذّر قراءة قائمة الصلاحيات من الخادم.");
  }
  return [...entry.options].sort((a, b) => a.label.localeCompare(b.label, "ar"));
}
