import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSettings, deleteSettings, listParameterGroups, listSettings, updateSettings,
} from "../api/settings.api";
import type { SettingsFilters, SettingsKind, SettingsPayload } from "../types/settings.types";

export const settingsKeys = {
  groups: ["settings", "groups"] as const,
  list: (kind: SettingsKind) => ["settings", "list", kind] as const,
};
export function useParameterGroups(enabled: boolean) {
  return useQuery({ queryKey: settingsKeys.groups, queryFn: listParameterGroups, enabled, staleTime: 5 * 60_000 });
}
export function useSettingsList(kind: SettingsKind, filters: SettingsFilters, parameterId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...settingsKeys.list(kind), filters, parameterId],
    queryFn: () => listSettings(kind, filters, parameterId),
    enabled,
    placeholderData: (previous) => previous,
  });
}
export function useSettingsMutations(kind: SettingsKind) {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: settingsKeys.list(kind) });
  const create = useMutation({
    mutationFn: ({ payload, parameterId }: { payload: SettingsPayload; parameterId?: number }) =>
      createSettings(kind, payload, parameterId),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SettingsPayload }) => updateSettings(kind, id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteSettings(kind, id), onSuccess: invalidate });
  return { create, update, remove };
}
