import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { financeCustomers,financeBalance,financeLedger,financeOpening,financeAccountOverview,financeOpeningStatus } from "../api/finance.api";
import type { AccountFilters,AccountOverviewFilters,OpeningBalanceInput } from "../types/finance.types";

export const financeKeys={
  customers:["finance","customers"] as const,
  balance:(id:number)=>["finance","balance",id] as const,
  ledger:(id:number)=>["finance","ledger",id] as const,
  overview:["finance","overview"] as const,
  opening:(id:number)=>["finance","opening-status",id] as const,
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
export function useAccountOverview(filters:AccountOverviewFilters,enabled:boolean){
  return useQuery({queryKey:[...financeKeys.overview,filters],queryFn:()=>financeAccountOverview(filters),enabled});
}
export function useFinanceOpeningStatus(id:number,enabled:boolean){
  return useQuery({queryKey:financeKeys.opening(id),queryFn:()=>financeOpeningStatus(id),enabled:enabled&&id>0});
}
export function useOpeningBalance(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn:({id,payload}:{id:number;payload:OpeningBalanceInput})=>financeOpening(id,payload),
    onSuccess:async(_,variables)=>{
      const id=variables.id;
      await Promise.all([
        qc.invalidateQueries({queryKey:financeKeys.balance(id)}),
        qc.invalidateQueries({queryKey:financeKeys.opening(id)}),
        qc.invalidateQueries({queryKey:financeKeys.overview}),
        qc.invalidateQueries({queryKey:financeKeys.ledger(id)}),
        qc.invalidateQueries({queryKey:["customers","balance",id]}),
        qc.invalidateQueries({queryKey:["customers","ledger",id]}),
      ]);
    },
  });
}
