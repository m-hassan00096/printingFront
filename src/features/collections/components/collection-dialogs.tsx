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

function Frame({title,busy,onClose,children}:{title:string;busy:boolean;onClose:()=>void;children:React.ReactNode}) {
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
function CorrectionForm({receipt,onCancel,onSuccess}:{receipt:Collection;onCancel:()=>void;onSuccess:()=>void}) {
  const actions=useCollectionActions();
  const [amount,setAmount]=useState(receipt.amount);
  const [reason,setReason]=useState("");
  const [confirmCredit,setConfirmCredit]=useState(false);
  const [error,setError]=useState("");
  const cents=parseCents(amount);
  const original=parseCents(receipt.amount);
  const valid=cents!==null&&cents>=0&&original!==null&&cents!==original&&
    reason.trim().length>=3&&!actions.correct.isPending;
  async function submit(){
    if(!valid)return;
    const payload:CorrectCollectionPayload={
      amount:centsToMoney(cents!),reason:reason.trim(),
    };
    if(receipt.source===2)payload.confirmCreditBalance=confirmCredit;
    setError("");
    try {
      const result=await actions.correct.mutateAsync({id:receipt.id,payload});
      toast.success(result.receiptNumber
        ?"تم تصحيح مبلغ التحصيل وإنشاء الإيصال "+result.receiptNumber
        :"تم عكس التحصيل بالكامل دون إنشاء إيصال بديل.");
      onSuccess();
    } catch(e:unknown){
      setError(getApiErrorMessage(e,"تعذّر تصحيح مبلغ التحصيل."));
    }
  }
  return <section aria-label="تصحيح مبلغ التحصيل" className="space-y-3 rounded-lg border p-4">
    <h3 className="text-sm font-bold">تصحيح مبلغ التحصيل</h3>
    <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
      <div><p className="text-xs text-muted-foreground">الإيصال الأصلي</p>
        <p dir="ltr" className="mt-1 font-semibold">{receipt.receiptNumber}</p></div>
      <div><p className="text-xs text-muted-foreground">المبلغ المسجل</p>
        <p className="mt-1 font-bold"><MoneyAmount amount={receipt.amount}/></p></div>
      {receipt.orderNumber&&<div><p className="text-xs text-muted-foreground">الأوردر المرتبط</p>
        <p dir="ltr" className="mt-1 font-semibold">{receipt.orderNumber}</p></div>}
    </div>
    <label className="block space-y-1 text-sm font-semibold">
      <span>المبلغ الصحيح (ج.م) *</span>
      <input autoFocus dir="ltr" inputMode="decimal" className={fieldClass} value={amount}
        aria-invalid={cents===null}
        onChange={e=>{setAmount(e.target.value);setError("");}}/>
      {cents===null&&<span role="alert" className="text-xs text-destructive">أدخل مبلغًا صحيحًا برقمين عشريين كحد أقصى.</span>}
      {cents!==null&&cents===original&&<span className="text-xs text-muted-foreground">غيّر المبلغ المسجل قبل الحفظ.</span>}
      {cents===0&&<span className="text-xs text-muted-foreground">المبلغ صفر: سيُعكس الإيصال دون إنشاء إيصال بديل.</span>}
    </label>
    <label className="block space-y-1 text-sm font-semibold">
      <span>سبب التصحيح *</span>
      <textarea className={fieldClass+" min-h-20 py-2"} maxLength={3000} value={reason}
        onChange={e=>{setReason(e.target.value);setError("");}} placeholder="لماذا كان المبلغ المسجل غير صحيح؟"/>
      {reason.length>0&&reason.trim().length<3&&<span role="alert" className="text-xs text-destructive">سبب التصحيح يجب أن يكون 3 أحرف على الأقل.</span>}
    </label>
    <p className="text-xs leading-6 text-muted-foreground">
      سيتم عكس الإيصال القديم وتسجيل إيصال بديل بنفس المصدر وطريقة الدفع
      {receipt.orderNumber?" ونفس الأوردر":""} في عملية واحدة، مع الاحتفاظ بالسجل المالي الأصلي.
      التصحيح لا يرد أموالًا فعلية للعميل.
    </p>
    {receipt.source===2&&cents!==null&&cents>0&&<label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
      <input type="checkbox" className="mt-1 accent-primary" checked={confirmCredit}
        onChange={e=>setConfirmCredit(e.target.checked)}/>
      أوافق على الرصيد الدائن إذا نتج عن تصحيح تحصيل التسليم.
    </label>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={!valid} onClick={()=>void submit()}>{actions.correct.isPending?"جاري التصحيح...":"تأكيد تصحيح المبلغ"}</Button>
      <Button variant="outline" disabled={actions.correct.isPending} onClick={onCancel}>رجوع</Button>
    </div>
  </section>;
}

export function CollectionDetailsDialog({id,onClose,onSuccess}:{id:number;onClose:()=>void;onSuccess:()=>void}) {
  const query=useCollection(id);
  const session=useCurrentUser();
  const canReverse=session.data?.permissions.includes("finance.collections.reverse")??false;
  const canCorrect=session.data?.permissions.includes("finance.collections.correct")??false;
  const canViewOrders=session.data?.permissions.includes("orders.view")??false;
  const canRefund=session.data?.permissions.includes("finance.refunds.create")??false;
  const actions=useCollectionActions();
  const [reversing,setReversing]=useState(false);
  const [correcting,setCorrecting]=useState(false);
  const [reason,setReason]=useState("");
  const [acknowledged,setAcknowledged]=useState(false);
  const [error,setError]=useState("");
  const c=query.data;
  const reversable=c?.status===1&&canReverse;
  async function confirm(){
    if(!reversable||reason.trim().length<3||!acknowledged||actions.reverse.isPending)return;
    setError("");
    try {
      await actions.reverse.mutateAsync({id,reason:reason.trim()});
      toast.success("تم عكس التحصيل محاسبيًا بنجاح.");
      onSuccess();
    } catch(e:unknown) {setError(getApiErrorMessage(e,"تعذّر عكس التحصيل."));}
  }
  return <Frame title="تفاصيل إيصال التحصيل" busy={actions.reverse.isPending} onClose={onClose}>
    {query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:c&&
      <div className="space-y-4">
        <div className="grid gap-4 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
          {[
            ["رقم الإيصال",c.receiptNumber],["العميل",c.customerName],
            ["رقم الهاتف",c.customerPhone],["تاريخ التحصيل",formatCollectionDate(c.collectedOn)],
            ...(c.source!==0&&c.orderNumber?[["رقم الأوردر",c.orderNumber]]:[]),
            ["طريقة التحصيل",c.paymentMethodLabel],["مصدر التحصيل",c.sourceLabel],
            ["الحالة",c.statusLabel],["جهة التحصيل",c.destinationLabel??"—"],
          ].map(([label,value])=><div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words font-semibold text-foreground">{value}</p>
          </div>)}
          <div><p className="text-xs text-muted-foreground">المبلغ</p>
            <p className="mt-1 font-extrabold"><MoneyAmount amount={c.amount}/></p></div>
        </div>
        {c.correctedFromId&&<p className="text-xs text-muted-foreground">هذا الإيصال بديل لتصحيح إيصال رقم #{c.correctedFromId}.</p>}
        {c.correctedToId&&<p className="text-xs text-muted-foreground">تم تصحيح المبلغ بإيصال بديل رقم #{c.correctedToId}.</p>}
        {c.note&&<p className="whitespace-pre-wrap rounded-lg border p-3 text-sm">ملاحظات: {c.note}</p>}
        {c.orderId&&canViewOrders&&<Link to={`/orders/${c.orderId}`} className="text-sm font-semibold text-primary underline">فتح الأوردر المرتبط</Link>}
        {c.status===1&&<p className="flex items-center gap-2 text-sm font-semibold text-[#14815b]"><CheckCircle2 className="size-4"/> إيصال معتمد ومسجل في حساب العميل.</p>}
        {c.status===2&&<div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm">
          <p className="font-bold text-amber-800">تحصيل معكوس — تم إلغاء أثره المالي مع الاحتفاظ بالإيصال.</p>
          <p className="mt-1">سبب العكس: {c.reversalReason??"—"}</p>
          {c.reversedAt&&<p className="mt-1 text-xs text-muted-foreground">
            تاريخ العكس: {new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"}).format(new Date(c.reversedAt))}
          </p>}
        </div>}
        {c.status===1&&<p className="text-xs leading-6 text-muted-foreground">
          عكس التحصيل لتصحيح إيصال مسجل بالخطأ، ولا يلغي الأوردر أو التسليم المرتبط به.
          إذا استُلمت الأموال فعلًا وتريد ردها للعميل، استخدم «رد رصيد» من حسابات العملاء.
        </p>}
        {c.status===1&&canRefund&&<Link to={`/finance?customerId=${c.customerId}`}
          className="inline-flex text-xs font-semibold text-primary underline">الانتقال لحساب العميل لرد رصيد</Link>}
        {c.status===1&&!reversing&&!correcting&&<div className="flex flex-wrap gap-2">
          {canCorrect&&<Button onClick={()=>setCorrecting(true)}>تصحيح المبلغ</Button>}
          {reversable&&<Button variant="destructive" onClick={()=>setReversing(true)}>عكس التحصيل</Button>}
        </div>}
        {c.status===1&&canCorrect&&correcting&&<CorrectionForm receipt={c}
          onCancel={()=>setCorrecting(false)} onSuccess={onSuccess}/>}
        {reversable&&reversing&&<div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive"><AlertTriangle className="size-4"/> عكس التحصيل</p>
          <p className="rounded-lg bg-[#fff4df] p-3 text-sm leading-6 text-[#a46b0b]">
            سيتم إلغاء أثر هذا التحصيل على رصيد العميل بحركة عكسية مع الاحتفاظ بالإيصال وسجل العملية.
            {c.source!==0&&" لن يتم إلغاء الأوردر أو التسليم نفسه."}
            {" "}هذه العملية لا ترد أموالًا للعميل تلقائيًا؛ لرد أموال مدفوعة فعلًا استخدم «رد رصيد» من حساب العميل.
          </p>
          <label className="block space-y-1 text-sm font-semibold">
            <span>سبب العكس *</span>
            <textarea className={fieldClass+" min-h-24 py-2"} value={reason} maxLength={3000}
              onChange={e=>setReason(e.target.value)} placeholder="أدخل سببًا واضحًا..."/>
          </label>
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm leading-6">
            <input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}
              aria-label="تأكيد أثر عكس التحصيل" className="mt-1 accent-primary"/>
            أؤكد فهمي أن عكس التحصيل يعدّل رصيد العميل محاسبيًا، ولا يُعد إثباتًا لرد الأموال فعليًا.
          </label>
          {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={reason.trim().length<3||!acknowledged||actions.reverse.isPending}
              onClick={()=>void confirm()}>{actions.reverse.isPending?"جاري العكس...":"تأكيد عكس التحصيل"}</Button>
            <Button variant="outline" disabled={actions.reverse.isPending} onClick={()=>setReversing(false)}>رجوع</Button>
          </div>
        </div>}
        <div className="border-t pt-3"><Button variant="outline" onClick={onClose}>إغلاق</Button></div>
      </div>}
  </Frame>;
}
