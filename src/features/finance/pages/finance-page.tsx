import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpLeft, History, Plus, RefreshCw, RotateCcw, UserRound, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { ErrorState, LoadingState, EmptyState, PaginationBar, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { uiMessages } from "@/shared/translations/ar/ui";
import { useFinanceCustomers, useFinanceBalance, useFinanceLedger, useFinanceOpeningStatus } from "../hooks/use-finance";
import { RefundsPanel } from "../components/refunds-panel";
import { FinanceAccountsOverview } from "../components/finance-accounts-overview";
import { CreateRefundDialog, RefundDetailsDialog } from "../components/refund-dialogs";
import { OpeningBalanceDialog } from "../components/opening-balance-dialog";
import type { AccountFilters } from "../types/finance.types";

const defaultFilters: AccountFilters = { page: 1, dateFrom: "", dateTo: "", type: "" };
const copy = uiMessages.financeAccounts;
const movementTypes = [
  { value: "", label: "كل الحركات" },
  { value: "1", label: "مديونية أوردر" },
  { value: "2", label: "تحصيل" },
  { value: "3", label: "إلغاء أوردر" },
  { value: "4", label: "عكس تحصيل" },
  { value: "5", label: "رد رصيد دائن" },
  { value: "6", label: "رصيد افتتاحي" },
];

export function FinancePage() {
  const permissions = useCurrentUser().data?.permissions ?? [];
  const canBalance = permissions.includes("finance.balances.view");
  const canLedger = permissions.includes("finance.ledger.view");
  const canOpening = permissions.includes("finance.opening_balances.create");
  const canRefund = permissions.includes("finance.refunds.create");
  const canRefundHistory = permissions.includes("finance.refunds.view");
  const canCustomerProfile = permissions.includes("customers.view");
  const canViewOrders = permissions.includes("orders.view");
  const canViewCollections = permissions.includes("finance.collections.view");
  const canAccountDetails = canBalance || canLedger || canOpening;

  const [params, setParams] = useSearchParams();
  const rawId = params.get("customerId") ?? "";
  const parsedId = Number(rawId);
  const customerId = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  // The active tab is URL-backed and permission-gated; its inactive data is not requested.
  const globalRefunds = canRefundHistory && (!canAccountDetails || params.get("tab")==="refunds");
  const customers = useFinanceCustomers(canAccountDetails && !globalRefunds && (customerId > 0 || !canBalance));
  const selected = customers.data?.find(item => item.value === customerId);
  // Customer selects currently expose a "name - phone" label, not separate profile fields.
  const selectedParts = selected?.label.match(/^(.*)\s[-–]\s(\+?\d+)$/);
  const customerName = selectedParts?.[1] ?? selected?.label ?? `عميل #${customerId}`;
  const customerPhone = selectedParts?.[2] ?? null;

  const [filters, setFilters] = useState<AccountFilters>(defaultFilters);
  const [opening, setOpening] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refundDetailsId,setRefundDetailsId] = useState<number|null>(null);
  const [selectedNote,setSelectedNote] = useState<string|null>(null);
  const qc = useQueryClient();

  const balance = useFinanceBalance(customerId, canBalance && !globalRefunds);
  const ledger = useFinanceLedger(customerId, filters, canLedger && !globalRefunds);
  const openingStatus = useFinanceOpeningStatus(customerId, canOpening && !globalRefunds);
  const actualBalance = canBalance ? balance.data : canLedger ? ledger.data?.balance : null;
  const balanceReady = canBalance ? balance.isSuccess : canLedger ? ledger.isSuccess : false;

  useEffect(() => setFilters(defaultFilters), [customerId]);
  useEffect(() => {
    if (ledger.data && ledger.data.pagination.lastPage > 0 && filters.page > ledger.data.pagination.lastPage) {
      setFilters(previous => ({ ...previous, page: ledger.data!.pagination.lastPage }));
    }
  }, [ledger.data, filters.page]);

  function chooseCustomer(value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("tab");
      next.delete("refundCustomerId");
      if (value) next.set("customerId", value);
      else next.delete("customerId");
      return next;
    });
    setOpening(false);
    setRefunding(false);
    setHistoryExpanded(false);
  }
  function changeFilter<K extends keyof AccountFilters>(key: K, value: AccountFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: value, page: 1 }));
  }
  function refresh() {
    void Promise.all([
      qc.invalidateQueries({ queryKey: ["finance"] }),
      qc.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  }

  const hasOpening = openingStatus.isSuccess && openingStatus.data.openingBalanceExists;
  // Refund action remains discoverable for permitted users, but never enabled for known debit/zero balances.
  // Refund-only staff without balance/ledger access can still open the server-validated refund dialog.
  const canRefundSelected = canRefund && customerId > 0 &&
    ((!canBalance && !canLedger) || (balanceReady && actualBalance?.type === 2));
  const refundUnavailableReason = !canRefund || !customerId || canRefundSelected ? "" :
    !balanceReady ? (balance.isError || ledger.isError ? copy.refundBalanceError : copy.refundBalanceLoading) :
    actualBalance?.type === 1 ? copy.refundDebitHint :
    actualBalance?.type === 0 ? copy.refundZeroHint : copy.refundNoCreditHint;
  const openingAlreadyRegistered = canOpening && openingStatus.isSuccess
    ? openingStatus.data.openingBalanceExists
    : canBalance ? balance.data?.openingBalanceExists
    : canLedger ? ledger.data?.openingBalanceExists : undefined;
  // Keep the selected customer in the URL when navigating the two top-level tabs.
  // A refunds-only user never gets access to the account tab or account queries.
  const refundHistoryVisible = canRefundHistory && globalRefunds;
  function selectFinanceTab(tab:"accounts"|"refunds"){
    if((tab==="accounts"&&!canAccountDetails)||(tab==="refunds"&&!canRefundHistory))return;
    setParams(previous=>{
      const next=new URLSearchParams(previous);
      if(tab==="refunds")next.set("tab","refunds");
      else next.delete("tab");
      return next;
    });
  }

  return <div className="space-y-4">
    <SectionHeader title="حسابات العملاء"
      detail="أرصدة العملاء وكشف الحساب، مع تسجيل الرصيد الافتتاحي ورد الرصيد الدائن."
      actions={<Button type="button" variant="outline" onClick={refresh}>
        <RefreshCw className="size-4"/> تحديث
      </Button>}/>

    {(canAccountDetails||canRefundHistory)&&<div role="tablist" aria-label={copy.moduleTabs}
      className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border bg-card p-1">
      {canAccountDetails&&<button type="button" role="tab" id="finance-accounts-tab"
        aria-controls="finance-accounts-panel" aria-selected={!globalRefunds}
        onClick={()=>selectFinanceTab("accounts")}
        className={"rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 "+
          (!globalRefunds?"bg-primary text-primary-foreground shadow-sm":"text-muted-foreground hover:bg-muted hover:text-foreground")}>
        {copy.accountsTab}
      </button>}
      {canRefundHistory&&<button type="button" role="tab" id="finance-refunds-tab"
        aria-controls="finance-refunds-panel" aria-selected={globalRefunds}
        onClick={()=>selectFinanceTab("refunds")}
        className={"rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 "+
          (globalRefunds?"bg-primary text-primary-foreground shadow-sm":"text-muted-foreground hover:bg-muted hover:text-foreground")}>
        {copy.globalRefundsTab}
      </button>}
    </div>}

    {canAccountDetails&&<div role="tabpanel" id="finance-accounts-panel" aria-labelledby="finance-accounts-tab"
      hidden={globalRefunds} className="space-y-3">
      {!globalRefunds&&<>
        {canBalance&&!customerId&&<FinanceAccountsOverview onSelect={id=>chooseCustomer(String(id))}/>}
        <section className="space-y-3">
      {!customerId&&!canBalance&&<section aria-label="اختيار حساب العميل" className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <UserRound className="size-4 text-primary"/>
          <h2 className="text-sm font-extrabold">{copy.selectCustomer}</h2>
          {canBalance&&customerId>0&&<Button size="sm" variant="ghost" onClick={()=>chooseCustomer("")}>
            {copy.backToAccounts}
          </Button>}
        </div>
        <div className="mt-2 max-w-xl">
          <SearchableSelect label="اختيار حساب العميل" placeholder="ابحث باسم العميل أو رقم هاتفه..."
            value={rawId} options={customers.data ?? []} onChange={chooseCustomer}
            loading={customers.isPending} disabled={customers.isError}/>
        </div>
        {customers.isError && <ErrorState error={customers.error} retry={() => void customers.refetch()}/>}
        {customers.isSuccess && customers.data.length === 0 &&
          <p className="mt-2 text-sm text-foreground/70">لا يوجد عملاء مسجلون.</p>}
      </section>}

      {!customerId&&!canBalance && <div className="rounded-xl border border-dashed bg-card p-6 text-center">
        <UserRound className="mx-auto mb-2 size-6 text-primary"/>
        <p className="font-semibold">اختَر عميلًا لعرض بيانات حسابه</p>
        <p className="mt-1 text-sm text-foreground/65">بيانات العميل والرصيد وكشف الحساب ستظهر هنا مباشرةً.</p>
      </div>}

      {customerId > 0 && <div className="space-y-3">
        <section aria-label="بيانات حساب العميل" className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-foreground/65">{copy.selectedCustomer}</p>
              <h2 className="break-words text-base font-extrabold">{customerName}</h2>
              <p className="text-xs font-medium text-muted-foreground">
                {copy.phone}: <span dir="ltr" className="inline-block tabular-nums">{customerPhone??copy.notAvailable}</span>
              </p>
              {canCustomerProfile&&<Link to={`/customers/${customerId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                {copy.customerRecord} <ArrowUpLeft className="size-3.5"/>
              </Link>}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">{copy.changeCustomer}</span>
                {canBalance&&<Button size="sm" variant="ghost" onClick={()=>chooseCustomer("")}>
                  {copy.backToAccounts}
                </Button>}
              </div>
              <SearchableSelect label="اختيار حساب العميل"
                placeholder={copy.accountsSearch} value={rawId}
                options={customers.data??[]} onChange={chooseCustomer}
                loading={customers.isPending} disabled={customers.isError}/>
              {customers.isError&&<ErrorState error={customers.error}
                retry={()=>void customers.refetch()}/>}
            </div>
          </div>

          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground/65">{copy.currentBalance}</p>
              {((canBalance && balance.isPending) || (!canBalance && canLedger && ledger.isPending))
                ? <p className="text-sm text-foreground/65">جاري تحميل الرصيد...</p>
                : actualBalance && balanceReady
                  ? <div className={"text-base font-semibold tabular-nums " +
                    (actualBalance.type === 1 ? "text-[#c8384a]" :
                    actualBalance.type === 2 ? "text-[#147c58]" : "text-foreground")}>
                      <span className="me-2 text-sm">{actualBalance.typeLabel}</span>
                      <MoneyAmount amount={actualBalance.amount}/>
                    </div>
                  : <p className="text-sm text-foreground/65">
                      {canBalance || canLedger ? "تعذّر عرض الرصيد" : "لا تملك صلاحية عرض الرصيد"}
                    </p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground/65">{copy.opening}</p>
              {canBalance&&balance.isSuccess&&balance.data.openingBalance ?
                  <p className="font-semibold">{balance.data.openingBalance.typeLabel} · <MoneyAmount amount={balance.data.openingBalance.amount}/></p> :
                openingAlreadyRegistered===undefined?
                  <p className="text-sm text-foreground/65">غير متاح</p>:
                  <p className="text-sm font-semibold text-foreground/80">
                    {openingAlreadyRegistered?copy.openingRecorded:copy.openingNotRecorded}
                  </p>}
            </div>
          </div>
          <p className="mt-2 text-xs text-foreground/60">{copy.balanceSource}</p>
          {(canRefund||canRefundHistory||(canOpening&&openingStatus.isSuccess&&!hasOpening))&&
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" aria-label={copy.accountActions}>
              {canRefund&&<Button size="sm" type="button" disabled={!canRefundSelected}
                title={refundUnavailableReason||undefined}
                onClick={()=>setRefunding(true)}>
                <RotateCcw className="size-4"/> {copy.refundAction}
              </Button>}
              {canRefundHistory&&<Button size="sm" type="button" variant="outline"
                aria-expanded={historyExpanded} onClick={()=>setHistoryExpanded(v=>!v)}>
                <History className="size-4"/>
                {historyExpanded?copy.backToLedger:copy.customerRefundsAction}
              </Button>}
              {canOpening&&openingStatus.isSuccess&&!hasOpening&&<Button size="sm" type="button"
                variant="outline" onClick={()=>setOpening(true)}>
                <Plus className="size-4"/> {copy.openingAction}
              </Button>}
              {canRefund&&<p role="status" className="basis-full text-xs text-muted-foreground">
                {canRefundSelected&&actualBalance?.type===2
                  ? <>{copy.refundableAmount}: <MoneyAmount amount={actualBalance.amount}/></>
                  : refundUnavailableReason || copy.refundValidatedByServer}
              </p>}
            </div>}
        </section>

        {canOpening && openingStatus.isError &&
          <ErrorState error={openingStatus.error} retry={() => void openingStatus.refetch()}/>}
        {canBalance && balance.isError &&
          <ErrorState error={balance.error} retry={() => void balance.refetch()}/>}
        {!canBalance && canLedger && ledger.isError &&
          <ErrorState error={ledger.error} retry={() => void ledger.refetch()}/>}
        {canRefundHistory&&historyExpanded&&<RefundsPanel key={customerId} customerId={customerId}/>}
        {canLedger && !historyExpanded && <section aria-label="كشف حساب العميل" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <History className="size-4 text-primary"/>
            <h2 className="text-sm font-extrabold">كشف الحساب</h2>
            <span className="text-xs text-foreground/65">
              {copy.ledgerHint}
            </span>
          </div>
          <div className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-3">
            <CreatedDatePicker label="من تاريخ" value={filters.dateFrom} max={filters.dateTo || undefined}
              onChange={value => changeFilter("dateFrom", value)}/>
            <CreatedDatePicker label="إلى تاريخ" value={filters.dateTo} min={filters.dateFrom || undefined}
              onChange={value => changeFilter("dateTo", value)}/>
            <label className="block space-y-1 text-xs font-semibold">
              <span>نوع الحركة</span>
              <select className={fieldClass + " h-9"} aria-label="نوع الحركة المالية"
                value={filters.type} onChange={event => changeFilter("type", event.target.value)}>
                {movementTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {(filters.dateFrom || filters.dateTo || filters.type) && <div className="md:col-span-3">
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>مسح الفلاتر</Button>
            </div>}
          </div>
          {ledger.isPending ? <LoadingState/> : ledger.isError ?
            <ErrorState error={ledger.error} retry={() => void ledger.refetch()}/> :
            ledger.data?.entries.length ? <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-bold">سجل الحركات</h3>
                <span className="text-xs font-semibold text-foreground/70">
                  {ledger.data.pagination.total.toLocaleString("ar-EG")} حركة
                </span>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-right text-sm">
                <thead className="bg-muted/60 text-xs text-foreground/70"><tr>
                  {["التاريخ", "نوع الحركة", "مدين (+)", "دائن (−)", "الرصيد بعد الحركة", "المرجع", "ملاحظات"].map(column =>
                    <th key={column} className="whitespace-nowrap px-3 py-3 font-bold">{column}</th>)}
                </tr></thead>
                <tbody className="divide-y">
                  {ledger.data.entries.map(entry => {
                    const credit = entry.signedAmount.startsWith("-");
                    const reference = entry.collectionId&&entry.receiptNumber
                      ? entry.receiptNumber : entry.refundId&&entry.refundNumber
                      ? entry.refundNumber : entry.orderNumber ?? null;
                    return <tr key={entry.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums"><span dir="ltr" className="inline-block">{formatCollectionDate(entry.effectiveDate)}</span></td>
                      <td className="px-3 py-2.5 font-semibold">{entry.typeLabel}</td>
                      <td className="px-3 py-2.5 font-semibold">{!credit ? <MoneyAmount amount={entry.amount}/> : "—"}</td>
                      <td className="px-3 py-2.5 font-semibold">{credit ? <MoneyAmount amount={entry.amount}/> : "—"}</td>
                      <td className={"whitespace-nowrap px-3 py-2.5 font-bold tabular-nums " +
                        (entry.runningBalance.type === 1 ? "text-[#c8384a]" : entry.runningBalance.type === 2 ? "text-[#147c58]" : "text-foreground")}>
                        {entry.runningBalance.typeLabel} · <MoneyAmount amount={entry.runningBalance.amount}/>
                      </td>
                      <td className="px-3 py-2.5">
                        {reference ? <div className="space-y-0.5 leading-5">
                          <div>{entry.collectionId&&canViewCollections ?
                            <Link to={`/collections?receiptId=${entry.collectionId}`}
                              className="font-semibold text-primary underline"><span dir="ltr" className="inline-block">{reference}</span></Link>:
                            entry.refundId&&canRefundHistory ?
                              <button type="button" className="font-semibold text-primary underline"
                                onClick={()=>setRefundDetailsId(entry.refundId)}><span dir="ltr" className="inline-block">{reference}</span></button>:
                            entry.orderId&&canViewOrders ?
                              <Link to={`/orders/${entry.orderId}`} className="font-semibold text-primary underline">
                                <span dir="ltr" className="inline-block">{reference}</span></Link>:
                              <span dir="ltr" className="inline-block tabular-nums">{reference}</span>}</div>
                          {entry.collectionId&&entry.orderId&&entry.orderNumber&&canViewOrders&&
                            <Link to={`/orders/${entry.orderId}`} className="inline-flex flex-wrap items-center gap-1 text-xs leading-4 text-muted-foreground underline">
                              {copy.relatedOrder}: <span dir="ltr" className="inline-block">{entry.orderNumber}</span>
                            </Link>}
                        </div>:"—"}
                      </td>
                      <td className="max-w-56 px-3 py-2.5 text-foreground/70">{entry.note ?
                        <button type="button" className="block max-w-44 truncate text-right hover:text-primary hover:underline"
                          onClick={()=>setSelectedNote(entry.note)} aria-label={copy.showNote} title={copy.showNote}>{entry.note}</button>:"—"}</td>
                    </tr>;
                  })}
                </tbody>
              </table></div>
            </div> : <EmptyState title="لا توجد حركات مالية" detail="لا توجد حركات للعميل ضمن الفلاتر الحالية."/>}
          {ledger.data && ledger.data.pagination.lastPage > 1 && <div className="rounded-xl border bg-card">
            <PaginationBar pagination={ledger.data.pagination}
              onPage={page => setFilters(previous => ({ ...previous, page }))}/>
          </div>}
        </section>}
        {!canBalance && !canLedger && <p className="rounded-xl border bg-card p-4 text-sm text-foreground/70">
          لا تملك صلاحية عرض الأرصدة أو كشف الحساب. يمكنك تنفيذ الإجراءات المالية المسموح بها فقط.
        </p>}
      </div>}
        </section>
      </>}
    </div>}

    {canRefund && !canAccountDetails && <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-extrabold">رد الأرصدة الدائنة</h2>
      <Button type="button" size="sm" onClick={() => setRefunding(true)}>
        <RotateCcw className="size-4"/> رد رصيد دائن
      </Button>
      <p className="text-xs text-foreground/65">يمكنك اختيار العميل داخل نموذج رد الرصيد.</p>
    </section>}

    {canRefundHistory&&<section role="tabpanel" id="finance-refunds-panel"
      aria-labelledby="finance-refunds-tab" hidden={!globalRefunds}>
      {refundHistoryVisible&&<RefundsPanel key="global"/>}
    </section>}

    {selectedNote!==null&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-3"
      onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedNote(null);}}>
      <section role="dialog" aria-modal="true" aria-label={copy.noteDialog} dir="rtl" className="w-full max-w-md rounded-xl bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <h3 className="font-semibold">{copy.noteDialog}</h3>
          <Button variant="ghost" size="icon-sm" aria-label={copy.returnAccount} onClick={()=>setSelectedNote(null)}><X className="size-4"/></Button>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm">{selectedNote}</p>
      </section>
    </div>}
    {refundDetailsId!==null&&canRefundHistory&&
      <RefundDetailsDialog id={refundDetailsId} onClose={()=>setRefundDetailsId(null)}/>}
    {opening && customerId > 0 && canOpening && openingStatus.isSuccess && !hasOpening &&
      <OpeningBalanceDialog key={customerId} customerId={customerId}
        customerName={customerName}
        onClose={() => setOpening(false)}
        onSuccess={() => { setOpening(false); refresh(); }}/>}
    {refunding && canRefund && <CreateRefundDialog initialCustomerId={customerId}
      onClose={() => setRefunding(false)}
      onSuccess={() => { setRefunding(false); refresh(); }}/>}
  </div>;
}
