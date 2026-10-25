import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import {
  isParameterKind, parameterGroupName,
  type ParameterGroup, type SettingsKind, type SettingsFilters,
  type SettingsPageResult, type SettingsRecord, type SettingsPagination,
  type SettingsPayload,
} from "../types/settings.types";

const endpoint = (kind: SettingsKind) =>
  isParameterKind(kind) ? "/settings/parameter-values" : kind === "bank-accounts" ? "/settings/bank-accounts" : "/settings/e-wallets";
const responseKey = (kind: SettingsKind): "parameters" | "bankAccounts" | "eWallets" =>
  isParameterKind(kind) ? "parameters" : kind === "bank-accounts" ? "bankAccounts" : "eWallets";

export async function listParameterGroups(): Promise<ParameterGroup[]> {
  const { data } = await apiClient.get<ApiResponse<{ groups: ParameterGroup[] }>>("/settings/parameter-groups");
  const groups = data.data?.groups;
  if (!Array.isArray(groups) || !groups.every((g) => Number.isSafeInteger(g.id) && g.id > 0 && typeof g.name === "string"))
    throw new Error("تعذّر تحميل معرّفات مجموعات الإعدادات من الخادم.");
  return groups;
}

export async function listSettings(kind: SettingsKind, filters: SettingsFilters, parameterId?: number): Promise<SettingsPageResult> {
  if (isParameterKind(kind) && (!Number.isSafeInteger(parameterId) || !parameterId || parameterId < 1))
    throw new Error("مجموعة الإعدادات غير متاحة.");
  const params = new URLSearchParams();
  if (isParameterKind(kind) && parameterId) params.set("parameterId", String(parameterId));
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.status !== "") params.set("filter[status]", filters.status);
  params.set("page", String(filters.page));
  params.set("perPage", "15");
  const { data } = await apiClient.get<ApiResponse<{
    parameters?: SettingsRecord[];
    bankAccounts?: SettingsRecord[];
    eWallets?: SettingsRecord[];
    pagination: SettingsPagination;
  }>>(endpoint(kind), { params });
  const items = data.data?.[responseKey(kind)];
  if (!Array.isArray(items) || !data.data?.pagination)
    throw new Error("بيانات الإعدادات المستلمة من الخادم غير صالحة.");
  return { items, pagination: data.data.pagination };
}

export async function createSettings(kind: SettingsKind, payload: SettingsPayload, parameterId?: number) {
  if (isParameterKind(kind) && (!parameterId || parameterId < 1))
    throw new Error("مجموعة الإعدادات غير متاحة.");
  const body = isParameterKind(kind) ? { ...payload, parameterId } : payload;
  const { data } = await apiClient.post<ApiResponse<SettingsRecord>>(endpoint(kind), body);
  return data.data;
}
export async function updateSettings(kind: SettingsKind, id: number, payload: SettingsPayload) {
  const { data } = await apiClient.patch<ApiResponse<SettingsRecord>>(`${endpoint(kind)}/${id}`, payload);
  return data.data;
}
export async function deleteSettings(kind: SettingsKind, id: number) {
  await apiClient.delete(`${endpoint(kind)}/${id}`);
}

export function resolveParameterId(groups: ParameterGroup[], kind: SettingsKind): number | undefined {
  if (!isParameterKind(kind)) return undefined;
  return groups.find((group) => group.name === parameterGroupName(kind))?.id;
}
