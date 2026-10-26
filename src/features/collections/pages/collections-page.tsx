import { useEffect,useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye,Plus,RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { EmptyState,ErrorState,LoadingState,PaginationBar,SectionHeader,fieldClass } from "@/features/identity/components/identity-ui";
import { CreateCollectionDialog,CollectionDetailsDialog } from "../components/collection-dialogs";
import { useCollections,useCollectionsSummary } from "../hooks/use-collections";
import type { CollectionFilters } from "../types/collections.types";

const defaults:CollectionFilters={search:"",dateFrom:"",dateTo:"",paymentMethod:"",source:"",status:"",sort:"-id"};
export function CollectionsPage(){
  const qc=useQueryClient();
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const canView=permissions.includes("finance.collections.view");
  const canCreate=permissions.includes("finance.collections.create");
  const [filters,setFilters]=useState<CollectionFilters>(defaults);
  const [searchInput,setSearchInput]=useState("");
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
  function reset(){setSearchInput("");setFilters(defaults);}
  function done(){setCreating(false);setDetails(null);void qc.invalidateQueries({queryKey:["collections"]});}
  return <div className="space-y-4">
    <SectionHeader title="التحصيلات" detail="إدارة إيصالات تحصيل العملاء ومراجعة العمليات المعتمدة والمعكوسة."
      actions={<div className="flex gap-2">
        <Button variant="outline" onClick={()=>void qc.invalidateQueries({queryKey:["collections"]})}>
          <RefreshCw className="size-4"/> تحديث
        </Button>
        {canCreate&&<Button onClick={()=>setCreating(true)}><Plus className="size-4"/> تحصيل جديد</Button>}
      </div>}/>
    {canView&&summary.data&&<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {[
        ["إجمالي المحصل",summary.data.totalCollected],
        ["نقدي",summary.data.cashTotal],
        ["تحويلات بنكية",summary.data.bankTotal],
        ["محافظ إلكترونية",summary.data.walletTotal],
      ].map(([label,value])=><div key={label} className="rounded-xl border bg-card p-3 shadow-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-extrabold"><MoneyAmount amount={value}/></p>
      </div>)}
    </div>}
    {canView&&summary.isError&&<div className="rounded-xl border bg-card p-3"><ErrorState error={summary.error} retry={()=>void summary.refetch()}/></div>}
    {canView&&<section aria-label="فلاتر التحصيلات" className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <label className="block space-y-1 text-xs font-semibold">
          <span>البحث</span>
          <input className={fieldClass} maxLength={200} value={searchInput} onChange={e=>setSearchInput(e.target.value)}
            placeholder="إيصال، عميل، هاتف، رقم أوردر..."/>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>من تاريخ</span>
          <input type="date" aria-label="من تاريخ التحصيل" className={fieldClass} value={filters.dateFrom}
            max={filters.dateTo||undefined} onChange={e=>change("dateFrom",e.target.value)}/>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>إلى تاريخ</span>
          <input type="date" aria-label="إلى تاريخ التحصيل" className={fieldClass} value={filters.dateTo}
            min={filters.dateFrom||undefined} onChange={e=>change("dateTo",e.target.value)}/>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>طريقة الدفع</span>
          <select className={fieldClass} aria-label="فلتر طريقة الدفع" value={filters.paymentMethod}
            onChange={e=>change("paymentMethod",e.target.value)}>
            <option value="">كل الطرق</option>
            <option value="0">نقدي</option><option value="1">تحويل بنكي</option><option value="2">محفظة إلكترونية</option>
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>مصدر التحصيل</span>
          <select className={fieldClass} aria-label="فلتر المصدر" value={filters.source}
            onChange={e=>change("source",e.target.value)}>
            <option value="">كل المصادر</option>
            <option value="0">تحصيل عام</option><option value="1">مقدم أوردر</option><option value="2">عند التسليم</option>
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>الحالة</span>
          <select className={fieldClass} aria-label="فلتر الحالة" value={filters.status}
            onChange={e=>change("status",e.target.value)}>
            <option value="">كل الحالات</option><option value="1">معتمد</option><option value="2">معكوس</option>
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span>الترتيب</span>
          <select className={fieldClass} aria-label="ترتيب التحصيلات" value={filters.sort}
            onChange={e=>change("sort",e.target.value as CollectionFilters["sort"])}>
            <option value="-id">الأحدث تسجيلًا</option><option value="id">الأقدم تسجيلًا</option>
            <option value="-collectedOn">الأحدث تحصيلًا</option><option value="collectedOn">الأقدم تحصيلًا</option>
          </select>
        </label>
      </div>
      <Button variant="ghost" size="sm" onClick={reset}>مسح الفلاتر</Button>
    </section>}
    {!canView&&<p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">يمكنك تسجيل تحصيل جديد، لكن عرض سجل الإيصالات يحتاج صلاحية التحصيلات.</p>}
    {canView&&(list.isPending?<LoadingState/>:list.isError?<ErrorState error={list.error} retry={()=>void list.refetch()}/>:
      list.data?.collections.length?<section className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-right text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{["الإيصال","العميل","الهاتف","المبلغ","طريقة الدفع","المصدر","تاريخ التحصيل","الحالة",""].map((label,i)=>
                <th className="whitespace-nowrap px-3 py-3 font-bold" key={i}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {list.data.collections.map(c=><tr key={c.id} className="hover:bg-muted/30">
                <td className="px-3 py-3 font-bold" dir="ltr">{c.receiptNumber}</td>
                <td className="px-3 py-3">{c.customerName}</td>
                <td className="px-3 py-3" dir="ltr">{c.customerPhone}</td>
                <td className="px-3 py-3 font-bold"><MoneyAmount amount={c.amount}/></td>
                <td className="px-3 py-3">{c.paymentMethodLabel}</td>
                <td className="px-3 py-3">{c.sourceLabel}</td>
                <td className="px-3 py-3">{c.collectedOn}</td>
                <td className="px-3 py-3"><span className={"rounded-full px-2 py-1 text-xs font-bold "+(c.status===1?
                  "bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-800")}>{c.statusLabel}</span></td>
                <td className="px-3 py-3"><Button variant="outline" size="sm" onClick={()=>setDetails(c.id)}>
                  <Eye className="size-4"/> التفاصيل
                </Button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>:<EmptyState title="لا توجد إيصالات مطابقة" detail="غيّر البحث أو الفلاتر لعرض التحصيلات."/>) }
    {list.data?.pagination&&list.data.pagination.lastPage>1&&<div className="overflow-hidden rounded-2xl border bg-card">
      <PaginationBar pagination={list.data.pagination} onPage={setPage}/></div>}
    {list.data&&<p className="text-xs text-muted-foreground">
      عدد الإيصالات: {list.data.pagination.total.toLocaleString("ar-EG")} ·
      إجمالي المعتمد ضمن الفترة والفلاتر (بغض النظر عن فلتر الحالة): {summary.data?.collectionsCount??"—"}
    </p>}
    {creating&&<CreateCollectionDialog onClose={()=>setCreating(false)} onSuccess={done}/>}
    {details!==null&&<CollectionDetailsDialog key={details} id={details} onClose={()=>setDetails(null)} onSuccess={done}/>}
  </div>;
}
