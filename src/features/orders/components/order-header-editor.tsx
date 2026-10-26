import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { CustomerFormModal } from "@/features/customers/components/customer-form-modal";
import { getApiErrorMessage } from "@/shared/api/http";
import { fieldClass } from "@/features/identity/components/identity-ui";
import { getActiveOrderCustomers } from "../api/order-options.api";
import { SearchableSelect } from "./searchable-select";
import { useOrderActions, orderKeys } from "../hooks/use-orders";
import type { Order } from "../types/orders.types";

export function OrderHeaderEditor({ order, canCreateCustomer, onClose }: {
  order: Order; canCreateCustomer: boolean; onClose: () => void;
}) {
  const actions = useOrderActions();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState(String(order.customerId));
  const [newCustomer, setNewCustomer] = useState<{value:number;label:string} | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [dueDate, setDueDate] = useState(order.dueDate ?? "");
  const [source, setSource] = useState<"0" | "1">(String(order.source) as "0" | "1");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [error, setError] = useState("");
  const customers = useQuery({queryKey:["orders","active-customer-options"],queryFn:getActiveOrderCustomers});
  const current = {value:order.customerId,label:order.customerName+" — "+order.customerPhone};
  const options = [...(customers.data ?? [])];
  if (!options.some((option) => option.value === current.value)) options.unshift(current);
  if (newCustomer && !options.some((option) => option.value === newCustomer.value)) options.unshift(newCustomer);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actions.update.isPending) return;
    const payload: Parameters<typeof actions.update.mutateAsync>[0]["payload"] = {};
    if (Number(customerId) !== order.customerId) payload.customerId = Number(customerId);
    if (dueDate !== (order.dueDate ?? "")) payload.dueDate = dueDate || null;
    if (Number(source) !== order.source) payload.source = Number(source) as 0 | 1;
    if ((notes.trim() || null) !== order.notes) payload.notes = notes.trim() || null;
    if (!Object.keys(payload).length) {onClose(); return;}
    try {
      await actions.update.mutateAsync({id:order.id,payload});
      toast.success("تم تعديل بيانات المسودة.");
      onClose();
    } catch (e:unknown) {setError(getApiErrorMessage(e,"تعذّر تحديث المسودة."));}
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <section role="dialog" aria-modal="true" aria-label="تعديل بيانات المسودة"
      className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 shadow-xl sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">تعديل بيانات المسودة</h2>
        <Button size="icon-sm" variant="ghost" type="button" aria-label="إغلاق"
          onClick={onClose}><X className="size-4" /></Button>
      </div>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold">العميل *</label>
          <SearchableSelect label="اختيار عميل المسودة" placeholder="ابحث بالاسم أو الهاتف"
            value={customerId} options={options} loading={customers.isPending}
            disabled={actions.update.isPending || customers.isError}
            onChange={(id) => {setCustomerId(id);setError("");}}
            onCreate={canCreateCustomer ? () => setCustomerModal(true) : undefined}
            createLabel="إضافة عميل جديد" />
          {customers.isError && <button type="button" onClick={() => void customers.refetch()}
            className="mt-2 text-xs text-destructive underline">تعذّر تحميل العملاء — إعادة المحاولة</button>}
          {customerId !== String(order.customerId) && <p className="mt-2 text-xs text-muted-foreground">
            تغيير العميل في المسودة سيحدّث نوع العميل المرتبط بعناصرها. بعد تأكيد الأوردر لن يمكن تغيير العميل.
          </p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">المصدر
            <select aria-label="مصدر المسودة" className={fieldClass + " mt-2"} value={source}
              onChange={(e) => setSource(e.target.value as "0" | "1")}>
              <option value="0">الفرع</option><option value="1">أونلاين</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">موعد التسليم
            <input aria-label="موعد تسليم المسودة" type="date" className={fieldClass + " mt-2"}
              value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-semibold">الملاحظات
          <textarea aria-label="ملاحظات المسودة" className={fieldClass + " mt-2 min-h-20 py-3"}
            maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" type="button" disabled={actions.update.isPending} onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={actions.update.isPending || customers.isError || !customerId}>حفظ التعديلات</Button>
        </div>
      </form>
      {customerModal && <CustomerFormModal onClose={() => setCustomerModal(false)}
        onSaved={(id, created) => {
          if (created) setNewCustomer({value:id,label:created.name+" — "+created.phone});
          setCustomerId(String(id));
          void qc.invalidateQueries({queryKey:["orders","active-customer-options"]});
          void qc.invalidateQueries({queryKey:orderKeys.list});
        }} />}
    </section>
  </div>;
}
