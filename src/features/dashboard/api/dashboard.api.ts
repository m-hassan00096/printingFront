import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { DashboardData } from "../types/dashboard.types";

export async function fetchDashboard():Promise<DashboardData>{
  const {data}=await apiClient.get<ApiResponse<DashboardData>>("/dashboard");
  if(!data.data?.metrics||!data.data.productionPressure||
    !Array.isArray(data.data.attentionOrders)||!Array.isArray(data.data.latestOrders))
    throw new Error("استجابة لوحة التحكم غير صحيحة.");
  return data.data;
}
