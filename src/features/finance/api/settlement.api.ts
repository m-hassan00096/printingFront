import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { CustomerSettlement, SettlementPeriod } from "../types/settlement.types";

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
