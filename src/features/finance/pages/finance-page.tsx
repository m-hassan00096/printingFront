import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpLeft, History, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
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
import { CustomerSettlementPanel } from "../components/customer-settlement-panel";
import { AccountSettlementPanel } from "../components/account-settlement-panel";
import { AccountCollectionDialog } from "../components/account-collection-dialog";
import { CreateRefundDialog, RefundDetailsDialog } from "../components/refund-dialogs";
import { OpeningBalanceDialog } from "../components/opening-balance-dialog";
import { accountTypeLabel } from "../lib/account-display";
import type { AccountFilters } from "../types/finance.types";

const defaultFilters: AccountFilters = {page: 1, dateFrom: "", dateTo: "", type: ""};
const copy = uiMessages.financeAccounts;
const movementTypes = [
  {value: "", label: "كل الحركات"}, {value: "1", label: "مديونية أوردر"},
  {value: "2", label: "تحصيل"}, {value: "3", label: "إلغاء أوردر"},
  {value: "4", label: "إلغاء تحصيل سابق"}, {value: "5", label: "رد مبلغ للعميل"},
  {value: "6", label: "رصيد افتتاحي"},
];
type AccountView = "ledger" | "delivered" | "settlements" | "refunds";

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
  const canCollect = permissions.includes("finance.collections.create");
  const canAccountDetails = canBalance || canLedger || canOpening;
  const [params, setParams] = useSearchParams();
  const rawId = params.get("customerId") ?? "";
  const parsedId = Number(rawId);
  const customerId = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  const globalRefunds = canRefundHistory && (!canAccountDetails || params.get("tab") === "refunds");
  const rawView = params.get("view");
  const view: AccountView = rawView === "delivered" || rawView === "settlements" || rawView === "refunds" ? rawView : "ledger";
  const customers = useFinanceCustomers(canAccountDetails && !globalRefunds && (customerId > 0 || !canBalance));
  const selected = customers.data?.find(item => item.value === customerId);
  const selectedParts = selected?.label.match(/^(.*)\s[-–]\s(\+?\d+)$/);
  const customerName = selectedParts?.[1] ?? selected?.label ?? `عميل #${customerId}`;
  const customerPhone = selectedParts?.[2] ?? null;
  const [filters, setFilters] = useState<AccountFilters>(defaultFilters);
  const [opening, setOpening] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [refundDetailsId, setRefundDetailsId] = useState<number | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const qc = useQueryClient();
  const balance = useFinanceBalance(customerId, canBalance && !globalRefunds);
  const ledger = useFinanceLedger(customerId, filters, canLedger && !globalRefunds && (view === "ledger" || !canBalance));
  const openingStatus = useFinanceOpeningStatus(customerId, canOpening && !globalRefunds);
  const actualBalance = canBalance ? balance.data : canLedger ? ledger.data?.balance : null;
  const balanceReady = canBalance ? balance.isSuccess : canLedger ? ledger.isSuccess : false;
  useEffect(() => setFilters(defaultFilters), [customerId]);
  useEffect(() => {
    if (ledger.data && ledger.data.pagination.lastPage > 0 && filters.page > ledger.data.pagination.lastPage) {
      setFilters(previous => ({...previous, page: ledger.data!.pagination.lastPage}));
    }
  }, [ledger.data, filters.page]);
  function chooseCustomer(value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("tab"); next.delete("refundCustomerId"); next.delete("view");
      if (value) next.set("customerId", value); else next.delete("customerId");
      return next;
    });
    setOpening(false); setRefunding(false); setCollecting(false); setSelectedNote(null);
  }
  function changeView(nextView: AccountView) {
    setParams(previous => {const next = new URLSearchParams(previous); next.set("view", nextView); return next;});
  }
  function changeFilter<K extends keyof AccountFilters>(key: K, value: AccountFilters[K]) {
    setFilters(previous => ({...previous, [key]: value, page: 1}));
  }
  function refresh() {
    void Promise.all(["finance", "customers", "collections"].map(name => qc.invalidateQueries({queryKey: [name]})));
  }
  const hasOpening = openingStatus.isSuccess && openingStatus.data.openingBalanceExists;
  const canRefundSelected = canRefund && customerId > 0 && ((!canBalance && !canLedger) || (balanceReady && actualBalance?.type === 2));
  const refundUnavailableReason = !canRefund || !customerId || canRefundSelected ? "" :
    !balanceReady ? (balance.isError || ledger.isError ? copy.refundBalanceError : copy.refundBalanceLoading) :
    actualBalance?.type === 1 ? copy.refundDebitHint : actualBalance?.type === 0 ? copy.refundZeroHint : copy.refundNoCreditHint;
  function selectFinanceTab(tab: "accounts" | "refunds") {
    if ((tab === "accounts" && !canAccountDetails) || (tab === "refunds" && !canRefundHistory)) return;
    setParams(previous => {const next = new URLSearchParams(previous); if (tab === "refunds") next.set("tab", "refunds"); else next.delete("tab"); return next;});
  }
  const accountViews: {key: AccountView; title: string}[] = canLedger ? [
    {key: "ledger", title: "كشف الحساب"}, {key: "delivered", title: "الشغل المستلّم"}, {key: "settlements", title: "تصفية الحساب"},
  ] : [];

  return <div className="space-y-4">
    <SectionHeader title="حسابات العملاء" detail="اعرف الرصيد، سجّل تحصيل، وراجع حساب الشغل المستلّم في مكان واحد."
      actions={<Button type="button" variant="outline" onClick={refresh}><RefreshCw className="size-4"/> تحديث</Button>}/>
    {(canAccountDetails || canRefundHistory) && <div role="tablist" aria-label={copy.moduleTabs} className="flex flex-wrap items-center gap-2">
      {canAccountDetails && <button type="button" role="tab" id="finance-accounts-tab" aria-controls="finance-accounts-panel" aria-selected={!globalRefunds} onClick={() => selectFinanceTab("accounts")}
        className={"rounded-lg px-4 py-2 text-sm font-semibold " + (!globalRefunds ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{copy.accountsTab}</button>}
      {canRefundHistory && <button type="button" role="tab" id="finance-refunds-tab" aria-controls="finance-refunds-panel" aria-selected={globalRefunds} onClick={() => selectFinanceTab("refunds")}
        className={"rounded-lg px-4 py-2 text-sm font-semibold " + (globalRefunds ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{copy.globalRefundsTab}</button>}
    </div>}
    {canAccountDetails && <div role="tabpanel" id="finance-accounts-panel" aria-labelledby="finance-accounts-tab" hidden={globalRefunds} className="space-y-4">
      {!globalRefunds && <>
        {canBalance && !customerId && <FinanceAccountsOverview onSelect={id => chooseCustomer(String(id))}/>}
        {!customerId && !canBalance && <section className="rounded-xl border bg-card p-5" aria-label="اختيار حساب العميل">
          <h2 className="mb-3 font-bold">اختَر عميلًا لعرض بيانات حسابه</h2>
          <SearchableSelect label="اختيار حساب العميل" placeholder="ابحث باسم العميل أو رقم هاتفه..." value={rawId} options={customers.data ?? []}
            onChange={chooseCustomer} loading={customers.isPending} disabled={customers.isError}/>
          {customers.isError && <ErrorState error={customers.error} retry={() => void customers.refetch()}/>}
        </section>}
        {customerId > 0 && <>
          <section aria-label="بيانات حساب العميل" className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <nav aria-label="مسار حساب العميل" className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <button type="button" onClick={() => chooseCustomer("")} className="font-semibold text-primary hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    {canBalance ? "حسابات العملاء" : "اختيار عميل"}
                  </button>
                  <span aria-hidden="true">/</span>
                  <span aria-current="page">حساب العميل</span>
                </nav>
                <h2 className="text-xl font-bold">{customerName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <p className="text-muted-foreground">{copy.phone}: <span dir="ltr" className="inline-block">{customerPhone ?? copy.notAvailable}</span></p>
                  {canCustomerProfile && <Link to={"/customers/" + customerId} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    {copy.customerRecord}<ArrowUpLeft className="size-3.5"/>
                  </Link>}
                </div>
              </div>
              <div className="space-y-1 text-start sm:text-end">
                <p className="text-xs text-muted-foreground">الرصيد الكلي — حتى الآن</p>
                {((canBalance && balance.isPending) || (!canBalance && canLedger && ledger.isPending)) ? <p className="text-sm">جاري تحميل الرصيد...</p> : actualBalance && balanceReady ?
                  <p className={"text-2xl font-extrabold " + (actualBalance.type === 1 ? "text-destructive" : actualBalance.type === 2 ? "text-emerald-700" : "text-foreground")}>
                    <span className="me-2 text-base">{accountTypeLabel(actualBalance.type)}</span><MoneyAmount amount={actualBalance.amount}/>
                  </p> : <p className="text-sm text-muted-foreground">{canBalance || canLedger ? "تعذّر عرض الرصيد" : "لا تملك صلاحية عرض الرصيد"}</p>}
                <p className="text-xs text-muted-foreground">يشمل الأوردرات المؤكدة حتى غير المستلّمة.</p>
              </div>
            </div>
            {(canCollect || canRefund || canRefundHistory || (canOpening && openingStatus.isSuccess && !hasOpening)) &&
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" aria-label={copy.accountActions}>
                {canCollect && <Button onClick={() => setCollecting(true)}><Plus className="size-4"/> تسجيل تحصيل</Button>}
                {(canRefund || canRefundHistory || (canOpening && openingStatus.isSuccess && !hasOpening)) &&
                  <details className="relative">
                    <summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold">إجراءات أخرى</summary>
                    <div className="absolute start-0 z-20 mt-2 w-72 space-y-2 rounded-xl border bg-card p-3 shadow-lg">
                      {canRefund && <>
                        <Button className="w-full justify-start" size="sm" variant="outline" disabled={!canRefundSelected} title={refundUnavailableReason || undefined} onClick={() => setRefunding(true)}>
                          <RotateCcw className="size-4"/>{copy.refundAction}
                        </Button>
                        <p role="status" className="text-xs leading-5 text-muted-foreground">
                          {canRefundSelected && actualBalance?.type === 2 ? <>{copy.refundableAmount}: <MoneyAmount amount={actualBalance.amount}/></> : refundUnavailableReason || copy.refundValidatedByServer}
                        </p>
                      </>}
                      {canRefundHistory && <Button className="w-full justify-start" size="sm" variant="outline" onClick={() => changeView("refunds")}>
                        <History className="size-4"/>{copy.customerRefundsAction}
                      </Button>}
                      {canOpening && openingStatus.isSuccess && !hasOpening &&
                        <Button className="w-full justify-start" size="sm" variant="outline" onClick={() => setOpening(true)}>
                          <Plus className="size-4"/>{copy.openingAction}
                        </Button>}
                    </div>
                  </details>}
              </div>}
          </section>
          {customers.isError && <ErrorState error={customers.error} retry={() => void customers.refetch()}/>}
          {canOpening && openingStatus.isError && <ErrorState error={openingStatus.error} retry={() => void openingStatus.refetch()}/>}
          {canBalance && balance.isError && <ErrorState error={balance.error} retry={() => void balance.refetch()}/>}
          {!canBalance && canLedger && ledger.isError && <ErrorState error={ledger.error} retry={() => void ledger.refetch()}/>}
          {accountViews.length > 0 && <div role="tablist" aria-label="تفاصيل حساب العميل" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
            {accountViews.map(tab => <button key={tab.key} role="tab" id={`account-${tab.key}-tab`} aria-controls={`account-${tab.key}-panel`} aria-selected={view === tab.key} onClick={() => changeView(tab.key)}
              className={"rounded-lg px-4 py-2.5 text-sm font-bold " + (view === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{tab.title}</button>)}
          </div>}
          {view === "refunds" && canRefundHistory && <><Button size="sm" variant="ghost" onClick={() => changeView("ledger")}>{copy.backToLedger}</Button><RefundsPanel key={customerId} customerId={customerId}/></>}
          {canLedger && view === "delivered" && <div role="tabpanel" id="account-delivered-panel" aria-labelledby="account-delivered-tab"><CustomerSettlementPanel key={customerId} customerId={customerId}/></div>}
          {canLedger && view === "settlements" && <div role="tabpanel" id="account-settlements-panel" aria-labelledby="account-settlements-tab"><AccountSettlementPanel key={customerId} customerId={customerId} canConfirm={canCollect} canViewCollections={canViewCollections}/></div>}
          {canLedger && view === "ledger" && <section role="tabpanel" id="account-ledger-panel" aria-labelledby="account-ledger-tab" className="space-y-3">
            <div><h2 className="font-bold">كشف الحساب</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">الأحدث أولًا. الرصيد بعد الحركة تراكمي من كامل الحساب، وليس مجموع الصفوف المعروضة بعد الفلترة.</p></div>
            <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-3">
              <CreatedDatePicker label="من تاريخ" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={value => changeFilter("dateFrom", value)}/>
              <CreatedDatePicker label="إلى تاريخ" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={value => changeFilter("dateTo", value)}/>
              <label className="space-y-1 text-xs font-semibold">نوع الحركة<select className={fieldClass} aria-label="نوع الحركة المالية" value={filters.type} onChange={event => changeFilter("type", event.target.value)}>{movementTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {(filters.dateFrom || filters.dateTo || filters.type) && <div className="md:col-span-3"><Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>مسح الفلاتر</Button></div>}
            </div>
            {ledger.isPending ? <LoadingState/> : ledger.isError ? <ErrorState error={ledger.error} retry={() => void ledger.refetch()}/> : ledger.data?.entries.length ? <div className="overflow-hidden rounded-xl border bg-card">
              <header className="flex justify-between border-b px-4 py-3"><h3 className="font-bold">سجل الحركات</h3><span className="text-sm text-muted-foreground">{ledger.data.pagination.total.toLocaleString("ar-EG")} حركة</span></header>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-muted/50"><tr>
                {["التاريخ", "العملية والتفاصيل", "زيادة على الحساب (+)", "دفعة / تخفيض (−)", "الرصيد بعد الحركة"].map(title => <th key={title} className="whitespace-nowrap px-3 py-3 text-xs font-semibold">{title}</th>)}
              </tr></thead><tbody className="divide-y">
                {ledger.data.entries.map(entry => {
                  const credit = entry.signedAmount.startsWith("-");
                  const reference = entry.collectionId && entry.receiptNumber ? entry.receiptNumber : entry.refundId && entry.refundNumber ? entry.refundNumber : entry.orderNumber ?? null;
                  return <tr key={entry.id} className="hover:bg-muted/20">
                    <td className="whitespace-nowrap px-3 py-3"><span dir="ltr" className="inline-block">{formatCollectionDate(entry.effectiveDate)}</span></td>
                    <td className="min-w-[220px] px-3 py-3">
                      <p className="font-semibold">{entry.type === 4 ? "إلغاء تحصيل سابق" : entry.type === 5 ? "رد مبلغ للعميل" : entry.typeLabel}</p>
                      {reference && <div className="mt-1 space-y-1 text-xs">
                        {entry.collectionId && canViewCollections ? <Link className="text-primary underline" to={`/collections?receiptId=${entry.collectionId}`}><span dir="ltr" className="inline-block">{reference}</span></Link> :
                          entry.refundId && canRefundHistory ? <button className="text-primary underline" onClick={() => setRefundDetailsId(entry.refundId)}><span dir="ltr">{reference}</span></button> :
                          entry.orderId && canViewOrders ? <Link className="text-primary underline" to={`/orders/${entry.orderId}`}><span dir="ltr" className="inline-block">{reference}</span></Link> : <span dir="ltr" className="inline-block">{reference}</span>}
                        {entry.collectionId && entry.orderId && entry.orderNumber && canViewOrders && <Link className="block text-muted-foreground underline" to={`/orders/${entry.orderId}`}>{copy.relatedOrder}: <span dir="ltr" className="inline-block">{entry.orderNumber}</span></Link>}
                      </div>}
                      {entry.note && <button className="mt-1 block max-w-56 truncate text-right text-xs text-muted-foreground underline" onClick={() => setSelectedNote(entry.note)} aria-label={copy.showNote} title={entry.note}>{entry.note}</button>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{credit ? "—" : <MoneyAmount amount={entry.amount}/>}</td>
                    <td className="whitespace-nowrap px-3 py-3">{credit ? <MoneyAmount amount={entry.amount}/> : "—"}</td>
                    <td className={"whitespace-nowrap px-3 py-3 font-semibold " + (entry.runningBalance.type === 1 ? "text-destructive" : entry.runningBalance.type === 2 ? "text-emerald-700" : "")}>
                      {accountTypeLabel(entry.runningBalance.type)} · <MoneyAmount amount={entry.runningBalance.amount}/>
                    </td>
                  </tr>;
                })}
              </tbody></table></div>
            </div> : <EmptyState title="لا توجد حركات مالية" detail="لا توجد حركات للعميل ضمن الفلاتر الحالية."/>}
            {ledger.data && ledger.data.pagination.lastPage > 1 && <PaginationBar pagination={ledger.data.pagination} onPage={page => setFilters(previous => ({...previous, page}))}/>}
          </section>}
          {!canBalance && !canLedger && <p className="rounded-xl border bg-card p-4 text-sm">لا تملك صلاحية عرض الأرصدة أو كشف الحساب. يمكنك تنفيذ الإجراءات المالية المسموح بها فقط.</p>}
        </>}
      </>}
    </div>}
    {canRefund && !canAccountDetails && <section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-bold">رد الأرصدة الدائنة</h2><Button onClick={() => setRefunding(true)}>رد رصيد دائن</Button></section>}
    {canRefundHistory && <section role="tabpanel" id="finance-refunds-panel" aria-labelledby="finance-refunds-tab" hidden={!globalRefunds}>{globalRefunds && <RefundsPanel key="global"/>}</section>}
    {selectedNote !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><section role="dialog" aria-modal="true" aria-label={copy.noteDialog} className="w-full max-w-md rounded-xl bg-card p-5">
      <header className="mb-3 flex justify-between"><h3 className="font-bold">{copy.noteDialog}</h3><Button variant="ghost" size="icon-sm" aria-label={copy.returnAccount} onClick={() => setSelectedNote(null)}><X className="size-4"/></Button></header><p className="whitespace-pre-wrap break-words text-sm">{selectedNote}</p>
    </section></div>}
    {refundDetailsId !== null && canRefundHistory && <RefundDetailsDialog id={refundDetailsId} onClose={() => setRefundDetailsId(null)}/>}
    {opening && customerId > 0 && canOpening && openingStatus.isSuccess && !hasOpening && <OpeningBalanceDialog key={customerId} customerId={customerId} customerName={customerName} onClose={() => setOpening(false)} onSuccess={() => {setOpening(false); refresh();}}/>}
    {refunding && canRefund && <CreateRefundDialog initialCustomerId={customerId} onClose={() => setRefunding(false)} onSuccess={() => {setRefunding(false); refresh();}}/>}
    {collecting && canCollect && customerId > 0 && <AccountCollectionDialog customerId={customerId} customerName={customerName} onClose={() => setCollecting(false)} onSuccess={() => {setCollecting(false); refresh();}}/>}
  </div>;
}
