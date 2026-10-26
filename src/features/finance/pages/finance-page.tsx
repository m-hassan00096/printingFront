import { useEffect,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { ArrowUpLeft,ArrowRight,BookOpen,RefreshCw,Wallet,Plus,History,RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { ErrorState,LoadingState,EmptyState,PaginationBar,SectionHeader,fieldClass } from "@/features/identity/components/identity-ui";
import { CollectionDateField,formatCollectionDate } from "@/features/collections/components/collection-date-field";
import { useFinanceCustomers,useFinanceBalance,useFinanceLedger,useFinanceOpeningStatus } from "../hooks/use-finance";
import { AccountsOverview } from "../components/accounts-overview";
import { RefundsPanel } from "../components/refunds-panel";
import { OpeningBalanceDialog } from "../components/opening-balance-dialog";
import type { AccountFilters } from "../types/finance.types";

const defaultFilters:AccountFilters={page:1,dateFrom:"",dateTo:"",type:""};
const movementTypes=[
  {value:"",label:"كل الحركات"},
  {value:"1",label:"مديونية أوردر"},
  {value:"2",label:"تحصيل"},
  {value:"3",label:"إلغاء أوردر"},
  {value:"4",label:"عكس تحصيل"},
  {value:"5",label:"رد رصيد دائن"},
  {value:"6",label:"رصيد افتتاحي"},
];
function BalancePanel({label,amount,tone}:{label:string;amount:string;tone:"debit"|"credit"|"neutral"}){
  const color=tone==="debit"?"text-rose-700":tone==="credit"?"text-emerald-700":"text-foreground";
  return <article className="rounded-xl border bg-card p-4 shadow-sm">
    <p className="text-xs font-semibold text-foreground/70">{label}</p>
    <p className={`mt-2 text-xl font-extrabold ${color}`}><MoneyAmount amount={amount}/></p>
  </article>;
}
export function FinancePage(){
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const mayBalance=permissions.includes("finance.balances.view");
  const mayLedger=permissions.includes("finance.ledger.view");
  const mayOpen=permissions.includes("finance.opening_balances.create");
  const mayViewCustomers=permissions.includes("customers.view");
  const mayViewOrders=permissions.includes("orders.view");
  const mayRefundView=permissions.includes("finance.refunds.view");
  const mayRefundCreate=permissions.includes("finance.refunds.create");
  const mayRefund=mayRefundView||mayRefundCreate;
  const mayAccounts=mayBalance||mayLedger||mayOpen;
  const qc=useQueryClient();
  const [params,setParams]=useSearchParams();
  const tab=params.get("tab")==="refunds"?"refunds":"accounts";
  const refundActive=mayRefund&&(!mayAccounts||tab==="refunds");
  const accountActive=!refundActive;
  const requestedRefundCustomerId=Number(params.get("refundCustomerId")??"");
  const rawId=params.get("customerId")??"";
  const id=Number(rawId);
  const customerId=Number.isSafeInteger(id)&&id>0?id:0;
  const customers=useFinanceCustomers(accountActive&&mayAccounts);
  const option=customers.data?.find(c=>c.value===customerId);
  const [filters,setFilters]=useState<AccountFilters>(defaultFilters);
  const [opening,setOpening]=useState(false);
  const balance=useFinanceBalance(customerId,mayBalance&&accountActive);
  const ledger=useFinanceLedger(customerId,filters,mayLedger&&accountActive);
  const openingStatus=useFinanceOpeningStatus(customerId,mayOpen&&accountActive);
  const effectiveBalance=mayBalance?balance.data:mayLedger?ledger.data?.balance:null;
  const balanceReady=mayBalance?balance.isSuccess:mayLedger?ledger.isSuccess:false;

  useEffect(()=>setFilters(defaultFilters),[customerId]);
  useEffect(()=>{
    if(ledger.data&&ledger.data.pagination.lastPage>0&&filters.page>ledger.data.pagination.lastPage)
      setFilters(p=>({...p,page:ledger.data!.pagination.lastPage}));
  },[ledger.data,filters.page]);
  function switchTab(nextTab:"accounts"|"refunds"){
    setOpening(false);
    setParams(old=>{
      const next=new URLSearchParams(old);
      if(nextTab==="refunds")next.set("tab","refunds");
      else {next.delete("tab");next.delete("refundCustomerId");}
      return next;
    });
  }
  function requestRefund(id:number){
    setParams(old=>{
      const next=new URLSearchParams(old);
      next.set("tab","refunds");
      next.set("refundCustomerId",String(id));
      return next;
    });
  }
  function clearRequestedRefund(){
    setParams(old=>{
      const next=new URLSearchParams(old);
      next.delete("refundCustomerId");
      return next;
    });
  }
  function selectCustomer(value:string){
    setParams(old=>{
      const next=new URLSearchParams(old);
      if(value)next.set("customerId",value);
      else next.delete("customerId");
      return next;
    });
    setOpening(false);
  }
  function change<K extends keyof AccountFilters>(key:K,value:AccountFilters[K]){
    setFilters(old=>({...old,[key]:value,page:1}));
  }
  function refresh(){
    void Promise.all([qc.invalidateQueries({queryKey:["finance"]}),qc.invalidateQueries({queryKey:["customers"]})]);
  }
  return <div className="space-y-4">
    <SectionHeader title="حسابات العملاء" detail="أرصدة العملاء وكشف الحساب والرصيد الافتتاحي ورد المبالغ الدائنة."
      actions={<Button variant="outline" type="button" onClick={refresh}><RefreshCw className="size-4"/> تحديث</Button>}/>
    {mayRefund&&mayAccounts&&<div role="tablist" aria-label="أقسام الحسابات"
      className="flex flex-wrap gap-2 border-b pb-3">
      <button role="tab" type="button" aria-selected={!refundActive} onClick={()=>switchTab("accounts")}
        className={"rounded-xl px-4 py-2 text-sm font-bold "+(!refundActive?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>
        <Wallet className="ms-1 inline size-4"/> حسابات العملاء
      </button>
      <button role="tab" type="button" aria-selected={refundActive} onClick={()=>switchTab("refunds")}
        className={"rounded-xl px-4 py-2 text-sm font-bold "+(refundActive?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>
        <RotateCcw className="ms-1 inline size-4"/> رد الأرصدة الدائنة
      </button>
    </div>}
    {refundActive&&<RefundsPanel canView={mayRefundView} canCreate={mayRefundCreate}
      requestedCustomerId={Number.isSafeInteger(requestedRefundCustomerId)&&requestedRefundCustomerId>0?requestedRefundCustomerId:0}
      onClearCustomer={clearRequestedRefund}/>}
    {accountActive&&<>
    {!customerId&&mayBalance&&<AccountsOverview onOpen={id=>selectCustomer(String(id))}
      onRefund={mayRefundCreate?requestRefund:undefined}/>}
    {(!mayBalance||customerId>0)&&<>
    {customerId>0&&mayBalance&&<div>
      <Button type="button" variant="ghost" size="sm" onClick={()=>selectCustomer("")}>
        <ArrowRight className="size-4"/> العودة لقائمة الحسابات
      </Button>
    </div>}
    <section aria-label="اختيار حساب العميل" className="space-y-2 rounded-2xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Wallet className="size-4 text-primary"/> حساب العميل</h2>
        {customerId>0&&mayViewCustomers&&<Button asChild variant="outline" size="sm"><Link to={`/customers/${customerId}`}>
          ملف العميل <ArrowUpLeft className="size-4"/>
        </Link></Button>}
      </div>
      <div className="max-w-xl space-y-1">
        <label className="text-sm font-semibold">اختر العميل بالاسم أو الهاتف</label>
        <SearchableSelect label="اختيار حساب العميل" placeholder="بحث عن عميل..." value={rawId}
          options={customers.data??[]} onChange={selectCustomer}
          loading={customers.isPending} disabled={customers.isError}/>
      </div>
      {customers.isError&&<ErrorState error={customers.error} retry={()=>void customers.refetch()}/>}
      {customers.isSuccess&&customers.data.length===0&&<p className="text-sm text-muted-foreground">لا يوجد عملاء مسجلون حتى الآن.</p>}
    </section>

    {!customerId&&<div className="rounded-2xl border border-dashed bg-card p-8 text-center">
      <BookOpen className="mx-auto mb-3 size-8 text-primary"/>
      <h3 className="text-base font-bold">اختر عميلًا لعرض حسابه</h3>
      <p className="mt-2 text-sm text-muted-foreground">سيظهر الرصيد الفعلي وسجل الحركات المالية للعميل المختار.</p>
    </div>}
    {customerId>0&&<>
      <section aria-label="رصيد الحساب الحالي" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">الرصيد الحالي</h2>
          {mayRefundCreate&&effectiveBalance?.type===2&&<Button size="sm" type="button"
            onClick={()=>requestRefund(customerId)}><RotateCcw className="size-4"/> رد الرصيد الدائن</Button>}
          {mayOpen&&openingStatus.isSuccess&&!openingStatus.data.openingBalanceExists&&
            <Button size="sm" type="button" onClick={()=>setOpening(true)}>
              <Plus className="size-4"/> رصيد افتتاحي
            </Button>}
          {mayOpen&&openingStatus.isSuccess&&openingStatus.data.openingBalanceExists&&
            <span className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground/70">
              الرصيد الافتتاحي مسجل بالفعل
            </span>}
        </div>
        {mayOpen&&openingStatus.isError&&<ErrorState error={openingStatus.error} retry={()=>void openingStatus.refetch()}/>}
        {!mayBalance&&!mayLedger&&<p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          لا تملك صلاحية عرض الرصيد، لكن يمكنك تسجيل الرصيد الافتتاحي إذا كان لديك الإذن المناسب.
        </p>}
        {(mayBalance?balance.isPending:mayLedger?ledger.isPending:false)&&<LoadingState/>}
        {mayBalance&&balance.isError&&<ErrorState error={balance.error} retry={()=>void balance.refetch()}/>}
        {!mayBalance&&mayLedger&&ledger.isError&&<ErrorState error={ledger.error} retry={()=>void ledger.refetch()}/>}
        {effectiveBalance&&balanceReady&&<div className="grid gap-3 sm:grid-cols-3">
          <BalancePanel label={effectiveBalance.type===1?"رصيد مدين":effectiveBalance.type===2?"رصيد دائن":"الرصيد متوازن"} amount={effectiveBalance.amount}
            tone={effectiveBalance.type===1?"debit":effectiveBalance.type===2?"credit":"neutral"}/>
          <BalancePanel label="مديونية العميل" amount={effectiveBalance.type===1?effectiveBalance.amount:"0.00"} tone="debit"/>
          <BalancePanel label="رصيد دائن للعميل" amount={effectiveBalance.type===2?effectiveBalance.amount:"0.00"} tone="credit"/>
        </div>}
        {effectiveBalance&&balanceReady&&<p className="text-xs font-semibold text-foreground/70">
          حالة الرصيد: {effectiveBalance.typeLabel} · الرصيد محسوب من دفتر الأستاذ ولا يمكن تعديله مباشرةً.
        </p>}
      </section>
      {mayLedger&&<section aria-label="كشف حساب العميل" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <History className="size-4 text-primary"/><h2 className="text-sm font-bold">كشف الحساب</h2>
          <span className="text-xs text-foreground/70">الرصيد التراكمي محسوب من كل الحركات السابقة، حتى خارج الفلاتر الحالية.</span>
        </div>
        <div className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-3">
          <CollectionDateField label="من تاريخ" value={filters.dateFrom} max={filters.dateTo||undefined}
            onChange={value=>change("dateFrom",value)}/>
          <CollectionDateField label="إلى تاريخ" value={filters.dateTo} min={filters.dateFrom||undefined}
            onChange={value=>change("dateTo",value)}/>
          <label className="block space-y-1 text-xs font-semibold">
            <span>نوع الحركة</span>
            <select className={fieldClass+" h-9"} aria-label="نوع الحركة المالية" value={filters.type}
              onChange={e=>change("type",e.target.value)}>
              {movementTypes.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          {(filters.dateFrom||filters.dateTo||filters.type)&&<div className="md:col-span-3">
            <Button size="sm" variant="ghost" onClick={()=>setFilters(defaultFilters)}>مسح الفلاتر</Button>
          </div>}
        </div>
        {ledger.isPending?<LoadingState/>:ledger.isError?
          <ErrorState error={ledger.error} retry={()=>void ledger.refetch()}/>:
          ledger.data?.entries.length?<div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-bold">سجل الحركات</h3>
              <span className="text-xs font-semibold text-foreground/70">{ledger.data.pagination.total.toLocaleString("ar-EG")} حركة</span>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-right text-sm">
              <thead className="bg-muted/60 text-xs text-foreground/70"><tr>
                {["التاريخ","نوع الحركة","مدين (+)","دائن (−)","الرصيد بعد الحركة","المرجع","ملاحظات"].map(x=>
                  <th key={x} className="whitespace-nowrap px-3 py-3 font-bold">{x}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {ledger.data.entries.map(entry=>{
                  const credit=entry.signedAmount.startsWith("-");
                  return <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums"><span dir="ltr" className="inline-block">{formatCollectionDate(entry.effectiveDate)}</span></td>
                    <td className="px-3 py-3 font-semibold">{entry.typeLabel}</td>
                    <td className="px-3 py-3 font-semibold">{!credit?<MoneyAmount amount={entry.amount}/>:"—"}</td>
                    <td className="px-3 py-3 font-semibold">{credit?<MoneyAmount amount={entry.amount}/>:"—"}</td>
                    <td className={"whitespace-nowrap px-3 py-3 font-bold tabular-nums "+(entry.runningBalance.type===1?"text-rose-700":entry.runningBalance.type===2?"text-emerald-700":"text-foreground")}>
                      {entry.runningBalance.typeLabel} · <MoneyAmount amount={entry.runningBalance.amount}/>
                    </td>
                    <td className="px-3 py-3">{entry.orderId&&mayViewOrders?
                      <Link className="font-semibold text-primary underline" to={`/orders/${entry.orderId}`}>أوردر #{entry.orderId}</Link>:
                      entry.orderId?`أوردر #${entry.orderId}`:entry.collectionId?`تحصيل #${entry.collectionId}`:entry.refundId?`رد رصيد #${entry.refundId}`:"—"}</td>
                    <td className="max-w-56 truncate px-3 py-3 text-foreground/70" title={entry.note??undefined}>{entry.note??"—"}</td>
                  </tr>;
                })}
              </tbody>
            </table></div>
          </div>:<EmptyState title="لا توجد حركات مالية" detail="لا توجد حركات للعميل ضمن الفلاتر الحالية."/>}
        {ledger.data&&ledger.data.pagination.lastPage>1&&<div className="rounded-xl border bg-card">
          <PaginationBar pagination={ledger.data.pagination}
            onPage={page=>setFilters(old=>({...old,page}))}/>
        </div>}
      </section>}
    </>}
    {opening&&customerId>0&&mayOpen&&openingStatus.isSuccess&&!openingStatus.data.openingBalanceExists&&<OpeningBalanceDialog key={customerId} customerId={customerId}
      customerName={option?.label??"العميل المحدد"} onClose={()=>setOpening(false)} onSuccess={()=>{setOpening(false);refresh();}}/>}
    </>}
    </>}
  </div>;
}
