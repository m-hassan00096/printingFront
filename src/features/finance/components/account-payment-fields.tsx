import { useQuery } from "@tanstack/react-query";
import { getOrderPaymentOptions } from "@/features/orders/api/order-options.api";
import { fieldClass } from "@/features/identity/components/identity-ui";

export type AccountPaymentValue = {method: 0 | 1 | 2; destination: string};
export function AccountPaymentFields({value, onChange, disabled = false}: {
  value: AccountPaymentValue; onChange: (value: AccountPaymentValue) => void; disabled?: boolean;
}) {
  const choices = useQuery({queryKey: ["collections", "destinations"], queryFn: getOrderPaymentOptions, enabled: value.method !== 0});
  const destinations = value.method === 1 ? choices.data?.banks ?? [] : choices.data?.wallets ?? [];
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="space-y-1 text-sm font-semibold">طريقة التحصيل
      <select aria-label="طريقة التحصيل" value={value.method} disabled={disabled} className={fieldClass}
        onChange={event => onChange({method: Number(event.target.value) as 0 | 1 | 2, destination: ""})}>
        <option value={0}>نقدي</option><option value={1}>تحويل بنكي</option><option value={2}>محفظة إلكترونية</option>
      </select>
    </label>
    {value.method !== 0 && <label className="space-y-1 text-sm font-semibold">حساب التحصيل
      <select aria-label="حساب التحصيل" value={value.destination} disabled={disabled || choices.isPending || choices.isError}
        className={fieldClass} onChange={event => onChange({...value, destination: event.target.value})}>
        <option value="">اختر الحساب</option>
        {destinations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {choices.isError && <button type="button" className="text-xs text-destructive underline" onClick={() => void choices.refetch()}>تعذّر تحميل الحسابات — إعادة المحاولة</button>}
      {choices.isSuccess && destinations.length === 0 && <span className="block text-xs text-destructive">لا يوجد حساب نشط لطريقة التحصيل المختارة.</span>}
    </label>}
  </div>;
}
