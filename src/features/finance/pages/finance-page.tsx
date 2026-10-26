import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpLeft, ChevronDown, ChevronUp, History, Plus, RefreshCw, RotateCcw, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { ErrorState, LoadingState, EmptyState, PaginationBar, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { CollectionDateField, formatCollectionDate } from "@/features/collections/components/collection-date-field";
import { useFinanceCustomers, useFinanceBalance, useFinanceLedger, useFinanceOpeningStatus } from "../hooks/use-finance";
import { RefundsPanel } from "../components/refunds-panel";
import { CreateRefundDialog } from "../components/refund-dialogs";
import { OpeningBalanceDialog } from "../components/opening-balance-dialog";
import type { AccountFilters } from "../types/finance.types";

const defaultFilters: AccountFilters = { page: 1, dateFrom: "", dateTo: "", type: "" };
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
  const canAccountDetails = canBalance || canLedger || canOpening;

  const [params, setParams] = useSearchParams();
  const rawId = params.get("customerId") ?? "";
  const parsedId = Number(rawId);
  const customerId = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  const customers = useFinanceCustomers(canAccountDetails);
  const selected = customers.data?.find(item => item.value === customerId);
  // Customer selects currently expose a "name - phone" label, not separate profile fields.
  const selectedParts = selected?.label.match(/^(.*)\s[-–]\s(\+?\d+)$/);
  const customerName = selectedParts?.[1] ?? selected?.label ?? `عميل #${customerId}`;
  const customerPhone = selectedParts?.[2] ?? null;

  const [filters, setFilters] = useState<AccountFilters>(defaultFilters);
  const [opening, setOpening] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const qc = useQueryClient();

  const balance = useFinanceBalance(customerId, canBalance);
  const ledger = useFinanceLedger(customerId, filters, canLedger);
  const openingStatus = useFinanceOpeningStatus(customerId, canOpening);
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
  const canRefundSelected = canRefund && customerId > 0 &&
    ((!canBalance && !canLedger) || (balanceReady && actualBalance?.type === 2));
  const openingAlreadyRegistered = canOpening && openingStatus.isSuccess
    ? openingStatus.data.openingBalanceExists
    : canBalance ? balance.data?.openingBalanceExists
    : canLedger ? ledger.data?.openingBalanceExists : undefined;
  const refundHistoryVisible = canRefundHistory && (historyExpanded || !canAccountDetails);

  return <div className="space-y-4">
    <SectionHeader title="حسابات العملاء"
      detail="أرصدة العملاء وكشف الحساب، مع تسجيل الرصيد الافتتاحي ورد الرصيد الدائن."
      actions={<Button type="button" variant="outline" onClick={refresh}>
        <RefreshCw className="size-4"/> تحديث
      </Button>}/>

    {canAccountDetails && <section className="space-y-3">
      <section aria-label="اختيار حساب العميل" className="rounded-2xl border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <UserRound className="size-4 text-primary"/>
          <h2 className="text-sm font-extrabold">اختيار العميل</h2>
          <span className="text-xs text-foreground/65">ابحث بالاسم أو رقم الهاتف لعرض حسابه</span>
        </div>
        <div className="mt-2 max-w-xl">
          <SearchableSelect label="اختيار حساب العميل" placeholder="ابحث باسم العميل أو رقم هاتفه..."
            value={rawId} options={customers.data ?? []} onChange={chooseCustomer}
            loading={customers.isPending} disabled={customers.isError}/>
        </div>
        {customers.isError && <ErrorState error={customers.error} retry={() => void customers.refetch()}/>}
        {customers.isSuccess && customers.data.length === 0 &&
          <p className="mt-2 text-sm text-foreground/70">لا يوجد عملاء مسجلون.</p>}
      </section>

      {!customerId && <div className="rounded-xl border border-dashed bg-card p-6 text-center">
        <UserRound className="mx-auto mb-2 size-6 text-primary"/>
        <p className="font-semibold">اختَر عميلًا لعرض بيانات حسابه</p>
        <p className="mt-1 text-sm text-foreground/65">بيانات العميل والرصيد وكشف الحساب ستظهر هنا مباشرةً.</p>
      </div>}

      {customerId > 0 && <div className="space-y-3">
        <section aria-label="بيانات حساب العميل" className="rounded-2xl border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-foreground/65">العميل المحدد</p>
              <h2 className="break-words text-base font-extrabold">{customerName}</h2>
              {customerPhone && <p dir="ltr" className="w-fit text-sm font-medium tabular-nums text-foreground/75">{customerPhone}</p>}
              {canCustomerProfile && <Link to={`/customers/${customerId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                ملف العميل <ArrowUpLeft className="size-3.5"/>
              </Link>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canOpening && openingStatus.isSuccess && !hasOpening && <Button size="sm" type="button"
                variant="outline" onClick={() => setOpening(true)}>
                <Plus className="size-4"/> رصيد افتتاحي
              </Button>}
              {canRefundSelected && <Button size="sm" type="button" onClick={() => setRefunding(true)}>
                <RotateCcw className="size-4"/> رد رصيد دائن
              </Button>}
            </div>
          </div>

          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground/65">الهاتف</p>
              <p dir="ltr" className="w-fit font-semibold tabular-nums">{customerPhone ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground/65">الرصيد الحالي</p>
              {((canBalance && balance.isPending) || (!canBalance && canLedger && ledger.isPending))
                ? <p className="text-sm text-foreground/65">جاري تحميل الرصيد...</p>
                : actualBalance && balanceReady
                  ? <div className={"text-lg font-extrabold tabular-nums " +
                    (actualBalance.type === 1 ? "text-rose-700" :
                    actualBalance.type === 2 ? "text-emerald-700" : "text-foreground")}>
                      <span className="me-2 text-sm">{actualBalance.typeLabel}</span>
                      <MoneyAmount amount={actualBalance.amount}/>
                    </div>
                  : <p className="text-sm text-foreground/65">
                      {canBalance || canLedger ? "تعذّر عرض الرصيد" : "لا تملك صلاحية عرض الرصيد"}
                    </p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground/65">الرصيد الافتتاحي</p>
              {openingAlreadyRegistered === undefined
                ? <p className="text-sm text-foreground/65">غير متاح</p>
                : <p className="text-sm font-semibold text-foreground/80">
                    {openingAlreadyRegistered ? "مسجل" : "لم يُسجّل"}
                  </p>}
            </div>
          </div>
          <p className="mt-2 text-xs text-foreground/60">الرصيد محسوب من دفتر الأستاذ ولا يُعدّل مباشرةً.</p>
        </section>

        {canOpening && openingStatus.isError &&
          <ErrorState error={openingStatus.error} retry={() => void openingStatus.refetch()}/>}
        {canBalance && balance.isError &&
          <ErrorState error={balance.error} retry={() => void balance.refetch()}/>}
        {!canBalance && canLedger && ledger.isError &&
          <ErrorState error={ledger.error} retry={() => void ledger.refetch()}/>}
        {canLedger && <section aria-label="كشف حساب العميل" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <History className="size-4 text-primary"/>
            <h2 className="text-sm font-extrabold">كشف الحساب</h2>
            <span className="text-xs text-foreground/65">
              الرصيد التراكمي محسوب من جميع الحركات السابقة حتى خارج الفلاتر
            </span>
          </div>
          <div className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-3">
            <CollectionDateField label="من تاريخ" value={filters.dateFrom} max={filters.dateTo || undefined}
              onChange={value => changeFilter("dateFrom", value)}/>
            <CollectionDateField label="إلى تاريخ" value={filters.dateTo} min={filters.dateFrom || undefined}
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
            ledger.data?.entries.length ? <div className="overflow-hidden rounded-2xl border bg-card">
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
                    return <tr key={entry.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums"><span dir="ltr" className="inline-block">{formatCollectionDate(entry.effectiveDate)}</span></td>
                      <td className="px-3 py-3 font-semibold">{entry.typeLabel}</td>
                      <td className="px-3 py-3 font-semibold">{!credit ? <MoneyAmount amount={entry.amount}/> : "—"}</td>
                      <td className="px-3 py-3 font-semibold">{credit ? <MoneyAmount amount={entry.amount}/> : "—"}</td>
                      <td className={"whitespace-nowrap px-3 py-3 font-bold tabular-nums " +
                        (entry.runningBalance.type === 1 ? "text-rose-700" : entry.runningBalance.type === 2 ? "text-emerald-700" : "text-foreground")}>
                        {entry.runningBalance.typeLabel} · <MoneyAmount amount={entry.runningBalance.amount}/>
                      </td>
                      <td className="px-3 py-3">{entry.orderId && canViewOrders ?
                        <Link className="font-semibold text-primary underline" to={`/orders/${entry.orderId}`}>أوردر #{entry.orderId}</Link> :
                        entry.orderId ? `أوردر #${entry.orderId}` : entry.collectionId ? `تحصيل #${entry.collectionId}` :
                          entry.refundId ? `رد رصيد #${entry.refundId}` : "—"}</td>
                      <td className="max-w-56 truncate px-3 py-3 text-foreground/70" title={entry.note ?? undefined}>{entry.note ?? "—"}</td>
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
    </section>}

    {canRefund && !canAccountDetails && <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-extrabold">رد الأرصدة الدائنة</h2>
      <Button type="button" size="sm" onClick={() => setRefunding(true)}>
        <RotateCcw className="size-4"/> رد رصيد دائن
      </Button>
      <p className="text-xs text-foreground/65">يمكنك اختيار العميل داخل نموذج رد الرصيد.</p>
    </section>}

    {canRefundHistory && <section aria-label="سجل رد الأرصدة" className="space-y-2">
      {canAccountDetails && <Button type="button" variant="outline" aria-expanded={historyExpanded}
        onClick={() => setHistoryExpanded(value => !value)}>
        <History className="size-4"/> سجل رد الأرصدة
        {historyExpanded ? <ChevronUp className="size-4"/> : <ChevronDown className="size-4"/>}
      </Button>}
      {refundHistoryVisible && <RefundsPanel/>}
    </section>}

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
