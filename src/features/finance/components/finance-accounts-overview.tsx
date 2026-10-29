import { useEffect,useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { EmptyState,ErrorState,LoadingState,PaginationBar } from "@/features/identity/components/identity-ui";
import { uiMessages } from "@/shared/translations/ar/ui";
import { useFinanceAccounts } from "../hooks/use-finance";
import type { AccountListFilters } from "../types/finance.types";

const copy=uiMessages.financeAccounts;
const initial:AccountListFilters={search:"",type:"",sort:"-balance",page:1};
const inputClass="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20";

export function FinanceAccountsOverview({onSelect}:{onSelect:(id:number)=>void}){
  const [filters,setFilters]=useState<AccountListFilters>(initial);
  const [search,setSearch]=useState("");
  const query=useFinanceAccounts(filters,true);
  useEffect(()=>{
    const timer=setTimeout(()=>setFilters(p=>({...p,search:search.trim(),page:1})),350);
    return ()=>clearTimeout(timer);
  },[search]);
  useEffect(()=>{
    if(query.data?.pagination.lastPage&&filters.page>query.data.pagination.lastPage)
      setFilters(p=>({...p,page:query.data!.pagination.lastPage}));
  },[filters.page,query.data]);
  const hasFilters=Boolean(search||filters.search||filters.type||filters.sort!==initial.sort);
  return <section aria-label={copy.accountsTitle} className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div><h2 className="font-bold">{copy.accountsTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{copy.accountsHint}</p></div>
    </div>
    <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-3">
      <label className="space-y-1 text-xs font-semibold">
        <span>{copy.accountsSearch}</span>
        <input className={inputClass} aria-label={copy.accountsSearch} value={search} maxLength={200}
          onChange={e=>setSearch(e.target.value)} placeholder={copy.accountsSearch}/>
      </label>
      <label className="space-y-1 text-xs font-semibold">
        <span>{copy.accountStatus}</span>
        <select aria-label={copy.accountStatus} className={inputClass} value={filters.type}
          onChange={e=>setFilters(p=>({...p,type:e.target.value,page:1}))}>
          <option value="">{copy.allStatuses}</option>
          <option value="1">{copy.debitOnly}</option><option value="2">{copy.creditOnly}</option>
          <option value="0">{copy.settledOnly}</option>
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold">
        <span>{copy.sortBy}</span>
        <select aria-label={copy.sortBy} className={inputClass} value={filters.sort}
          onChange={e=>setFilters(p=>({...p,sort:e.target.value as AccountListFilters["sort"],page:1}))}>
          <option value="-balance">{copy.highestDebt}</option>
          <option value="balance">{copy.largestCredit}</option>
          <option value="-id">{copy.newest}</option><option value="name">{copy.nameOrder}</option>
        </select>
      </label>
      {hasFilters&&<div className="md:col-span-3">
        <Button size="sm" variant="ghost" onClick={()=>{setFilters(initial);setSearch("");}}>{copy.clearFilters}</Button>
      </div>}
    </div>
    {query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:
      query.data?.accounts.length?<div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <h3 className="text-sm font-bold">{copy.accountsTitle}</h3>
          <span className="text-xs text-muted-foreground">{query.data.pagination.total.toLocaleString("ar-EG")} {copy.customer}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-right text-sm">
            <thead className="bg-muted/60 text-xs text-foreground/70"><tr>
              {[copy.customer,copy.phone,copy.currentBalance,copy.opening,copy.actions].map(x=>
                <th key={x} className="px-3 py-3 font-bold">{x}</th>)}
            </tr></thead>
            <tbody className="divide-y">{query.data.accounts.map(account=>
              <tr key={account.customerId} className="hover:bg-muted/30">
                <td className="px-3 py-3 font-semibold">{account.customerName}</td>
                <td className="px-3 py-3"><span dir="ltr" className="inline-block tabular-nums">{account.customerPhone}</span></td>
                <td className={"whitespace-nowrap px-3 py-3 font-semibold "+(account.type===1?"text-destructive":account.type===2?"text-emerald-700":"")}>
                  {account.typeLabel} · <MoneyAmount amount={account.amount}/>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {account.openingBalanceExists?copy.openingRecorded:copy.openingMissing}
                </td>
                <td className="px-3 py-3"><Button type="button" size="sm" variant="outline"
                  onClick={()=>onSelect(account.customerId)}>{copy.viewAccount}</Button></td>
              </tr>)}</tbody>
          </table>
        </div>
      </div>:<EmptyState title={copy.noAccounts} detail={copy.noAccountsHint}/>}
    {query.data&&query.data.pagination.lastPage>1&&
      <PaginationBar pagination={query.data.pagination} onPage={page=>setFilters(p=>({...p,page}))}/>}
  </section>;
}
