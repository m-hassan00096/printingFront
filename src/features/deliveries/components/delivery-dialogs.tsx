import { useEffect, useState } from "react";
import axios from "axios";
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
import { uiMessages } from "@/shared/translations/ar/ui";
import { useDeliveryActions, useDeliveryDetails, useDeliveryPreview } from "../hooks/use-deliveries";
import type { DeliverPayload, PaymentMethod } from "../types/deliveries.types";

function DialogFrame({ title, children, footer, busy, onClose }: {
  title: string; children: React.ReactNode; footer?: React.ReactNode; busy: boolean; onClose: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-3 sm:p-4"
    onMouseDown={event => { if (event.target===event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} dir="rtl"
      onKeyDown={event => { if (event.key==="Escape" && !busy) onClose(); }}
      className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-card shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="icon-sm" disabled={busy}
          aria-label="إغلاق" onClick={onClose}><X className="size-4"/></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      {footer && <footer className="shrink-0 border-t bg-card px-4 py-3 sm:px-5">
        {footer}
      </footer>}
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
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const [focusField, setFocusField] = useState<string | null>(null);
  useEffect(()=>{
    if(!focusField) return;
    const field=Array.from(document.querySelectorAll<HTMLElement>("[data-delivery-field]"))
      .find(element=>element.dataset.deliveryField===focusField);
    field?.scrollIntoView?.({block:"center",behavior:"smooth"});
    field?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)')
      ?.focus({preventScroll:true});
  },[focusField]);
  function clearField(name:string) {
    setFieldErrors(current=>{if(!current[name])return current;const next={...current};delete next[name];return next;});
    setError("");
    setFocusField(null);
  }
  // An empty amount intentionally means delivery without collection.
  const paid = amount.trim()==="" ? 0 : parseCents(amount);
  const needsPayment = paid !== null && paid > 0;
  const canCollect = preview.data?.canCollect === true;
  const needsDestination = needsPayment && method !== 0;
  const paymentOptions = useQuery({
    queryKey: ["deliveries","payment-options"], queryFn: getOrderPaymentOptions,
    enabled: canCollect && needsDestination,
  });
  const destinations = method === 1 ? paymentOptions.data?.banks ?? [] : paymentOptions.data?.wallets ?? [];
  const estimated = paid===null ? null :
    estimatedBalance(preview.data?.customerBalance ?? null, centsToMoney(paid));
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
      toast.success(uiMessages.deliveries.deliverySuccess.replace("{number}",preview.data?.order.orderNumber??""));
      onSuccess();
    } catch (e:unknown) {
      const response=axios.isAxiosError<{errors?:Record<string,string[]>}>(e)?e.response?.data:undefined;
      const mapped=Object.fromEntries(Object.entries(response?.errors??{})
        .filter((entry):entry is [string,string[]]=>Array.isArray(entry[1])&&entry[1].length>0)
        .map(([name,messages])=>[name,messages[0]]));
      if(Object.keys(mapped).length>0) {
        setFieldErrors(mapped);
        const first=["receiverName","collectedAmount","paymentMethod","paymentDestinationId","confirmCreditBalance"]
          .find(name=>mapped[name]) ?? Object.keys(mapped)[0];
        setFocusField(first);
        setError("");
      } else {
        setError(getApiErrorMessage(e,uiMessages.deliveries.genericError));
      }
    }
  }

  return <DialogFrame title="تسليم الأوردر" busy={busy} onClose={onClose}
    footer={preview.data && <div className="flex items-center gap-2">
      <Button type="button" disabled={disabled} onClick={()=>void submit()}>
        {busy?"جاري التسليم...":"تأكيد التسليم"}
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
    </div>}>
    {preview.isPending ? <LoadingState/> : preview.isError ?
      <ErrorState error={preview.error} retry={()=>void preview.refetch()}/> : preview.data &&
      <div className="space-y-3">
        <div className="space-y-3 rounded-lg border border-[#e8ebf4] bg-[#f8f9fc] p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <DeliveryField label="رقم الأوردر"><span dir="ltr" className="inline-block tabular-nums">{preview.data.order.orderNumber}</span></DeliveryField>
            <div className="min-w-0 space-y-2 text-right">
              <DeliveryField label="العميل">{preview.data.order.customerName}</DeliveryField>
              <DeliveryField label={uiMessages.deliveries.phoneLabel}>
                <span dir="ltr" className="inline-block tabular-nums">{preview.data.order.customerPhone}</span>
              </DeliveryField>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[#e5e8f1] pt-3">
            <DeliveryField label="قيمة الأوردر"><MoneyAmount amount={preview.data.order.orderTotal}/></DeliveryField>
            <DeliveryField label="المنتجات الجاهزة">
              {preview.data.order.readyItemsCount} من {preview.data.order.totalItemsCount}
            </DeliveryField>
          </div>
        </div>
        {!preview.data.canDeliver && <p role="alert" className="rounded-lg bg-[#fff4df] p-3 text-sm text-[#a46b0b]">
          لا يمكن التسليم قبل جاهزية جميع منتجات الأوردر.
        </p>}
        <label data-delivery-field="receiverName" className="block scroll-mt-24 space-y-1 text-sm font-semibold">
          <span>اسم المستلم (اختياري)</span>
          <input className={fieldClass} maxLength={150} value={receiver} disabled={busy} aria-label="اسم المستلم (اختياري)"
            aria-invalid={!!fieldErrors.receiverName}
            onChange={e=>{setReceiver(e.target.value);clearField("receiverName");}} placeholder="الشخص الذي استلم الأوردر"/>
          {fieldErrors.receiverName&&<span role="alert" className="block text-xs text-destructive">{fieldErrors.receiverName}</span>}
        </label>
        <section className="space-y-2 rounded-lg border border-[#e8ebf4] p-3.5" aria-label={uiMessages.deliveries.collectOptional}>
          <h3 className="text-sm font-bold">{uiMessages.deliveries.collectOptional}</h3>
          <label data-delivery-field="collectedAmount" className="block scroll-mt-24 space-y-1 text-sm font-medium">
            <span>{uiMessages.deliveries.amountInput}</span>
            <input className={fieldClass} inputMode="decimal" dir="ltr" value={amount} disabled={busy} aria-label={uiMessages.deliveries.amountInput}
              onChange={e=>{setAmount(e.target.value);setCreditConfirmed(false);clearField("collectedAmount");}}
              aria-invalid={paid===null||!!fieldErrors.collectedAmount} placeholder="0.00"/>
            {(paid===null||fieldErrors.collectedAmount)&&<span role="alert" className="block text-xs text-destructive">
              {fieldErrors.collectedAmount??uiMessages.deliveries.amountError}
            </span>}
          </label>
          <p className="text-xs text-muted-foreground">{uiMessages.deliveries.zeroAmountHint}</p>
        </section>
        {needsPayment && !canCollect && <p role="alert" className="rounded-lg bg-[#fff4df] p-3 text-sm text-[#a46b0b]">
          {uiMessages.deliveries.collectionPermissionError}
        </p>}
        {needsPayment && canCollect && <>
          <label className="block scroll-mt-24 space-y-1 text-sm font-semibold" data-delivery-field="paymentMethod">
            <span>{uiMessages.deliveries.method} *</span>
            <select className={fieldClass} aria-label="طريقة التحصيل" value={method} disabled={busy}
              aria-invalid={!!fieldErrors.paymentMethod}
              onChange={e=>{setMethod(Number(e.target.value) as PaymentMethod);setDestination("");clearField("paymentMethod");}}>
              <option value={0}>{uiMessages.deliveries.cash}</option>
              <option value={1}>{uiMessages.deliveries.bank}</option>
              <option value={2}>{uiMessages.deliveries.wallet}</option>
            </select>
            {fieldErrors.paymentMethod&&<span role="alert" className="text-xs text-destructive">{fieldErrors.paymentMethod}</span>}
          </label>
          {needsDestination && <div className="scroll-mt-24 space-y-2" data-delivery-field="paymentDestinationId">
            <label className="block text-sm font-semibold">حساب التحصيل *</label>
            <SearchableSelect label="حساب التحصيل" placeholder="ابحث عن حساب أو محفظة..."
              value={destination} onChange={v=>{setDestination(v);clearField("paymentDestinationId");}}
              invalid={!!fieldErrors.paymentDestinationId} options={destinations}
              loading={paymentOptions.isPending} disabled={busy||paymentOptions.isError}/>
            {!destination&&!paymentOptions.isPending&&!paymentOptions.isError&&
              <p className="text-xs text-muted-foreground">{uiMessages.deliveries.destinationRequired}</p>}
            {fieldErrors.paymentDestinationId&&<p role="alert" className="text-xs text-destructive">{fieldErrors.paymentDestinationId}</p>}
            {paymentOptions.isError && <p role="alert" className="text-sm text-destructive">
              تعذّر تحميل حسابات التحصيل.
              <button type="button" className="mr-2 underline" onClick={()=>void paymentOptions.refetch()}>
                إعادة المحاولة
              </button>
            </p>}
          </div>}
        </>}
        {estimated !== null && paid !== null && <section className="space-y-2 rounded-lg border border-[#e2e6f3] bg-[#f8f9ff] p-3.5"
          aria-label={uiMessages.deliveries.summary}>
          <h3 className="text-sm font-bold">{uiMessages.deliveries.summary}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{uiMessages.deliveries.currentBalance}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-1.5 font-semibold">
                <MoneyAmount amount={preview.data.customerBalance?.amount??"0.00"}/>
                <span className="text-xs text-muted-foreground">{preview.data.customerBalance?.typeLabel}</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{uiMessages.deliveries.amountNow}</dt>
              <dd className="font-semibold"><MoneyAmount amount={centsToMoney(paid)}/></dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#e2e6f3] pt-2">
              <dt className="font-bold">{uiMessages.deliveries.afterBalance}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-2">
                <strong className="text-base"><MoneyAmount amount={centsToMoney(Math.abs(estimated))}/></strong>
                <span className={"rounded-md px-2 py-0.5 text-xs font-semibold "+
                  (estimated>0?"bg-amber-100 text-amber-800":estimated<0?"bg-emerald-100 text-emerald-800":"bg-slate-100 text-slate-700")}>
                  {estimated>0?uiMessages.deliveries.debit:estimated<0?uiMessages.deliveries.credit:uiMessages.deliveries.settled}
                </span>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{uiMessages.deliveries.estimateWarning}</p>
        </section>}
        {willCreateCredit && <label data-delivery-field="confirmCreditBalance" className="flex flex-wrap scroll-mt-24 items-start gap-2 rounded-lg border border-amber-200 bg-[#fff4df] p-3 text-sm text-[#a46b0b]">
          <input type="checkbox" checked={creditConfirmed} onChange={e=>{setCreditConfirmed(e.target.checked);clearField("confirmCreditBalance");}}
            aria-label="تأكيد الرصيد الدائن"/>
          أؤكد أن المبلغ سيُنشئ أو يزيد رصيدًا دائنًا لحساب العميل.
          {fieldErrors.confirmCreditBalance&&<span role="alert" className="basis-full text-xs text-destructive">{fieldErrors.confirmCreditBalance}</span>}
        </label>}
        {needsPayment && estimated === null && canCollect &&
          <label data-delivery-field="confirmCreditBalance" className="flex flex-wrap scroll-mt-24 items-start gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" checked={creditConfirmed} onChange={e=>{setCreditConfirmed(e.target.checked);clearField("confirmCreditBalance");}}
              aria-label="السماح بالرصيد الدائن"/>
            أوافق على إنشاء رصيد دائن إذا تجاوز المبلغ المستحق (قد يطلب النظام هذا التأكيد).
            {fieldErrors.confirmCreditBalance&&<span role="alert" className="basis-full text-xs text-destructive">{fieldErrors.confirmCreditBalance}</span>}
          </label>}
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
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
        <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
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
        {item.status===2 && <div className="space-y-2 rounded-lg border border-amber-200 p-3 text-sm">
          <p className="font-bold">بيانات إلغاء التسليم</p>
          <p>بواسطة: {item.cancelledByName??"—"} · {cairoDate(item.cancelledAt)}</p>
          <p className="whitespace-pre-wrap">السبب: {item.cancellationReason??"—"}</p>
        </div>}
        {item.canCancel && !cancelMode && <Button type="button" variant="destructive"
          onClick={()=>setCancelMode(true)}>إلغاء التسليم</Button>}
        {item.canCancel && cancelMode && <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4"/> تأكيد إلغاء التسليم
          </p>
          <label className="block space-y-1 text-sm font-semibold">
            <span>سبب الإلغاء *</span>
            <textarea className={fieldClass+" min-h-24 py-2"} maxLength={3000}
              value={reason} onChange={e=>setReason(e.target.value)} placeholder="اكتب سبب الإلغاء..."/>
          </label>
          {hasActiveCollection && <label className="flex items-start gap-2 rounded-lg bg-[#fff4df] p-3 text-sm text-[#a46b0b]">
            <input type="checkbox" aria-label="تأكيد التسوية الفعلية للأموال" checked={fundsConfirmed}
              onChange={e=>setFundsConfirmed(e.target.checked)}/>
            أؤكد أن ردّ الأموال أو تسويتها مع العميل تم فعليًا خارج النظام.
            عكس التحصيل محاسبيًا لا يعيد النقد أو يحوّل الأموال تلقائيًا.
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
