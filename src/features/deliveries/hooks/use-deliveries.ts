import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/deliveries.api";
import type { CancelPayload, DeliverPayload, HistoryFilters, ReadyFilters } from "../types/deliveries.types";

export const deliveryKeys = {
  ready: ["deliveries", "ready"] as const,
  history: ["deliveries", "history"] as const,
  preview: (id: number) => ["deliveries", "preview", id] as const,
  detail: (id: number) => ["deliveries", "detail", id] as const,
};
export function useReadyOrders(filters: ReadyFilters, page: number, enabled: boolean) {
  return useQuery({ queryKey: [...deliveryKeys.ready, filters, page],
    queryFn: () => api.listReady(filters, page), enabled });
}
export function useDeliveryPreview(id: number) {
  return useQuery({ queryKey: deliveryKeys.preview(id), queryFn: () => api.previewDelivery(id), enabled: id > 0 });
}
export function useDeliveryHistory(filters: HistoryFilters, page: number, enabled: boolean) {
  return useQuery({ queryKey: [...deliveryKeys.history, filters, page],
    queryFn: () => api.listHistory(filters, page), enabled });
}
export function useDeliveryDetails(id: number) {
  return useQuery({ queryKey: deliveryKeys.detail(id), queryFn: () => api.deliveryDetails(id), enabled: id > 0 });
}
export function useDeliveryActions() {
  const client = useQueryClient();
  const pending = useRef(new Map<string, string>());
  function keyFor(fingerprint: string) {
    const existing = pending.current.get(fingerprint);
    if (existing) return existing;
    const key = crypto.randomUUID();
    pending.current.set(fingerprint, key);
    return key;
  }
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: deliveryKeys.ready }),
      client.invalidateQueries({ queryKey: deliveryKeys.history }),
      client.invalidateQueries({ queryKey: ["orders"] }),
      client.invalidateQueries({ queryKey: ["production"] }),
      client.invalidateQueries({ queryKey: ["finance"] }),
      client.invalidateQueries({ queryKey: ["customers"] }),
    ]);
    // The active preview is no longer eligible after handover. Mark it stale
    // without immediately requesting a now-404 resource before the modal closes.
    await Promise.all([
      client.invalidateQueries({ queryKey: ["deliveries", "preview"], refetchType: "none" }),
      client.invalidateQueries({ queryKey: ["deliveries", "detail"], refetchType: "none" }),
    ]);
  };
  const deliver = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: DeliverPayload }) => {
      const fingerprint = "deliver:" + id + ":" + JSON.stringify(payload);
      await api.deliverOrder(id, payload, keyFor(fingerprint));
      pending.current.delete(fingerprint);
    },
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: CancelPayload }) => {
      const fingerprint = "cancel:" + id + ":" + JSON.stringify(payload);
      await api.cancelDelivery(id, payload, keyFor(fingerprint));
      pending.current.delete(fingerprint);
    },
    onSuccess: refresh,
  });
  return { deliver, cancel };
}
