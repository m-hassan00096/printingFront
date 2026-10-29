import { useEffect,useState } from "react";
import { Eye, History } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { EmptyState,ErrorState,LoadingState,PaginationBar } from "@/features/identity/components/identity-ui";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { uiMessages } from "@/shared/translations/ar/ui";
import { useRefundList } from "../hooks/use-refunds";
import { RefundDetailsDialog } from "./refund-dialogs";
import type { RefundFilters } from "../types/refunds.types";

const initial:RefundFilters={page:1,search:"",dateFrom:"",dateTo:"",paymentMethod:""};
const fieldClass="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
export function RefundsPanel({customerId}:{customerId?:number}){
  const copy=uiMessages.financeAccounts;
  const [filters,setFilters]=useState<RefundFilters>({...initial,customerId});
  const [searchInput,setSearchInput]=useState("");
  const [details,setDetails]=useState<number|null>(null);
  useEffect(()=>{
    const timeout=setTimeout(()=>setFilters(previous=>({...previous,search:searchInput.trim(),page:1})),350);
    return ()=>clearTimeout(timeout);
  },[searchInput]);
  const query=useRefundList(filters,true);
  useEffect(()=>{
    if(query.data?.pagination.lastPage&&filters.page>query.data.pagination.lastPage){
      setFilters(old=>({...old,page:query.data!.pagination.lastPage}));
    }
  },[filters.page,query.data]);
  function change<K extends keyof RefundFilters>(name:K,value:RefundFilters[K]){
    setFilters(old=>({...old,[name]:value,page:1}));
  }
  return <section className="space-y-3" aria-label="رد الأرصدة الدائنة">
    <div className="flex items-center gap-2">
      <History className="size-4 text-primary"/>
      <h2 className="text-sm font-bold">{customerId?copy.customerRefundsTitle:copy.globalRefundsTitle}</h2>
    </div>
    <div className="grid gap-2.5 rounded-lg border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
      {!customerId&&<label className="space-y-1 text-xs font-semibold"><span>بحث بالعميل أو رقم المستند أو الهاتف</span>
        <input className={fieldClass} aria-label="بحث في المبالغ المرتجعة" value={searchInput} maxLength={200}
          onChange={e=>setSearchInput(e.target.value)} placeholder="بحث..."/>
      </label>}
      <CreatedDatePicker label="من تاريخ رد الرصيد" value={filters.dateFrom} max={filters.dateTo||undefined}
        onChange={dateFrom=>change("dateFrom",dateFrom)}/>
      <CreatedDatePicker label="إلى تاريخ رد الرصيد" value={filters.dateTo} min={filters.dateFrom||undefined}
        onChange={dateTo=>change("dateTo",dateTo)}/>
      <label className="space-y-1 text-xs font-semibold"><span>طريقة رد الأموال</span>
        <select className={fieldClass} aria-label="فلتر طريقة رد الأموال" value={filters.paymentMethod}
          onChange={e=>change("paymentMethod",e.target.value as RefundFilters["paymentMethod"])}>
          <option value="">جميع الطرق</option><option value="0">نقدي</option><option value="1">تحويل بنكي</option><option value="2">محفظة إلكترونية</option>
        </select>
      </label>
    </div>
    {query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:
      query.data?.refunds.length?<div className="overflow-hidden rounded-lg border bg-card">
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
      </div>:<EmptyState title="لا توجد عمليات رد مطابقة" detail="ستظهر هنا عمليات رد الأرصدة بعد تسجيلها." />}
    {query.data&&query.data.pagination.lastPage>1&&<div className="rounded-lg border bg-card">
      <PaginationBar pagination={query.data.pagination} onPage={page=>setFilters(old=>({...old,page}))}/>
    </div>}
    {details!==null&&<RefundDetailsDialog id={details} onClose={()=>setDetails(null)}/>}
  </section>;
}
