import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  CustomerSettlement, SettlementPeriod, SettlementRecord, SettlementRecordsPage,
  CreateSettlementRecordPayload,
} from "../types/settlement.types";

export async function fetchCustomerSettlement(
  customerId: number,
  period: SettlementPeriod,
): Promise<CustomerSettlement> {
  const params = new URLSearchParams({ dateFrom: period.from, dateTo: period.to });
  const { data } = await apiClient.get<ApiResponse<CustomerSettlement>>(
    "/finance/customers/" + customerId + "/settlement",
    { params },
  );
  if (!data.data || !Array.isArray(data.data.lines) ||
    typeof data.data.closingBalance !== "string") {
    throw Error("تعذّر قراءة كشف التصفية.");
  }
  return data.data;
}

const recordsRoot = (customerId: number) =>
  "/finance/customers/" + customerId + "/settlement-records";

export async function fetchSettlementRecords(
  customerId: number,
  page: number,
): Promise<SettlementRecordsPage> {
  const { data } = await apiClient.get<ApiResponse<SettlementRecordsPage>>(
    recordsRoot(customerId), { params: { page } },
  );
  if (!data.data || !Array.isArray(data.data.settlements)) {
    throw Error("تعذّر قراءة سجل التصفيات.");
  }
  return data.data;
}

export async function fetchSettlementRecord(
  customerId: number,
  id: number,
): Promise<SettlementRecord> {
  const { data } = await apiClient.get<ApiResponse<SettlementRecord>>(
    recordsRoot(customerId) + "/" + id,
  );
  if (!data.data?.statement || !Array.isArray(data.data.statement.lines)) {
    throw Error("تعذّر قراءة تفاصيل التصفية.");
  }
  return data.data;
}

export async function createSettlementRecord(
  customerId: number,
  payload: CreateSettlementRecordPayload,
  key: string,
): Promise<SettlementRecord> {
  const { data } = await apiClient.post<ApiResponse<SettlementRecord>>(
    recordsRoot(customerId), payload,
    { headers: { "Idempotency-Key": key } },
  );
  if (!data.data?.id) throw Error("تعذّر قراءة التصفية المحفوظة.");
  return data.data;
}
