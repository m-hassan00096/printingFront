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

/**
 * Records are newest-ID-first, with immutable snapshots loaded only from show().
 * Fetch the record preceding an older saved settlement as well as the latest
 * one for a new draft; never mistake the draft's future settlement for posted cash.
 */
export async function findPreviousAccountSettlement(customerId: number, beforeId?: number): Promise<AccountSettlementRecord | null> {
  let page = 1, lastPage = 1;
  do {
    const history = await listAccountSettlements(customerId, page);
    const reference = history.settlements.find(row => beforeId === undefined || row.id < beforeId);
    if (reference) return getAccountSettlement(customerId, reference.id);
    lastPage = history.pagination.lastPage;
    page += 1;
  } while (page <= lastPage);
  return null;
}
