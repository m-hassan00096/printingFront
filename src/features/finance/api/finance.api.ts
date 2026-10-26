import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { AccountFilters, AccountLedger, OpeningBalanceInput, CustomerBalance, CustomerOption } from "../types/finance.types";

export async function financeCustomers():Promise<CustomerOption[]>{
  const {data}=await apiClient.get<ApiResponse<Array<{label:string;options:CustomerOption[]}>>>("/selects",{params:{selects:"customers"}});
  const options=data.data?.find(x=>x.label==="customers")?.options;
  if(!Array.isArray(options))throw Error("تعذّر تحميل قائمة العملاء.");
  return options;
}
export async function financeBalance(id:number):Promise<CustomerBalance>{
  const {data}=await apiClient.get<ApiResponse<CustomerBalance>>(`/finance/customers/${id}/balance`);
  return data.data;
}
export async function financeLedger(id:number,filters:AccountFilters):Promise<AccountLedger>{
  const params=new URLSearchParams({page:String(filters.page),perPage:"20"});
  if(filters.dateFrom)params.set("filter[dateFrom]",filters.dateFrom);
  if(filters.dateTo)params.set("filter[dateTo]",filters.dateTo);
  if(filters.type)params.set("filter[type]",filters.type);
  const {data}=await apiClient.get<ApiResponse<AccountLedger>>(`/finance/customers/${id}/ledger`,{params});
  if(!Array.isArray(data.data?.entries)||!data.data.pagination)throw Error("بيانات كشف الحساب غير صحيحة.");
  return data.data;
}
export async function financeOpening(id:number,payload:OpeningBalanceInput):Promise<void>{
  await apiClient.post<ApiResponse<null>>(`/finance/customers/${id}/opening-balance`,payload);
}
