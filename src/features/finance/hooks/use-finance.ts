import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { financeCustomers,financeBalance,financeLedger,financeOpening } from "../api/finance.api";
import type { AccountFilters,OpeningBalanceInput } from "../types/finance.types";

export const financeKeys={
  customers:["finance","customers"] as const,
  balance:(id:number)=>["finance","balance",id] as const,
  ledger:(id:number)=>["finance","ledger",id] as const,
};
export function useFinanceCustomers(){
  return useQuery({queryKey:financeKeys.customers,queryFn:financeCustomers,staleTime:60_000});
}
export function useFinanceBalance(id:number,enabled:boolean){
  return useQuery({queryKey:financeKeys.balance(id),queryFn:()=>financeBalance(id),enabled:enabled&&id>0});
}
export function useFinanceLedger(id:number,filters:AccountFilters,enabled:boolean){
  return useQuery({queryKey:[...financeKeys.ledger(id),filters],queryFn:()=>financeLedger(id,filters),enabled:enabled&&id>0});
}
export function useOpeningBalance(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn:({id,payload}:{id:number;payload:OpeningBalanceInput})=>financeOpening(id,payload),
    onSuccess:async(_,variables)=>{
      const id=variables.id;
      await Promise.all([
        qc.invalidateQueries({queryKey:financeKeys.balance(id)}),
        qc.invalidateQueries({queryKey:financeKeys.ledger(id)}),
        qc.invalidateQueries({queryKey:["customers","balance",id]}),
        qc.invalidateQueries({queryKey:["customers","ledger",id]}),
      ]);
    },
  });
}
