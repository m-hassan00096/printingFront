import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { AccountSettlementPreview, AccountSettlementInput, AccountSettlementRecord,
  AccountSettlementHistory } from "../types/account-settlement.types";

const path = (customerId: number) => `/finance/customers/${customerId}/settlements`;
export async function previewAccountSettlement(customerId: number, dateTo: string): Promise<AccountSettlementPreview> {
  const { data } = await apiClient.get<ApiResponse<AccountSettlementPreview>>(path(customerId) + "/preview", {params: {dateTo}});
  return data.data;
}
export async function confirmAccountSettlement(customerId: number, payload: AccountSettlementInput, key: string): Promise<AccountSettlementRecord> {
  const { data } = await apiClient.post<ApiResponse<AccountSettlementRecord>>(path(customerId), payload,
    {headers: {"Idempotency-Key": key}});
  return data.data;
}
export async function listAccountSettlements(customerId: number, page: number): Promise<AccountSettlementHistory> {
  const { data } = await apiClient.get<ApiResponse<AccountSettlementHistory>>(path(customerId), {params: {page}});
  return data.data;
}
export async function getAccountSettlement(customerId: number, id: number): Promise<AccountSettlementRecord> {
  const { data } = await apiClient.get<ApiResponse<AccountSettlementRecord>>(path(customerId) + `/${id}`);
  return data.data;
}
