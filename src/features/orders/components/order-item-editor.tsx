import { useState, type FormEvent } from "react";
import axios from "axios";
import { Calculator, ChevronDown, ChevronUp, LoaderCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { fieldClass } from "@/features/identity/components/identity-ui";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { previewPrintingServicePrice } from "@/features/printing-services/api/printing-services.api";
import { getOrderServiceOptions } from "../api/order-options.api";
import { SearchableSelect } from "./searchable-select";
import { useOrderActions } from "../hooks/use-orders";
import type { Order, OrderItem, OrderItemPayload } from "../types/orders.types";

type FormErrors = Record<string, string>;
const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;
export function OrderItemEditor({ order, item, canPricePreview, onClose }: {
  order: Order; item?: OrderItem; canPricePreview: boolean; onClose: () => void;
}) {
  const actions = useOrderActions();
  const [serviceId, setServiceId] = useState(String(item?.serviceId ?? ""));
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [agreedTotal, setAgreedTotal] = useState(item?.agreedTotal ?? "");
  const [specifications, setSpecifications] = useState(item?.specifications ?? "");
  const [showSpecifications, setShowSpecifications] = useState(!!item?.specifications);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState("");
  const services = useQuery({ queryKey: ["orders", "item-services"], queryFn: getOrderServiceOptions });
  const known = services.data ?? [];
  const options = item && !known.some((v) => v.value === item.serviceId) ?
    [{ value: item.serviceId, label: item.serviceName + " (الخدمة الحالية)" }, ...known] : known;
  const busy = actions.addItem.isPending || actions.editItem.isPending;

  function reset(key: string) {
    setErrors((old) => {const next = {...old};delete next[key];return next;});
    setGeneralError("");
  }
  async function suggested() {
    const qty = Number(quantity);
    if (!serviceId || !/^\d+$/.test(quantity) || !Number.isSafeInteger(qty) || qty < 1) {
      setGeneralError("اختر الخدمة وأدخل كمية صحيحة لحساب السعر.");return;
    }
    setPreviewBusy(true);setGeneralError("");setSuggestion(null);
    try {
      const result = await previewPrintingServicePrice({
        serviceId: Number(serviceId), quantity: qty,
        customerTypeId: order.customerTypeId,
      });
      if (result.requiresManualTotal || !result.suggestedTotal)
        setGeneralError("لا يوجد سعر مقترح، أدخل الإجمالي المتفق عليه يدويًا.");
      else setSuggestion(result.suggestedTotal);
    } catch (e: unknown) {setGeneralError(getApiErrorMessage(e, "تعذّر حساب السعر المقترح."));}
    finally {setPreviewBusy(false);}
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const issues: FormErrors = {};
    if (!serviceId) issues.serviceId = "اختر خدمة الطباعة.";
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(Number(quantity)) ||
        Number(quantity) < 1 || Number(quantity) > 1000000)
      issues.quantity = "الكمية من 1 إلى 1,000,000.";
    if (!moneyPattern.test(agreedTotal)) issues.agreedTotal = "أدخل الإجمالي المتفق عليه بصيغة مالية صحيحة.";
    setErrors(issues);
    if (Object.keys(issues).length) return;

    const payload: OrderItemPayload = {
      serviceId: Number(serviceId), quantity: Number(quantity), agreedTotal,
      specifications: specifications.trim() || null,
    };
    try {
      if (item) {
        const changes: Partial<OrderItemPayload> = {};
        if (payload.serviceId !== item.serviceId) changes.serviceId = payload.serviceId;
        if (payload.quantity !== item.quantity) changes.quantity = payload.quantity;
        if (Number(payload.agreedTotal) !== Number(item.agreedTotal)) changes.agreedTotal = payload.agreedTotal;
        if (payload.specifications !== item.specifications) changes.specifications = payload.specifications;
        if (Object.keys(changes).length)
          await actions.editItem.mutateAsync({ id: order.id, itemId: item.id, payload: changes });
      } else await actions.addItem.mutateAsync({ id: order.id, payload });
      toast.success(item ? "تم تعديل العنصر." : "تم إضافة العنصر.");
      onClose();
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const responseErrors = error.response.data?.errors ?? {};
        const mapped: FormErrors = {};
        for (const [key, messages] of Object.entries(responseErrors)) mapped[key] = messages[0];
        if (Object.keys(mapped).length) {setErrors(mapped);return;}
      }
      setGeneralError(getApiErrorMessage(error, "تعذّر حفظ العنصر."));
    }
  }
  const fieldError = (key: string) => errors[key] ?
    <p role="alert" className="mt-1 text-xs text-destructive">{errors[key]}</p> : null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-4">
    <section role="dialog" aria-modal="true" aria-label={item ? "تعديل عنصر" : "إضافة عنصر"}
      className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-5 shadow-xl sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{item ? "تعديل عنصر" : "إضافة عنصر"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">يمكن تعديل الخدمة والكمية والسعر في المسودة فقط.</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} disabled={busy} aria-label="إغلاق">
          <X className="size-4" />
        </Button>
      </div>
      <form onSubmit={(e) => void save(e)} noValidate className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold">خدمة الطباعة *</label>
          <SearchableSelect options={options} label="خدمة الطباعة للعنصر" placeholder="ابحث عن خدمة..."
            value={serviceId} loading={services.isPending} disabled={busy || services.isPending || services.isError}
            onChange={(v) => {setServiceId(v);setSuggestion(null);reset("serviceId");}} />
          {fieldError("serviceId")}
          {services.isError && <button type="button" className="mt-2 text-xs text-destructive underline"
            onClick={() => void services.refetch()}>تعذّر تحميل الخدمات — إعادة المحاولة</button>}
          {item && serviceId !== String(item.serviceId) &&
            <p className="mt-2 text-xs text-muted-foreground">تغيير الخدمة سينشئ عنصرًا بديلًا ويحافظ الباك على المرفقات المرتبطة به.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">الكمية *
            <input aria-label="كمية العنصر" aria-invalid={!!errors.quantity} type="number" min="1" max="1000000"
              className={fieldClass + " mt-2"} value={quantity} disabled={busy}
              onChange={(e) => {setQuantity(e.target.value);setSuggestion(null);reset("quantity");}} />
            {fieldError("quantity")}
          </label>
          <label className="block text-sm font-semibold">الإجمالي المتفق عليه (ج.م) *
            <input aria-label="إجمالي السعر" aria-invalid={!!errors.agreedTotal} className={fieldClass + " mt-2"}
              inputMode="decimal" dir="ltr" placeholder="أدخل الإجمالي" value={agreedTotal} disabled={busy}
              onChange={(e) => {setAgreedTotal(e.target.value);reset("agreedTotal");}} />
            {fieldError("agreedTotal")}
          </label>
        </div>
        {canPricePreview && <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={busy || previewBusy} onClick={() => void suggested()}>
            {previewBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            السعر المقترح
          </Button>
          {suggestion && <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span>الإجمالي المقترح: <strong>{suggestion} ج.م</strong></span>
            <Button type="button" variant="outline" size="sm" onClick={() => {setAgreedTotal(suggestion);reset("agreedTotal");}}>
              استخدام السعر
            </Button>
          </div>}
        </div>}
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSpecifications((v) => !v)}>
            {showSpecifications ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            المواصفات (اختياري)
          </Button>
          {showSpecifications && <textarea aria-label="مواصفات العنصر" className={fieldClass + " mt-2 min-h-24 py-3"}
            maxLength={20000} value={specifications} disabled={busy}
            onChange={(e) => setSpecifications(e.target.value)} />}
          {fieldError("specifications")}
        </div>
        {generalError && <p role="alert" className="text-sm text-destructive">{generalError}</p>}
        <footer className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy || services.isError || services.isPending}>
            {busy && <LoaderCircle className="size-4 animate-spin" />} حفظ
          </Button>
        </footer>
      </form>
    </section>
  </div>;
}
