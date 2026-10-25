import { useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowRight, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { getCustomer } from "@/features/customers/api/customers.api";
import { previewPrintingServicePrice } from "@/features/printing-services/api/printing-services.api";
import { getOrderCreateOptions } from "../api/order-options.api";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { fieldClass, ErrorState } from "@/features/identity/components/identity-ui";
import { useOrderActions } from "../hooks/use-orders";
import type { CreateOrderPayload } from "../types/orders.types";

type ItemDraft = { key: number; serviceId: string; quantity: string; agreedTotal: string; specifications: string };
type Errors = Record<string, string>;
const blank = (key: number): ItemDraft => ({ key, serviceId: "", quantity: "1", agreedTotal: "", specifications: "" });
const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;
export function OrderCreatePage() {
  const navigate = useNavigate();
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const actions = useOrderActions();
  const next = useRef(1);
  const idempotency = useRef(crypto.randomUUID());
  const [customerSearch, setCustomerSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [source, setSource] = useState<"0" | "1">("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([blank(0)]);
  const [errors, setErrors] = useState<Errors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, string>>({});
  const [previewPending, setPreviewPending] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<Record<number, string>>({});
  const choices = useQuery({
    queryKey: ["orders", "create-selects"],
    queryFn: getOrderCreateOptions,
  });
  const selectedCustomer = choices.data?.customers.find((option) => String(option.value) === customerId);
  const customerDetails = useQuery({
    queryKey: ["orders", "selected-customer", customerId],
    queryFn: () => getCustomer(Number(customerId)),
    enabled: !!customerId && permissions.includes("customers.view"),
  });
  function changeItem(key: number, field: keyof Omit<ItemDraft, "key">, value: string) {
    setItems((old) => old.map((r) => r.key === key ? { ...r, [field]: value } : r));
    setErrors((old) => { const next = { ...old };delete next[`items.${key}.${field}`];return next; });
    setSuggestions((old) => { const next = { ...old };delete next[key];return next; });
    setPreviewError((old) => { const next = { ...old };delete next[key];return next; });
  }
  function addItem() { const key = next.current++;setItems((old) => [...old, blank(key)]); }
  function removeItem(key: number) {
    if (items.length < 2) return;
    setItems((old) => old.filter((i) => i.key !== key));
  }
  function validate(): Errors {
    const issues: Errors = {};
    if (!customerId) issues.customerId = "اختر عميلًا مسجلًا.";
    if (!items.length) issues.items = "يجب إضافة عنصر واحد على الأقل.";
    for (const i of items) {
      if (!i.serviceId) issues[`items.${i.key}.serviceId`] = "اختر خدمة الطباعة.";
      if (!/^\d+$/.test(i.quantity) || Number(i.quantity) < 1 || Number(i.quantity) > 1000000)
        issues[`items.${i.key}.quantity`] = "الكمية من 1 إلى 1,000,000.";
      if (!moneyPattern.test(i.agreedTotal)) issues[`items.${i.key}.agreedTotal`] = "الإجمالي المتفق عليه مطلوب بصيغة مالية صحيحة.";
    }
    return issues;
  }
  async function preview(key: number) {
    const row = items.find((x) => x.key === key);
    const quantity = Number(row?.quantity);
    if (customerId && !customerDetails.data) {
      setPreviewError((old) => ({ ...old, [key]: "معاينة السعر حسب نوع العميل تتطلب صلاحية عرض بيانات العميل. أدخل السعر يدويًا." }));
      return;
    }
    if (!row?.serviceId || !Number.isSafeInteger(quantity) || quantity < 1) {
      setPreviewError((old) => ({ ...old, [key]: "اختر الخدمة وأدخل كمية صحيحة أولًا." }));
      return;
    }
    setPreviewPending(key);
    setPreviewError((old) => ({ ...old, [key]: "" }));
    try {
      const result = await previewPrintingServicePrice({
        serviceId: Number(row.serviceId),
        customerTypeId: customerDetails.data?.customerTypeId ?? null,
        quantity,
      });
      if (result.requiresManualTotal || result.suggestedTotal === null) {
        setPreviewError((old) => ({ ...old, [key]: "لا يوجد سعر مقترح؛ أدخل إجمالي السعر المتفق عليه يدويًا." }));
      } else {
        setSuggestions((old) => ({ ...old, [key]: result.suggestedTotal! }));
      }
    } catch (e: unknown) { setPreviewError((old) => ({ ...old, [key]: getApiErrorMessage(e, "تعذّر معاينة السعر.") })); }
    finally { setPreviewPending(null); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actions.create.isPending) return;
    const issues = validate();
    setErrors(issues);
    if (Object.keys(issues).length) return;
    const payload: CreateOrderPayload = {
      customerId: Number(customerId), source: Number(source) as 0 | 1,
      status: 0, dueDate: dueDate || null, notes: notes.trim() || null,
      items: items.map((i) => ({
        serviceId: Number(i.serviceId), quantity: Number(i.quantity),
        specifications: i.specifications.trim() || null, agreedTotal: i.agreedTotal,
      })),
    };
    try {
      await actions.create.mutateAsync({ payload, key: idempotency.current });
      toast.success("تم حفظ مسودة الأوردر. افتحها من القائمة لاستكمال الملفات أو التأكيد.");
      navigate(permissions.includes("orders.list") ? "/orders" : "/");
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const server = error.response.data?.errors ?? {};
        const mapped: Errors = {};
        for (const [key, messages] of Object.entries(server)) {
          const match = /^items\.(\d+)\.(.+)$/.exec(key);
          if (match) {
            const row = items[Number(match[1])];
            if (row) mapped[`items.${row.key}.${match[2]}`] = messages[0];
          } else mapped[key] = messages[0];
        }
        if (Object.keys(mapped).length) { setErrors(mapped); return; }
      }
      setGeneralError(getApiErrorMessage(error, "تعذّر إنشاء مسودة الأوردر."));
    }
  }
  function message(key: string) {
    return errors[key] ? <p role="alert" className="mt-1 text-xs text-destructive">{errors[key]}</p> : null;
  }
  const canPick = permissions.includes("orders.create");
  return <div className="mx-auto max-w-6xl space-y-5">
    <Button variant="ghost" asChild><Link to="/orders"><ArrowRight /> العودة للأوردرات</Link></Button>
    <div><h1 className="text-2xl font-extrabold">إضافة أوردر</h1>
      <p className="text-sm text-muted-foreground">سيُحفظ كمسودة، ثم يمكن رفع الملفات وتأكيده. السعر المتفق عليه هو المعتمد.</p></div>
    {!canPick && <div role="alert" className="rounded-xl border p-4 text-sm text-destructive">
      ليس لديك صلاحية إنشاء الأوردر.
    </div>}
    <form noValidate onSubmit={(e) => void save(e)} className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-bold">بيانات الأوردر</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><label htmlFor="order-customer-search" className="text-sm font-semibold">العميل المسجل *</label>
            <input id="order-customer-search" className={fieldClass} value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)} placeholder="ابحث عن اسم العميل أو هاتفه" />
            <select aria-label="اختيار العميل" className={fieldClass} value={customerId}
              disabled={!canPick || choices.isPending || choices.isError}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setSuggestions({});
                setErrors((prev) => ({ ...prev, customerId: "" }));
              }}>
              <option value="">اختر العميل</option>
              {choices.data?.customers.filter((c) => c.label.includes(customerSearch.trim())).map((c) =>
                <option key={c.value} value={c.value}>{c.label}</option>)}
              {selectedCustomer && !selectedCustomer.label.includes(customerSearch.trim()) &&
                <option value={selectedCustomer.value}>{selectedCustomer.label}</option>}
            </select>
            {message("customerId")}
            {choices.isError && <p role="alert" className="text-xs text-destructive">تعذّر تحميل قائمة العملاء والخدمات.</p>}
          </div>
          <label className="text-sm font-semibold">مصدر الأوردر
            <select aria-label="مصدر الأوردر" className={fieldClass + " mt-2"} value={source} onChange={(e) => setSource(e.target.value as "0" | "1")}>
              <option value="0">الفرع</option><option value="1">أونلاين</option>
            </select>
          </label>
          <label className="text-sm font-semibold">تاريخ التسليم (اختياري)
            <input aria-label="تاريخ التسليم" type="date" className={fieldClass + " mt-2"} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {message("dueDate")}
          </label>
          <label className="text-sm font-semibold">ملاحظات
            <textarea aria-label="ملاحظات" className={fieldClass + " mt-2 min-h-20 py-3"} value={notes} maxLength={10000} onChange={(e) => setNotes(e.target.value)} />
            {message("notes")}
          </label>
        </div>
      </section>
      <section className="rounded-2xl border bg-card shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b p-4"><div>
          <h2 className="font-bold">عناصر الأوردر</h2><p className="mt-1 text-xs text-muted-foreground">تقدر تضيف نفس الخدمة بأكثر من مواصفات.</p>
        </div><Button variant="outline" type="button" onClick={addItem}><Plus /> إضافة عنصر</Button></header>
        <div className="space-y-3 p-4">
          <label className="block max-w-sm text-xs font-semibold">البحث عن خدمة
            <input aria-label="البحث عن خدمة" className={fieldClass + " mt-2"} value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)} placeholder="اسم خدمة الطباعة" />
          </label>
          {choices.isError && <ErrorState error={choices.error} retry={() => void choices.refetch()} />}
          {items.map((item, index) => <fieldset className="rounded-xl border p-4" key={item.key}>
            <legend className="px-2 text-sm font-bold">العنصر {index + 1}</legend>
            <div className="flex justify-end"><Button type="button" variant="ghost" size="icon-sm" disabled={items.length === 1}
              aria-label={`حذف العنصر ${index + 1}`} onClick={() => removeItem(item.key)}><Trash2 className="size-4 text-destructive" /></Button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold">خدمة الطباعة *</label>
                <select aria-label={`خدمة العنصر ${index + 1}`} className={fieldClass}
                  value={item.serviceId} disabled={!canPick || choices.isPending || choices.isError}
                  onChange={(e) => changeItem(item.key, "serviceId", e.target.value)}>
                  <option value="">اختر الخدمة</option>
                  {choices.data?.services.filter((svc) => svc.label.includes(serviceSearch.trim())).map((svc) =>
                    <option key={svc.value} value={svc.value}>{svc.label}</option>)}
                  {item.serviceId && !choices.data?.services.some((svc) =>
                    String(svc.value) === item.serviceId && svc.label.includes(serviceSearch.trim())) && (() => {
                      const chosen = choices.data?.services.find((svc) => String(svc.value) === item.serviceId);
                      return chosen ? <option value={chosen.value}>{chosen.label}</option> : null;
                    })()}
                </select>
                {message(`items.${item.key}.serviceId`)}
              </div>
              <label className="text-xs font-semibold">الكمية *
                <input aria-label={`كمية العنصر ${index + 1}`} type="number" min="1" max="1000000"
                  className={fieldClass + " mt-2"} value={item.quantity} onChange={(e) => changeItem(item.key, "quantity", e.target.value)} />
                {message(`items.${item.key}.quantity`)}
              </label>
              <label className="text-xs font-semibold">الإجمالي المتفق عليه (ج.م) *
                <input aria-label={`إجمالي العنصر ${index + 1}`} dir="ltr" inputMode="decimal"
                  className={fieldClass + " mt-2"} value={item.agreedTotal}
                  onChange={(e) => changeItem(item.key, "agreedTotal", e.target.value)} placeholder="350.00" />
                {message(`items.${item.key}.agreedTotal`)}
              </label>
              <label className="text-xs font-semibold md:col-span-2">المواصفات (اختياري)
                <textarea aria-label={`مواصفات العنصر ${index + 1}`} className={fieldClass + " mt-2 min-h-20 py-3"}
                  value={item.specifications} maxLength={20000} onChange={(e) => changeItem(item.key, "specifications", e.target.value)} />
              </label>
            </div>
            {permissions.includes("printing_services.price_preview.view") && <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={previewPending !== null}
                onClick={() => void preview(item.key)}>{previewPending === item.key ? "جاري الحساب..." : "السعر المقترح"}</Button>
              {suggestions[item.key] && <span className="text-xs">الإجمالي المقترح: <b>{suggestions[item.key]} ج.م</b>
                <button type="button" className="ms-2 font-bold text-primary underline" onClick={() => changeItem(item.key, "agreedTotal", suggestions[item.key])}>اعتماد السعر</button></span>}
              {previewError[item.key] && <span role="alert" className="text-xs text-destructive">{previewError[item.key]}</span>}
            </div>}
          </fieldset>)}
          {message("items")}
          <p className="text-xs text-muted-foreground">التسعير المقترح اختياري، ويتم إرسال الإجمالي المتفق عليه إلى الباك. رفع الملفات متاح بعد حفظ المسودة.</p>
        </div>
      </section>
      {generalError && <p role="alert" className="rounded-xl border bg-red-50 p-4 text-sm text-destructive">{generalError}</p>}
      <footer className="flex justify-end gap-3 pb-4">
        <Button asChild variant="outline"><Link to="/orders">إلغاء</Link></Button>
        <Button disabled={!canPick || actions.create.isPending || choices.isPending || choices.isError} type="submit">
          {actions.create.isPending && <LoaderCircle className="size-4 animate-spin" />} حفظ مسودة الأوردر
        </Button>
      </footer>
    </form>

  </div>;
}
