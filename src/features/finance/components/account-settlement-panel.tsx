import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, FileSpreadsheet, History, Plus, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { formatEgp } from "@/shared/lib/format-egp";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { MoneyAmount } from "@/shared/components/money-amount";
import { ErrorState, LoadingState, PaginationBar, fieldClass } from "@/features/identity/components/identity-ui";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { parseCents, centsToMoney } from "@/features/deliveries/lib/delivery-money";
import { getApiErrorMessage } from "@/shared/api/http";
import { previewAccountSettlement, confirmAccountSettlement, listAccountSettlements, getAccountSettlement } from "../api/account-settlements.api";
import type { AccountSettlementInput, AccountSettlementRecord } from "../types/account-settlement.types";
import { AccountPaymentFields, type AccountPaymentValue } from "./account-payment-fields";
import { absoluteAmount, balanceDescription, cairoToday } from "../lib/account-display";
import { renderAccountSettlementEvidence } from "../lib/account-settlement-print";
import { exportAccountSettlementXlsx } from "../lib/account-settlement-xlsx";

export function AccountSettlementPanel({customerId, customerName, canConfirm, canViewCollections, canDiscount = false}: {
  customerId: number; customerName?: string; canConfirm: boolean; canViewCollections: boolean; canDiscount?: boolean;
}) {
  const qc = useQueryClient();
  const [cutoff, setCutoff] = useState(cairoToday);
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('0.00');
  const [discountReason, setDiscountReason] = useState('');
  const [discountOpen, setDiscountOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const [payment, setPayment] = useState<AccountPaymentValue>({method: 0, destination: ""});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState<"new" | "history">("history");
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState<AccountSettlementRecord | null>(null);
  const [openingRecord, setOpeningRecord] = useState(false);
  const keys = useRef(new Map<string, string>());
  const validDate = Boolean(cutoff && cutoff <= cairoToday());
  useEffect(() => {
    if (!datePopoverOpen) return;
    function dismissOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && datePopoverRef.current?.contains(target)) return;
      // The existing calendar renders its own dialog in a portal outside this panel.
      if (target instanceof Element && target.closest('[role="dialog"][aria-label="اختيار الشغل المستلّم حتى"]')) return;
      setDatePopoverOpen(false);
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDatePopoverOpen(false);
    }
    document.addEventListener("pointerdown", dismissOnOutsideClick);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsideClick);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [datePopoverOpen]);
  const preview = useQuery({queryKey: ["finance", "settlement-preview", customerId, cutoff],
    queryFn: () => previewAccountSettlement(customerId, cutoff), enabled: mode === "new" && validDate && !record,
    refetchOnWindowFocus: false, retry: false});
  const history = useQuery({queryKey: ["finance", "account-settlements", customerId, page],
    queryFn: () => listAccountSettlements(customerId, page), enabled: mode === "history", retry: false});
  const mutation = useMutation({mutationFn: ({payload, key}: {payload: AccountSettlementInput; key: string}) => confirmAccountSettlement(customerId, payload, key), retry: false});
  const data = preview.data;
  const modalCustomerName = data?.customerName || customerName || `عميل #${customerId}`;
  const due = data ? parseCents(data.dueNow) : null;
  const accountCents = data ? parseCents(data.accountBalance.startsWith('-') ? '0.00' : data.accountBalance) : null;
  const discountCents = parseCents(discountInput);
  const afterDiscount = due === null || discountCents === null ? null : due - discountCents;
  const discountAmountValid = discountCents !== null && due !== null && accountCents !== null &&
    discountCents <= due && discountCents <= accountCents;
  const discountReasonValid = discountCents === 0 || (discountCents !== null && canDiscount && discountReason.trim().length >= 3);
  const allowedDiscount = discountAmountValid && discountReasonValid;
  // Never prefill a real cash collection: the operator must confirm what was actually received.
  const amount = amountInput ?? (due === 0 ? "0.00" : "");
  const cents = parseCents(amount);
  const projectedRemainder = discountAmountValid && afterDiscount !== null && cents !== null && cents <= afterDiscount
    ? afterDiscount - cents : null;
  const busy = mutation.isPending;
  const valid = canConfirm && !busy && !stale && preview.isSuccess && !preview.isFetching && data?.hasWork &&
    cents !== null && afterDiscount !== null && allowedDiscount && cents <= afterDiscount &&
    (cents === 0 || payment.method === 0 || payment.destination !== "");
  async function refreshPreview() {
    setStale(false); setError(""); setAmountInput(null);
    await preview.refetch();
  }
  async function confirm() {
    if (!valid || !data || cents === null) return;
    const payload: AccountSettlementInput = {dateTo: cutoff, previewHash: data.previewHash, amount: centsToMoney(cents),
      ...(discountCents !== null && discountCents > 0 ? {
        discountAmount: centsToMoney(discountCents), discountReason: discountReason.trim(),
      } : {}),
      ...(note.trim() ? {note: note.trim()} : {}),
      ...(cents > 0 ? {paymentMethod: payment.method, ...(payment.method !== 0 ? {paymentDestinationId: Number(payment.destination)} : {})} : {})};
    const fingerprint = JSON.stringify(payload);
    let key = keys.current.get(fingerprint);
    if (!key) {key = crypto.randomUUID(); keys.current.set(fingerprint, key);}
    setError("");
    try {
      const saved = await mutation.mutateAsync({payload, key});
      setRecord(saved);
      await Promise.all(["finance", "collections", "customers", "orders", "deliveries"].map(name => qc.invalidateQueries({queryKey: [name]})));
      toast.success(saved.statusLabel);
    } catch (cause) {
      if ((cause as {response?: {status?: number}}).response?.status === 409) setStale(true);
      setError(getApiErrorMessage(cause, "تعذّر تسجيل التصفية. راجع الحساب قبل المحاولة مرة أخرى."));
    }
  }
  async function openRecord(id: number) {
    setOpeningRecord(true); setError("");
    try {setRecord(await getAccountSettlement(customerId, id));}
    catch (cause) {setError(getApiErrorMessage(cause, "تعذّر فتح التصفية."));}
    finally {setOpeningRecord(false);}
  }
  async function printRecord() {
    if (!record) return;
    const popup = window.open("", "_blank");
    if (!popup) {toast.error("اسمح للمتصفح بفتح نافذة الطباعة."); return;}
    popup.opener = null;
    try {
      // Re-read review flags before issuing evidence, not an old browser snapshot.
      const latest = await getAccountSettlement(customerId, record.id);
      setRecord(latest);
      popup.document.open(); popup.document.write(renderAccountSettlementEvidence(latest));
      popup.addEventListener("load", () => {popup.focus(); popup.print();}, {once: true});
      popup.document.close();
    } catch (cause) {popup.close(); toast.error(getApiErrorMessage(cause, "تعذّر تحميل إثبات التصفية."));}
  }
  async function exportExcelRecord() {
    if (!record) return;
    try {
      // Preserve original settlement evidence, refresh only the current review flag.
      const latest = await getAccountSettlement(customerId, record.id);
      setRecord(latest);
      exportAccountSettlementXlsx(latest);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "تعذّر تصدير إثبات التصفية."));
    }
  }
  function startNew() {
    setRecord(null); setMode("new"); setAmountInput(null);
    setPayment({method: 0, destination: ""}); setNote("");
    setDiscountInput('0.00'); setDiscountReason(''); setDiscountOpen(false); setDatePopoverOpen(false);
    setError(""); setStale(false);
  }

  return <section aria-label="التصفية المالية" className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">تصفية حساب العميل</h2>
        <p className="mt-1 text-sm text-muted-foreground">راجع المستحق عن الشغل المستلّم، وسجّل ما دفعه العميل فعلًا.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {mode === "new" && !record ? null : <>
          <Button size="sm" disabled={busy} onClick={startNew}>تصفية جديدة</Button>
          {record && <Button variant="ghost" size="sm" disabled={busy}
            onClick={() => {setMode("history"); setRecord(null); setError("");}}>
            <History className="size-4"/> التصفيات السابقة
          </Button>}
        </>}
      </div>
    </header>

    {error && mode !== "new" && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {error}
      {stale && <Button variant="outline" className="ms-3" size="sm" onClick={() => void refreshPreview()}>تحديث المراجعة</Button>}
    </div>}
    {openingRecord && <LoadingState/>}

    {record ? <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="نتيجة التصفية">
      <div className="flex items-center gap-2">
        {record.needsReview ? <TriangleAlert className="size-6 text-destructive"/> : <CheckCircle2 className="size-6 text-primary"/>}
        <h3 className="text-lg font-bold">{record.statusLabel}</h3>
      </div>
      <p className="text-sm text-muted-foreground"><span dir="ltr">{record.number}</span> · تاريخ التنفيذ: {record.settledOn}</p>
      {record.needsReview && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
        حدث إلغاء أو رد مالي بعد تسجيل التصفية. هذا الإثبات يحتاج مراجعة ولا يؤكد سداد الرصيد الحالي.
      </p>}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">خصم هذه التصفية (ليس تحصيلًا)</dt>
          <dd className="mt-2 text-xl font-bold"><MoneyAmount amount={record.discountAmount ?? '0.00'}/></dd>
          {record.discountReason && <p className="mt-1 text-xs text-muted-foreground">السبب: {record.discountReason}</p>}
        </div>
        <div className="rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">المبلغ المحصّل في هذه التصفية</dt>
          <dd className="mt-2 text-xl font-bold"><MoneyAmount amount={record.amountCollected}/></dd>
        </div>
        <div className="rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{record.balanceAfter.startsWith("-") ? "رصيد للعميل بعد التصفية" : "المتبقي بعد التصفية"}</dt>
          <dd className="mt-2 text-xl font-bold"><MoneyAmount amount={absoluteAmount(record.balanceAfter)}/></dd>
        </div>
      </dl>
      <p className="text-sm leading-6 text-muted-foreground">
        رصيد حساب العميل الكلي بعد العملية: {balanceDescription(record.accountBalanceAfter)} <MoneyAmount amount={absoluteAmount(record.accountBalanceAfter)}/>.
        التصفية تخص الشغل المحدد ولا تمسح مديونيات أوردرات أخرى لم تُسلَّم.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void printRecord()}><Printer className="size-4"/> طباعة إثبات التصفية</Button>
        <Button variant="outline" onClick={() => void exportExcelRecord()}>
          <FileSpreadsheet className="size-4"/> تصدير إثبات Excel
        </Button>
        {record.collectionId && canViewCollections && <Button variant="outline" asChild><Link to={"/collections?receiptId=" + record.collectionId}>إيصال التحصيل {record.receiptNumber}</Link></Button>}
        {!record.collectionId && <span className="self-center text-sm text-muted-foreground">لم يُسجّل تحصيل جديد في هذه العملية.</span>}
      </div>
    </section> : mode === "new" ? <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-2 sm:p-4"
      onMouseDown={event => {if (event.target === event.currentTarget && !busy) setMode("history");}}>
      <section role="dialog" aria-modal="true" aria-label="تصفية حساب جديدة" dir="rtl"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl sm:max-h-[92vh]"
        onKeyDown={event => {if (event.key === "Escape" && !busy) {
          if (datePopoverOpen) setDatePopoverOpen(false);
          else setMode("history");
        }}}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold sm:text-lg">تصفية حساب — {modalCustomerName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">راجع المستحق وسجّل المبلغ الذي استلمته فعليًا.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setMode("history")}>إغلاق</Button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
            {stale && <Button variant="outline" className="ms-3" size="sm"
              onClick={() => void refreshPreview()}>تحديث المراجعة</Button>}
          </div>}
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>الشغل حتى <span dir="ltr" className="inline-block font-semibold text-foreground">
                {cutoff ? formatCollectionDate(cutoff) : "—"}
              </span></span>
              <span aria-hidden="true">·</span>
              <span>الدفعات حتى اليوم</span>
              <div className="relative" ref={datePopoverRef}>
                <button type="button" aria-expanded={datePopoverOpen} aria-controls="settlement-date-popover"
                  disabled={busy} onClick={() => setDatePopoverOpen(open => !open)}
                  className="inline-flex items-center gap-1 rounded-md px-1 py-1 font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  تغيير التاريخ <ChevronDown className="size-3.5" aria-hidden="true"/>
                </button>
                {datePopoverOpen && <div id="settlement-date-popover" role="group" aria-label="تعديل تاريخ الشغل"
                  className="absolute right-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-lg border bg-card p-3 text-foreground shadow-lg">
                  <CreatedDatePicker label="الشغل المستلّم حتى" value={cutoff} max={cairoToday()} disabled={busy}
                    onChange={value => {
                      if (busy) return;
                      setDatePopoverOpen(false); setCutoff(value); setAmountInput(null); setDiscountInput('0.00');
                      setDiscountReason(''); setDiscountOpen(false); setStale(false); setError("");
                    }}/>
                </div>}
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={busy || preview.isFetching || !validDate}
              onClick={() => void refreshPreview()}>
              <RefreshCw className="size-3.5" aria-hidden="true"/> تحديث الحساب
            </Button>
          </div>
          {!validDate ? <p role="alert" className="text-sm text-destructive">اختر تاريخًا صحيحًا لا يتجاوز اليوم.</p>
            : preview.isPending ? <LoadingState/>
            : preview.isError ? <ErrorState error={preview.error} retry={() => void preview.refetch()}/>
            : data && <>
              <section className="mx-auto w-full max-w-3xl space-y-4" aria-label="إتمام التصفية">
                <div className="space-y-1 py-1 text-center">
                  <p className="text-sm text-muted-foreground">
                    {due === 0 && data.balanceBefore.startsWith("-") ? "رصيد دائن للعميل ضمن التصفية" : "المستحق على العميل"}
                  </p>
                  <p className={"text-3xl font-extrabold tabular-nums sm:text-4xl " +
                    (due === 0 && data.balanceBefore.startsWith("-") ? "text-emerald-700" : "text-primary")}>
                    <MoneyAmount amount={due === 0 && data.balanceBefore.startsWith("-")
                      ? absoluteAmount(data.balanceBefore) : data.dueNow}/>
                  </p>
                </div>
                {data.outsideBalance !== "0.00" && data.outsideBalance !== "0" && <p
                  className="text-center text-xs text-muted-foreground">
                  {balanceDescription(data.outsideBalance)} خارج هذه التصفية: <MoneyAmount amount={absoluteAmount(data.outsideBalance)}/>
                </p>}
                {!canConfirm ? <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                    يمكن مراجعة الحساب، لكن تسجيل التصفية يحتاج صلاحية تسجيل التحصيل.
                  </p>
                  : !data.hasWork ? <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                    لا يوجد شغل مستلّم أو رصيد افتتاحي لتصفيته.
                  </p>
                  : <>
                    {due === 0 ? <p className="text-center text-sm text-muted-foreground">
                      لا يوجد مبلغ مطلوب الآن. يمكنك حفظ مراجعة الحساب بدون تحصيل أو إيصال قبض جديد.
                    </p> : <div className={cents !== null && cents > 0 && afterDiscount !== null && cents <= afterDiscount
                      ? "grid items-start gap-4 md:grid-cols-2" : "space-y-2"}>
                      <div className="space-y-2">
                        <label className="block space-y-1.5 text-sm font-semibold">
                          <span>المبلغ المستلم الآن</span>
                          <input aria-label="مبلغ التصفية المستلم" className={fieldClass} dir="ltr" inputMode="decimal"
                            placeholder="اكتب المبلغ المدفوع فعليًا" value={amount} disabled={busy}
                            onChange={event => {setAmountInput(event.target.value); setError("");}}/>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" disabled={busy || !allowedDiscount}
                            onClick={() => setAmountInput(centsToMoney(afterDiscount ?? 0))}>دفع كامل المتبقي بعد الخصم</Button>
                          <Button type="button" variant="ghost" size="sm" disabled={busy}
                            onClick={() => setAmountInput('0.00')}>بدون تحصيل الآن</Button>
                        </div>
                        {amountInput !== null && (cents === null || (afterDiscount !== null && cents > afterDiscount)) &&
                          <p role="alert" className="text-xs text-destructive">
                            أدخل مبلغًا صحيحًا لا يتجاوز المستحق بعد الخصم.
                          </p>}
                      </div>
                      {cents !== null && cents > 0 && afterDiscount !== null && cents <= afterDiscount &&
                        <AccountPaymentFields value={payment} onChange={setPayment} disabled={busy}/>}
                    </div>}
                    {canDiscount && due !== null && due > 0 && <>
                      <button type="button" aria-expanded={discountOpen} aria-controls="settlement-discount-fields"
                        disabled={busy} onClick={() => {
                          if (discountOpen) {setDiscountInput('0.00'); setDiscountReason('');}
                          setDiscountOpen(!discountOpen); setError("");
                        }} className="inline-flex items-center gap-2 rounded-md py-1 text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {discountOpen ? <ChevronDown className="size-4 rotate-180" aria-hidden="true"/> :
                          <Plus className="size-4" aria-hidden="true"/>}
                        {discountOpen ? "إلغاء الخصم" : "إضافة خصم"}
                      </button>
                      {discountOpen && <div id="settlement-discount-fields" className={"grid gap-3 rounded-lg bg-muted/25 p-3 " +
                        (discountCents !== null && discountCents > 0 ? "sm:grid-cols-2" : "grid-cols-1")}>
                        <div className="space-y-1">
                          <label className="block space-y-1.5 text-sm font-semibold">
                            <span>قيمة الخصم (ج.م)</span>
                            <input aria-label="خصم ثابت" aria-invalid={!discountAmountValid}
                              aria-describedby={!discountAmountValid ? "settlement-discount-amount-error" : undefined}
                              className={fieldClass} dir="ltr" inputMode="decimal" placeholder="0.00"
                              value={discountInput} disabled={busy}
                              onChange={event => {setDiscountInput(event.target.value); setError("");}}/>
                          </label>
                          {!discountAmountValid && <p id="settlement-discount-amount-error" role="alert"
                            className="text-xs text-destructive">
                            أدخل خصمًا صحيحًا لا يتجاوز المستحق أو مديونية العميل.
                          </p>}
                        </div>
                        {discountCents !== null && discountCents > 0 && <div className="space-y-1">
                          <label className="block space-y-1.5 text-sm font-semibold">
                            <span>سبب الخصم *</span>
                            <input aria-label="سبب الخصم" aria-invalid={!discountReasonValid}
                              aria-describedby={!discountReasonValid ? "settlement-discount-reason-error" : undefined}
                              className={fieldClass} value={discountReason} maxLength={1000} disabled={busy}
                              placeholder="مثال: خصم متفق عليه مع العميل"
                              onChange={event => {setDiscountReason(event.target.value); setError("");}}/>
                          </label>
                          {!discountReasonValid && <p id="settlement-discount-reason-error" role="alert"
                            className="text-xs text-destructive">
                            اكتب سبب الخصم قبل التأكيد (3 أحرف على الأقل).
                          </p>}
                        </div>}
                      </div>}
                    </>}
                    <section aria-label="ملخص التصفية المتوقع"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">المتبقي المتوقع</p>
                        {discountCents !== null && discountCents > 0 && <p className="mt-1 text-xs text-muted-foreground">
                          خصم <MoneyAmount amount={centsToMoney(discountCents)}/> ·
                          تحصيل {cents !== null ? <MoneyAmount amount={centsToMoney(cents)}/> : "غير محدد"}
                        </p>}
                      </div>
                      <strong className={projectedRemainder !== null
                        ? "text-xl font-bold text-primary" : "text-sm font-medium text-muted-foreground"}>
                        {projectedRemainder !== null ? <MoneyAmount amount={centsToMoney(projectedRemainder)}/>
                          : !discountAmountValid ? "راجع قيمة الخصم"
                          : cents === null ? "أدخل المبلغ أو اختر «بدون تحصيل»" : "راجع مبلغ التحصيل"}
                      </strong>
                      <p className="w-full text-xs text-muted-foreground">
                        نتيجة تقديرية فقط، لم تُسجَّل بعد.
                      </p>
                    </section>
                    {cents === 0 && <p className="text-xs text-muted-foreground">
                      {discountCents !== null && discountCents > 0
                        ? "سيُسجّل الخصم فقط، دون إنشاء إيصال تحصيل."
                        : "حفظ المراجعة بدون تحصيل لا يسدد المديونية؛ الرصيد المتبقي يظل مستحقًا."}
                    </p>}
                    <details className="border-t pt-2 text-sm">
                      <summary className="cursor-pointer text-muted-foreground">إضافة ملاحظة (اختياري)</summary>
                      <textarea aria-label="ملاحظة التصفية" className={fieldClass + " mt-2 min-h-20 py-2"}
                        value={note} maxLength={4000} disabled={busy} onChange={event => setNote(event.target.value)}/>
                    </details>
                  </>}
              </section>
              <details className="mx-auto w-full max-w-3xl border-t pt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-primary">عرض تفاصيل الحساب والشغل</summary>
                <div className="mt-3 space-y-4 border-t pt-3">
                  <p className="font-semibold">كيف اتحسب المبلغ المتبقي؟</p>
                  <dl className="space-y-2">
                    {[
                      ["الرصيد الافتتاحي", data.openingBalance],
                      ["الشغل المستلّم", data.deliveredTotal],
                      ["صافي دفعات العميل السابقة", data.netPayments],
                      ["الخصومات السابقة", data.discountsTotal ?? "0.00"],
                    ].map(([title, value]) => <div key={title} className="flex items-center justify-between gap-3">
                      <dt>{title}</dt><dd className="font-semibold"><MoneyAmount amount={value}/></dd>
                    </div>)}
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <dt className="font-bold">{balanceDescription(data.balanceBefore)} ضمن التصفية</dt>
                      <dd className="font-bold"><MoneyAmount amount={absoluteAmount(data.balanceBefore)}/></dd>
                    </div>
                  </dl>
                  <p className="text-xs leading-5 text-muted-foreground">
                    الحساب الكلي حتى الآن: {balanceDescription(data.accountBalance)} <MoneyAmount amount={absoluteAmount(data.accountBalance)}/>.
                    الدفعات محسوبة حتى {data.paymentsThrough}، والخصومات حركات مستقلة لا تُعد تحصيلًا.
                    الأوردرات غير المستلّمة خارج هذه التصفية.
                  </p>
                  <Link to={"/finance?customerId=" + customerId + "&view=ledger"}
                    className="inline-flex items-center text-sm font-semibold text-primary underline underline-offset-4">
                    عرض حركات الدفعات في كشف الحساب
                  </Link>
                  <details className="border-t pt-3">
                    <summary className="cursor-pointer font-semibold text-muted-foreground">
                      الشغل المشمول ({data.items.length} بند)
                    </summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[600px] text-right text-sm">
                        <thead><tr>{["الأوردر", "الشغل", "الكمية", "القيمة"].map(title =>
                          <th className="p-2" key={title}>{title}</th>)}</tr></thead>
                        <tbody>{data.items.map(item => <tr className="border-t" key={item.id}>
                          <td className="p-2" dir="ltr">{item.orderNumber}</td>
                          <td className="p-2">{item.description}{item.widthCm && item.heightCm &&
                            <span className="block text-xs text-muted-foreground">
                              {item.widthCm} × {item.heightCm} سم
                            </span>}</td>
                          <td className="p-2">{item.quantity}</td>
                          <td className="p-2"><MoneyAmount amount={item.amount}/></td>
                        </tr>)}</tbody>
                      </table>
                    </div>
                  </details>
                </div>
              </details>
            </>}
        </div>
        {canConfirm && data?.hasWork && validDate && <footer aria-label="إجراءات التصفية"
          className="shrink-0 border-t bg-card px-4 py-3 sm:px-6">
          <Button type="button" className="mx-auto w-full max-w-3xl" disabled={!valid} onClick={() => void confirm()}>
            {busy ? "جاري التسجيل..." : cents === 0
              ? discountCents !== null && discountCents > 0 ? "حفظ الخصم بدون تحصيل" : "حفظ مراجعة الحساب بدون تحصيل"
              : cents !== null && cents > 0 && afterDiscount !== null && cents <= afterDiscount
                ? discountCents !== null && discountCents > 0 ? "تأكيد الخصم والتحصيل"
                  : "تأكيد تحصيل " + formatEgp(centsToMoney(cents))
                : "تأكيد التصفية"}
          </Button>
        </footer>}
      </section>
    </div> : history.isPending ? <LoadingState/> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()}/>
      : <div className="space-y-3 rounded-xl border bg-card p-4">
          {!history.data?.settlements.length
            ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تصفيات مسجلة لهذا العميل.</p>
            : <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-right text-sm">
                    <thead><tr>{["رقم التصفية", "تاريخ التنفيذ", "الشغل حتى", "الخصم", "المحصّل", "المتبقي بعد العملية", "النتيجة", ""].map((title, index) => <th key={index} className="p-3">{title}</th>)}</tr></thead>
                    <tbody>{history.data.settlements.map(item => <tr className="border-t" key={item.id}>
                      <td className="p-3" dir="ltr">{item.number}</td><td className="p-3">{item.settledOn}</td><td className="p-3">{item.dateTo}</td>
                      <td className="p-3"><MoneyAmount amount={item.discountAmount ?? '0.00'}/></td>
                      <td className="p-3"><MoneyAmount amount={item.amountCollected}/></td>
                      <td className="whitespace-nowrap p-3">
                        <span>{item.balanceAfter.startsWith("-") ? "للعميل رصيد " : ""}</span>
                        <MoneyAmount amount={absoluteAmount(item.balanceAfter)}/>
                      </td>
                      <td className={"p-3 " + (item.needsReview ? "text-destructive" : "")}>{item.statusLabel}</td>
                      <td className="p-3"><Button variant="outline" size="sm" disabled={openingRecord} onClick={() => void openRecord(item.id)}>عرض الإثبات</Button></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  المتبقي الظاهر هو رصيد التصفية وقت تسجيلها، وليس بالضرورة رصيد العميل الحالي. التصفيات التي تحتاج مراجعة لا تؤكد السداد الحالي.
                </p>
                {history.data.pagination.lastPage > 1 && <PaginationBar pagination={history.data.pagination} onPage={setPage}/>}
              </>}
        </div>}
  </section>;
}
