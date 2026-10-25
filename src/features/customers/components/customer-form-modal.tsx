import { useState, type FormEvent } from "react";
import axios from "axios";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { fieldClass, fieldLabel } from "@/features/identity/components/identity-ui";
import { useCustomerMutations, useCustomerTypes } from "../hooks/use-customers";
import type { Customer, CustomerPayload } from "../types/customers.types";

type FormKey = keyof CustomerPayload;
type Draft = { name: string; phone: string; address: string; customerTypeId: string; status: "0" | "1" };
type Errors = Partial<Record<FormKey, string>>;

function validate(form: Draft): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "اسم العميل مطلوب.";
  else if (form.name.trim().length > 150) errors.name = "اسم العميل يجب ألا يتجاوز 150 حرفًا.";
  if (!form.phone.trim()) errors.phone = "رقم الهاتف مطلوب.";
  else if (form.phone.trim().length > 100) errors.phone = "رقم الهاتف يجب ألا يتجاوز 100 حرف.";
  if (form.address.length > 1000) errors.address = "العنوان يجب ألا يتجاوز 1000 حرف.";
  if (!form.customerTypeId) errors.customerTypeId = "اختر نوع العميل.";
  return errors;
}

export function CustomerFormModal({ customer, onClose, onSaved }: {
  customer?: Customer;
  onClose: () => void;
  onSaved?: (customerId: number) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: customer?.name ?? "", phone: customer?.phone ?? "",
    address: customer?.address ?? "", customerTypeId: customer ? String(customer.customerTypeId) : "",
    status: customer?.status === 0 ? "0" : "1",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const types = useCustomerTypes(true);
  const mutations = useCustomerMutations();
  const busy = mutations.create.isPending || mutations.update.isPending;

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: undefined }));
    setGeneralError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validate(draft);
    setErrors(validation);
    if (Object.keys(validation).length) { setGeneralError(null); return; }
    const payload: CustomerPayload = {
      name: draft.name.trim(), phone: draft.phone.trim(),
      address: draft.address.trim() || null,
      customerTypeId: Number(draft.customerTypeId), status: Number(draft.status) as 0 | 1,
    };
    setGeneralError(null);
    try {
      if (customer) {
        // The backend accepts PATCH. Avoid re-validating an unchanged legacy
        // customerTypeId that may no longer be active or assignable.
        const changed: Partial<CustomerPayload> = {};
        for (const field of Object.keys(payload) as (keyof CustomerPayload)[]) {
          if (payload[field] !== customer[field]) {
            // Assignment through a common key is safe after narrowing by actual payload values.
            Object.assign(changed, { [field]: payload[field] });
          }
        }
        if (Object.keys(changed).length) {
          await mutations.update.mutateAsync({ id: customer.id, payload: changed });
          toast.success("تم تعديل العميل بنجاح.");
          onSaved?.(customer.id);
        }
      } else {
        const created = await mutations.create.mutateAsync(payload);
        toast.success("تم إضافة العميل بنجاح.");
        onSaved?.(created.id);
      }
      onClose();
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const server = error.response.data?.errors ?? {};
        const updated: Errors = {};
        const other: string[] = [];
        for (const [key, messages] of Object.entries(server)) {
          if (["name", "phone", "address", "customerTypeId", "status"].includes(key)) {
            updated[key as FormKey] = messages[0];
          } else other.push(...messages);
        }
        if (Object.keys(updated).length || other.length) {
          setErrors(updated);
          setGeneralError(other.length ? other.join(" ") : null);
          return;
        }
      }
      setGeneralError(getApiErrorMessage(error, "تعذّر حفظ بيانات العميل."));
    }
  }

  function fieldError(key: FormKey) {
    return errors[key] ? <span role="alert" className="mt-1 block text-xs text-destructive">{errors[key]}</span> : null;
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={customer ? "تعديل عميل" : "إضافة عميل"}
      onKeyDown={(event) => { if (event.key === "Escape" && !busy) onClose(); }}
      className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><h3 className="text-xl font-extrabold">{customer ? "تعديل عميل" : "إضافة عميل"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">الحقول المميزة بالنجمة مطلوبة.</p></div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="إغلاق" disabled={busy} onClick={onClose}><X /></Button>
      </div>
      <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2"><span className={fieldLabel}>اسم العميل *</span>
            <input autoFocus aria-label="اسم العميل" aria-invalid={!!errors.name} className={fieldClass} maxLength={150}
              value={draft.name} disabled={busy} onChange={(e) => change("name", e.target.value)} />
            {fieldError("name")}
          </label>
          <label className="block space-y-2"><span className={fieldLabel}>رقم الهاتف *</span>
            <input aria-label="رقم الهاتف" aria-invalid={!!errors.phone} dir="ltr" inputMode="tel"
              className={fieldClass} maxLength={100} value={draft.phone} disabled={busy}
              onChange={(e) => change("phone", e.target.value)} />
            {fieldError("phone")}
          </label>
          <label className="block space-y-2"><span className={fieldLabel}>نوع العميل *</span>
            <select aria-label="نوع العميل" aria-invalid={!!errors.customerTypeId}
              className={fieldClass} value={draft.customerTypeId} disabled={busy || types.isPending || types.isError}
              onChange={(e) => change("customerTypeId", e.target.value)}>
              <option value="">اختر نوع العميل</option>
              {customer?.customerType && !types.data?.some((item) => item.value === customer.customerTypeId) &&
                <option value={customer.customerTypeId}>{customer.customerType.name} (النوع الحالي)</option>}
              {types.data?.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            {fieldError("customerTypeId")}
            {types.isPending && <span role="status" className="text-xs text-muted-foreground">جاري تحميل أنواع العملاء...</span>}
            {types.isError && <span role="alert" className="text-xs text-destructive">
              تعذّر تحميل أنواع العملاء. <button type="button" className="underline" onClick={() => void types.refetch()}>إعادة المحاولة</button>
            </span>}
          </label>
          <label className="block space-y-2"><span className={fieldLabel}>الحالة *</span>
            <select aria-label="الحالة" aria-invalid={!!errors.status} className={fieldClass} value={draft.status}
              disabled={busy} onChange={(e) => change("status", e.target.value as "0" | "1")}>
              <option value="1">نشط</option><option value="0">غير نشط</option>
            </select>{fieldError("status")}
          </label>
          <label className="block space-y-2 sm:col-span-2"><span className={fieldLabel}>العنوان (اختياري)</span>
            <textarea aria-label="العنوان" aria-invalid={!!errors.address} className={fieldClass + " min-h-24 py-3"}
              maxLength={1000} value={draft.address} disabled={busy} onChange={(e) => change("address", e.target.value)} />
            {fieldError("address")}
          </label>
        </div>
        {generalError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{generalError}</p>}
        <div className="flex justify-end gap-3 border-t pt-5">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy || types.isError || types.isPending || (!types.data?.length && !customer?.customerType)}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}{customer ? "حفظ التعديلات" : "إضافة العميل"}
          </Button>
        </div>
      </form>
    </section>
  </div>;
}
