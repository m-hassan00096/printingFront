import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/orders.api";
import type { OrderFilters } from "../types/orders.types";

export const orderKeys = {
  list: ["orders", "list"] as const,
  detail: (id: number) => ["orders", "detail", id] as const,
  files: (id: number, itemId: number) => ["orders", "files", id, itemId] as const,
  activities: (id: number) => ["orders", "activities", id] as const,
};
export function useOrders(filters: OrderFilters) {
  return useQuery({ queryKey: [...orderKeys.list, filters], queryFn: () => api.listOrders(filters),
    placeholderData: (old) => old });
}
export function useOrder(id: number) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: () => api.getOrder(id), enabled: id > 0 });
}
export function useOrderActivities(id: number, enabled: boolean) {
  return useQuery({ queryKey: orderKeys.activities(id), queryFn: () => api.getOrderActivities(id), enabled: id > 0 && enabled });
}
export function useOrderFiles(id: number, itemId: number, enabled: boolean) {
  return useQuery({ queryKey: orderKeys.files(id, itemId), queryFn: () => api.getOrderFiles(id, itemId),
    enabled: id > 0 && itemId > 0 && enabled });
}
export function useOrderActions() {
  const qc = useQueryClient();
  const refresh = (id?: number) => {
    void qc.invalidateQueries({ queryKey: orderKeys.list });
    if (id) {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: orderKeys.activities(id) });
    }
  };
  const create = useMutation({ mutationFn: ({ payload, key }: { payload: Parameters<typeof api.createDraft>[0]; key: string }) => api.createDraft(payload, key),
    onSuccess: () => refresh() });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateDraft>[1] }) => api.updateDraft(id, payload),
    onSuccess: (_, { id }) => refresh(id) });
  const remove = useMutation({ mutationFn: api.removeDraft, onSuccess: () => refresh() });
  const addItem = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.addOrderItem>[1] }) => api.addOrderItem(id, payload),
    onSuccess: (_, { id }) => refresh(id) });
  const editItem = useMutation({ mutationFn: ({ id, itemId, payload }: { id: number; itemId: number; payload: Parameters<typeof api.updateOrderItem>[2] }) => api.updateOrderItem(id, itemId, payload),
    onSuccess: (_, { id }) => refresh(id) });
  const removeItem = useMutation({ mutationFn: ({ id, itemId }: { id: number; itemId: number }) => api.removeOrderItem(id, itemId),
    onSuccess: (_, { id }) => refresh(id) });
  const confirm = useMutation({ mutationFn: ({ id, key, payload }: { id: number; key: string; payload: Parameters<typeof api.confirmOrder>[2] }) => api.confirmOrder(id, key, payload),
    onSuccess: (_, { id }) => refresh(id) });
  const cancel = useMutation({ mutationFn: ({ id, key, reason }: { id: number; key: string; reason: string }) => api.cancelOrder(id, key, reason),
    onSuccess: (_, { id }) => refresh(id) });
  const upload = useMutation({ mutationFn: ({ id, itemId, file }: { id: number; itemId: number; file: File }) => api.uploadOrderFile(id, itemId, file),
    onSuccess: (_, { id, itemId }) => { void qc.invalidateQueries({ queryKey: orderKeys.files(id, itemId) });refresh(id); } });
  const deleteFile = useMutation({ mutationFn: ({ id, itemId, fileId }: { id: number; itemId: number; fileId: number }) => api.deleteOrderFile(id, itemId, fileId),
    onSuccess: (_, { id, itemId }) => {void qc.invalidateQueries({ queryKey: orderKeys.files(id, itemId) });refresh(id);} });
  return { create, update, remove, addItem, editItem, removeItem, confirm, cancel, upload, deleteFile };
}
