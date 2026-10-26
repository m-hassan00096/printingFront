import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/production.api";
import type { ProductionAction, ProductionColumnId, ProductionFilters } from "../types/production.types";

const keys = {
  root: ["production"] as const,
  board: (column: ProductionColumnId, filters: ProductionFilters, page: number) =>
    ["production", "board", column, filters, page] as const,
  summary: (filters: ProductionFilters) => ["production", "summary", filters] as const,
  history: (itemId: number, page: number) => ["production", "history", itemId, page] as const,
};
export function useProductionColumn(column: ProductionColumnId, filters: ProductionFilters, page: number, enabled=true) {
  return useQuery({
    queryKey: keys.board(column,filters,page),
    queryFn: () => api.getProductionItems(column,filters,page),
    enabled,
  });
}
export function useProductionSummary(filters: ProductionFilters, enabled: boolean) {
  return useQuery({ queryKey: keys.summary(filters), queryFn: () => api.getProductionSummary(filters), enabled });
}
export function useProductionHistory(itemId: number, page: number, enabled: boolean) {
  return useQuery({ queryKey: keys.history(itemId,page), queryFn: () => api.getProductionHistory(itemId,page),
    enabled: enabled && itemId > 0 });
}
export function useProductionSelects(enabled: boolean) {
  return useQuery({ queryKey: ["production","selects"], queryFn: api.getProductionSelects, enabled, staleTime:60_000 });
}
export type SingleMove = {
  action: ProductionAction;
  itemId: number;
  printingLocationId?: number;
};
export type BatchMove = { itemIds: number[]; printingLocationId: number };
export function useProductionActions() {
  const qc=useQueryClient();
  const pendingKeys=useRef(new Map<string,string>());
  function idempotency(operation: string): string {
    const existing=pendingKeys.current.get(operation);
    if(existing) return existing;
    const next=crypto.randomUUID();
    pendingKeys.current.set(operation,next);
    return next;
  }
  async function refresh() {
    await qc.invalidateQueries({queryKey:keys.root});
    await qc.invalidateQueries({queryKey:["orders"]});
  }
  const single=useMutation({
    mutationFn: async (params:SingleMove) => {
      const fingerprint=`item:${params.itemId}:${params.action}:${params.printingLocationId ?? ""}`;
      await api.runProductionAction(params.action,params.itemId,idempotency(fingerprint),params.printingLocationId);
      pendingKeys.current.delete(fingerprint);
    },
    onSuccess:refresh,
  });
  const batch=useMutation({
    mutationFn: async (params:BatchMove) => {
      const sorted=[...params.itemIds].sort((a,b)=>a-b);
      const fingerprint=`batch:${sorted.join(",")}:${params.printingLocationId}`;
      await api.sendProductionBatch(sorted,params.printingLocationId,idempotency(fingerprint));
      pendingKeys.current.delete(fingerprint);
    },
    onSuccess:refresh,
  });
  return { single, batch };
}
