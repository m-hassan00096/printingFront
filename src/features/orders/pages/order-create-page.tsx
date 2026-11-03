import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowRight, Calculator, ChevronDown, ChevronUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { uiMessages } from "@/shared/translations/ar/ui";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { CustomerFormModal } from "@/features/customers/components/customer-form-modal";
import { getCustomer, getCustomerBalance } from "@/features/customers/api/customers.api";
import type { Customer } from "@/features/customers/types/customers.types";
import { previewPrintingServicePrice } from "@/features/printing-services/api/printing-services.api";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { fieldClass } from "@/features/identity/components/identity-ui";
import { getOrderCreateOptions, getOrderPaymentOptions } from "../api/order-options.api";
import { SearchableSelect } from "../components/searchable-select";
import { CreatedDatePicker } from "../components/created-date-picker";
import { cairoTodayISO } from "@/features/orders/lib/cairo-today";
import { useOrderActions } from "../hooks/use-orders";
import type { CreateOrderPayload } from "../types/orders.types";
import "./order-create-page.css";

type ItemDraft = {
  key: number; serviceId: string; quantity: string; agreedTotal: string; widthCm: string; heightCm: string;
  specifications: string; expanded: boolean;
};
type Errors = Record<string, string>;
type Mode = "draft" | "confirm";
const blank = (key: number): ItemDraft => ({
  key, serviceId: "", quantity: "1", agreedTotal: "", widthCm: "", heightCm: "", specifications: "", expanded: false,
});
const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;
function cents(value: string): number | null {
  if (!moneyPattern.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}
export function OrderCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const canConfirm = permissions.includes("orders.confirm");
  const canAddCustomer = permissions.includes("customers.create");
  const canEditCustomer = permissions.includes("customers.update") && permissions.includes("customers.view");
  const actions = useOrderActions();
  const nextKey = useRef(1);
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  const previewEpoch = useRef(0);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState<Customer | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(false);
  const [source, setSource] = useState<"0" | "1">("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([blank(0)]);
  const [errors, setErrors] = useState<Errors>({});
  const [focusRequest, setFocusRequest] = useState<{key:string} | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, string>>({});
  const [previewPending, setPreviewPending] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<Record<number, string>>({});
  const [confirmPriceKey, setConfirmPriceKey] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"0" | "1" | "2">("0");
  const [destinationOverride, setDestinationOverride] = useState<string | null>(null);
  const [overpaymentAccepted, setOverpaymentAccepted] = useState(false);

  const choices = useQuery({ queryKey: ["orders", "create-selects"], queryFn: getOrderCreateOptions });
  const customers = choices.data?.customers ?? [];
  const services = choices.data?.services ?? [];
  const mergedCustomers = newCustomer && !customers.some((c) => c.value === newCustomer.id)
    ? [{ value: newCustomer.id, label: newCustomer.name + " - " + newCustomer.phone }, ...customers]
    : customers;

  const customerDetails = useQuery({
    queryKey: ["orders", "selected-customer", customerId],
    queryFn: () => getCustomer(Number(customerId)),
    enabled: !!customerId && permissions.includes("customers.view") && newCustomer?.id !== Number(customerId),
  });
  const selectedCustomer = newCustomer?.id === Number(customerId) ? newCustomer : customerDetails.data;
  const balance = useQuery({
    queryKey: ["orders", "prior-balance", customerId],
    queryFn: () => getCustomerBalance(Number(customerId)),
    enabled: !!customerId && permissions.includes("finance.balances.view"),
  });
  const paymentOptions = useQuery({
    queryKey: ["orders", "payment-destinations"],
    queryFn: getOrderPaymentOptions,
    enabled: canConfirm && Number(depositAmount) > 0 && paymentMethod !== "0",
  });
  const accounts = paymentMethod === "1" ? paymentOptions.data?.banks ?? [] : paymentOptions.data?.wallets ?? [];
  const defaultAccount = accounts.find((account) => Number(account.isDefault) === 1) ?? accounts[0];
  const selectedDestination = destinationOverride ?? (defaultAccount ? String(defaultAccount.value) : "");

  const validTotals = items.map((item) => cents(item.agreedTotal));
  const allPriced = validTotals.every((total) => total !== null);
  const orderCents = validTotals.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const paidCents = cents(depositAmount);
  const remainingCents = paidCents === null ? null : Math.max(0, orderCents - paidCents);
  const overpaymentCents = paidCents === null ? 0 : Math.max(0, paidCents - orderCents);
  const busy = actions.create.isPending;

  useEffect(() => {
    if (!focusRequest) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-order-field]"))
      .find(node => node.dataset.orderField === focusRequest.key);
    if (!target) return;
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
    target.querySelector<HTMLElement>(
      'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)'
    )?.focus({ preventScroll: true });
  }, [focusRequest]);

  function clear(key: string) {
    setErrors((old) => { const updated = { ...old }; delete updated[key]; return updated; });
    setGeneralError(null);
  }
  function resetSuggestions() {
    previewEpoch.current += 1;
    setSuggestions({});
    setPreviewError({});
    setConfirmPriceKey(null);
  }
  function setCustomer(id: string) {
    setCustomerId(id);
    setNewCustomer((old) => old?.id === Number(id) ? old : null);
    clear("customerId");
    resetSuggestions();
  }
  function changeItem(key: number, field: keyof Omit<ItemDraft, "key" | "expanded">, value: string) {
    setItems((old) => old.map((item) => item.key === key ? { ...item, [field]: value } : item));
    clear("items." + key + "." + field);
    if (field === "serviceId" || field === "quantity" || field === "widthCm" || field === "heightCm") {
      setConfirmPriceKey(null);
      previewEpoch.current += 1;
      setSuggestions((old) => {const updated = { ...old };delete updated[key];return updated;});
      setPreviewError((old) => {const updated = { ...old };delete updated[key];return updated;});
    }
  }
  function addItem() {
    if (items.length >= 100) {toast.error("الحد الأقصى 100 عنصر للأوردر.");return;}
    const key = nextKey.current++;
    setItems((old) => [...old, blank(key)]);
  }
  function removeItem(key: number) {
    if (items.length <= 1) return;
    previewEpoch.current += 1;
    setItems((old) => old.filter((item) => item.key !== key));
    setSuggestions((old) => {const updated = { ...old };delete updated[key];return updated;});
  }
  async function preview(key: number) {
    const row = items.find((item) => item.key === key);
    const quantity = Number(row?.quantity);
    const method = services.find((service) => service.value === Number(row?.serviceId))?.pricingMethod ?? "quantity";
    if (!row?.serviceId || !/^\d+$/.test(row.quantity) || !Number.isSafeInteger(quantity) || quantity < 1) {
      setPreviewError((old) => ({ ...old, [key]: "اختر الخدمة وأدخل كمية صحيحة أولًا." })); return;
    }
    if (customerId && !selectedCustomer) {
      setPreviewError((old) => ({ ...old, [key]: "لا يمكن تحديد نوع العميل الآن. أدخل السعر يدويًا أو تحقق من صلاحية عرض بيانات العميل." }));
      return;
    }
    const version = ++previewEpoch.current;
    setPreviewPending(key);
    setPreviewError((old) => ({ ...old, [key]: "" }));
    try {
      const result = await previewPrintingServicePrice({
        serviceId: Number(row.serviceId),
        customerTypeId: selectedCustomer?.customerTypeId ?? null,
        quantity,
        ...(method !== "quantity" ? {widthCm: row.widthCm, heightCm: row.heightCm} : {}),
      });
      if (version !== previewEpoch.current) return;
      if (result.requiresManualTotal || result.suggestedTotal === null)
        setPreviewError((old) => ({ ...old, [key]: "لا يوجد سعر مقترح؛ اكتب الإجمالي المتفق عليه يدويًا." }));
      else setSuggestions((old) => ({ ...old, [key]: result.suggestedTotal! }));
    } catch (error: unknown) {
      if (version === previewEpoch.current)
        setPreviewError((old) => ({ ...old, [key]: getApiErrorMessage(error, "تعذّر حساب السعر المقترح.") }));
    } finally { setPreviewPending((old) => old === key ? null : old); }
  }

  function applySuggestion(row: ItemDraft) {
    const proposed = suggestions[row.key];
    if (proposed === undefined) return;
    if (cents(row.agreedTotal) !== null && cents(row.agreedTotal) !== cents(proposed) && confirmPriceKey !== row.key) {
      setConfirmPriceKey(row.key);return;
    }
    changeItem(row.key, "agreedTotal", proposed);
    setConfirmPriceKey(null);
  }
  function agreedUnit(row: ItemDraft) {
    const total = cents(row.agreedTotal), qty = Number(row.quantity);
    return total !== null && Number.isSafeInteger(qty) && qty > 0 ? (total / (qty * 100)).toFixed(2) : null;
  }
  function validate(mode: Mode): Errors {
    const issues: Errors = {};
    if (!customerId) issues.customerId = "اختر عميلًا مسجلًا.";
    for (const item of items) {
      if (!item.serviceId) issues["items." + item.key + ".serviceId"] = "اختر خدمة الطباعة.";
      const method = services.find((service) => service.value === Number(item.serviceId))?.pricingMethod ?? "quantity";
      if (method !== "quantity") {
        if (!/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,4})?$/.test(item.widthCm) || Number(item.widthCm) <= 0) issues["items." + item.key + ".widthCm"] = "العرض مطلوب بالسنتيمتر وأكبر من صفر.";
        if (!/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,4})?$/.test(item.heightCm) || Number(item.heightCm) <= 0) issues["items." + item.key + ".heightCm"] = "الطول مطلوب بالسنتيمتر وأكبر من صفر.";
      }
      if (!/^\d+$/.test(item.quantity) || !Number.isSafeInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1 || Number(item.quantity) > 1_000_000)
        issues["items." + item.key + ".quantity"] = "الكمية من 1 إلى 1,000,000.";
      if (cents(item.agreedTotal) === null) issues["items." + item.key + ".agreedTotal"] = "أدخل الإجمالي المتفق عليه بصيغة صحيحة.";
    }
    if (canConfirm) {
      if (mode === "confirm" && !canConfirm) issues.status = "ليس لديك صلاحية تأكيد الأوردر.";
      if (paidCents === null) issues.depositAmount = "أدخل مبلغًا صحيحًا.";
      if (paidCents !== null && paidCents > 0 && paymentMethod !== "0" && !selectedDestination)
        issues.paymentDestinationId = "اختر حساب بنك أو محفظة صالحة.";
      if (mode === "confirm" && overpaymentCents > 0 && !overpaymentAccepted)
        issues.overpayment = "يجب تأكيد تحويل المبلغ الزائد إلى رصيد دائن للعميل.";
    }
    return issues;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const mode: Mode = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "confirm" ? "confirm" : "draft";
    const issues = validate(mode);
    setErrors(issues);
    if (Object.keys(issues).length) {
      setFocusRequest({key:Object.keys(issues)[0]});
      return;
    }
    const payload: CreateOrderPayload = {
      customerId: Number(customerId), source: Number(source) as 0 | 1, status: mode === "confirm" ? 1 : 0,
      dueDate: dueDate || null, notes: notes.trim() || null,
      items: items.map((item) => ({
        serviceId: Number(item.serviceId), quantity: Number(item.quantity),
        specifications: item.specifications.trim() || null, agreedTotal: item.agreedTotal,
        ...(services.find((service) => service.value === Number(item.serviceId))?.pricingMethod !== "quantity" ? {widthCm: item.widthCm, heightCm: item.heightCm} : {}),
      })),
    };
    if (mode === "draft" && canConfirm) {
      payload.plannedDepositAmount = depositAmount;
      payload.plannedPaymentMethod = paidCents !== null && paidCents > 0 ? Number(paymentMethod) as 0 | 1 | 2 : null;
      payload.plannedPaymentDestinationId = paidCents !== null && paidCents > 0 && paymentMethod !== "0"
        ? Number(selectedDestination) : null;
    }
    if (mode === "confirm" && paidCents !== null && paidCents > 0) {
      payload.depositAmount = depositAmount;
      payload.paymentMethod = Number(paymentMethod) as 0 | 1 | 2;
      if (paymentMethod !== "0") payload.paymentDestinationId = Number(selectedDestination);
    }
    // Use the same key for retrying the same request, but not for a changed payload.
    const fingerprint = JSON.stringify(payload);
    if (submission.current?.fingerprint !== fingerprint)
      submission.current = { fingerprint, key: crypto.randomUUID() };
    try {
      await actions.create.mutateAsync({ payload, key: submission.current.key });
      toast.success(mode === "confirm"
        ? "تم إنشاء وتأكيد الأوردر بنجاح."
        : "تم حفظ المسودة. يمكنك رفع الملفات من تفاصيل الأوردر ثم تأكيده.");
      navigate(permissions.includes("orders.list") ? "/orders" : "/");
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const server = error.response.data?.errors ?? {};
        const mapped: Errors = {};
        for (const [key, messages] of Object.entries(server)) {
          const match = /^items\.(\d+)\.(.+)$/.exec(key);
          if (match) {
            const row = items[Number(match[1])];
            if (row) mapped["items." + row.key + "." + match[2]] = messages[0];
          } else mapped[key === "plannedDepositAmount" ? "depositAmount" :
            key === "plannedPaymentDestinationId" ? "paymentDestinationId" : key] = messages[0];
        }
        if (Object.keys(mapped).length) {
          setErrors(mapped);
          setFocusRequest({key:Object.keys(mapped)[0]});
          return;
        }
      }
      setGeneralError(getApiErrorMessage(error, mode === "confirm" ? "تعذّر تأكيد الأوردر." : "تعذّر حفظ المسودة."));
    }
  }
  function message(key: string) {
    return errors[key] ? <p role="alert" className="mt-1 text-xs text-destructive">{errors[key]}</p> : null;
  }

  return <div className="order-create-workspace mx-auto max-w-[1480px] space-y-4 pb-8">
    <header className="space-y-1">
      <Button variant="ghost" asChild size="sm" className="h-8 px-0 text-xs">
        <Link to="/orders"><ArrowRight className="size-4" /> الأوردرات</Link>
      </Button>
      <h1 className="text-2xl font-bold leading-tight text-[#252a40]">إنشاء أوردر جديد</h1>
    </header>
    {choices.isError && <div role="alert" className="rounded-xl border p-3 text-sm text-destructive">
      تعذّر تحميل العملاء أو خدمات الطباعة. <button type="button" className="underline" onClick={() => void choices.refetch()}>إعادة المحاولة</button>
    </div>}
    <form onSubmit={(event) => void submit(event)} noValidate className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
      <div className="min-w-0 space-y-4">
      <section className="rounded-2xl border border-[#e5e8f1] bg-white p-4 shadow-[0_3px_14px_#25335708] sm:p-5">
        <h2 className="mb-4 border-b border-[#e9ebf2] pb-3 text-base font-bold">بيانات الأوردر</h2>
        <div className="grid items-start gap-x-4 gap-y-4 md:grid-cols-2">
          <div className="scroll-mt-24 space-y-2" data-order-field="customerId">
            <label className="text-sm font-semibold">العميل المسجل *</label>
            <SearchableSelect label="اختيار العميل" placeholder="ابحث بالاسم أو رقم الهاتف..."
              options={mergedCustomers} value={customerId} onChange={setCustomer} loading={choices.isPending}
              invalid={!!errors.customerId}
              disabled={busy || choices.isPending || choices.isError}
              onCreate={canAddCustomer ? () => setCustomerModal(true) : undefined} createLabel="إضافة عميل جديد" />
            {message("customerId")}
            {selectedCustomer && <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">نوع العميل: {selectedCustomer.customerType?.name ?? uiMessages.customers.unclassified}</p>
              {canEditCustomer && <Button type="button" variant="ghost" size="sm" disabled={busy}
                onClick={() => setEditCustomer(true)}>تعديل بيانات العميل</Button>}
            </div>}
          </div>
          <label className="text-sm font-semibold">مصدر الأوردر
            <select aria-label="مصدر الأوردر" className={fieldClass + " mt-2"} value={source} disabled={busy}
              onChange={(e) => setSource(e.target.value as "0" | "1")}>
              <option value="0">الفرع</option><option value="1">أونلاين</option>
            </select>
          </label>
          <div className="scroll-mt-24" data-order-field="dueDate">
            <CreatedDatePicker label="تاريخ التسليم (اختياري)" value={dueDate} min={cairoTodayISO()} disabled={busy}
              onChange={(next) => {setDueDate(next);clear("dueDate");}} />
            {message("dueDate")}
          </div>
          <div className="flex items-end"><Button type="button" variant="ghost" size="sm" className="px-0 text-[#6555ba]" onClick={() => setShowNotes(!showNotes)}>
            {showNotes ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} ملاحظات الأوردر (اختياري)
          </Button></div>
          {showNotes && <label className="block text-sm font-semibold md:col-span-2">
            <textarea aria-label="ملاحظات" className={fieldClass + " mt-2 min-h-20 py-3"}
              maxLength={10000} disabled={busy} value={notes} onChange={(e) => setNotes(e.target.value)} />
            {message("notes")}
          </label>}
        </div>
      </section>

      <section className="overflow-visible rounded-2xl border border-[#e5e8f1] bg-white shadow-[0_3px_14px_#25335708]">
        <header className="flex items-center justify-between gap-3 border-b border-[#e9ebf2] px-4 py-3.5 sm:px-5">
          <h2 className="text-base font-bold">بنود الأوردر <span className="ms-2 rounded-md bg-[#f0edfc] px-2 py-0.5 text-xs font-semibold text-[#6250c9]">{items.length}</span></h2>
        </header>
        <div className="space-y-3 p-3 sm:p-4">
          {items.map((item, index) => <div key={item.key} className="rounded-xl border border-[#e8eaf2] bg-[#fbfcfe] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">العنصر {index + 1}</h3>
              {items.length > 1 && <Button type="button" variant="ghost" size="icon-sm" disabled={busy}
                aria-label={"حذف العنصر " + (index + 1)} onClick={() => removeItem(item.key)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>}
            </div>
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(92px,.65fr)_minmax(145px,.95fr)]">
              <div className="scroll-mt-24 space-y-1" data-order-field={"items." + item.key + ".serviceId"}>
                <label className="text-xs font-semibold">خدمة الطباعة *</label>
                <SearchableSelect label={"خدمة العنصر " + (index + 1)} placeholder="ابحث عن خدمة..."
                  options={services} value={item.serviceId} invalid={!!errors["items." + item.key + ".serviceId"]}
                  disabled={busy || choices.isPending || choices.isError}
                  onChange={(value) => changeItem(item.key, "serviceId", value)} />
                {message("items." + item.key + ".serviceId")}
              </div>
              <label className="scroll-mt-24 text-xs font-semibold" data-order-field={"items." + item.key + ".quantity"}>الكمية *
                <input type="number" min="1" max="1000000" aria-label={"كمية العنصر " + (index + 1)}
                  aria-invalid={!!errors["items." + item.key + ".quantity"]} className={fieldClass + " mt-2"}
                  value={item.quantity} disabled={busy} onChange={(e) => changeItem(item.key, "quantity", e.target.value)} />
                {message("items." + item.key + ".quantity")}
              </label>
              <label className="scroll-mt-24 text-xs font-semibold" data-order-field={"items." + item.key + ".agreedTotal"}>الإجمالي المتفق عليه (ج.م) *
                <input dir="ltr" inputMode="decimal" aria-label={"إجمالي العنصر " + (index + 1)}
                  aria-invalid={!!errors["items." + item.key + ".agreedTotal"]} className={fieldClass + " mt-2"}
                  value={item.agreedTotal} disabled={busy} placeholder="أدخل المبلغ"
                  onChange={(e) => changeItem(item.key, "agreedTotal", e.target.value)} />
                {message("items." + item.key + ".agreedTotal")}
              </label>
            </div>
            {services.find((service) => service.value === Number(item.serviceId))?.pricingMethod !== undefined &&
              services.find((service) => service.value === Number(item.serviceId))?.pricingMethod !== "quantity" && <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">العرض (سم) *
                  <input aria-label={"عرض العنصر " + (index + 1)} type="number" min="0.0001" step="any" className={fieldClass + " mt-2"} value={item.widthCm} disabled={busy}
                    onChange={(e) => changeItem(item.key, "widthCm", e.target.value)} />
                  {message("items." + item.key + ".widthCm")}
                </label>
                <label className="block text-xs font-semibold">الطول (سم) *
                  <input aria-label={"طول العنصر " + (index + 1)} type="number" min="0.0001" step="any" className={fieldClass + " mt-2"} value={item.heightCm} disabled={busy}
                    onChange={(e) => changeItem(item.key, "heightCm", e.target.value)} />
                  {message("items." + item.key + ".heightCm")}
                </label>
              </div>}
            {agreedUnit(item) !== null && <p className="mt-2 text-xs text-muted-foreground">
              {uiMessages.orders.agreedUnitPrice}: <span dir="ltr" className="inline-block font-semibold tabular-nums">{agreedUnit(item)} ج.م</span>
              <span className="mx-1">×</span> {item.quantity} {uiMessages.orders.pieces}
            </p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy}
                onClick={() => setItems((old) => old.map((row) => row.key === item.key ? { ...row, expanded: !row.expanded } : row))}>
                {item.expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                المواصفات {item.specifications ? "✓" : "(اختياري)"}
              </Button>
              {permissions.includes("printing_services.price_preview.view") && <Button type="button" size="sm" variant="outline"
                disabled={busy || previewPending !== null} onClick={() => void preview(item.key)}>
                <Calculator className="size-4" /> {previewPending === item.key ? "جاري الحساب..." : "السعر المقترح"}
              </Button>}
            </div>
            {item.expanded && <textarea aria-label={"مواصفات العنصر " + (index + 1)}
              className={fieldClass + " mt-2 min-h-20 py-2"} maxLength={20000} disabled={busy}
              placeholder="المقاس، الخامة، الألوان أو أي تفاصيل أخرى..."
              value={item.specifications} onChange={(e) => changeItem(item.key, "specifications", e.target.value)} />}
            {suggestions[item.key] !== undefined && <div className="mt-3 rounded-lg border border-primary/15 bg-[#f8f9ff] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs text-muted-foreground">{uiMessages.orders.suggestedPrice}</p>
                  <strong className="text-base"><MoneyAmount amount={suggestions[item.key]} /></strong>
                  <p className="text-[11px] text-muted-foreground">{uiMessages.orders.suggestedNotAgreed}</p></div>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => applySuggestion(item)}>{uiMessages.orders.useSuggested}</Button>
              </div>
              {confirmPriceKey === item.key && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <p className="text-xs text-[#9c591b]">{uiMessages.orders.replaceAgreedPrice}: <span dir="ltr" className="inline-block">{item.agreedTotal} ج.م</span> ← <span dir="ltr" className="inline-block">{suggestions[item.key]} ج.م</span></p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => applySuggestion(item)}>{uiMessages.orders.confirmReplacement}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmPriceKey(null)}>{uiMessages.orders.keepAgreedPrice}</Button>
                </div>
              </div>}
            </div>}
            {previewError[item.key] && <p role="alert" className="mt-2 text-xs text-destructive">{previewError[item.key]}</p>}
          </div>)}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="border-[#bbb0f2] text-[#6250c9] hover:bg-[#f6f3ff]"
              disabled={busy || items.length >= 100} onClick={addItem}><Plus className="size-4" /> إضافة بند</Button>
            <p className="text-xs text-muted-foreground">ارفع الملفات بعد حفظ المسودة.</p>
          </div>
        </div>
      </section>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-24">
        <section aria-label="ملخص الأوردر" className="rounded-2xl border border-[#e5e8f1] bg-white p-4 shadow-[0_3px_14px_#25335708] sm:p-5">
          <h2 className="mb-4 border-b border-[#e9ebf2] pb-3 text-base font-bold">ملخص الأوردر</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">عدد البنود</span><strong className="tabular-nums">{items.length}</strong>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f1eefc] px-3 py-3">
              <span className="text-sm font-semibold text-[#5142aa]">إجمالي الأوردر</span>
              <strong className="text-lg font-bold text-[#5142aa]">{allPriced ? <MoneyAmount amount={orderCents / 100}/> : "أكمل أسعار البنود"}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">المتبقي من الأوردر</span>
              <strong className={"tabular-nums " + (remainingCents === 0 ? "text-emerald-700" : "text-[#29334d]")}>
                {allPriced && remainingCents !== null ? <MoneyAmount amount={remainingCents / 100}/> : "—"}
              </strong>
            </div>
          </div>
        {customerId && permissions.includes("finance.balances.view") && <div className="mt-3 rounded-lg border border-[#e6e9f2] bg-[#fafbff] px-3 py-3 text-xs">
          <p className="font-semibold text-foreground">{uiMessages.orders.priorCustomerBalance}</p>
          <p className="mt-1 text-muted-foreground">{balance.isPending ? "جاري التحميل..." :
            balance.isError ? "تعذّر التحميل" : balance.data?.type === 1
              ? <>مديونية <MoneyAmount amount={balance.data.amount} /></>
              : balance.data?.type === 2 ? <>رصيد دائن <MoneyAmount amount={balance.data.amount} /></>
                : "صفر"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{uiMessages.orders.priorSeparateNote}</p>
        </div>}
        {canConfirm && <div className="mt-4 space-y-3 border-t border-[#e9ebf2] pt-4">
            <h3 className="text-sm font-bold">التحصيل عند التأكيد</h3>
          <label className="scroll-mt-24 block text-sm font-semibold" data-order-field="depositAmount">المدفوع الآن (العربون)
            <input aria-label="المدفوع الآن" aria-invalid={!!errors.depositAmount}
              className={fieldClass + " mt-2"} dir="ltr" inputMode="decimal"
              value={depositAmount} disabled={busy}
              onChange={(e) => {setDepositAmount(e.target.value);setOverpaymentAccepted(false);clear("depositAmount");}} />
            {message("depositAmount")}
          </label>
          {paidCents !== null && paidCents > 0 && <div className="space-y-3">
            <div className="flex flex-wrap gap-2" aria-label="طريقة الدفع">
              {([["0","نقدي"],["1","تحويل بنكي"],["2","محفظة إلكترونية"]] as const).map(([method,label]) =>
                <button key={method} type="button" aria-pressed={paymentMethod === method} disabled={busy}
                  onClick={() => {setPaymentMethod(method);setDestinationOverride(null);clear("paymentDestinationId");}}
                  className={"rounded-lg border px-3 py-2 text-xs font-semibold transition-colors " +
                    (paymentMethod === method ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                  {label}
                </button>)}
            </div>
            {paymentMethod !== "0" && <div className="scroll-mt-24 max-w-md space-y-2" data-order-field="paymentDestinationId">
              <label htmlFor="payment-destination" className="text-sm font-semibold">
                {paymentMethod === "1" ? "الحساب البنكي" : "المحفظة الإلكترونية"} *
              </label>
              <select id="payment-destination" aria-label="وجهة تحصيل العربون" className={fieldClass}
                value={selectedDestination} disabled={busy || paymentOptions.isPending || paymentOptions.isError}
                onChange={(e) => {setDestinationOverride(e.target.value);clear("paymentDestinationId");}}>
                {!selectedDestination && <option value="">اختر وجهة التحصيل</option>}
                {accounts.map((account) => <option key={account.value} value={account.value}>
                  {account.label}{Number(account.isDefault) === 1 ? " (افتراضي)" : ""}
                </option>)}
              </select>
              {paymentOptions.isPending && <p role="status" className="text-xs text-muted-foreground">جاري تحميل الحسابات...</p>}
              {paymentOptions.isError && <p role="alert" className="text-xs text-destructive">
                تعذّر تحميل وسائل التحصيل. <button type="button" className="underline" onClick={() => void paymentOptions.refetch()}>إعادة المحاولة</button>
              </p>}
              {!paymentOptions.isPending && !paymentOptions.isError && accounts.length === 0 &&
                <p className="text-xs text-destructive">لا توجد وجهة تحصيل نشطة لهذا النوع.</p>}
              {message("paymentDestinationId")}
            </div>}
          </div>}
          {allPriced && overpaymentCents > 0 && <label data-order-field="overpayment" className="scroll-mt-24 flex items-start gap-2 rounded-xl border border-[#f2d99b] bg-[#fff5df] p-3 text-sm">
            <input type="checkbox" checked={overpaymentAccepted} onChange={(e) => {setOverpaymentAccepted(e.target.checked);clear("overpayment");}}
              aria-label="تأكيد الزيادة عن قيمة الأوردر" />
            <span>المدفوع أعلى من إجمالي الأوردر بـ <MoneyAmount amount={overpaymentCents / 100} />.
              أؤكد تسجيل الزيادة كرصيد دائن للعميل.</span>
          </label>}
          {message("overpayment")}
          <p className="border-t pt-3 text-xs leading-6 text-muted-foreground">{uiMessages.orders.paymentDraftNote}</p>
        </div>}
        </section>
      </aside>

      {generalError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive xl:col-span-2">{generalError}</p>}
      <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur sm:p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">إجمالي الأوردر</span>
          <strong className="me-2 block text-lg">{allPriced ? <MoneyAmount amount={orderCents / 100} /> : "—"}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/orders">إلغاء</Link></Button>
          <Button type="submit" value="draft" variant="outline" disabled={busy || choices.isError || choices.isPending}>
            حفظ مسودة
          </Button>
          {canConfirm && <Button type="submit" value="confirm" disabled={busy || choices.isError || choices.isPending}>
            {busy && <LoaderCircle className="size-4 animate-spin" />} تأكيد الأوردر
          </Button>}
        </div>
      </footer>
    </form>
    {editCustomer && selectedCustomer && <CustomerFormModal customer={selectedCustomer}
      onClose={() => setEditCustomer(false)} onSaved={(id) => {
        setNewCustomer(null);
        resetSuggestions();
        void qc.invalidateQueries({queryKey:["orders","create-selects"]});
        void qc.invalidateQueries({queryKey:["orders","selected-customer",String(id)]});
      }} />}
    {customerModal && <CustomerFormModal onClose={() => setCustomerModal(false)}
      onSaved={(id, created) => {
        if (created) setNewCustomer(created);
        setCustomerId(String(id));
        resetSuggestions();
        clear("customerId");
        void qc.invalidateQueries({ queryKey: ["orders", "create-selects"] });
      }} />}
  </div>;
}
