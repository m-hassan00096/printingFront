import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  ConfirmOrderPayload, CreateOrderPayload, Order, OrderActivity, OrderFile, OrderFilters,
  OrderItemPayload, Pagination, UpdateOrderPayload,
} from "../types/orders.types";

const path = "/orders";
export async function listOrders(filters: OrderFilters): Promise<{ orders: Order[]; pagination: Pagination }> {
  const params = new URLSearchParams({ page: String(filters.page), perPage: "15", sort: filters.sort || "-id" });
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.status !== "") params.set("filter[status]", filters.status);
  if (filters.productionStatus !== "") params.set("filter[productionStatus]", filters.productionStatus);
  if (filters.lateOnly) params.set("filter[lateOnly]", "1");
  if (filters.readyDueToday) params.set("filter[readyDueToday]", "1");
  if (filters.createdFrom) params.set("filter[createdFrom]", filters.createdFrom);
  if (filters.createdTo) params.set("filter[createdTo]", filters.createdTo);
  const { data } = await apiClient.get<ApiResponse<{ orders: Order[]; pagination: Pagination }>>(path, { params });
  if (!Array.isArray(data.data?.orders) || !data.data?.pagination) throw new Error("استجابة قائمة الأوردرات غير صحيحة.");
  return data.data;
}
export async function getOrder(id: number): Promise<Order> {
  const { data } = await apiClient.get<ApiResponse<Order>>(`${path}/${id}`);
  return data.data;
}
export async function createDraft(payload: CreateOrderPayload, key: string): Promise<void> {
  // Both draft and confirmed creation return data:null; never assume an order ID.
  await apiClient.post<ApiResponse<null>>(path, payload, { headers: { "Idempotency-Key": key } });
}
export async function updateDraft(id: number, payload: UpdateOrderPayload): Promise<void> {
  await apiClient.patch<ApiResponse<null>>(`${path}/${id}`, payload);
}
export async function removeDraft(id: number): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`${path}/${id}`);
}
export async function addOrderItem(id: number, payload: OrderItemPayload): Promise<void> {
  await apiClient.post<ApiResponse<null>>(`${path}/${id}/items`, payload);
}
export async function updateOrderItem(id: number, itemId: number, payload: Partial<OrderItemPayload>): Promise<void> {
  await apiClient.patch<ApiResponse<null>>(`${path}/${id}/items/${itemId}`, payload);
}
export async function removeOrderItem(id: number, itemId: number): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`${path}/${id}/items/${itemId}`);
}
export async function confirmOrder(id: number, key: string, payload: ConfirmOrderPayload): Promise<void> {
  await apiClient.post<ApiResponse<null>>(`${path}/${id}/confirm`, payload, { headers: { "Idempotency-Key": key } });
}
export async function cancelOrder(id: number, key: string, reason: string): Promise<void> {
  await apiClient.post<ApiResponse<null>>(`${path}/${id}/cancel`, { reason }, { headers: { "Idempotency-Key": key } });
}
export async function getOrderActivities(id: number): Promise<{ activities: OrderActivity[]; pagination: Pagination }> {
  const { data } = await apiClient.get<ApiResponse<{ activities: OrderActivity[]; pagination: Pagination }>>(`${path}/${id}/activities`);
  return data.data;
}
export async function getOrderFiles(id: number, itemId: number): Promise<OrderFile[]> {
  const { data } = await apiClient.get<ApiResponse<OrderFile[]>>(`${path}/${id}/items/${itemId}/files`);
  return data.data;
}
export async function uploadOrderFile(id: number, itemId: number, file: File): Promise<OrderFile> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ApiResponse<OrderFile>>(`${path}/${id}/items/${itemId}/files`, form);
  return data.data;
}
export async function deleteOrderFile(id: number, itemId: number, fileId: number): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`${path}/${id}/items/${itemId}/files/${fileId}`);
}
export async function fetchOrderFile(id: number, itemId: number, fileId: number): Promise<Blob> {
  const response = await apiClient.get<Blob>(`${path}/${id}/items/${itemId}/files/${fileId}`, { responseType: "blob" });
  return response.data;
}
