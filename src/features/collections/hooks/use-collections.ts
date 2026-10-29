import { useRef } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import * as api from "../api/collections.api";
import type { CollectionFilters,CreateCollectionPayload,CorrectCollectionPayload } from "../types/collections.types";

export const collectionKeys={
  root:["collections"] as const,
  list:["collections","list"] as const,
  summary:["collections","summary"] as const,
  detail:(id:number)=>["collections","detail",id] as const,
};
export function useCollections(filters:CollectionFilters,page:number,enabled:boolean){
  return useQuery({queryKey:[...collectionKeys.list,filters,page],queryFn:()=>api.getCollections(filters,page),enabled});
}
export function useCollectionsSummary(filters:CollectionFilters,enabled:boolean){
  return useQuery({queryKey:[...collectionKeys.summary,{search:filters.search,dateFrom:filters.dateFrom,dateTo:filters.dateTo,paymentMethod:filters.paymentMethod,source:filters.source}],queryFn:()=>api.getCollectionSummary(filters),enabled});
}
export function useCollection(id:number){
  return useQuery({queryKey:collectionKeys.detail(id),queryFn:()=>api.getCollection(id),enabled:id>0});
}
export function useCollectionCustomers(enabled:boolean){
  return useQuery({queryKey:["collections","customers"],queryFn:api.getCollectionCustomers,enabled,staleTime:60_000});
}
export function useCollectionActions(){
  const qc=useQueryClient();
  const keys=useRef(new Map<string,string>());
  const keyFor=(fingerprint:string)=>{
    const previous=keys.current.get(fingerprint);
    if(previous)return previous;
    const value=crypto.randomUUID();keys.current.set(fingerprint,value);return value;
  };
  const refresh=async()=>{
    await Promise.all([
      qc.invalidateQueries({queryKey:collectionKeys.root}),
      qc.invalidateQueries({queryKey:["finance"]}),
      qc.invalidateQueries({queryKey:["customers"]}),
      qc.invalidateQueries({queryKey:["orders"]}),
      qc.invalidateQueries({queryKey:["deliveries"]}),
    ]);
  };
  const create=useMutation({mutationFn:async(payload:CreateCollectionPayload)=>{
    const fingerprint="create:"+JSON.stringify(payload);
    const result=await api.addCollection(payload,keyFor(fingerprint));keys.current.delete(fingerprint);return result;
  },onSuccess:refresh});
  const reverse=useMutation({mutationFn:async({id,reason}:{id:number;reason:string})=>{
    const fingerprint="reverse:"+id+":"+reason;
    await api.reverseCollection(id,reason,keyFor(fingerprint));keys.current.delete(fingerprint);
  },onSuccess:refresh});
  const correct=useMutation({mutationFn:async({id,payload}:{id:number;payload:CorrectCollectionPayload})=>{
    const fingerprint="correct:"+id+":"+JSON.stringify(payload);
    const result=await api.correctCollection(id,payload,keyFor(fingerprint));keys.current.delete(fingerprint);return result;
  },onSuccess:refresh});
  return {create,reverse,correct};
}
