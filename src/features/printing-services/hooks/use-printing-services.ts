import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPrintingService, deletePrintingService, getPrintingService,
  listPrintingServices, previewPrintingServicePrice, updatePrintingService,
} from "../api/printing-services.api";
import type {
  CreateServicePayload, PricePreviewPayload, ServiceFilters, UpdateServicePayload,
} from "../types/printing-service.types";

export const printingServiceKeys = {
  lists: ["printing-services", "list"] as const,
  detail: (id: number) => ["printing-services", "detail", id] as const,
};
export function usePrintingServices(filters: ServiceFilters) {
  return useQuery({
    queryKey: [...printingServiceKeys.lists, filters],
    queryFn: () => listPrintingServices(filters),
    placeholderData: (old) => old,
  });
}
export function usePrintingService(id: number) {
  return useQuery({
    queryKey: printingServiceKeys.detail(id),
    queryFn: () => getPrintingService(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
}
export function usePrintingServiceMutations() {
  const queryClient = useQueryClient();
  function refresh(id?: number) {
    void queryClient.invalidateQueries({ queryKey: printingServiceKeys.lists });
    if (id) void queryClient.invalidateQueries({ queryKey: printingServiceKeys.detail(id) });
  }
  const create = useMutation({
    mutationFn: (payload: CreateServicePayload) => createPrintingService(payload),
    onSuccess: (service) => refresh(service.id),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateServicePayload }) => updatePrintingService(id, payload),
    onSuccess: (service) => refresh(service.id),
  });
  const remove = useMutation({ mutationFn: deletePrintingService, onSuccess: () => refresh() });
  const preview = useMutation({ mutationFn: (payload: PricePreviewPayload) => previewPrintingServicePrice(payload) });
  return { create, update, remove, preview };
}
