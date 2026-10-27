import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { fieldClass } from "@/features/identity/components/identity-ui";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { parseCents,centsToMoney } from "@/features/deliveries/lib/delivery-money";
import { useOpeningBalance } from "../hooks/use-finance";
import type { OpeningBalanceInput } from "../types/finance.types";

export function OpeningBalanceDialog({customerId,customerName,onClose,onSuccess}:{
  customerId:number;customerName:string;onClose:()=>void;onSuccess:()=>void;
}){
  const post=useOpeningBalance();
  const [amount,setAmount]=useState("");
  const [type,setType]=useState<1|2>(1);
  const [note,setNote]=useState("");
  const [ack,setAck]=useState(false);
  const [error,setError]=useState("");
  const cents=parseCents(amount);
  const allowed=cents!==null&&cents>0&&ack&&note.length<=5000&&!post.isPending;
  async function submit(){
    if(!allowed)return;
    const payload:OpeningBalanceInput={amount:centsToMoney(cents!),type,...(note.trim()?{note:note.trim()}:{})};
    setError("");
    try{
      await post.mutateAsync({id:customerId,payload});
      toast.success("تم تسجيل الرصيد الافتتاحي بنجاح.");
      onSuccess();
    }catch(err:unknown){
      setError(getApiErrorMessage(err,"تعذّر تسجيل الرصيد الافتتاحي. ربما سبق تسجيله للعميل."));
    }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-3"
    onMouseDown={e=>{if(e.target===e.currentTarget&&!post.isPending)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label="تسجيل الرصيد الافتتاحي" dir="rtl"
      onKeyDown={e=>{if(e.key==="Escape"&&!post.isPending)onClose();}}
      className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-card shadow-2xl">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">تسجيل الرصيد الافتتاحي</h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="إغلاق" disabled={post.isPending} onClick={onClose}><X className="size-4"/></Button>
      </header>
      <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          العميل: <strong>{customerName}</strong>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-[#fff4df] p-3 text-sm leading-6 text-amber-950">
          <AlertTriangle className="mt-1 size-4 shrink-0"/>
          يُسمح بتسجيل رصيد افتتاحي واحد فقط لكل عميل. لا يمكن تعديل الحركة بعد ترحيلها؛ اختر نوع الرصيد بعناية.
        </p>
        <label className="block space-y-1 text-sm font-semibold">
          <span>نوع الرصيد *</span>
          <select aria-label="نوع الرصيد" className={fieldClass} value={type}
            onChange={e=>{setType(Number(e.target.value) as 1|2);setAck(false);}}>
            <option value={1}>مدين — العميل عليه مديونية</option>
            <option value={2}>دائن — للعميل رصيد لدى المطبعة</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          <span>قيمة الرصيد بالجنيه *</span>
          <input className={fieldClass} dir="ltr" inputMode="decimal" value={amount} aria-label="قيمة الرصيد"
            aria-invalid={amount!==""&&(cents===null||cents<=0)}
            placeholder="0.00" onChange={e=>{setAmount(e.target.value);setAck(false);}}/>
          {amount!==""&&(cents===null||cents<=0)&&<span role="alert" className="text-xs text-destructive">
            يجب أن يكون المبلغ أكبر من صفر وبحد أقصى منزلتين عشريتين.
          </span>}
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          <span>ملاحظة (اختيارية)</span>
          <textarea className={fieldClass+" min-h-20 py-2"} maxLength={5000} value={note}
            onChange={e=>setNote(e.target.value)} placeholder="مثال: رصيد العميل قبل بدء استخدام النظام"/>
        </label>
        {cents!==null&&cents>0&&<div className="rounded-lg border p-3 text-sm">
          الرصيد الافتتاحي المختار: <strong>{type===1?"مدين":"دائن"} · <MoneyAmount amount={centsToMoney(cents)}/></strong>
        </div>}
        <label className="flex items-start gap-2 text-sm leading-6">
          <input type="checkbox" aria-label="تأكيد تسجيل الرصيد الافتتاحي" checked={ack}
            onChange={e=>setAck(e.target.checked)} className="mt-1 accent-primary"/>
          أؤكد صحة المبلغ ونوع الرصيد الافتتاحي وأعلم أنه لا يمكن تسجيل رصيد افتتاحي آخر لنفس العميل.
        </label>
        {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" disabled={!allowed} onClick={()=>void submit()}>
            {post.isPending?"جاري التسجيل...":"تأكيد الرصيد الافتتاحي"}
          </Button>
          <Button type="button" variant="outline" disabled={post.isPending} onClick={onClose}>رجوع</Button>
        </div>
      </div>
    </section>
  </div>;
}
