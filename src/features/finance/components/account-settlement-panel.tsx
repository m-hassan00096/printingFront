import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, History, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
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

export function AccountSettlementPanel({customerId, canConfirm, canViewCollections}: {
  customerId: number; canConfirm: boolean; canViewCollections: boolean;
}) {
  const qc = useQueryClient();
  const [cutoff, setCutoff] = useState(cairoToday);
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const [payment, setPayment] = useState<AccountPaymentValue>({method: 0, destination: ""});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState<"new" | "history">("new");
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState<AccountSettlementRecord | null>(null);
  const [openingRecord, setOpeningRecord] = useState(false);
  const keys = useRef(new Map<string, string>());
  const validDate = Boolean(cutoff && cutoff <= cairoToday());
  const preview = useQuery({queryKey: ["finance", "settlement-preview", customerId, cutoff],
    queryFn: () => previewAccountSettlement(customerId, cutoff), enabled: mode === "new" && validDate && !record,
    refetchOnWindowFocus: false, retry: false});
  const history = useQuery({queryKey: ["finance", "account-settlements", customerId, page],
    queryFn: () => listAccountSettlements(customerId, page), enabled: mode === "history", retry: false});
  const mutation = useMutation({mutationFn: ({payload, key}: {payload: AccountSettlementInput; key: string}) => confirmAccountSettlement(customerId, payload, key), retry: false});
  const data = preview.data;
  const amount = amountInput ?? data?.dueNow ?? "";
  const cents = parseCents(amount);
  const due = data ? parseCents(data.dueNow) : null;
  const busy = mutation.isPending;
  const valid = canConfirm && !busy && !stale && preview.isSuccess && !preview.isFetching && data?.hasWork &&
    cents !== null && due !== null && cents <= due && (due === 0 ? cents === 0 : cents > 0) &&
    (cents === 0 || payment.method === 0 || payment.destination !== "");
  async function refreshPreview() {
    setStale(false); setError(""); setAmountInput(null);
    await preview.refetch();
  }
  async function confirm() {
    if (!valid || !data || cents === null) return;
    const payload: AccountSettlementInput = {dateTo: cutoff, previewHash: data.previewHash, amount: centsToMoney(cents),
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
  function startNew() {setRecord(null); setMode("new"); setAmountInput(null); setError(""); setStale(false);}

  return <section aria-label="التصفية المالية" className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold">التصفية المالية</h2><p className="mt-1 text-sm text-muted-foreground">مراجعة الحساب، تسجيل المتبقي المستلم فعليًا، ثم حفظ إثبات النتيجة.</p></div>
      <div className="flex gap-2"><Button variant={mode === "new" ? "default" : "outline"} size="sm" disabled={busy} onClick={startNew}>تصفية جديدة</Button>
        <Button variant={mode === "history" ? "default" : "outline"} size="sm" disabled={busy} onClick={() => {setMode("history"); setRecord(null); setError("");}}><History className="size-4"/> سجل التصفية</Button></div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}
      {stale && <Button variant="outline" className="ms-3" size="sm" onClick={() => void refreshPreview()}>تحديث المراجعة</Button>}</div>}
    {openingRecord && <LoadingState/>}
    {record ? <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="نتيجة التصفية">
      <div className="flex items-center gap-2">{record.needsReview ? <TriangleAlert className="size-6 text-destructive"/> : <CheckCircle2 className="size-6 text-primary"/>}
        <h3 className="text-lg font-bold">{record.statusLabel}</h3></div>
      <p className="text-sm text-muted-foreground"><span dir="ltr">{record.number}</span> · التنفيذ: {record.settledOn} · الشغل حتى: {record.dateTo}</p>
      {record.needsReview && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">حدث إلغاء أو رد مالي بعد تسجيل التصفية. هذه لقطة وقت التسجيل وليست تأكيدًا بأن الرصيد الحالي مسدد.</p>}
      <dl className="grid gap-3 sm:grid-cols-3">
        {[['المحصّل في هذه العملية', record.amountCollected], [balanceDescription(record.balanceAfter), absoluteAmount(record.balanceAfter)], ['رصيد الحساب الكلي بعد العملية', record.accountBalanceAfter]].map(([title, value]) =>
          <div className="rounded-lg border p-3" key={title}><dt className="text-sm text-muted-foreground">{title}</dt><dd className="mt-2 text-xl font-bold"><MoneyAmount amount={value}/></dd></div>)}
      </dl>
      <p className="text-sm leading-6">التقفيل يخص النطاق الموضح، ولا يلغي مديونية الأوردرات المؤكدة خارج هذا النطاق. الرصيد الدائن يبقى محفوظًا ولا يُرد تلقائيًا.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void printRecord()}><Printer className="size-4"/> طباعة إثبات التصفية</Button>
        {record.collectionId && canViewCollections && <Button variant="outline" asChild><Link to={`/collections?receiptId=${record.collectionId}`}>إيصال التحصيل {record.receiptNumber}</Link></Button>}
        {!record.collectionId && <span className="self-center text-sm text-muted-foreground">لم يُسجّل تحصيل جديد في هذه العملية.</span>}
      </div>
    </section> : mode === "new" ? <>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-56 flex-1"><CreatedDatePicker label="الشغل المسلّم حتى" value={cutoff} max={cairoToday()}
          onChange={value => {if (busy) return; setCutoff(value); setAmountInput(null); setStale(false); setError("");}}/></div>
        <Button variant="outline" disabled={busy || preview.isFetching || !validDate} onClick={() => void refreshPreview()}><RefreshCw className="size-4"/> تحديث المراجعة</Button>
        <p className="basis-full text-sm text-muted-foreground">النطاق تراكمي، ويشمل الشغل السابق حتى هذا التاريخ. الدفعات تُراجع حتى اليوم، وليس حتى نهاية كشف تاريخي قديم.</p>
      </div>
      {!validDate ? <p role="alert" className="text-sm text-destructive">اختر تاريخًا صحيحًا لا يتجاوز اليوم.</p> : preview.isPending ? <LoadingState/> : preview.isError ? <ErrorState error={preview.error} retry={() => void preview.refetch()}/> : data && <>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
          <section className="rounded-xl border bg-card p-5" aria-label="مراجعة رصيد التصفية">
            <h3 className="mb-4 font-bold">كيف وصلنا للمبلغ المتبقي؟</h3>
            <dl className="space-y-3 text-sm">
              {[['الرصيد الافتتاحي المحتسب',data.openingBalance],['الشغل المسلّم ضمن النطاق',data.deliveredTotal],['صافي دفعات العميل السابقة',data.netPayments]].map(([title,value]) =>
                <div key={title} className="flex items-center justify-between gap-3"><dt>{title}</dt><dd className="font-semibold"><MoneyAmount amount={value}/></dd></div>)}
              <div className="flex items-center justify-between gap-3 border-t pt-4"><dt className="font-bold">{balanceDescription(data.balanceBefore)} ضمن التصفية</dt>
                <dd className="text-2xl font-extrabold text-primary"><MoneyAmount amount={absoluteAmount(data.balanceBefore)}/></dd></div>
            </dl>
            <details className="mt-4 border-t pt-3 text-sm"><summary className="cursor-pointer font-semibold">تفصيل الدفعات والمقدمات</summary>
              <div className="mt-3 space-y-2 text-muted-foreground"><p>التحصيلات المسجلة: <MoneyAmount amount={data.grossCollections}/></p><p>التحصيلات الملغاة: <MoneyAmount amount={data.collectionReversals}/></p>
                <p>المبالغ المعادة: <MoneyAmount amount={data.refundsTotal}/></p><p>مقدمات مرتبطة بشغل خارج النطاق: <MoneyAmount amount={data.advancesForOtherWork}/></p>
                <p>هذه المقدمات داخلة بالفعل في صافي دفعات الحساب ولا تخصم مرة ثانية. التصفية على الحساب الجاري للعميل، وليست توزيع دفعات على أوردرات منفردة.</p></div>
            </details>
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm leading-6"><p>رصيد الحساب الكلي: <MoneyAmount amount={data.accountBalance}/></p>
              <p>فرق مديونية الأوردرات خارج النطاق: <MoneyAmount amount={data.outsideBalance}/></p>
              <p>الدفعات محتسبة حتى {data.paymentsThrough}. أي رصيد دائن هنا ليس تصريحًا برد أموال؛ الرد يعتمد على رصيد الحساب الكلي.</p></div>
          </section>
          <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="إتمام التصفية">
            <h3 className="font-bold">المبلغ المستلم الآن</h3>
            {!canConfirm ? <p className="text-sm text-muted-foreground">يمكنك مراجعة الحساب. تأكيد التصفية يحتاج صلاحية تسجيل التحصيل.</p> : !data.hasWork ? <p className="text-sm text-muted-foreground">لا يوجد شغل مسلّم أو رصيد افتتاحي لتصفيته.</p> : <>
              {due === 0 ? <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6">لا يلزم تحصيل جديد. التأكيد يوثّق الموقف الحالي فقط، ولا يصفر رصيدًا دائنًا أو يرد مبلغًا.</p> : <label className="block space-y-1 text-sm font-semibold">المبلغ الذي دفعه العميل بالفعل
                <input aria-label="مبلغ التصفية المستلم" className={fieldClass} dir="ltr" inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmountInput(event.target.value)}/>
                {(cents === null || cents <= 0 || (due !== null && cents > due)) && <span className="text-xs text-destructive">أدخل مبلغًا أكبر من صفر ولا يتجاوز المتبقي.</span>}
              </label>}
              {cents !== null && cents > 0 && <AccountPaymentFields value={payment} onChange={setPayment} disabled={busy}/>}
              <label className="block space-y-1 text-sm">ملاحظة (اختياري)<textarea aria-label="ملاحظة التصفية" className={fieldClass + " min-h-20 py-2"} value={note} maxLength={4000} disabled={busy} onChange={event => setNote(event.target.value)}/></label>
              {due !== null && cents !== null && due > 0 && cents <= due && <p className="rounded-lg bg-muted/40 p-3 text-sm">المتبقي بعد هذه الدفعة: <strong><MoneyAmount amount={centsToMoney(due - cents)}/></strong>{cents < due ? " — ستكون دفعة جزئية، وليست تقفيلًا كاملًا." : " — سيتم تقفيل هذا النطاق."}</p>}
              <p className="text-xs leading-5 text-muted-foreground">تاريخ التحصيل الفعلي هو اليوم. لن تُسجّل مديونية جديدة، ولن تتكرر الدفعات السابقة.</p>
              <Button className="w-full" disabled={!valid} onClick={() => void confirm()}>{busy ? "جاري التسجيل..." : due === 0 ? "تأكيد التصفية بدون تحصيل جديد" : cents !== null && due !== null && cents < due ? "تسجيل دفعة جزئية" : "تأكيد التحصيل وتقفيل التصفية"}</Button>
            </>}
          </section>
        </div>
        <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">مراجعة الشغل المشمول ({data.items.length} بند)</summary>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-right text-sm"><thead><tr>{['الأوردر','الشغل','الكمية','القيمة'].map(title => <th className="p-2" key={title}>{title}</th>)}</tr></thead><tbody>
            {data.items.map(item => <tr className="border-t" key={item.id}><td className="p-2" dir="ltr">{item.orderNumber}</td><td className="p-2">{item.description}{item.widthCm && item.heightCm && <span className="block text-xs text-muted-foreground">{item.widthCm} × {item.heightCm} سم</span>}</td><td className="p-2">{item.quantity}</td><td className="p-2"><MoneyAmount amount={item.amount}/></td></tr>)}
          </tbody></table></div>
        </details>
      </>}
    </> : history.isPending ? <LoadingState/> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()}/> : <div className="space-y-3 rounded-xl border bg-card p-4">
      {!history.data?.settlements.length ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تصفيات مالية مسجلة. عرض الكشف أو طباعته وحده لا يسجل تصفية.</p> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead><tr>{['رقم التصفية','تاريخ التنفيذ','الشغل حتى','المحصّل','النتيجة',''].map((title,index) => <th key={index} className="p-3">{title}</th>)}</tr></thead><tbody>
          {history.data.settlements.map(item => <tr className="border-t" key={item.id}><td className="p-3" dir="ltr">{item.number}</td><td className="p-3">{item.settledOn}</td><td className="p-3">{item.dateTo}</td><td className="p-3"><MoneyAmount amount={item.amountCollected}/></td><td className={"p-3 " + (item.needsReview ? "text-destructive" : "")}>{item.statusLabel}</td><td className="p-3"><Button variant="outline" size="sm" disabled={openingRecord} onClick={() => void openRecord(item.id)}>عرض الإثبات</Button></td></tr>)}
        </tbody></table></div>
        {history.data.pagination.lastPage > 1 && <PaginationBar pagination={history.data.pagination} onPage={setPage}/>}
      </>}
    </div>}
  </section>;
}
