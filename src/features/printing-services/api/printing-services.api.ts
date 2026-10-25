import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type {
  CreateServicePayload, PrintingService, PricePreview, PricePreviewPayload,
  ServiceFilters, ServicePagination, UpdateServicePayload,
} from "../types/printing-service.types";

const basePath = "/printing-services";
export async function listPrintingServices(filters: ServiceFilters): Promise<{
  printingServices: PrintingService[]; pagination: ServicePagination;
}> {
  const params = new URLSearchParams({
    page: String(filters.page), perPage: "15", sort: filters.sort || "-id",
  });
  if (filters.search.trim()) params.set("filter[search]", filters.search.trim());
  if (filters.status !== "") params.set("filter[status]", filters.status);
  const { data } = await apiClient.get<ApiResponse<{
    printingServices: PrintingService[]; pagination: ServicePagination;
  }>>(basePath, { params });
  if (!Array.isArray(data.data?.printingServices) || !data.data?.pagination)
    throw new Error("تعذّر قراءة قائمة خدمات الطباعة.");
  return data.data;
}
export async function getPrintingService(id: number): Promise<PrintingService> {
  const { data } = await apiClient.get<ApiResponse<PrintingService>>(`${basePath}/${id}`);
  return data.data;
}
export async function createPrintingService(payload: CreateServicePayload): Promise<PrintingService> {
  const { data } = await apiClient.post<ApiResponse<PrintingService>>(basePath, payload);
  return data.data;
}
export async function updatePrintingService(id: number, payload: UpdateServicePayload): Promise<PrintingService> {
  const { data } = await apiClient.patch<ApiResponse<PrintingService>>(`${basePath}/${id}`, payload);
  return data.data;
}
export async function deletePrintingService(id: number): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`${basePath}/${id}`);
}
export async function previewPrintingServicePrice(payload: PricePreviewPayload): Promise<PricePreview> {
  const { data } = await apiClient.post<ApiResponse<PricePreview>>(`${basePath}/price-preview`, payload);
  return data.data;
}
