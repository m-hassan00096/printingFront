import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, Eye, RefreshCw, Truck } from "lucide-react";
import { CreatedDatePicker, cairoTodayISO } from "@/features/orders/components/created-date-picker";
import { formatCollectionDate } from "@/features/collections/components/collection-date-field";
import { uiMessages } from "@/shared/translations/ar/ui";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { getDeliveryCustomerOptions } from "../api/deliveries.api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { EmptyState, ErrorState, LoadingState, PaginationBar, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { DeliverOrderDialog, DeliveryDetailsDialog } from "../components/delivery-dialogs";
import { useReadyOrders, useDeliveryHistory } from "../hooks/use-deliveries";
import type { HistoryFilters, ReadyFilters, ReadyOrder } from "../types/deliveries.types";

const defaultReady: ReadyFilters = { search:"", customerId:null, sort:"dueDate" };
const defaultHistory: HistoryFilters = {
  search:"", customerId:null, dateFrom:"", dateTo:"", status:"", sort:"-deliveredAt",
};
function dateTime(value: string | null) {
  if (!value) return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? "—" :
    new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"}).format(date);
}
function ReadyCard({ order, canViewOrder, onPreview }: {
  order: ReadyOrder; canViewOrder:boolean; onPreview:(id:number)=>void;
}) {
  const isLate=!!order.dueDate && order.dueDate<cairoTodayISO();
  const dueToday=!!order.dueDate && order.dueDate===cairoTodayISO();
  return <article aria-label={`الأوردر ${order.orderNumber}`} className="overflow-hidden rounded-xl border border-[#e4e8f3] bg-card shadow-[0_3px_14px_#24345b08]">
    <header className="space-y-3 border-b bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold" dir="ltr">{order.orderNumber}</h3>
        <span className={"rounded-md px-2.5 py-1 text-xs font-bold " +
          (order.isReadyForDelivery?"bg-[#e5f7ee] text-[#147c58]":"bg-[#fff5df] text-[#a36a0d]")}>
          {order.isReadyForDelivery?"جاهز للتسليم":"جاهز جزئيًا"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{uiMessages.deliveries.customerLabel}</dt>
          <dd className="mt-1 truncate text-sm font-semibold" title={order.customerName}>{order.customerName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{uiMessages.deliveries.phoneLabel}</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums" dir="ltr">{order.customerPhone}</dd>
        </div>
      </dl>
    </header>
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">إجمالي الأوردر</p>
          <p className="mt-1 font-bold"><MoneyAmount amount={order.orderTotal}/></p></div>
        <div><p className="text-xs text-muted-foreground">موعد التسليم</p>
          <p className={"mt-1 flex flex-wrap items-center gap-1 font-semibold "+(isLate?"text-[#ba3646]":"")}>
            <span dir="ltr">{order.dueDate?formatCollectionDate(order.dueDate):"بدون موعد"}</span>
            {isLate?<span className="rounded bg-[#fff0f2] px-1.5 py-0.5 text-[11px]">{uiMessages.deliveries.overdue}</span>:
              dueToday?<span className="rounded bg-[#fff4dc] px-1.5 py-0.5 text-[11px] text-[#9c6107]">{uiMessages.deliveries.dueToday}</span>:null}
          </p></div>
        <div><p className="text-xs text-muted-foreground">{uiMessages.deliveries.readyCount}</p>
          <p className="mt-1 font-bold">{order.readyItemsCount} / {order.totalItemsCount}</p></div>
        <div><p className="text-xs text-muted-foreground">{uiMessages.deliveries.customerAccount}</p>
          <p className="mt-1 font-semibold">{order.customerBalance ?
            <>{order.customerBalance.typeLabel} · <MoneyAmount amount={order.customerBalance.amount}/></> :
            "غير متاح"}</p></div>
      </div>
      <div className="space-y-1.5 border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground">{uiMessages.deliveries.itemsLabel} ({order.readyItemsCount}/{order.totalItemsCount})</p>
        {order.items.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-medium">{item.serviceName} · كمية {item.quantity.toLocaleString("en-US")}</span>
          {!order.isReadyForDelivery && <span className={item.productionStage===4?"text-[#147c58]":"text-[#a36a0d]"}>
            {item.productionStageLabel}
          </span>}
        </div>)}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {order.canDeliver &&
          <Button type="button" size="sm" onClick={()=>onPreview(order.orderId)}>
            <ClipboardCheck className="size-4"/> تسليم الأوردر
          </Button>}
        {!order.isReadyForDelivery && <p className="text-xs font-semibold text-[#a36a0d]">
          التسليم متاح بعد جاهزية كل المنتجات.
        </p>}
        {canViewOrder && <Button asChild type="button" size="sm" variant="outline">
          <Link to={`/orders/${order.orderId}`}><Eye className="size-4"/> تفاصيل الأوردر</Link>
        </Button>}
      </div>
    </div>
  </article>;
}
export function DeliveriesPage() {
  const qc=useQueryClient();
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const canReady=permissions.includes("deliveries.ready.view");
  const canHistory=permissions.includes("deliveries.list");
  const canViewDelivery=permissions.includes("deliveries.view");
  const canViewOrder=permissions.includes("orders.view");
  const [tab,setTab]=useState<"ready"|"history">("ready");
  const activeTab=tab==="ready" && !canReady && canHistory ? "history" : tab==="history" && !canHistory && canReady ? "ready" : tab;
  const [searchInput,setSearchInput]=useState("");
  const [customerId,setCustomerId]=useState("");
  const [search,setSearch]=useState("");
  const [readySort,setReadySort]=useState<ReadyFilters["sort"]>("dueDate");
  const [historySort,setHistorySort]=useState<HistoryFilters["sort"]>("-deliveredAt");
  const [status,setStatus]=useState<HistoryFilters["status"]>("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [page,setPage]=useState(1);
  const [delivering,setDelivering]=useState<number|null>(null);
  const [details,setDetails]=useState<number|null>(null);
  const customerOptions=useQuery({
    queryKey:["deliveries","customer-options"],
    queryFn:getDeliveryCustomerOptions,
    enabled:canReady||canHistory,
    staleTime:60_000,
  });

  useEffect(()=>{
    const timer=setTimeout(()=>setSearch(searchInput.trim()),350);
    return ()=>clearTimeout(timer);
  },[searchInput]);
  useEffect(()=>setPage(1),[activeTab,search,customerId,readySort,historySort,status,dateFrom,dateTo]);
  const readyFilters:ReadyFilters={...defaultReady,search,customerId:customerId?Number(customerId):null,sort:readySort};
  const historyFilters:HistoryFilters={...defaultHistory,search,customerId:customerId?Number(customerId):null,dateFrom,dateTo,status,sort:historySort};
  const ready=useReadyOrders(readyFilters,page,canReady && activeTab==="ready");
  const history=useDeliveryHistory(historyFilters,page,canHistory && activeTab==="history");
  const resultPage=activeTab==="ready"?ready.data?.pagination:history.data?.pagination;
  useEffect(()=>{
    if(resultPage && resultPage.lastPage>0 && page>resultPage.lastPage)
      setPage(resultPage.lastPage);
  },[resultPage,page]);
  function reset() {
    setSearchInput("");setSearch("");setCustomerId("");setStatus("");setDateFrom("");setDateTo("");
    setReadySort("dueDate");setHistorySort("-deliveredAt");
  }
  function done() {
    setDelivering(null);setDetails(null);
    void qc.invalidateQueries({queryKey:["deliveries"]});
  }
  return <div className="space-y-4">
    <SectionHeader title="التسليمات" detail="تسليم الأوردرات الجاهزة ومراجعة سجل الاستلام والتحصيل."
      actions={<Button type="button" variant="outline" onClick={()=>void qc.invalidateQueries({queryKey:["deliveries"]})}>
        <RefreshCw className="size-4"/> تحديث
      </Button>}/>
    <div role="tablist" aria-label="أقسام التسليمات" className="flex flex-wrap gap-2 border-b pb-3">
      {canReady && <button type="button" role="tab" aria-selected={activeTab==="ready"}
        className={"rounded-lg px-4 py-2 text-sm font-bold "+(activeTab==="ready"?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}
        onClick={()=>{setTab("ready");reset();}}>جاهزة للتسليم</button>}
      {canHistory && <button type="button" role="tab" aria-selected={activeTab==="history"}
        className={"rounded-lg px-4 py-2 text-sm font-bold "+(activeTab==="history"?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}
        onClick={()=>{setTab("history");reset();}}>سجل التسليمات</button>}
    </div>
    <section aria-label="فلاتر التسليمات" className="rounded-xl border bg-card px-4 py-3">
      <div className={activeTab==="ready"?"grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(200px,300px)_minmax(180px,230px)_auto]":"grid items-end gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(200px,1fr)_minmax(180px,250px)_repeat(3,minmax(140px,170px))_auto]"}>
        <label className="block space-y-1 text-xs font-semibold">
          <span>البحث برقم الأوردر أو العميل أو الهاتف</span>
          <input className={fieldClass} value={searchInput} onChange={e=>setSearchInput(e.target.value)}
            placeholder="بحث في التسليمات..." maxLength={200}/>
        </label>
        <div className="min-w-0 space-y-1">
          <span className="block text-xs font-semibold">{uiMessages.deliveries.customerFilter}</span>
          <div>
            <SearchableSelect label={uiMessages.deliveries.customerFilter}
              placeholder={uiMessages.deliveries.customerPlaceholder}
              options={customerOptions.data??[]} value={customerId} onChange={setCustomerId}
              loading={customerOptions.isPending} disabled={customerOptions.isError}/>
          </div>
          {customerOptions.isError && <p role="alert" className="text-xs text-destructive">{uiMessages.deliveries.customerLoadError}</p>}
        </div>
        {activeTab==="ready" ? <label className="block space-y-1 text-xs font-semibold">
          <span>الترتيب</span>
          <select className={fieldClass} value={readySort} aria-label="ترتيب الأوردرات الجاهزة"
            onChange={e=>setReadySort(e.target.value as ReadyFilters["sort"])}>
            <option value="dueDate">الأقرب للتسليم</option>
            <option value="-dueDate">الأبعد للتسليم</option>
            <option value="-id">الأحدث</option>
            <option value="id">الأقدم</option>
          </select>
        </label> : <>
          <CreatedDatePicker label={uiMessages.deliveries.dateFrom} value={dateFrom} max={dateTo||undefined} onChange={setDateFrom}/>
          <CreatedDatePicker label={uiMessages.deliveries.dateTo} value={dateTo} min={dateFrom||undefined} onChange={setDateTo}/>
          <label className="block space-y-1 text-xs font-semibold">
            <span>الحالة</span><select className={fieldClass} aria-label="حالة التسليم" value={status}
              onChange={e=>setStatus(e.target.value as HistoryFilters["status"])}>
              <option value="">كل الحالات</option>
              <option value="1">تم التسليم</option>
              <option value="2">ملغي</option>
            </select>
          </label>
          <label className="block space-y-1 text-xs font-semibold">
            <span>الترتيب</span><select className={fieldClass} aria-label="ترتيب سجل التسليمات"
              value={historySort} onChange={e=>setHistorySort(e.target.value as HistoryFilters["sort"])}>
              <option value="-deliveredAt">الأحدث تسليمًا</option>
              <option value="deliveredAt">الأقدم تسليمًا</option>
              <option value="-id">الأحدث تسجيلًا</option>
              <option value="id">الأقدم تسجيلًا</option>
            </select>
          </label>
        </>}
        <Button type="button" variant="ghost" size="sm" className="shrink-0"
          disabled={!searchInput.trim()&&!search&&!customerId&&!dateFrom&&!dateTo&&!status&&readySort==="dueDate"&&historySort==="-deliveredAt"}
          onClick={reset}>{uiMessages.deliveries.clearFilters}</Button>
      </div>
    </section>
    {activeTab==="ready" && canReady ? ready.isPending ? <LoadingState/> : ready.isError ?
      <ErrorState error={ready.error} retry={()=>void ready.refetch()}/> :
      ready.data?.orders.length ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {ready.data.orders.map(order=><ReadyCard key={order.orderId} order={order}
          canViewOrder={canViewOrder} onPreview={setDelivering}/>)}
      </div> : <EmptyState title="لا توجد أوردرات جاهزة" detail="ستظهر الأوردرات هنا عند وصول منتجاتها لمرحلة الجاهزية."/> : null}
    {activeTab==="history" && canHistory ? history.isPending ? <LoadingState/> : history.isError ?
      <ErrorState error={history.error} retry={()=>void history.refetch()}/> :
      history.data?.deliveries.length ? <section className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-right text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
              {["الأوردر","العميل","الهاتف","سلّم بواسطة","المحصل وقت التسليم","المبلغ الفعّال","تاريخ التسليم","الحالة",""].map((label,i)=>
                <th key={i} className="whitespace-nowrap px-3 py-3 font-bold">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {history.data.deliveries.map(record=><tr key={record.id} className="hover:bg-muted/30">
                <td className="px-3 py-3 font-bold" dir="ltr">{record.orderNumber??"—"}</td>
                <td className="px-3 py-3">{record.customerName??"—"}</td>
                <td className="px-3 py-3" dir="ltr">{record.customerPhone??"—"}</td>
                <td className="px-3 py-3">{record.deliveredByName}</td>
                <td className="px-3 py-3"><MoneyAmount amount={record.receivedAmount}/></td>
                <td className="px-3 py-3"><MoneyAmount amount={record.effectiveReceivedAmount}/></td>
                <td className="whitespace-nowrap px-3 py-3">{dateTime(record.deliveredAt)}</td>
                <td className="px-3 py-3"><span className={"rounded-full px-2 py-1 text-xs font-bold " +
                  (record.status===1?"bg-[#e5f7ee] text-[#147c58]":"bg-[#fff0f2] text-rose-800")}>{record.statusLabel}</span></td>
                <td className="px-3 py-3">{canViewDelivery &&
                  <Button type="button" variant="outline" size="sm" onClick={()=>setDetails(record.id)}>
                    <Eye className="size-4"/> التفاصيل
                  </Button>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section> : <EmptyState title="لا توجد تسليمات مطابقة" detail="غيّر الفلاتر أو التاريخ لعرض سجلات أخرى."/> : null}
    {resultPage && resultPage.lastPage>1 && <div className="overflow-hidden rounded-lg border bg-card">
      <PaginationBar pagination={resultPage} onPage={setPage}/>
    </div>}
    {resultPage && resultPage.lastPage<=1 && <p className="text-xs text-muted-foreground">
      إجمالي النتائج: {resultPage.total.toLocaleString("ar-EG")}
    </p>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Truck className="size-4"/> تسليم الأوردر بالكامل فقط؛ تسجيل التجهيز في الإنتاج لا يعني تسليم العميل فعليًا.
    </p>
    {delivering!==null && <DeliverOrderDialog key={delivering} orderId={delivering} onClose={()=>setDelivering(null)} onSuccess={done}/>}
    {details!==null && <DeliveryDetailsDialog key={details} deliveryId={details} onClose={()=>setDetails(null)} onSuccess={done}/>}
  </div>;
}
