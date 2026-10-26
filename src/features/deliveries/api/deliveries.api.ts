import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  CancelPayload, DeliverPayload, DeliveryDetails, DeliveryHistory,
  HistoryFilters, ReadyFilters, ReadyList, ReadyPreview,
} from "../types/deliveries.types";

const root = "/deliveries";
function readyParams(filters: ReadyFilters, page: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), perPage: "20", sort: filters.sort });
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.customerId) params.set("filter[customerId]", String(filters.customerId));
  return params;
}
function historyParams(filters: HistoryFilters, page: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), perPage: "20", sort: filters.sort });
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.dateFrom) params.set("filter[dateFrom]", filters.dateFrom);
  if (filters.dateTo) params.set("filter[dateTo]", filters.dateTo);
  if (filters.status) params.set("filter[status]", filters.status);
  return params;
}
export async function listReady(filters: ReadyFilters, page: number): Promise<ReadyList> {
  const { data } = await apiClient.get<ApiResponse<ReadyList>>(root + "/ready", { params: readyParams(filters, page) });
  if (!Array.isArray(data.data?.orders) || !data.data.pagination) throw new Error("استجابة التسليمات غير صحيحة.");
  return data.data;
}
export async function previewDelivery(orderId: number): Promise<ReadyPreview> {
  const { data } = await apiClient.get<ApiResponse<ReadyPreview>>(`${root}/ready/${orderId}`);
  return data.data;
}
export async function listHistory(filters: HistoryFilters, page: number): Promise<DeliveryHistory> {
  const { data } = await apiClient.get<ApiResponse<DeliveryHistory>>(root, { params: historyParams(filters, page) });
  if (!Array.isArray(data.data?.deliveries) || !data.data.pagination) throw new Error("استجابة سجل التسليمات غير صحيحة.");
  return data.data;
}
export async function deliveryDetails(id: number): Promise<DeliveryDetails> {
  const { data } = await apiClient.get<ApiResponse<DeliveryDetails>>(`${root}/${id}`);
  return data.data;
}
export async function deliverOrder(orderId: number, body: DeliverPayload, key: string): Promise<void> {
  await apiClient.post<ApiResponse<null>>(`${root}/orders/${orderId}/deliver`, body,
    { headers: { "Idempotency-Key": key } });
}
export async function cancelDelivery(id: number, body: CancelPayload, key: string): Promise<void> {
  await apiClient.post<ApiResponse<null>>(`${root}/${id}/cancel`, body,
    { headers: { "Idempotency-Key": key } });
}
