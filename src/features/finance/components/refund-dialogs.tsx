import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { getOrderPaymentOptions } from "@/features/orders/api/order-options.api";
import { useFinanceCustomers } from "../hooks/use-finance";
import { ErrorState,LoadingState,fieldClass } from "@/features/identity/components/identity-ui";
import { getApiErrorMessage } from "@/shared/api/http";
import { parseCents,centsToMoney } from "@/features/deliveries/lib/delivery-money";
import { useCreateRefund,useRefundCredit,useRefundDetails } from "../hooks/use-refunds";
import type { RefundPayload,RefundPaymentMethod } from "../types/refunds.types";

function Modal({title,onClose,busy,children}:{title:string;onClose:()=>void;busy:boolean;children:React.ReactNode}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3"
    onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label={title} dir="rtl"
      className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
      onKeyDown={event=>{if(event.key==="Escape"&&!busy)onClose();}}>
      <header className="flex shrink-0 items-center justify-between border-b p-4">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="إغلاق" disabled={busy}
          onClick={onClose}><X className="size-4"/></Button>
      </header>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
    </section>
  </div>;
}
export function CreateRefundDialog({initialCustomerId=0,onClose,onSuccess}:{
  initialCustomerId?:number;onClose:()=>void;onSuccess:()=>void;
}){
  const [customer,setCustomer]=useState(initialCustomerId?String(initialCustomerId):"");
  const [amount,setAmount]=useState("");
  const [method,setMethod]=useState<RefundPaymentMethod>(0);
  const [destination,setDestination]=useState("");
  const [reason,setReason]=useState("");
  const [ack,setAck]=useState(false);
  const [error,setError]=useState("");
  const [validation,setValidation]=useState<Record<string,string>>({});
  const customers=useFinanceCustomers();
  const customerId=Number(customer)||0;
  const credit=useRefundCredit(customerId,customerId>0);
  const cents=parseCents(amount);
  const creditCents=credit.isSuccess?parseCents(credit.data.availableCredit):null;
  const overCredit=cents!==null&&creditCents!==null&&cents>creditCents;
  const needsDestination=method!==0;
  const options=useQuery({queryKey:["finance","refund-payment-destinations"],queryFn:getOrderPaymentOptions,enabled:needsDestination});
  const destinations=method===1?options.data?.banks??[]:options.data?.wallets??[];
  const validCustomer=customers.data?.some(x=>String(x.value)===customer)??false;
  const post=useCreateRefund();
  const valid=validCustomer&&credit.isSuccess&&credit.data.canRefund&&
    cents!==null&&cents>0&&creditCents!==null&&cents<=creditCents&&
    reason.trim().length>=3&&reason.trim().length<=3000&&ack&&
    (!needsDestination||destinations.some(x=>String(x.value)===destination))&&!post.isPending;

  async function submit(){
    if(!valid||cents===null)return;
    const payload:RefundPayload={customerId,amount:centsToMoney(cents),paymentMethod:method,reason:reason.trim()};
    if(needsDestination)payload.paymentDestinationId=Number(destination);
    setError("");setValidation({});
    try{
      const result=await post.mutateAsync(payload);
      toast.success("تم تسجيل رد الرصيد: "+result.refundNumber);
      onSuccess();
    }catch(err:unknown){
      setError(getApiErrorMessage(err,"تعذّر تسجيل رد الرصيد. حدّث الرصيد وحاول مجددًا."));
      const fields=(err as {response?:{data?:{errors?:Record<string,string[]>}}}).response?.data?.errors;
      if(fields)setValidation(Object.fromEntries(Object.entries(fields).map(([field,values])=>[field,values[0]??"قيمة غير صالحة"])));
      void credit.refetch();
    }
  }
  return <Modal title="رد رصيد دائن للعميل" busy={post.isPending} onClose={onClose}>
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        <AlertTriangle className="mt-1 size-4 shrink-0"/>
        سجل العملية بعد رد الأموال فعليًا للعميل. النظام يُعدّل رصيده المحاسبي فقط ولا ينفذ تحويلًا أو صرفًا تلقائيًا.
      </p>
      <div className="space-y-1">
        <label className="text-sm font-semibold">العميل *</label>
        <SearchableSelect label="عميل رد الرصيد" placeholder="ابحث بالاسم أو الهاتف..." value={customer}
          options={customers.data??[]} loading={customers.isPending} disabled={customers.isError||post.isPending}
          onChange={value=>{setCustomer(value);setAck(false);setError("");setAmount("");}}/>
        {customers.isError&&<ErrorState error={customers.error} retry={()=>void customers.refetch()}/>}
        {validation.customerId&&<p role="alert" className="text-xs text-destructive">{validation.customerId}</p>}
      </div>
      {customerId>0&&(credit.isPending?<LoadingState/>:credit.isError?
        <ErrorState error={credit.error} retry={()=>void credit.refetch()}/>:
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="text-xs font-semibold">الرصيد المتاح للرد حاليًا</p>
          <p className="mt-1 text-xl font-extrabold"><MoneyAmount amount={credit.data!.availableCredit}/></p>
          {!credit.data!.canRefund&&<p role="alert" className="mt-1 text-xs font-semibold">العميل ليس له رصيد دائن متاح للرد.</p>}
          <p className="mt-1 text-xs">يُعاد التحقق من الرصيد داخل معاملة قاعدة البيانات عند الحفظ.</p>
        </div>)}
      <label className="block space-y-1 text-sm font-semibold">
        <span>المبلغ المراد رده (ج.م) *</span>
        <input className={fieldClass} dir="ltr" inputMode="decimal" value={amount}
          aria-label="مبلغ رد الرصيد" placeholder="0.00" onChange={event=>{setAmount(event.target.value);setAck(false);setError("");}}/>
        {amount!==""&&(cents===null||cents<=0)&&<p role="alert" className="text-xs text-destructive">أدخل مبلغًا صحيحًا أكبر من صفر وبحد أقصى منزلتين عشريتين.</p>}
        {overCredit&&<p role="alert" className="text-xs font-semibold text-destructive">المبلغ يتجاوز الرصيد الدائن المتاح.</p>}
        {validation.amount&&<p role="alert" className="text-xs text-destructive">{validation.amount}</p>}
      </label>
      <label className="block space-y-1 text-sm font-semibold">
        <span>طريقة رد المبلغ *</span>
        <select className={fieldClass} value={method} aria-label="طريقة رد الرصيد"
          onChange={event=>{setMethod(Number(event.target.value) as RefundPaymentMethod);setDestination("");setAck(false);}}>
          <option value={0}>نقدي</option><option value={1}>تحويل بنكي</option><option value={2}>محفظة إلكترونية</option>
        </select>
      </label>
      {needsDestination&&<div className="space-y-1">
        <label className="text-sm font-semibold">حساب رد الأموال *</label>
        <SearchableSelect label="حساب رد الأموال" placeholder="اختر حسابًا نشطًا..."
          value={destination} options={destinations} loading={options.isPending} disabled={options.isError}
          onChange={value=>{setDestination(value);setAck(false);}}/>
        {options.isError&&<ErrorState error={options.error} retry={()=>void options.refetch()}/>}
        {options.isSuccess&&destinations.length===0&&<p role="alert" className="text-xs text-amber-800">لا توجد حسابات نشطة لهذه الطريقة.</p>}
        {validation.paymentDestinationId&&<p role="alert" className="text-xs text-destructive">{validation.paymentDestinationId}</p>}
      </div>}
      <label className="block space-y-1 text-sm font-semibold">
        <span>سبب رد الرصيد *</span>
        <textarea className={fieldClass+" min-h-24 py-2"} value={reason} maxLength={3000}
          aria-label="سبب رد الرصيد" onChange={e=>{setReason(e.target.value);setAck(false);}}
          placeholder="مثال: طلب العميل استرداد المبلغ المتبقي بعد إلغاء الأوردر..."/>
        {reason.length>0&&reason.trim().length<3&&<p role="alert" className="text-xs text-destructive">السبب لازم يكون 3 أحرف على الأقل.</p>}
        {validation.reason&&<p role="alert" className="text-xs text-destructive">{validation.reason}</p>}
      </label>
      <label className="flex items-start gap-2 rounded-xl border p-3 text-sm leading-6">
        <input type="checkbox" checked={ack} aria-label="تأكيد رد الأموال فعليًا" className="mt-1 accent-primary"
          onChange={e=>setAck(e.target.checked)}/>
        أؤكد أن المبلغ تم رده فعليًا للعميل بالطريقة المحددة، وأن تسجيل العملية سيخصمه من رصيده الدائن.
      </label>
      {error&&<p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button disabled={!valid} onClick={()=>void submit()}>{post.isPending?"جاري التسجيل...":"تأكيد رد الرصيد"}</Button>
        <Button variant="outline" disabled={post.isPending} onClick={onClose}>إلغاء</Button>
      </div>
    </div>
  </Modal>;
}
export function RefundDetailsDialog({id,onClose}:{id:number;onClose:()=>void}){
  const details=useRefundDetails(id,true);
  const item=details.data;
  return <Modal title="تفاصيل رد الرصيد" busy={false} onClose={onClose}>
    {details.isPending?<LoadingState/>:details.isError?<ErrorState error={details.error} retry={()=>void details.refetch()}/>:item&&
      <div className="space-y-4">
        <div className="grid gap-4 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
          {[
            ["رقم المستند",item.refundNumber],["العميل",item.customerName],
            ["تاريخ الرد",item.refundedOn],["طريقة الرد",item.paymentMethodLabel],
            ["الحساب المستخدم",item.destinationLabel??"نقدي"],["السبب",item.reason],
          ].map(([name,value])=><div key={name}>
            <p className="text-xs text-foreground/70">{name}</p>
            <p className="mt-1 whitespace-pre-wrap break-words font-semibold">{value}</p>
          </div>)}
          <div><p className="text-xs text-foreground/70">المبلغ المسترد</p>
            <p className="mt-1 text-lg font-extrabold"><MoneyAmount amount={item.amount}/></p></div>
        </div>
        <p className="text-xs text-muted-foreground">هذا المستند المالي معتمد ولا يمكن حذفه أو تعديله من الواجهة.</p>
        <div className="border-t pt-3"><Button variant="outline" onClick={onClose}>إغلاق</Button></div>
      </div>}
  </Modal>;
}
