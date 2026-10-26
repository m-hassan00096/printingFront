import { useEffect,useState } from "react";
import { Eye,Plus,RefreshCw,RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { EmptyState,ErrorState,LoadingState,PaginationBar } from "@/features/identity/components/identity-ui";
import { CollectionDateField,formatCollectionDate } from "@/features/collections/components/collection-date-field";
import { useRefundList } from "../hooks/use-refunds";
import { CreateRefundDialog,RefundDetailsDialog } from "./refund-dialogs";
import type { RefundFilters } from "../types/refunds.types";

const initial:RefundFilters={page:1,search:"",dateFrom:"",dateTo:"",paymentMethod:""};
const fieldClass="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
export function RefundsPanel({canView,canCreate,requestedCustomerId=0,onClearCustomer}:{
  canView:boolean;canCreate:boolean;requestedCustomerId?:number;onClearCustomer?:()=>void;
}){
  const queryClient=useQueryClient();
  const [filters,setFilters]=useState<RefundFilters>(initial);
  const [searchInput,setSearchInput]=useState("");
  const [creating,setCreating]=useState(requestedCustomerId>0&&canCreate);
  const [details,setDetails]=useState<number|null>(null);
  useEffect(()=>{
    const timeout=setTimeout(()=>setFilters(previous=>({...previous,search:searchInput.trim(),page:1})),350);
    return ()=>clearTimeout(timeout);
  },[searchInput]);
  const query=useRefundList(filters,canView);
  useEffect(()=>{
    if(query.data?.pagination.lastPage&&filters.page>query.data.pagination.lastPage){
      setFilters(old=>({...old,page:query.data!.pagination.lastPage}));
    }
  },[filters.page,query.data]);
  function change<K extends keyof RefundFilters>(name:K,value:RefundFilters[K]){
    setFilters(old=>({...old,[name]:value,page:1}));
  }
  function refresh(){void queryClient.invalidateQueries({queryKey:["finance"]});}
  function completed(){setCreating(false);onClearCustomer?.();refresh();}
  return <section className="space-y-3" aria-label="رد الأرصدة الدائنة">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-extrabold"><RotateCcw className="size-5 text-primary"/> رد الأرصدة الدائنة</h2>
        <p className="text-xs text-foreground/70">رد المبالغ المستحقة للعملاء وتوثيقها بحركة مالية دون تعديل الإيصالات الأصلية.</p>
      </div>
      <div className="flex items-center gap-2">
        {canView&&<Button type="button" size="sm" variant="outline" onClick={refresh}><RefreshCw className="size-4"/> تحديث</Button>}
        {canCreate&&<Button type="button" size="sm" onClick={()=>setCreating(true)}><Plus className="size-4"/> رد رصيد دائن</Button>}
      </div>
    </div>
    {canView?<div className="grid gap-2.5 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-xs font-semibold"><span>بحث بالعميل أو رقم المستند أو الهاتف</span>
        <input className={fieldClass} aria-label="بحث في المبالغ المرتجعة" value={searchInput} maxLength={200}
          onChange={e=>setSearchInput(e.target.value)} placeholder="بحث..."/>
      </label>
      <CollectionDateField label="من تاريخ رد الرصيد" value={filters.dateFrom} max={filters.dateTo||undefined}
        onChange={dateFrom=>change("dateFrom",dateFrom)}/>
      <CollectionDateField label="إلى تاريخ رد الرصيد" value={filters.dateTo} min={filters.dateFrom||undefined}
        onChange={dateTo=>change("dateTo",dateTo)}/>
      <label className="space-y-1 text-xs font-semibold"><span>طريقة رد الأموال</span>
        <select className={fieldClass} aria-label="فلتر طريقة رد الأموال" value={filters.paymentMethod}
          onChange={e=>change("paymentMethod",e.target.value as RefundFilters["paymentMethod"])}>
          <option value="">جميع الطرق</option><option value="0">نقدي</option><option value="1">تحويل بنكي</option><option value="2">محفظة إلكترونية</option>
        </select>
      </label>
    </div>:<p className="rounded-xl border bg-card p-4 text-sm text-foreground/70">
      يمكنك تسجيل رد رصيد دائن، لكن سجل العمليات يحتاج صلاحية عرض المبالغ المرتجعة.
    </p>}
    {canView&&(query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:
      query.data?.refunds.length?<div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-bold">سجل المبالغ المرتجعة</h3>
          <span className="text-xs text-foreground/70">{query.data.pagination.total.toLocaleString("ar-EG")} عملية</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm">
          <thead className="bg-muted/60 text-xs text-foreground/70">
            <tr>{["المستند","العميل","المبلغ","طريقة الرد","جهة الصرف","تاريخ الرد","الإجراء"].map(name=>
              <th key={name} className="px-3 py-3 font-bold">{name}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {query.data.refunds.map(r=><tr key={r.id} className="hover:bg-muted/30">
              <td className="whitespace-nowrap px-3 py-3 font-bold tabular-nums" dir="ltr">{r.refundNumber}</td>
              <td className="px-3 py-3 font-semibold">{r.customerName}</td>
              <td className="px-3 py-3 font-bold"><MoneyAmount amount={r.amount}/></td>
              <td className="px-3 py-3">{r.paymentMethodLabel}</td>
              <td className="px-3 py-3">{r.destinationLabel??"نقدي"}</td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatCollectionDate(r.refundedOn)}</td>
              <td className="px-3 py-3"><Button size="sm" variant="outline" onClick={()=>setDetails(r.id)}>
                <Eye className="size-4"/> التفاصيل
              </Button></td>
            </tr>)}
          </tbody>
        </table></div>
      </div>:<EmptyState title="لا توجد عمليات رد مطابقة" detail="ستظهر هنا عمليات رد الأرصدة بعد تسجيلها." />)}
    {canView&&query.data&&query.data.pagination.lastPage>1&&<div className="rounded-xl border bg-card">
      <PaginationBar pagination={query.data.pagination} onPage={page=>setFilters(old=>({...old,page}))}/>
    </div>}
    {canCreate&&creating&&<CreateRefundDialog initialCustomerId={requestedCustomerId} onClose={()=>{setCreating(false);onClearCustomer?.();}} onSuccess={completed}/>}
    {canView&&details!==null&&<RefundDetailsDialog id={details} onClose={()=>setDetails(null)}/>}
  </section>;
}
