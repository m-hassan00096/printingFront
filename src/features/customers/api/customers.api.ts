import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  Customer, CustomerBalance, CustomerFilters, CustomerOption, CustomerPayload, LedgerFilters,
  LedgerPage, Pagination,
} from "../types/customers.types";

function listParams(filters: CustomerFilters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.customerTypeId) params.set("filter[customerTypeId]", filters.customerTypeId);
  if (filters.status !== "") params.set("filter[status]", filters.status);
  if (filters.sort) params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("perPage", "15");
  return params;
}
export async function listCustomers(filters: CustomerFilters) {
  const { data } = await apiClient.get<ApiResponse<{ customers: Customer[]; pagination: Pagination }>>("/customers", { params: listParams(filters) });
  return data.data;
}
export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await apiClient.get<ApiResponse<Customer>>(`/customers/${id}`);
  return data.data;
}
export async function getCustomerTypes(): Promise<CustomerOption[]> {
  const { data } = await apiClient.get<ApiResponse<{ customerTypes: CustomerOption[] }>>("/customers/customer-types");
  if (!Array.isArray(data.data?.customerTypes)) throw new Error("تعذّر تحميل أنواع العملاء.");
  return data.data.customerTypes;
}
export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const { data } = await apiClient.post<ApiResponse<Customer>>("/customers", payload);
  return data.data;
}
export async function updateCustomer(id: number, payload: Partial<CustomerPayload>): Promise<void> {
  // PATCH returns data: null. Refresh cache after update rather than expecting a customer in the response.
  await apiClient.patch<ApiResponse<null>>(`/customers/${id}`, payload);
}
export async function deleteCustomer(id: number): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`/customers/${id}`);
}
export async function getCustomerBalance(id: number): Promise<CustomerBalance> {
  const { data } = await apiClient.get<ApiResponse<CustomerBalance>>(`/finance/customers/${id}/balance`);
  return data.data;
}
export async function getCustomerLedger(id: number, filters: LedgerFilters): Promise<LedgerPage> {
  const params = new URLSearchParams({ page: String(filters.page), perPage: "15" });
  if (filters.dateFrom) params.set("filter[dateFrom]", filters.dateFrom);
  if (filters.dateTo) params.set("filter[dateTo]", filters.dateTo);
  const { data } = await apiClient.get<ApiResponse<LedgerPage>>(`/finance/customers/${id}/ledger`, { params });
  return data.data;
}
