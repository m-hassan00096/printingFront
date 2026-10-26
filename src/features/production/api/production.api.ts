import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  ProductionAction, ProductionColumnId, ProductionFilters, ProductionHistory,
  ProductionList, ProductionSummary, SelectOption,
} from "../types/production.types";

const base = "/production";
function filterParams(filters: ProductionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.customerId) params.set("filter[customerId]", String(filters.customerId));
  if (filters.myDesignWork) params.set("filter[myDesignWork]", filters.myDesignWork);
  if (filters.lateOnly) params.set("filter[lateOnly]", "1");
  return params;
}
export async function getProductionItems(
  column: ProductionColumnId, filters: ProductionFilters, page: number,
): Promise<ProductionList> {
  const params = filterParams(filters);
  params.set("filter[column]", String(column));
  params.set("page", String(page));
  params.set("perPage", "20");
  params.set("sort", filters.sort);
  const { data } = await apiClient.get<ApiResponse<ProductionList>>(`${base}/items`, { params });
  if (!Array.isArray(data.data?.items) || !data.data?.pagination) throw new Error("استجابة الإنتاج غير صحيحة.");
  return data.data;
}
export async function getProductionSummary(filters: ProductionFilters): Promise<ProductionSummary> {
  const { data } = await apiClient.get<ApiResponse<ProductionSummary>>(`${base}/summary`, {
    params: filterParams(filters),
  });
  return data.data;
}
export async function getProductionHistory(itemId: number, page: number): Promise<ProductionHistory> {
  const { data } = await apiClient.get<ApiResponse<ProductionHistory>>(`${base}/items/${itemId}/history`, {
    params: { page, perPage: 15 },
  });
  return data.data;
}
export async function getProductionSelects(): Promise<{ customers: SelectOption[]; locations: SelectOption[] }> {
  // Active customers drive the optional filter. Free-text search also finds customers
  // who were subsequently disabled.
  const { data } = await apiClient.get<ApiResponse<{ label: string; options: SelectOption[] }[]>>(
    "/selects", { params: { selects: "activeCustomers,printingLocations" } },
  );
  const groups = data.data;
  if (!Array.isArray(groups)) throw new Error("تعذّر تحميل قوائم الاختيار.");
  const get = (name: string) => {
    const options = groups.find((group) => group.label === name)?.options;
    if (!Array.isArray(options)) throw new Error(`تعذّر تحميل قائمة ${name}.`);
    return options;
  };
  return { customers: get("activeCustomers"), locations: get("printingLocations") };
}
export async function runProductionAction(
  action: ProductionAction, itemId: number, idempotencyKey: string, printingLocationId?: number,
): Promise<void> {
  const payload = printingLocationId === undefined ? {} : { printingLocationId };
  const headers = { "Idempotency-Key": idempotencyKey };
  if (action === "change-location") {
    await apiClient.patch<ApiResponse<null>>(`${base}/items/${itemId}/printing-location`, payload, { headers });
  } else {
    await apiClient.post<ApiResponse<null>>(`${base}/items/${itemId}/${action}`, payload, { headers });
  }
}
export async function sendProductionBatch(
  ids: number[], printingLocationId: number, idempotencyKey: string,
): Promise<void> {
  await apiClient.post<ApiResponse<null>>(`${base}/items/send-to-printing`, {
    orderItemIds: [...ids].sort((a,b) => a-b),
    printingLocationId,
  }, { headers: { "Idempotency-Key": idempotencyKey } });
}
