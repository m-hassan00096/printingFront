import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { RefundFilters,RefundList,RefundRecord,RefundCreditPreview,RefundPayload,RefundCreated } from "../types/refunds.types";

const root="/finance/refunds";
export async function fetchRefunds(filters:RefundFilters):Promise<RefundList>{
  const params=new URLSearchParams({page:String(filters.page),perPage:"20"});
  for(const key of ["search","dateFrom","dateTo","paymentMethod"] as const){
    if(filters[key])params.set("filter["+key+"]",filters[key]);
  }
  if(filters.customerId)params.set("filter[customerId]",String(filters.customerId));
  const {data}=await apiClient.get<ApiResponse<RefundList>>(root,{params});
  if(!Array.isArray(data.data?.refunds)||!data.data.pagination)throw Error("استجابة سجل رد الأرصدة غير صحيحة.");
  return data.data;
}
export async function fetchRefund(id:number):Promise<RefundRecord>{
  const {data}=await apiClient.get<ApiResponse<RefundRecord>>(root+"/"+id);
  return data.data;
}
export async function fetchRefundCredit(customerId:number):Promise<RefundCreditPreview>{
  const {data}=await apiClient.get<ApiResponse<RefundCreditPreview>>(`/finance/customers/${customerId}/refundable-credit`);
  return data.data;
}
export async function createRefund(payload:RefundPayload,key:string):Promise<RefundCreated>{
  const {data}=await apiClient.post<ApiResponse<RefundCreated>>(root,payload,{headers:{"Idempotency-Key":key}});
  return data.data;
}
