import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { fieldClass } from "@/features/identity/components/identity-ui";
import { getApiErrorMessage } from "@/shared/api/http";
import { parseCents, centsToMoney } from "@/features/deliveries/lib/delivery-money";
import { useCollectionActions } from "@/features/collections/hooks/use-collections";
import { CollectionDateField } from "@/features/collections/components/collection-date-field";
import { AccountPaymentFields, type AccountPaymentValue } from "./account-payment-fields";
import { cairoToday } from "../lib/account-display";

export function AccountCollectionDialog({customerId, customerName, onClose, onSuccess}: {
  customerId: number; customerName: string; onClose: () => void; onSuccess: () => void;
}) {
  const actions = useCollectionActions();
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<AccountPaymentValue>({method: 0, destination: ""});
  const [date, setDate] = useState(cairoToday);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const frame = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cents = parseCents(amount);
  const busy = actions.create.isPending;
  const valid = cents !== null && cents > 0 && date !== "" && date <= cairoToday() && (payment.method === 0 || payment.destination !== "");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    return () => {document.body.style.overflow = overflow; previous?.focus();};
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setError("");
    try {
      const receipt = await actions.create.mutateAsync({customerId, amount: centsToMoney(cents!),
        paymentMethod: payment.method, collectedOn: date, ...(note.trim() ? {note: note.trim()} : {}),
        ...(payment.method !== 0 ? {paymentDestinationId: Number(payment.destination)} : {})});
      toast.success("تم تسجيل التحصيل: " + receipt.receiptNumber);
      onSuccess();
    } catch (cause) { setError(getApiErrorMessage(cause, "تعذّر تسجيل التحصيل.")); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
    <section ref={frame} role="dialog" aria-modal="true" aria-labelledby="account-collection-title" dir="rtl"
      className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border bg-card p-5 shadow-xl"
      onKeyDown={event => {
        if (event.key === "Escape" && !busy) onClose();
        if (event.key !== "Tab") return;
        const controls = Array.from(frame.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div><h2 id="account-collection-title" className="text-lg font-bold">تسجيل تحصيل</h2><p className="mt-1 text-sm text-muted-foreground">{customerName}</p></div>
        <Button variant="ghost" size="icon-sm" aria-label="إغلاق" disabled={busy} onClick={onClose}><X className="size-4"/></Button>
      </header>
      <form onSubmit={event => void submit(event)} className="space-y-4">
        <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6">هذه دفعة فعلية على حساب العميل. لا تضيفها هنا إذا سبق تسجيلها كعربون أو عند التسليم.</p>
        <label className="block space-y-1 text-sm font-semibold">المبلغ المستلم الآن
          <input ref={input} aria-label="المبلغ المستلم الآن" inputMode="decimal" dir="ltr" className={fieldClass}
            value={amount} onChange={event => setAmount(event.target.value)} disabled={busy} placeholder="0.00"/>
        </label>
        <AccountPaymentFields value={payment} onChange={setPayment} disabled={busy}/>
        <CollectionDateField label="تاريخ التحصيل" value={date} max={cairoToday()} onChange={setDate}/>
        <label className="block space-y-1 text-sm">ملاحظات (اختياري)
          <textarea className={fieldClass + " min-h-20 py-2"} value={note} disabled={busy} maxLength={4000} onChange={event => setNote(event.target.value)}/>
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <footer className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="submit" disabled={!valid || busy}>{busy ? "جاري التسجيل..." : <>تأكيد تحصيل {cents !== null && <MoneyAmount amount={centsToMoney(cents)}/>}</>}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
        </footer>
      </form>
    </section>
  </div>;
}
