import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { Collection, CollectionCreated, CollectionFilters, CollectionPage, CollectionSummary, CreateCollectionPayload, SelectOption } from "../types/collections.types";

const root="/finance/collections";
function filtersToParams(filters:CollectionFilters, page?:number, summary=false):URLSearchParams {
  const params=new URLSearchParams();
  if(!summary){params.set("sort",filters.sort);params.set("page",String(page??1));params.set("perPage","20");}
  const keys: (keyof CollectionFilters)[]=["search","dateFrom","dateTo","paymentMethod","source",...(summary?[]:["status"])];
  for(const key of keys){const value=filters[key];if(value)params.set("filter["+key+"]",value);}
  return params;
}
export async function getCollections(filters:CollectionFilters,page:number):Promise<CollectionPage>{
  const {data}=await apiClient.get<ApiResponse<CollectionPage>>(root,{params:filtersToParams(filters,page)});
  if(!Array.isArray(data.data?.collections)||!data.data.pagination)throw Error("استجابة التحصيلات غير صحيحة.");
  return data.data;
}
export async function getCollectionSummary(filters:CollectionFilters):Promise<CollectionSummary>{
  const {data}=await apiClient.get<ApiResponse<CollectionSummary>>(root+"/summary",{params:filtersToParams(filters,undefined,true)});
  return data.data;
}
export async function getCollection(id:number):Promise<Collection>{
  const {data}=await apiClient.get<ApiResponse<Collection>>(root+"/"+id);
  return data.data;
}
export async function addCollection(payload:CreateCollectionPayload,key:string):Promise<CollectionCreated>{
  const {data}=await apiClient.post<ApiResponse<CollectionCreated>>(root,payload,{headers:{"Idempotency-Key":key}});
  return data.data;
}
export async function reverseCollection(id:number,reason:string,key:string):Promise<void>{
  await apiClient.post<ApiResponse<null>>(root+"/"+id+"/reverse",{reason},{headers:{"Idempotency-Key":key}});
}
export async function getCollectionCustomers():Promise<SelectOption[]>{
  const {data}=await apiClient.get<ApiResponse<{label:string;options:SelectOption[]}[]>>("/selects",{params:{selects:"customers"}});
  const options=data.data?.find(x=>x.label==="customers")?.options;
  if(!Array.isArray(options))throw Error("قائمة العملاء غير متاحة.");
  return options;
}
