import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { parseCents, centsToMoney } from "@/features/deliveries/lib/delivery-money";
import { getOrderPaymentOptions } from "@/features/orders/api/order-options.api";
import { ErrorState, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { getApiErrorMessage } from "@/shared/api/http";
import { createSettlementRecord, fetchCustomerSettlement } from "../api/settlement.api";
import type { CreateSettlementRecordPayload } from "../types/settlement.types";

function cairoToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function signedCents(amount: string): number | null {
  const negative = amount.startsWith("-");
  const cents = parseCents(negative ? amount.slice(1) : amount);
  return cents === null ? null : (negative ? -cents : cents);
}

export function CreateSettlementDialog({ customerId, nextDateFrom, canDiscount, canCollect, onClose, onSuccess }: {
  customerId: number;
  nextDateFrom: string | null;
  canDiscount: boolean;
  canCollect: boolean;
  onClose: () => void;
  onSuccess: (id: number) => void;
}) {
  const today = cairoToday();
  const initialFrom = nextDateFrom ?? today.slice(0, 8) + "01";
  const [period, setPeriod] = useState({ from: initialFrom, to: today });
  const [discount, setDiscount] = useState("0.00");
  const [discountReason, setDiscountReason] = useState("");
  const [collected, setCollected] = useState("0.00");
  const [method, setMethod] = useState<0 | 1 | 2>(0);
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [showLines, setShowLines] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const qc = useQueryClient();
  const periodValid = Boolean(period.from && period.to &&
    period.from <= period.to && period.to <= today &&
    (!nextDateFrom || period.from >= nextDateFrom));
  const preview = useQuery({
    queryKey: ["finance", "settlement-preview", customerId, period.from, period.to],
    queryFn: () => fetchCustomerSettlement(customerId, period),
    enabled: periodValid,
    staleTime: 0,
  });
  const due = preview.data ? signedCents(preview.data.closingBalance) : null;
  const discountCents = parseCents(discount);
  const collectedCents = parseCents(collected);
  const after = due === null || discountCents === null || collectedCents === null
    ? null : due - discountCents - collectedCents;
  const needsPayment = collectedCents !== null && collectedCents > 0;
  const needsDestination = needsPayment && method !== 0;
  const options = useQuery({
    queryKey: ["finance", "settlement-payment-destinations"],
    queryFn: getOrderPaymentOptions,
    enabled: needsDestination,
  });
  const destinations = method === 1 ? options.data?.banks ?? [] : options.data?.wallets ?? [];
  const allowedAfter = after !== null && (after >= 0 ||
    (due !== null && due < 0 && discountCents === 0 && collectedCents === 0));
  const valid = periodValid && preview.isSuccess && !preview.isFetching &&
    discountCents !== null && collectedCents !== null &&
    discountCents >= 0 && collectedCents >= 0 && allowedAfter &&
    (discountCents === 0 || (canDiscount && discountReason.trim().length >= 3)) &&
    (!needsPayment || canCollect) &&
    (!needsDestination || (options.isSuccess &&
      destinations.some(item => String(item.value) === destination))) &&
    note.length <= 1000 && discountReason.length <= 1000 && !busy;

  function changePeriod(which: "from" | "to", value: string) {
    setPeriod(prev => ({ ...prev, [which]: value }));
    setError("");
    setFieldErrors({});
  }

  async function save() {
    if (!valid || discountCents === null || collectedCents === null) return;
    const payload: CreateSettlementRecordPayload = {
      dateFrom: period.from,
      dateTo: period.to,
      discountAmount: centsToMoney(discountCents),
      collectedAmount: centsToMoney(collectedCents),
    };
    if (discountCents > 0) payload.discountReason = discountReason.trim();
    if (collectedCents > 0) {
      payload.paymentMethod = method;
      if (method !== 0) payload.paymentDestinationId = Number(destination);
    }
    if (note.trim()) payload.note = note.trim();

    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const record = await createSettlementRecord(customerId, payload, attempt.current.key);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["finance"] }),
        qc.invalidateQueries({ queryKey: ["collections"] }),
        qc.invalidateQueries({ queryKey: ["customers"] }),
      ]);
      toast.success("تم حفظ التصفية: " + record.number);
      onSuccess(record.id);
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause, "تعذّر حفظ التصفية. راجع الرصيد وحاول مرة أخرى."));
      const errors = (cause as { response?: { data?: { errors?: Record<string, string[]> } } })
        .response?.data?.errors;
      if (errors) {
        setFieldErrors(Object.fromEntries(Object.entries(errors).map(
          ([name, values]) => [name, values[0] ?? "قيمة غير صحيحة"],
        )));
      }
      void preview.refetch();
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-3 sm:p-4"
    onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="تصفية حساب جديدة" dir="rtl"
      className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <header className="flex shrink-0 items-center justify-between border-b p-4">
        <div>
          <h2 className="font-bold">تصفية حساب جديدة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            الخصم يقلل المديونية، والتحصيل يُسجل فقط عند استلام مبلغ فعلي.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" disabled={busy}
          aria-label="إغلاق" onClick={onClose}><X className="size-4"/></Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <CreatedDatePicker label="تشمل من" value={period.from} min={nextDateFrom ?? undefined}
            max={period.to || today} onChange={value => changePeriod("from", value)} disabled={busy}/>
          <CreatedDatePicker label="تشمل حتى" value={period.to}
            min={period.from || nextDateFrom || undefined} max={today}
            onChange={value => changePeriod("to", value)} disabled={busy}/>
        </div>
        <p className="text-xs text-muted-foreground">
          الخصم والتحصيل يتسجلوا بتاريخ اليوم الفعلي، حتى لو فترة الشغل المختارة أقدم.
        </p>
        {!periodValid && <p role="alert" className="text-xs text-destructive">
          {nextDateFrom && nextDateFrom > today
            ? "آخر تصفية تشمل اليوم بالفعل. يمكن إنشاء التصفية التالية من الغد."
            : "اختر فترة صحيحة لا تتداخل مع تصفية سابقة ولا تتجاوز اليوم."}
        </p>}

        {periodValid && (preview.isPending ? <LoadingState/> :
          preview.isError ? <ErrorState error={preview.error} retry={() => void preview.refetch()}/> :
          <section className="rounded-lg border bg-muted/20 p-3" aria-label="ملخص التصفية">
            <h3 className="mb-3 text-sm font-bold">ملخص الحساب</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><span>رصيد سابق</span>
                <MoneyAmount amount={preview.data.openingBalance}/></div>
              <div className="flex justify-between gap-2"><span>الشغل المستلم</span>
                <MoneyAmount amount={preview.data.deliveredTotal}/></div>
              <div className="flex justify-between gap-2"><span>المدفوعات المسجلة</span>
                <MoneyAmount amount={preview.data.paymentsTotal}/></div>
              {preview.data.discountsTotal && preview.data.discountsTotal !== "0.00" &&
                <div className="flex justify-between gap-2"><span>خصومات سابقة</span>
                  <MoneyAmount amount={preview.data.discountsTotal}/></div>}
              <div className="flex justify-between gap-2 border-t pt-2 font-bold">
                <span>المستحق قبل التصفية</span>
                <MoneyAmount amount={preview.data.closingBalance}/>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowLines(x => !x)}>
                {showLines ? <ChevronUp className="size-4"/> : <ChevronDown className="size-4"/>}
                {showLines ? "إخفاء التفاصيل" : "عرض تفاصيل الشغل والدفعات"}
              </Button>
              {showLines && <div className="max-h-44 space-y-2 overflow-y-auto border-t pt-2 text-xs">
                {preview.data.lines.length === 0 ? "لا توجد حركات خلال الفترة." :
                  preview.data.lines.map(line => <div key={line.key}
                    className="flex justify-between gap-2 border-b pb-2">
                    <span>{formatCollectionDate(line.date)} — {line.description}</span>
                    <span dir="ltr" className="shrink-0 tabular-nums">{line.signedAmount}</span>
                  </div>)}
              </div>}
            </div>
          </section>)}

        <div className="grid gap-3 sm:grid-cols-2">
          {canDiscount && <label className="block space-y-1 text-sm font-semibold">
            <span>خصم ثابت (ج.م)</span>
            <input aria-label="خصم ثابت" className={fieldClass} dir="ltr" inputMode="decimal"
              value={discount} disabled={busy} onChange={e => { setDiscount(e.target.value); setError(""); }}/>
          </label>}
          {canCollect && <label className="block space-y-1 text-sm font-semibold">
            <span>المبلغ المحصل الآن (ج.م)</span>
            <input aria-label="المبلغ المحصل الآن" className={fieldClass} dir="ltr" inputMode="decimal"
              value={collected} disabled={busy} onChange={e => { setCollected(e.target.value); setError(""); }}/>
          </label>}
        </div>
        {(discountCents === null || collectedCents === null) &&
          <p role="alert" className="text-xs text-destructive">
            أدخل مبلغًا صحيحًا بحد أقصى رقمين بعد العلامة العشرية.
          </p>}
        {after !== null && after < 0 && (discountCents !== 0 || collectedCents !== 0) &&
          <p role="alert" className="text-xs text-destructive">
          مجموع الخصم والتحصيل لا يمكن أن يتجاوز المستحق.
        </p>}

        {canDiscount && discountCents !== null && discountCents > 0 && <label
          className="block space-y-1 text-sm font-semibold">
          <span>سبب الخصم *</span>
          <input aria-label="سبب الخصم" className={fieldClass} value={discountReason}
            maxLength={1000} disabled={busy} placeholder="مثال: خصم متفق عليه مع العميل"
            onChange={e => setDiscountReason(e.target.value)}/>
          {fieldErrors.discountReason && <span role="alert" className="text-xs text-destructive">{fieldErrors.discountReason}</span>}
        </label>}

        {canCollect && needsPayment && <>
          <label className="block space-y-1 text-sm font-semibold">
            <span>طريقة التحصيل</span>
            <select aria-label="طريقة التحصيل" className={fieldClass} value={method} disabled={busy}
              onChange={e => { setMethod(Number(e.target.value) as 0 | 1 | 2); setDestination(""); }}>
              <option value={0}>نقدي</option>
              <option value={1}>تحويل بنكي</option>
              <option value={2}>محفظة إلكترونية</option>
            </select>
          </label>
          {needsDestination && <div className="space-y-1 text-sm font-semibold">
            <label htmlFor="settlement-destination">حساب التحصيل</label>
            {options.isPending ? <LoadingState/> : options.isError ?
              <ErrorState error={options.error} retry={() => void options.refetch()}/> :
              <select id="settlement-destination" className={fieldClass} value={destination}
                disabled={busy} onChange={e => setDestination(e.target.value)}>
                <option value="">اختر الحساب...</option>
                {destinations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>}
          </div>}
        </>}

        <label className="block space-y-1 text-sm font-semibold">
          <span>ملاحظات (اختياري)</span>
          <textarea aria-label="ملاحظات التصفية" className={fieldClass + " min-h-16 py-2"}
            value={note} maxLength={1000} disabled={busy} onChange={e => setNote(e.target.value)}/>
        </label>

        {after !== null && <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-bold">المتبقي بعد التصفية</span>
          <span className="text-lg font-extrabold"><MoneyAmount amount={centsToMoney(after)}/></span>
        </div>}
        {Object.entries(fieldErrors).filter(([key]) => key !== "discountReason").map(([field, message]) =>
          <p key={field} role="alert" className="text-xs text-destructive">{message}</p>)}
        {error && <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4"/> {error}
        </p>}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t p-4">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button type="button" disabled={!valid} onClick={() => void save()}>
          {busy ? "جاري الحفظ..." : needsPayment ? "حفظ وتسجيل التحصيل" : "حفظ التصفية"}
        </Button>
      </footer>
    </section>
  </div>;
}
