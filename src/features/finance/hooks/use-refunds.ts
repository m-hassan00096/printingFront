import { useRef } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { createRefund,fetchRefund,fetchRefundCredit,fetchRefunds } from "../api/refunds.api";
import type { RefundFilters,RefundPayload } from "../types/refunds.types";

export const refundKeys={
  root:["finance","refunds"] as const,
  detail:(id:number)=>["finance","refunds","detail",id] as const,
  credit:(id:number)=>["finance","refundable-credit",id] as const,
};
export function useRefundList(filters:RefundFilters,enabled:boolean){
  return useQuery({queryKey:[...refundKeys.root,filters],queryFn:()=>fetchRefunds(filters),enabled});
}
export function useRefundDetails(id:number,enabled:boolean){
  return useQuery({queryKey:refundKeys.detail(id),queryFn:()=>fetchRefund(id),enabled:enabled&&id>0});
}
export function useRefundCredit(id:number,enabled:boolean){
  return useQuery({queryKey:refundKeys.credit(id),queryFn:()=>fetchRefundCredit(id),enabled:enabled&&id>0});
}
export function useCreateRefund(){
  const qc=useQueryClient();
  const keys=useRef(new Map<string,string>());
  return useMutation({
    mutationFn:async(payload:RefundPayload)=>{
      const fingerprint=JSON.stringify(payload);
      let key=keys.current.get(fingerprint);
      if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
      const created=await createRefund(payload,key);
      keys.current.delete(fingerprint);
      return created;
    },
    onSuccess:async(_,payload)=>{
      await Promise.all([
        qc.invalidateQueries({queryKey:refundKeys.root}),
        qc.invalidateQueries({queryKey:refundKeys.credit(payload.customerId)}),
        qc.invalidateQueries({queryKey:["finance","overview"]}),
        qc.invalidateQueries({queryKey:["finance","balance",payload.customerId]}),
        qc.invalidateQueries({queryKey:["finance","ledger",payload.customerId]}),
        qc.invalidateQueries({queryKey:["customers","balance",payload.customerId]}),
        qc.invalidateQueries({queryKey:["customers","ledger",payload.customerId]}),
      ]);
    },
  });
}
