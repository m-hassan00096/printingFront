import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { EmptyState,ErrorState,LoadingState,PaginationBar,SectionHeader } from "@/features/identity/components/identity-ui";
import { CreateCollectionDialog,CollectionDetailsDialog } from "../components/collection-dialogs";
import { formatCollectionDate } from "../components/collection-date-field";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { useCollections,useCollectionsSummary } from "../hooks/use-collections";
import type { CollectionFilters } from "../types/collections.types";

const defaults:CollectionFilters={search:"",dateFrom:"",dateTo:"",paymentMethod:"",source:"",status:"",sort:"-id"};
const compactFieldClass="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20";
export function CollectionsPage(){
  const qc=useQueryClient();
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const canView=permissions.includes("finance.collections.view");
  const canCreate=permissions.includes("finance.collections.create");
  const canViewOrders=permissions.includes("orders.view");
  const [filters,setFilters]=useState<CollectionFilters>(defaults);
  const [searchInput,setSearchInput]=useState("");
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [page,setPage]=useState(1);
  const [creating,setCreating]=useState(false);
  const [details,setDetails]=useState<number|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>setFilters(p=>({...p,search:searchInput.trim()})),350);return()=>clearTimeout(timer);},[searchInput]);
  useEffect(()=>setPage(1),[filters]);
  const list=useCollections(filters,page,canView);
  const summary=useCollectionsSummary(filters,canView);
  useEffect(()=>{
    if(list.data&&list.data.pagination.lastPage>0&&page>list.data.pagination.lastPage)
      setPage(list.data.pagination.lastPage);
  },[list.data,page]);
  function change<K extends keyof CollectionFilters>(key:K,value:CollectionFilters[K]){
    setFilters(old=>({...old,[key]:value}));
  }
  const advancedCount=Number(Boolean(filters.source))+Number(Boolean(filters.status))+Number(filters.sort!=="-id");
  const hasFilters=Boolean(searchInput||filters.search||filters.dateFrom||filters.dateTo||filters.paymentMethod||advancedCount);
  function reset(){setSearchInput("");setFilters(defaults);setAdvancedOpen(false);}
  function done(){setCreating(false);setDetails(null);void qc.invalidateQueries({queryKey:["collections"]});}
  return <div className="space-y-4">
    <SectionHeader title="التحصيلات" detail="إدارة إيصالات تحصيل العملاء ومراجعة العمليات المعتمدة والمعكوسة."
      actions={<div className="flex gap-2">
        <Button variant="outline" onClick={()=>void qc.invalidateQueries({queryKey:["collections"]})}>
          <RefreshCw className="size-4"/> تحديث
        </Button>
        {canCreate&&<Button onClick={()=>setCreating(true)}><Plus className="size-4"/> تحصيل جديد</Button>}
      </div>}/>
    {canView&&summary.data&&<section className="space-y-2" aria-label="ملخص التحصيلات المعتمدة">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-bold text-foreground">ملخص التحصيلات المعتمدة فقط</h3>
        <p className="text-xs font-medium text-foreground/70">يشمل الفلاتر الحالية باستثناء الحالة · لا يحتسب الإيصالات المعكوسة.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["إجمالي المعتمد",summary.data.totalCollected],
          ["نقدي",summary.data.cashTotal],
          ["تحويلات بنكية",summary.data.bankTotal],
          ["محافظ إلكترونية",summary.data.walletTotal],
        ].map(([label,value])=><div key={label} className="rounded-xl border bg-card p-3 ">
          <p className="text-xs font-medium text-foreground/70">{label}</p>
          <p className="mt-1 text-base font-semibold"><MoneyAmount amount={value}/></p>
        </div>)}
      </div>
    </section>}
    {canView&&summary.isError&&<div className="rounded-xl border bg-card p-3"><ErrorState error={summary.error} retry={()=>void summary.refetch()}/></div>}
    {canView&&<section aria-label="فلاتر التحصيلات" className="space-y-2.5 rounded-lg border bg-card p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <SlidersHorizontal className="size-4 text-muted-foreground"/> الفلاتر
        </h3>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="ghost" disabled={!hasFilters} onClick={reset}>مسح الفلاتر</Button>
          <Button type="button" size="sm" variant="outline" aria-expanded={advancedOpen}
            aria-controls="collections-advanced-filters" onClick={()=>setAdvancedOpen(v=>!v)}>
            فلاتر إضافية{advancedCount>0?` (${advancedCount})`:""}
            <ChevronDown className={`size-4 transition-transform ${advancedOpen?"rotate-180":""}`}/>
          </Button>
        </div>
      </header>
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <label className="block min-w-0 space-y-1 text-xs font-semibold">
          <span className="text-foreground/80">البحث</span>
          <input className={compactFieldClass} maxLength={200} value={searchInput} onChange={e=>setSearchInput(e.target.value)}
            aria-label="البحث في التحصيلات" placeholder="إيصال، عميل، هاتف، رقم أوردر..."/>
        </label>
        <CreatedDatePicker label="من تاريخ التحصيل" value={filters.dateFrom}
          max={filters.dateTo||undefined} onChange={value=>change("dateFrom",value)}/>
        <CreatedDatePicker label="إلى تاريخ التحصيل" value={filters.dateTo}
          min={filters.dateFrom||undefined} onChange={value=>change("dateTo",value)}/>
        <label className="block min-w-0 space-y-1 text-xs font-semibold">
          <span className="text-foreground/80">طريقة الدفع</span>
          <select className={compactFieldClass} aria-label="فلتر طريقة الدفع" value={filters.paymentMethod}
            onChange={e=>change("paymentMethod",e.target.value)}>
            <option value="">كل الطرق</option>
            <option value="0">نقدي</option><option value="1">تحويل بنكي</option><option value="2">محفظة إلكترونية</option>
          </select>
        </label>
      </div>
      {advancedOpen&&<div id="collections-advanced-filters" className="grid gap-2.5 border-t pt-2.5 md:grid-cols-2 xl:grid-cols-3">
        <label className="block min-w-0 space-y-1 text-xs font-semibold">
          <span className="text-foreground/80">مصدر التحصيل</span>
          <select className={compactFieldClass} aria-label="فلتر المصدر" value={filters.source}
            onChange={e=>change("source",e.target.value)}>
            <option value="">كل المصادر</option>
            <option value="0">تحصيل عام</option><option value="1">مقدم أوردر</option><option value="2">عند التسليم</option>
          </select>
        </label>
        <label className="block min-w-0 space-y-1 text-xs font-semibold">
          <span className="text-foreground/80">الحالة</span>
          <select className={compactFieldClass} aria-label="فلتر الحالة" value={filters.status}
            onChange={e=>change("status",e.target.value)}>
            <option value="">كل الحالات</option><option value="1">معتمد</option><option value="2">معكوس</option>
          </select>
        </label>
        <label className="block min-w-0 space-y-1 text-xs font-semibold">
          <span className="text-foreground/80">الترتيب</span>
          <select className={compactFieldClass} aria-label="ترتيب التحصيلات" value={filters.sort}
            onChange={e=>change("sort",e.target.value as CollectionFilters["sort"])}>
            <option value="-id">الأحدث تسجيلًا</option><option value="id">الأقدم تسجيلًا</option>
            <option value="-collectedOn">الأحدث تحصيلًا</option><option value="collectedOn">الأقدم تحصيلًا</option>
          </select>
        </label>
      </div>}
    </section>}
    {!canView&&<p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">يمكنك تسجيل تحصيل جديد، لكن عرض سجل الإيصالات يحتاج صلاحية التحصيلات.</p>}
    {canView&&(list.isPending?<LoadingState/>:list.isError?<ErrorState error={list.error} retry={()=>void list.refetch()}/>:
      list.data?.collections.length?<section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
          <h3 className="text-sm font-bold">سجل الإيصالات</h3>
          <span className="text-xs font-semibold text-foreground/70">
            {list.data.pagination.total.toLocaleString("ar-EG")} إيصال
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-right text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{["الإيصال","العميل","الهاتف","المبلغ","طريقة الدفع","المصدر","رقم الأوردر","تاريخ التحصيل","الحالة","الإجراء"].map((label,i)=>
                <th className="whitespace-nowrap px-3 py-2.5 font-bold text-foreground/75" key={i}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {list.data.collections.map(c=><tr key={c.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-bold"><span dir="ltr" className="inline-block tabular-nums">{c.receiptNumber}</span></td>
                <td className="px-3 py-2.5">{c.customerName}</td>
                <td className="px-3 py-2.5"><span dir="ltr" className="inline-block tabular-nums">{c.customerPhone}</span></td>
                <td className="px-3 py-2.5"><MoneyAmount amount={c.amount} className={c.status===2?"font-semibold text-foreground/60":"font-bold text-foreground"}/></td>
                <td className="px-3 py-2.5">{c.paymentMethodLabel}</td>
                <td className="px-3 py-2.5">{c.sourceLabel}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {c.source!==0&&c.orderNumber ? (canViewOrders&&c.orderId ?
                    <Link to={`/orders/${c.orderId}`} dir="ltr" className="inline-block font-semibold text-primary underline">{c.orderNumber}</Link> :
                    <span dir="ltr" className="inline-block">{c.orderNumber}</span>) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5"><span dir="ltr" className="inline-block tabular-nums">{formatCollectionDate(c.collectedOn)}</span></td>
                <td className="px-3 py-2.5"><span className={"rounded-full px-2 py-1 text-xs font-bold "+(c.status===1?
                  "bg-[#e5f7ee] text-[#147c58]":"bg-[#fff5df] text-[#a36a0d]")}>{c.statusLabel}</span></td>
                <td className="whitespace-nowrap px-2 py-2.5"><Button variant="outline" size="sm" className="h-8 gap-1 px-2" onClick={()=>setDetails(c.id)}>
                  <Eye className="size-4"/> التفاصيل
                </Button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>:<EmptyState title="لا توجد إيصالات مطابقة" detail="غيّر البحث أو الفلاتر لعرض التحصيلات."/>) }
    {list.data?.pagination&&list.data.pagination.lastPage>1&&<div className="overflow-hidden rounded-lg border bg-card">
      <PaginationBar pagination={list.data.pagination} onPage={setPage}/></div>}

    {creating&&<CreateCollectionDialog onClose={()=>setCreating(false)} onSuccess={done}/>}
    {details!==null&&<CollectionDetailsDialog key={details} id={details} onClose={()=>setDetails(null)} onSuccess={done}/>}
  </div>;
}
