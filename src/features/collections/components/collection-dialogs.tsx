import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { getOrderPaymentOptions } from "@/features/orders/api/order-options.api";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { ErrorState, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { parseCents, centsToMoney } from "@/features/deliveries/lib/delivery-money";
import { useCollection, useCollectionActions, useCollectionCustomers } from "../hooks/use-collections";
import { CollectionDateField, formatCollectionDate } from "./collection-date-field";
import type { Collection,CreateCollectionPayload,CorrectCollectionPayload,PaymentMethod } from "../types/collections.types";

function Frame({title,busy,onClose,footer,children}:{title:string;busy:boolean;onClose:()=>void;footer?:React.ReactNode;children:React.ReactNode}) {
  const titleId=useId();
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    closeRef.current?.focus();
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previousOverflow;};
  },[]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-3 sm:p-4"
    onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} dir="rtl"
      className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-card shadow-2xl"
      onKeyDown={e=>{if(e.key==="Escape"&&!busy)onClose();}}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b p-4">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        <Button ref={closeRef} type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label="إغلاق" onClick={onClose}><X className="size-4"/></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      {footer&&<footer className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-card px-4 py-3 sm:px-5">{footer}</footer>}
    </section>
  </div>;
}
export function CreateCollectionDialog({onClose,onSuccess}:{onClose:()=>void;onSuccess:()=>void}) {
  const actions=useCollectionActions();
  const customers=useCollectionCustomers(true);
  const [customer,setCustomer]=useState("");
  const [amount,setAmount]=useState("");
  const [method,setMethod]=useState<PaymentMethod>(0);
  const [destination,setDestination]=useState("");
  const [collectedOn,setCollectedOn]=useState("");
  const [note,setNote]=useState("");
  const [error,setError]=useState("");
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const amountCents=parseCents(amount);
  const amountInvalid=amount.length>0 && (amountCents===null || amountCents<=0);
  const amountError=fieldErrors.amount||(amountInvalid?"أدخل مبلغًا أكبر من صفر وبحد أقصى رقمين عشريين.":"");
  const needsDestination=method!==0;
  const paymentOptions=useQuery({queryKey:["collections","destinations"],queryFn:getOrderPaymentOptions,enabled:needsDestination});
  const destinations=method===1?paymentOptions.data?.banks??[]:paymentOptions.data?.wallets??[];
  const dateParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const datePart=(type:string)=>dateParts.find(p=>p.type===type)?.value??"";
  const today=[datePart("year"),datePart("month"),datePart("day")].join("-");
  const dateValid=!collectedOn || collectedOn<=today;
  const valid=Number(customer)>0 && amountCents!==null && amountCents>0 &&
    customers.data?.some(x=>String(x.value)===customer)===true &&
    (!needsDestination || destinations.some(x=>String(x.value)===destination)) &&
    dateValid && note.length<=5000 && !actions.create.isPending;
  async function submit(){
    if(!valid)return;
    const payload:CreateCollectionPayload={
      customerId:Number(customer),amount:centsToMoney(amountCents!),paymentMethod:method,
    };
    if(needsDestination)payload.paymentDestinationId=Number(destination);
    if(collectedOn)payload.collectedOn=collectedOn;
    if(note.trim())payload.note=note.trim();
    setError("");setFieldErrors({});
    try {
      const created=await actions.create.mutateAsync(payload);
      toast.success("تم تسجيل التحصيل: "+created.receiptNumber);
      onSuccess();
    } catch(e:unknown) {
      setError(getApiErrorMessage(e,"تعذّر تسجيل التحصيل."));
      const response=e as {response?:{data?:{errors?:Record<string,string[]>}}};
      const fields=response.response?.data?.errors;
      if(fields&&typeof fields==="object")setFieldErrors(Object.fromEntries(
        Object.entries(fields).map(([name,errors])=>[name,errors[0]??"قيمة غير صحيحة"])
      ));
    }
  }
  return <Frame title="تسجيل تحصيل جديد" busy={actions.create.isPending} onClose={onClose}>
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-primary/10 bg-muted/40 p-3 text-sm leading-6 text-foreground/80">
        <Info className="mt-0.5 size-4 shrink-0 text-primary"/>
        التحصيل العام يُسجل على حساب العميل ويقلل مديونيته، وأي مبلغ زائد يصبح رصيدًا دائنًا.
        لا يلزم ربط التحصيل بأوردر.
      </p>
      <div className="space-y-1">
        <label className="text-sm font-semibold">العميل *</label>
        <SearchableSelect label="اختيار العميل" placeholder="ابحث بالاسم أو الهاتف..."
          options={customers.data??[]} value={customer} onChange={v=>{setCustomer(v);setError("");setFieldErrors({});}}
          loading={customers.isPending} disabled={customers.isError}/>
        {customers.isError&&<p role="alert" className="text-sm text-destructive">
          تعذّر تحميل العملاء. تأكد من صلاحية قائمة العملاء.
          <button type="button" className="mr-2 underline" onClick={()=>void customers.refetch()}>إعادة المحاولة</button>
        </p>}
        {!customers.isPending&&!customers.isError&&customers.data?.length===0&&<p className="text-sm text-muted-foreground">لا يوجد عملاء مسجلون.</p>}
        {fieldErrors.customerId&&<p role="alert" className="text-xs text-destructive">{fieldErrors.customerId}</p>}
      </div>
      <label className="block space-y-1 text-sm font-semibold">
        <span>المبلغ (ج.م) *</span>
        <input dir="ltr" inputMode="decimal" className={fieldClass} value={amount}
          aria-invalid={amountInvalid||Boolean(fieldErrors.amount)}
          onChange={e=>{setAmount(e.target.value);setError("");setFieldErrors(prev=>({...prev,amount:""}));}} placeholder="0.00"/>
        {amountError&&<p role="alert" className="text-xs text-destructive">{amountError}</p>}
      </label>
      <label className="block space-y-1 text-sm font-semibold">
        <span>طريقة التحصيل *</span>
        <select className={fieldClass} aria-label="طريقة التحصيل" value={method}
          onChange={e=>{setMethod(Number(e.target.value) as PaymentMethod);setDestination("");setError("");setFieldErrors({});}}>
          <option value={0}>نقدي</option>
          <option value={1}>تحويل بنكي</option>
          <option value={2}>محفظة إلكترونية</option>
        </select>
      </label>
      {needsDestination&&<div className="space-y-1">
        <label className="text-sm font-semibold">حساب التحصيل *</label>
        <SearchableSelect label="حساب التحصيل" placeholder="اختر الحساب..."
          options={destinations} value={destination} onChange={value=>{setDestination(value);setFieldErrors(prev=>({...prev,paymentDestinationId:""}));}}
          loading={paymentOptions.isPending} disabled={paymentOptions.isError}/>
        {paymentOptions.isError&&<p role="alert" className="text-sm text-destructive">
          تعذّر تحميل الحسابات.
          <button type="button" className="mr-2 underline" onClick={()=>void paymentOptions.refetch()}>إعادة المحاولة</button>
        </p>}
        {!paymentOptions.isPending&&!paymentOptions.isError&&destinations.length===0&&
          <p className="text-sm text-[#a46b0b]">لا توجد حسابات نشطة لطريقة الدفع المختارة. يمكن مراجعتها من الإعدادات.</p>}
        {fieldErrors.paymentDestinationId&&<p role="alert" className="text-xs text-destructive">{fieldErrors.paymentDestinationId}</p>}
      </div>}
      <div className="space-y-1">
        <CollectionDateField label="تاريخ التحصيل (اختياري)" max={today} value={collectedOn}
          onChange={setCollectedOn}/>
        {!dateValid&&<p role="alert" className="text-xs text-destructive">لا يمكن تحديد تاريخ مستقبلي.</p>}
        {fieldErrors.collectedOn&&<p role="alert" className="text-xs text-destructive">{fieldErrors.collectedOn}</p>}
      </div>
      <label className="block space-y-1 text-sm font-semibold">
        <span>ملاحظات (اختياري)</span>
        <textarea className={fieldClass+" min-h-24 py-2"} maxLength={5000} value={note}
          onChange={e=>setNote(e.target.value)} placeholder="تفاصيل إضافية عن التحصيل..."/>
      </label>
      {error&&<p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button disabled={!valid} onClick={()=>void submit()}>
          {actions.create.isPending?"جاري الحفظ...":"تأكيد تسجيل التحصيل"}
        </Button>
        <Button variant="outline" disabled={actions.create.isPending} onClick={onClose}>إلغاء</Button>
      </div>
    </div>
  </Frame>;
}

type ReceiptView="details"|"correct"|"reverse";

function ReceiptActionSummary({receipt}:{receipt:Collection}){
  return <div className="grid gap-x-4 gap-y-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
    <div>
      <p className="text-xs text-muted-foreground">رقم الإيصال</p>
      <p className="mt-1 text-right font-semibold"><span dir="ltr" className="inline-block tabular-nums">{receipt.receiptNumber}</span></p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">المبلغ المسجل</p>
      <p className="mt-1 font-bold"><MoneyAmount amount={receipt.amount}/></p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">العميل</p>
      <p className="mt-1 font-semibold">{receipt.customerName}</p>
    </div>
    {receipt.source!==0&&receipt.orderNumber&&<div>
      <p className="text-xs text-muted-foreground">رقم الأوردر</p>
      <p className="mt-1 text-right font-semibold"><span dir="ltr" className="inline-block tabular-nums">{receipt.orderNumber}</span></p>
    </div>}
  </div>;
}

export function CollectionDetailsDialog({id,onClose,onSuccess}:{id:number;onClose:()=>void;onSuccess:()=>void}) {
  const query=useCollection(id);
  const session=useCurrentUser();
  const canReverse=session.data?.permissions.includes("finance.collections.reverse")??false;
  const canCorrect=session.data?.permissions.includes("finance.collections.correct")??false;
  const canViewOrders=session.data?.permissions.includes("orders.view")??false;
  const canRefund=session.data?.permissions.includes("finance.refunds.create")??false;
  const actions=useCollectionActions();
  const [view,setView]=useState<ReceiptView>("details");
  const [amount,setAmount]=useState("");
  const [correctionReason,setCorrectionReason]=useState("");
  const [confirmCredit,setConfirmCredit]=useState(false);
  const [reversalReason,setReversalReason]=useState("");
  const [acknowledged,setAcknowledged]=useState(false);
  const [error,setError]=useState("");
  const receipt=query.data;
  const busy=actions.reverse.isPending||actions.correct.isPending;
  const isPosted=receipt?.status===1;
  const correctable=Boolean(isPosted&&canCorrect);
  const reversible=Boolean(isPosted&&canReverse);
  const correctedCents=parseCents(amount);
  const originalCents=receipt?parseCents(receipt.amount):null;
  const amountChanged=correctedCents!==null&&originalCents!==null&&correctedCents!==originalCents;
  const validCorrection=correctable&&correctedCents!==null&&correctedCents>0&&amountChanged&&
    correctionReason.trim().length>=3&&!busy;
  const validReversal=reversible&&reversalReason.trim().length>=3&&acknowledged&&!busy;

  function goBack(){
    if(busy)return;
    setView("details");
    setError("");
    setAmount("");
    setCorrectionReason("");
    setConfirmCredit(false);
    setReversalReason("");
    setAcknowledged(false);
  }
  function beginCorrection(){
    if(!correctable||!receipt)return;
    setAmount(receipt.amount);
    setCorrectionReason("");
    setConfirmCredit(false);
    setError("");
    setView("correct");
  }
  function beginReversal(){
    if(!reversible)return;
    setReversalReason("");
    setAcknowledged(false);
    setError("");
    setView("reverse");
  }
  async function submitCorrection(){
    if(!validCorrection||!receipt)return;
    const payload:CorrectCollectionPayload={
      amount:centsToMoney(correctedCents!),reason:correctionReason.trim(),
    };
    if(receipt.source===2)payload.confirmCreditBalance=confirmCredit;
    setError("");
    try{
      const result=await actions.correct.mutateAsync({id,payload});
      toast.success(result.receiptNumber
        ?"تم تصحيح التحصيل وإنشاء الإيصال البديل "+result.receiptNumber
        :"تم تصحيح التحصيل بنجاح.");
      onSuccess();
    }catch(e:unknown){
      setError(getApiErrorMessage(e,"تعذّر تصحيح مبلغ التحصيل."));
    }
  }
  async function submitReversal(){
    if(!validReversal)return;
    setError("");
    try{
      await actions.reverse.mutateAsync({id,reason:reversalReason.trim()});
      toast.success("تم عكس التحصيل محاسبيًا بنجاح.");
      onSuccess();
    }catch(e:unknown){
      setError(getApiErrorMessage(e,"تعذّر عكس التحصيل."));
    }
  }

  const title=view==="correct"?"تصحيح مبلغ التحصيل":view==="reverse"?"عكس الإيصال بالكامل":"تفاصيل إيصال التحصيل";
  const footer=view==="correct"?<>
    <Button disabled={!validCorrection} onClick={()=>void submitCorrection()}>
      {actions.correct.isPending?"جاري التصحيح...":"تأكيد تصحيح المبلغ"}
    </Button>
    <Button variant="outline" disabled={busy} onClick={goBack}>رجوع للتفاصيل</Button>
  </>:view==="reverse"?<>
    <Button variant="destructive" disabled={!validReversal} onClick={()=>void submitReversal()}>
      {actions.reverse.isPending?"جاري العكس...":"تأكيد عكس الإيصال"}
    </Button>
    <Button variant="outline" disabled={busy} onClick={goBack}>رجوع للتفاصيل</Button>
  </>:<Button variant="outline" disabled={busy} onClick={onClose}>إغلاق</Button>;

  return <Frame title={title} busy={busy} onClose={onClose} footer={footer}>
    {query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:receipt&&
      (view==="details"?<div className="space-y-4">
        <div className="grid gap-4 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
          {[
            ["رقم الإيصال",receipt.receiptNumber],["العميل",receipt.customerName],
            ["رقم الهاتف",receipt.customerPhone],["تاريخ التحصيل",formatCollectionDate(receipt.collectedOn)],
            ...(receipt.source!==0&&receipt.orderNumber?[["رقم الأوردر",receipt.orderNumber]]:[]),
            ["طريقة التحصيل",receipt.paymentMethodLabel],["مصدر التحصيل",receipt.sourceLabel],
            ["الحالة",receipt.statusLabel],["جهة التحصيل",receipt.destinationLabel??"—"],
          ].map(([label,value])=><div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-right font-semibold text-foreground">{label==="رقم الإيصال"||label==="رقم الأوردر"?<span dir="ltr" className="inline-block tabular-nums">{value}</span>:value}</p>
          </div>)}
          <div><p className="text-xs text-muted-foreground">المبلغ</p>
            <p className="mt-1 font-extrabold"><MoneyAmount amount={receipt.amount}/></p></div>
        </div>
        {receipt.correctedFromId&&<p className="text-xs text-muted-foreground">
          هذا الإيصال بديل لإيصال سابق رقم #{receipt.correctedFromId}.
        </p>}
        {receipt.correctedToId&&<p className="text-xs text-muted-foreground">
          تم تصحيح المبلغ، والإيصال البديل رقم #{receipt.correctedToId}.
        </p>}
        {receipt.note&&<p className="whitespace-pre-wrap rounded-lg border p-3 text-sm">ملاحظات: {receipt.note}</p>}
        {receipt.orderId&&canViewOrders&&<Link to={`/orders/${receipt.orderId}`} className="text-sm font-semibold text-primary underline">فتح الأوردر المرتبط</Link>}
        {receipt.status===1&&<p className="flex items-center gap-2 text-sm font-semibold text-[#14815b]">
          <CheckCircle2 className="size-4"/> إيصال معتمد ومسجل في حساب العميل.
        </p>}
        {receipt.status===2&&<div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm">
          <p className="font-bold text-amber-800">
            {receipt.correctedToId?"تم تصحيح الإيصال — الإيصال الأصلي معكوس ومُحتفظ به.":"تحصيل معكوس — تم إلغاء أثره المالي مع الاحتفاظ بالإيصال."}
          </p>
          <p className="mt-1">سبب العكس: {receipt.reversalReason??"—"}</p>
          {receipt.reversedAt&&<p className="mt-1 text-xs text-muted-foreground">
            تاريخ العكس: {new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"}).format(new Date(receipt.reversedAt))}
          </p>}
        </div>}
        {receipt.status===1&&(correctable||reversible)&&<section className="space-y-2 border-t pt-3" aria-label="إجراءات الإيصال">
          <p className="text-sm font-semibold">هل المبلغ المسجل صحيح؟</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {correctable&&<div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">استلمت مبلغًا مختلفًا عن المسجل؟</p>
              <Button className="w-full" onClick={beginCorrection}>تصحيح المبلغ</Button>
            </div>}
            {reversible&&<div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">الإيصال كله اتسجل بالخطأ؟</p>
              <Button variant="outline" className="w-full text-destructive" onClick={beginReversal}>عكس الإيصال بالكامل</Button>
            </div>}
          </div>
          <p className="text-xs text-muted-foreground">
            كلا الإجراءين يغيّر حساب العميل محاسبيًا، ولا يرد أموالًا فعلية.
          </p>
        </section>}
        {receipt.status===1&&canRefund&&<Link to={`/finance?customerId=${receipt.customerId}`}
          className="inline-flex text-xs font-semibold text-primary underline">الانتقال لحساب العميل لرد رصيد</Link>}
      </div>:view==="correct"&&correctable?<div className="space-y-4">
        <ReceiptActionSummary receipt={receipt}/>
        <label className="block space-y-2 text-sm font-semibold">
          <span className="block">المبلغ الصحيح الذي استُلم (ج.م) *</span>
          <input autoFocus dir="ltr" inputMode="decimal" className={fieldClass} value={amount}
            aria-invalid={correctedCents===null||correctedCents===0}
            onChange={e=>{setAmount(e.target.value);setError("");}}/>
          {correctedCents===null&&<span role="alert" className="text-xs text-destructive">
            أدخل مبلغًا صحيحًا برقمين عشريين كحد أقصى.
          </span>}
          {correctedCents===0&&<p role="alert" className="text-xs text-destructive">
            لإلغاء الإيصال بالكامل، ارجع واختر «عكس التحصيل».
          </p>}
          {correctedCents!==null&&correctedCents===originalCents&&<p className="text-xs text-muted-foreground">غيّر المبلغ المسجل قبل الحفظ.</p>}
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span className="block">سبب التصحيح *</span>
          <textarea className={fieldClass+" min-h-20 py-2"} maxLength={3000} value={correctionReason}
            onChange={e=>{setCorrectionReason(e.target.value);setError("");}}
            placeholder="مثال: العميل دفع 300 ج.م لكن تم تسجيل 500 ج.م"/>
          {correctionReason.length>0&&correctionReason.trim().length<3&&<span role="alert" className="text-xs text-destructive">
            السبب لازم يكون 3 أحرف على الأقل.
          </span>}
        </label>
        <section aria-label="النتيجة بعد التصحيح" className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-semibold">النتيجة بعد التصحيح</p>
          {correctedCents!==null&&correctedCents>0&&amountChanged&&<div
            aria-label="مقارنة المبلغ القديم والجديد"
            className="grid grid-cols-2 gap-3 rounded-md border bg-card p-3">
            <div>
              <p className="text-xs text-muted-foreground">المبلغ القديم</p>
              <p className="mt-1 font-semibold"><MoneyAmount amount={receipt.amount}/></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المبلغ الجديد</p>
              <p className="mt-1 font-bold text-foreground"><MoneyAmount amount={centsToMoney(correctedCents)}/></p>
            </div>
          </div>}
          <p className="text-xs leading-6 text-muted-foreground">
            سيُعكس الإيصال القديم ويُسجل إيصال جديد
            {receipt.source!==0?" لنفس الأوردر":""} بنفس طريقة الدفع والمصدر، مع الاحتفاظ بالسجل المالي.
          </p>
        </section>
        {receipt.source===2&&<label className="flex items-start gap-2 rounded-lg border p-3 text-sm leading-6">
          <input type="checkbox" checked={confirmCredit} onChange={e=>setConfirmCredit(e.target.checked)}
            className="mt-1 accent-primary"/>
          أوافق على الرصيد الدائن إذا نتج عن تصحيح تحصيل التسليم.
        </label>}
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>:view==="reverse"&&reversible?<div className="space-y-4">
        <ReceiptActionSummary receipt={receipt}/>
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <AlertTriangle className="mt-1 size-4 shrink-0"/>
          <span>
            سيتم إلغاء الأثر المالي للإيصال بالكامل، مع الاحتفاظ به في السجل.
            {receipt.source!==0?" لن يتم إلغاء الأوردر أو التسليم.":""}
            {" "}العملية لا ترد فلوسًا للعميل تلقائيًا.
          </span>
        </p>
        <label className="block space-y-2 text-sm font-semibold">
          <span className="block">سبب العكس *</span>
          <textarea autoFocus className={fieldClass+" min-h-20 py-2"} maxLength={3000} value={reversalReason}
            onChange={e=>{setReversalReason(e.target.value);setError("");}}
            placeholder="مثال: تم تسجيل الإيصال مرتين"/>
          {reversalReason.length>0&&reversalReason.trim().length<3&&<p role="alert" className="text-xs text-destructive">
            السبب لازم يكون 3 أحرف على الأقل.
          </p>}
        </label>
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm leading-6">
          <input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}
            aria-label="تأكيد أثر عكس التحصيل" className="mt-1 accent-primary"/>
          أؤكد أنني أريد إلغاء أثر هذا الإيصال ماليًا.
        </label>
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>:<p className="text-sm text-muted-foreground">هذا الإيصال غير متاح للإجراء المطلوب.</p>)}
  </Frame>;
}
