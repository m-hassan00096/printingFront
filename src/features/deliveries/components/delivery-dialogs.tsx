import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpLeft, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { ErrorState, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { getOrderPaymentOptions } from "@/features/orders/api/order-options.api";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { estimatedBalance, centsToMoney, parseCents } from "../lib/delivery-money";
import { useDeliveryActions, useDeliveryDetails, useDeliveryPreview } from "../hooks/use-deliveries";
import type { DeliverPayload, PaymentMethod } from "../types/deliveries.types";

function DialogFrame({ title, children, busy, onClose }: {
  title: string; children: React.ReactNode; busy: boolean; onClose: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
    onMouseDown={event => { if (event.target===event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} dir="rtl"
      onKeyDown={event => { if (event.key==="Escape" && !busy) onClose(); }}
      className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <Button type="button" variant="ghost" size="icon-sm" disabled={busy}
          aria-label="إغلاق" onClick={onClose}><X className="size-4"/></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
    </section>
  </div>;
}
function DeliveryField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm font-semibold">{children}</div></div>;
}
function cairoDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" :
    new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"}).format(parsed);
}

export function DeliverOrderDialog({ orderId, onClose, onSuccess }: {
  orderId: number; onClose: () => void; onSuccess: () => void;
}) {
  const preview = useDeliveryPreview(orderId);
  const actions = useDeliveryActions();
  const busy = actions.deliver.isPending;
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [method, setMethod] = useState<PaymentMethod>(0);
  const [destination, setDestination] = useState("");
  const [creditConfirmed, setCreditConfirmed] = useState(false);
  const [error, setError] = useState("");
  const paid = parseCents(amount);
  const needsPayment = paid !== null && paid > 0;
  const canCollect = preview.data?.canCollect === true;
  const needsDestination = needsPayment && method !== 0;
  const paymentOptions = useQuery({
    queryKey: ["deliveries","payment-options"], queryFn: getOrderPaymentOptions,
    enabled: canCollect && needsDestination,
  });
  const destinations = method === 1 ? paymentOptions.data?.banks ?? [] : paymentOptions.data?.wallets ?? [];
  const estimated = estimatedBalance(preview.data?.customerBalance ?? null, amount);
  const willCreateCredit = needsPayment && estimated !== null && estimated < 0;
  const disabled = !preview.data?.canDeliver || paid === null ||
    (needsPayment && !canCollect) ||
    (needsDestination && (paymentOptions.isPending || paymentOptions.isError ||
      !destinations.some(x => String(x.value) === destination))) ||
    (willCreateCredit && !creditConfirmed) ||
    receiver.trim().length > 150 || busy;

  async function submit() {
    if (disabled) return;
    const payload: DeliverPayload = {
      receiverName: receiver.trim() || null,
      collectedAmount: centsToMoney(paid!),
    };
    if (needsPayment) {
      payload.paymentMethod = method;
      if (needsDestination) payload.paymentDestinationId = Number(destination);
      if (creditConfirmed) payload.confirmCreditBalance = true;
    }
    setError("");
    try {
      await actions.deliver.mutateAsync({id:orderId,payload});
      toast.success("تم تسليم الأوردر بنجاح.");
      onSuccess();
    } catch (e:unknown) {
      setError(getApiErrorMessage(e,"تعذّر تنفيذ التسليم. حدّث البيانات وحاول مجددًا."));
    }
  }

  return <DialogFrame title="تسليم الأوردر" busy={busy} onClose={onClose}>
    {preview.isPending ? <LoadingState/> : preview.isError ?
      <ErrorState error={preview.error} retry={()=>void preview.refetch()}/> : preview.data &&
      <div className="space-y-4">
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
          <DeliveryField label="رقم الأوردر">{preview.data.order.orderNumber}</DeliveryField>
          <DeliveryField label="العميل">{preview.data.order.customerName}</DeliveryField>
          <DeliveryField label="التليفون">{preview.data.order.customerPhone}</DeliveryField>
          <DeliveryField label="قيمة الأوردر"><MoneyAmount amount={preview.data.order.orderTotal}/></DeliveryField>
          <DeliveryField label="المنتجات الجاهزة">
            {preview.data.order.readyItemsCount} من {preview.data.order.totalItemsCount}
          </DeliveryField>
          <DeliveryField label="رصيد حساب العميل">
            {preview.data.customerBalance
              ? <>{preview.data.customerBalance.typeLabel} · <MoneyAmount amount={preview.data.customerBalance.amount}/></>
              : "غير متاح وفق الصلاحيات"}
          </DeliveryField>
        </div>
        {!preview.data.canDeliver && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          لا يمكن التسليم قبل جاهزية جميع منتجات الأوردر.
        </p>}
        <label className="block space-y-1 text-sm font-semibold">
          <span>اسم المستلم (اختياري)</span>
          <input className={fieldClass} maxLength={150} value={receiver}
            onChange={e=>setReceiver(e.target.value)} placeholder="الشخص الذي استلم الأوردر"/>
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          <span>المبلغ المحصل عند التسليم (ج.م)</span>
          <input className={fieldClass} inputMode="decimal" dir="ltr" value={amount}
            onChange={e=>{setAmount(e.target.value);setCreditConfirmed(false);setError("");}}
            aria-invalid={paid===null} placeholder="0.00"/>
        </label>
        {paid===null && <p role="alert" className="text-sm text-destructive">
          أدخل مبلغًا صحيحًا موجبًا أو صفرًا، بحد أقصى خانتين عشريتين.
        </p>}
        {needsPayment && !canCollect && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          لا تملك صلاحية التحصيل المالي. يمكنك تسليم الأوردر بدون تحصيل.
        </p>}
        {needsPayment && canCollect && <>
          <label className="block space-y-1 text-sm font-semibold"><span>طريقة التحصيل</span>
            <select className={fieldClass} aria-label="طريقة التحصيل" value={method}
              onChange={e=>{setMethod(Number(e.target.value) as PaymentMethod);setDestination("");setError("");}}>
              <option value={0}>نقدي</option>
              <option value={1}>تحويل بنكي</option>
              <option value={2}>محفظة إلكترونية</option>
            </select>
          </label>
          {needsDestination && <div className="space-y-2">
            <label className="block text-sm font-semibold">حساب التحصيل *</label>
            <SearchableSelect label="حساب التحصيل" placeholder="ابحث عن حساب أو محفظة..."
              value={destination} onChange={setDestination} options={destinations}
              loading={paymentOptions.isPending} disabled={paymentOptions.isError}/>
            {paymentOptions.isError && <p role="alert" className="text-sm text-destructive">
              تعذّر تحميل حسابات التحصيل.
              <button type="button" className="mr-2 underline" onClick={()=>void paymentOptions.refetch()}>
                إعادة المحاولة
              </button>
            </p>}
          </div>}
        </>}
        {estimated !== null && paid !== null && <div className="rounded-xl border p-3 text-sm">
          الرصيد التقديري بعد التحصيل: <strong>
            {estimated < 0 ? "دائن" : estimated > 0 ? "مدين" : "متوازن"} ·
            {" "}<MoneyAmount amount={centsToMoney(Math.abs(estimated))}/>
          </strong>
          <p className="mt-1 text-xs text-muted-foreground">تقديري فقط؛ النظام يعيد حساب الرصيد عند الحفظ.</p>
        </div>}
        {willCreateCredit && <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" checked={creditConfirmed} onChange={e=>setCreditConfirmed(e.target.checked)}
            aria-label="تأكيد الرصيد الدائن"/>
          أؤكد أن المبلغ سيُنشئ أو يزيد رصيدًا دائنًا لحساب العميل.
        </label>}
        {needsPayment && estimated === null && canCollect &&
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" checked={creditConfirmed} onChange={e=>setCreditConfirmed(e.target.checked)}
              aria-label="السماح بالرصيد الدائن"/>
            أوافق على إنشاء رصيد دائن إذا تجاوز المبلغ المستحق (قد يطلب النظام هذا التأكيد).
          </label>}
        <p className="text-xs text-muted-foreground">
          تاريخ التسليم يسجله السيرفر تلقائيًا. لن يتم تسجيل أي تحصيل إذا كان المبلغ صفرًا.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" disabled={disabled} onClick={()=>void submit()}>
            {busy?"جاري التسليم...":"تأكيد التسليم"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
        </div>
      </div>}
  </DialogFrame>;
}

export function DeliveryDetailsDialog({ deliveryId, onClose, onSuccess }: {
  deliveryId:number; onClose:()=>void; onSuccess:()=>void;
}) {
  const detail=useDeliveryDetails(deliveryId);
  const permissions=useCurrentUser().data?.permissions??[];
  const canViewOrder=permissions.includes("orders.view");
  const actions=useDeliveryActions();
  const busy=actions.cancel.isPending;
  const [cancelMode,setCancelMode]=useState(false);
  const [reason,setReason]=useState("");
  const [fundsConfirmed,setFundsConfirmed]=useState(false);
  const [error,setError]=useState("");
  const item=detail.data?.delivery;
  const hasActiveCollection=item && item.collectionStatus===1 &&
    (parseCents(item.effectiveReceivedAmount)??0)>0;
  async function submitCancellation() {
    if (!item?.canCancel || reason.trim().length<3 || busy || (hasActiveCollection && !fundsConfirmed)) return;
    setError("");
    try {
      await actions.cancel.mutateAsync({
        id:deliveryId,
        payload:{reason:reason.trim(), ...(hasActiveCollection?{fundsReturnConfirmed:true}:{})},
      });
      toast.success("تم إلغاء التسليم وإعادة الأوردر إلى جاهز للتسليم.");
      onSuccess();
    } catch(e:unknown) {
      setError(getApiErrorMessage(e,"تعذّر إلغاء التسليم."));
    }
  }
  return <DialogFrame title="تفاصيل التسليم" busy={busy} onClose={onClose}>
    {detail.isPending ? <LoadingState/> : detail.isError ?
      <ErrorState error={detail.error} retry={()=>void detail.refetch()}/> : item &&
      <div className="space-y-4">
        <div className="grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
          <DeliveryField label="الأوردر">{item.orderNumber??"—"}</DeliveryField>
          <DeliveryField label="العميل">{item.customerName??"—"}</DeliveryField>
          <DeliveryField label="رقم الهاتف">{item.customerPhone??"—"}</DeliveryField>
          <DeliveryField label="حالة التسليم">{item.statusLabel}</DeliveryField>
          <DeliveryField label="سُلّم بواسطة">{item.deliveredByName}</DeliveryField>
          <DeliveryField label="المستلم">{item.receiverName??"غير محدد"}</DeliveryField>
          <DeliveryField label="تاريخ التسليم">{cairoDate(item.deliveredAt)}</DeliveryField>
          <DeliveryField label="المبلغ المحصل وقت التسليم"><MoneyAmount amount={item.receivedAmount}/></DeliveryField>
          <DeliveryField label="المبلغ الفعّال حاليًا"><MoneyAmount amount={item.effectiveReceivedAmount}/></DeliveryField>
          {item.receiptNumber && <DeliveryField label="رقم الإيصال">{item.receiptNumber}</DeliveryField>}
          {item.collection && <DeliveryField label="طريقة التحصيل">
            {item.collection.paymentMethodLabel} {item.collection.destinationLabel??""}
          </DeliveryField>}
        </div>
        {item.status===2 && <div className="space-y-2 rounded-xl border border-amber-200 p-3 text-sm">
          <p className="font-bold">بيانات إلغاء التسليم</p>
          <p>بواسطة: {item.cancelledByName??"—"} · {cairoDate(item.cancelledAt)}</p>
          <p className="whitespace-pre-wrap">السبب: {item.cancellationReason??"—"}</p>
        </div>}
        {item.canCancel && !cancelMode && <Button type="button" variant="destructive"
          onClick={()=>setCancelMode(true)}>إلغاء التسليم</Button>}
        {item.canCancel && cancelMode && <div className="space-y-3 rounded-xl border border-destructive/30 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4"/> تأكيد إلغاء التسليم
          </p>
          <label className="block space-y-1 text-sm font-semibold">
            <span>سبب الإلغاء *</span>
            <textarea className={fieldClass+" min-h-24 py-2"} maxLength={3000}
              value={reason} onChange={e=>setReason(e.target.value)} placeholder="اكتب سبب الإلغاء..."/>
          </label>
          {hasActiveCollection && <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" aria-label="تأكيد التسوية الفعلية للأموال" checked={fundsConfirmed}
              onChange={e=>setFundsConfirmed(e.target.checked)}/>
            أؤكد مراجعة التسوية الفعلية للأموال مع العميل؛ عكس التحصيل في النظام لا يعيد النقد
            أو يحوّل الأموال تلقائيًا إلى حسابه.
          </label>}
          <p className="text-xs text-muted-foreground">
            سيُحفظ سجل التسليم ويُعاد الأوردر للجاهزية، ويُعكس التحصيل المرتبط فقط إذا كان قائمًا.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="destructive"
              disabled={busy||reason.trim().length<3||(hasActiveCollection&&!fundsConfirmed)}
              onClick={()=>void submitCancellation()}>{busy?"جاري الإلغاء...":"تأكيد إلغاء التسليم"}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={()=>setCancelMode(false)}>رجوع</Button>
          </div>
        </div>}
        <div className="flex flex-wrap gap-3 border-t pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>إغلاق</Button>
          {canViewOrder && <Link to={`/orders/${item.orderId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            فتح الأوردر <ArrowUpLeft className="size-4"/>
          </Link>}
        </div>
      </div>}
  </DialogFrame>;
}
