import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowRight, Calculator, ChevronDown, ChevronUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
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
import { useOrderActions } from "../hooks/use-orders";
import type { CreateOrderPayload } from "../types/orders.types";

type ItemDraft = {
  key: number; serviceId: string; quantity: string; agreedTotal: string;
  specifications: string; expanded: boolean;
};
type Errors = Record<string, string>;
type Mode = "draft" | "confirm";
const blank = (key: number): ItemDraft => ({
  key, serviceId: "", quantity: "1", agreedTotal: "", specifications: "", expanded: false,
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
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, string>>({});
  const [previewPending, setPreviewPending] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<Record<number, string>>({});
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
    if (!Object.keys(errors).length) return;
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [errors]);

  function clear(key: string) {
    setErrors((old) => { const updated = { ...old }; delete updated[key]; return updated; });
    setGeneralError(null);
  }
  function resetSuggestions() {
    previewEpoch.current += 1;
    setSuggestions({});
    setPreviewError({});
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
    if (field === "serviceId" || field === "quantity") {
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

  function validate(mode: Mode): Errors {
    const issues: Errors = {};
    if (!customerId) issues.customerId = "اختر عميلًا مسجلًا.";
    for (const item of items) {
      if (!item.serviceId) issues["items." + item.key + ".serviceId"] = "اختر خدمة الطباعة.";
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
    if (Object.keys(issues).length) return;
    const payload: CreateOrderPayload = {
      customerId: Number(customerId), source: Number(source) as 0 | 1, status: mode === "confirm" ? 1 : 0,
      dueDate: dueDate || null, notes: notes.trim() || null,
      items: items.map((item) => ({
        serviceId: Number(item.serviceId), quantity: Number(item.quantity),
        specifications: item.specifications.trim() || null, agreedTotal: item.agreedTotal,
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
        if (Object.keys(mapped).length) {setErrors(mapped); return;}
      }
      setGeneralError(getApiErrorMessage(error, mode === "confirm" ? "تعذّر تأكيد الأوردر." : "تعذّر حفظ المسودة."));
    }
  }
  function message(key: string) {
    return errors[key] ? <p role="alert" className="mt-1 text-xs text-destructive">{errors[key]}</p> : null;
  }

  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <Button variant="ghost" asChild className="px-0"><Link to="/orders"><ArrowRight /> العودة للأوردرات</Link></Button>
    <header>
      <h1 className="text-xl font-semibold">إضافة أوردر</h1>
      <p className="mt-1 text-sm text-muted-foreground">أدخل بيانات الطلب، ثم احفظ مسودة أو أكد الأوردر مع تسجيل الدفعة الآن.</p>
    </header>
    {choices.isError && <div role="alert" className="rounded-xl border p-3 text-sm text-destructive">
      تعذّر تحميل العملاء أو خدمات الطباعة. <button type="button" className="underline" onClick={() => void choices.refetch()}>إعادة المحاولة</button>
    </div>}
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <section className="rounded-lg border bg-card p-4  sm:p-5">
        <h2 className="mb-4 font-bold">بيانات الأوردر</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold">العميل المسجل *</label>
            <SearchableSelect label="اختيار العميل" placeholder="ابحث بالاسم أو رقم الهاتف..."
              options={mergedCustomers} value={customerId} onChange={setCustomer} loading={choices.isPending}
              disabled={busy || choices.isPending || choices.isError}
              onCreate={canAddCustomer ? () => setCustomerModal(true) : undefined} createLabel="إضافة عميل جديد" />
            {message("customerId")}
            {selectedCustomer && <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">نوع العميل: {selectedCustomer.customerType?.name ?? "حسب الملف المسجل"}</p>
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
          <label className="text-sm font-semibold">تاريخ التسليم (اختياري)
            <input type="date" aria-label="تاريخ التسليم" className={fieldClass + " mt-2"}
              value={dueDate} disabled={busy} onChange={(e) => {setDueDate(e.target.value);clear("dueDate");}} />
            {message("dueDate")}
          </label>
          <div className="flex items-center"><Button type="button" variant="ghost" size="sm" onClick={() => setShowNotes(!showNotes)}>
            {showNotes ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} ملاحظات الأوردر (اختياري)
          </Button></div>
          {showNotes && <label className="block text-sm font-semibold md:col-span-2">
            <textarea aria-label="ملاحظات" className={fieldClass + " mt-2 min-h-20 py-3"}
              maxLength={10000} disabled={busy} value={notes} onChange={(e) => setNotes(e.target.value)} />
            {message("notes")}
          </label>}
        </div>
      </section>

      <section className="overflow-visible rounded-lg border bg-card ">
        <header className="flex items-center justify-between gap-3 border-b p-4 sm:px-5">
          <h2 className="font-bold">عناصر الأوردر</h2>
          <Button type="button" variant="outline" size="sm" disabled={busy || items.length >= 100} onClick={addItem}><Plus className="size-4" /> إضافة عنصر</Button>
        </header>
        <div className="space-y-3 p-3 sm:p-4">
          {items.map((item, index) => <div key={item.key} className="rounded-xl border bg-muted/15 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">العنصر {index + 1}</h3>
              {items.length > 1 && <Button type="button" variant="ghost" size="icon-sm" disabled={busy}
                aria-label={"حذف العنصر " + (index + 1)} onClick={() => removeItem(item.key)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>}
            </div>
            <div className="grid items-start gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,.8fr)_minmax(0,1fr)]">
              <div className="space-y-1">
                <label className="text-xs font-semibold">خدمة الطباعة *</label>
                <SearchableSelect label={"خدمة العنصر " + (index + 1)} placeholder="ابحث عن خدمة..."
                  options={services} value={item.serviceId} disabled={busy || choices.isPending || choices.isError}
                  onChange={(value) => changeItem(item.key, "serviceId", value)} />
                {message("items." + item.key + ".serviceId")}
              </div>
              <label className="text-xs font-semibold">الكمية *
                <input type="number" min="1" max="1000000" aria-label={"كمية العنصر " + (index + 1)}
                  aria-invalid={!!errors["items." + item.key + ".quantity"]} className={fieldClass + " mt-2"}
                  value={item.quantity} disabled={busy} onChange={(e) => changeItem(item.key, "quantity", e.target.value)} />
                {message("items." + item.key + ".quantity")}
              </label>
              <label className="text-xs font-semibold">الإجمالي المتفق عليه (ج.م) *
                <input dir="ltr" inputMode="decimal" aria-label={"إجمالي العنصر " + (index + 1)}
                  aria-invalid={!!errors["items." + item.key + ".agreedTotal"]} className={fieldClass + " mt-2"}
                  value={item.agreedTotal} disabled={busy} placeholder="أدخل المبلغ"
                  onChange={(e) => changeItem(item.key, "agreedTotal", e.target.value)} />
                {message("items." + item.key + ".agreedTotal")}
              </label>
            </div>
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
            {suggestions[item.key] && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
              <span className="text-sm">الإجمالي المقترح: <strong><MoneyAmount amount={suggestions[item.key]} /></strong></span>
              <Button type="button" variant="outline" size="sm" disabled={busy}
                onClick={() => changeItem(item.key, "agreedTotal", suggestions[item.key])}>استخدام السعر</Button>
            </div>}
            {previewError[item.key] && <p role="alert" className="mt-2 text-xs text-destructive">{previewError[item.key]}</p>}
          </div>)}
          <p className="text-xs text-muted-foreground">يمكن تعديل السعر المتفق عليه يدويًا. الملفات تُرفع بعد حفظ المسودة وقبل تأكيدها.</p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4  sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">الحساب والدفع</h2>
          <span className="text-xs text-muted-foreground">اختيارات الدفع تُحفظ في المسودة، والتحصيل عند التأكيد فقط</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">عدد العناصر</p>
            <p className="mt-1 text-lg font-bold">{items.length}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">إجمالي الأوردر</p>
            <p className="mt-1 text-xl font-extrabold">{allPriced ? <MoneyAmount amount={orderCents / 100} /> : "أكمل أسعار العناصر"}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">المتبقي من الأوردر</p>
            <p className="mt-1 text-xl font-bold">{allPriced && remainingCents !== null ? <MoneyAmount amount={remainingCents / 100} /> : "—"}</p>
          </div>
        </div>
        {customerId && permissions.includes("finance.balances.view") && <p className="mt-3 text-xs text-muted-foreground">
          رصيد العميل قبل هذا الأوردر: {balance.isPending ? "جاري التحميل..." :
            balance.isError ? "تعذّر التحميل" : balance.data?.type === 1
              ? <>مديونية <MoneyAmount amount={balance.data.amount} /></>
              : balance.data?.type === 2 ? <>رصيد دائن <MoneyAmount amount={balance.data.amount} /></>
                : "صفر"} — منفصل عن المتبقي من الأوردر.
        </p>}
        {canConfirm && <div className="mt-5 space-y-4 border-t pt-4">
          <label className="block max-w-xs text-sm font-semibold">المدفوع الآن (العربون)
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
                  className={"rounded-xl border px-4 py-2 text-sm font-semibold " +
                    (paymentMethod === method ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                  {label}
                </button>)}
            </div>
            {paymentMethod !== "0" && <div className="max-w-md space-y-2">
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
          {allPriced && overpaymentCents > 0 && <label className="flex items-start gap-2 rounded-xl border border-[#f2d99b] bg-[#fff5df] p-3 text-sm">
            <input type="checkbox" checked={overpaymentAccepted} onChange={(e) => {setOverpaymentAccepted(e.target.checked);clear("overpayment");}}
              aria-label="تأكيد الزيادة عن قيمة الأوردر" />
            <span>المدفوع أعلى من إجمالي الأوردر بـ <MoneyAmount amount={overpaymentCents / 100} />.
              أؤكد تسجيل الزيادة كرصيد دائن للعميل.</span>
          </label>}
          {message("overpayment")}
        </div>}
      </section>

      {generalError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{generalError}</p>}
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
