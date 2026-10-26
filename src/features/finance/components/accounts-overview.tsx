import { useEffect,useState } from "react";
import { ArrowUpLeft, Search, UsersRound } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { ErrorState,EmptyState,LoadingState,PaginationBar } from "@/features/identity/components/identity-ui";
import { useAccountOverview } from "../hooks/use-finance";
import type { AccountOverviewFilters } from "../types/finance.types";

const initial:AccountOverviewFilters={page:1,search:"",type:"",sort:"-id"};
export function AccountsOverview({onOpen}:{onOpen:(customerId:number)=>void}){
  const [filters,setFilters]=useState<AccountOverviewFilters>(initial);
  const [draftSearch,setDraftSearch]=useState("");
  useEffect(()=>{
    const timer=setTimeout(()=>setFilters(previous=>({...previous,search:draftSearch.trim(),page:1})),350);
    return ()=>clearTimeout(timer);
  },[draftSearch]);
  const query=useAccountOverview(filters,true);
  const data=query.data;
  useEffect(()=>{
    if(data?.pagination.lastPage&&filters.page>data.pagination.lastPage)
      setFilters(previous=>({...previous,page:data.pagination.lastPage}));
  },[data,filters.page]);
  function change<K extends keyof AccountOverviewFilters>(key:K,value:AccountOverviewFilters[K]){
    setFilters(previous=>({...previous,[key]:value,page:1}));
  }
  const input="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
  return <div className="space-y-3" aria-label="قائمة أرصدة العملاء">
    <div className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <UsersRound className="size-4 text-primary"/><h2 className="text-sm font-extrabold">أرصدة العملاء</h2>
        <p className="text-xs text-foreground/65">الأرصدة محسوبة من دفتر الأستاذ مباشرة</p>
      </div>
      <div className="grid gap-2.5 md:grid-cols-3">
        <label className="block space-y-1 text-xs font-semibold">
          <span>بحث بالاسم أو الهاتف</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
            <input value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}
              aria-label="بحث في حسابات العملاء" maxLength={200} placeholder="اسم العميل أو رقم الهاتف..."
              className={input+" pr-9"}/>
          </span>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>نوع الرصيد</span>
          <select className={input} aria-label="فلتر نوع الرصيد" value={filters.type}
            onChange={e=>change("type",e.target.value as AccountOverviewFilters["type"])}>
            <option value="">جميع الأرصدة</option><option value="1">مدين</option>
            <option value="2">دائن</option><option value="0">متوازن</option>
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>الترتيب</span>
          <select className={input} aria-label="ترتيب حسابات العملاء" value={filters.sort}
            onChange={e=>change("sort",e.target.value as AccountOverviewFilters["sort"])}>
            <option value="-id">الأحدث</option><option value="id">الأقدم</option>
            <option value="name">الاسم أ–ي</option><option value="-name">الاسم ي–أ</option>
            <option value="-balance">أعلى مديونية</option><option value="balance">أعلى رصيد دائن</option>
          </select>
        </label>
      </div>
    </div>
    {query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:
      data?.accounts.length?<section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-bold">قائمة الحسابات</h3>
          <span className="text-xs font-semibold text-foreground/70">{data.pagination.total.toLocaleString("ar-EG")} عميل</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-right text-sm">
          <thead className="bg-muted/50 text-xs text-foreground/70"><tr>
            {["العميل","الهاتف","حالة الرصيد","قيمة الرصيد","الرصيد الافتتاحي",""].map((name,i)=>
              <th key={i} className="px-3 py-3 font-bold">{name}</th>)}
          </tr></thead>
          <tbody className="divide-y">
            {data.accounts.map(account=><tr key={account.customerId} className="hover:bg-muted/30">
              <td className="px-3 py-3 font-semibold">{account.customerName}</td>
              <td className="px-3 py-3 tabular-nums" dir="ltr">{account.customerPhone}</td>
              <td className="px-3 py-3"><span className={"rounded-lg px-2 py-1 text-xs font-bold "+
                (account.type===1?"bg-rose-50 text-rose-700":account.type===2?"bg-emerald-50 text-emerald-700":"bg-muted text-foreground/75")}>
                {account.typeLabel}
              </span></td>
              <td className="px-3 py-3 font-bold tabular-nums"><MoneyAmount amount={account.amount}/></td>
              <td className="px-3 py-3 text-xs text-foreground/70">{account.openingBalanceExists?"مسجل":"لم يُسجّل"}</td>
              <td className="px-3 py-3">
                <Button type="button" size="sm" variant="outline" onClick={()=>onOpen(account.customerId)}>
                  كشف الحساب <ArrowUpLeft className="size-4"/>
                </Button>
              </td>
            </tr>)}
          </tbody>
        </table></div>
      </section>:<EmptyState title="لا توجد حسابات مطابقة" detail="جرّب تغيير البحث أو فلتر نوع الرصيد."/>}
    {data&&data.pagination.lastPage>1&&<div className="rounded-xl border bg-card">
      <PaginationBar pagination={data.pagination} onPage={page=>setFilters(old=>({...old,page}))}/>
    </div>}
  </div>;
}
