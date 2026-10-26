import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getOrderPaymentOptions } from "../api/order-options.api";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ConfirmDialog, ErrorState, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { OrderItemEditor } from "../components/order-item-editor";
import { OrderHeaderEditor } from "../components/order-header-editor";
import { OrderActivityTimeline } from "../components/order-activity";
import { OrderFileGallery } from "../components/order-file-gallery";
import { useOrder, useOrderActions, orderKeys } from "../hooks/use-orders";
import type { OrderItem } from "../types/orders.types";

const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;
function displayMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", {minimumFractionDigits:2,maximumFractionDigits:4}).replace(/(\.\d{2})00$/, "$1");
}
export function OrderDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data: session } = useCurrentUser();
  const perms = session?.permissions ?? [];
  const order = useOrder(valid ? id : 0);
  const actions = useOrderActions();
  const [activeTab, setActiveTab] = useState<"order" | "activity">("order");
  const [editItem, setEditItem] = useState<OrderItem | "new" | null>(null);
  const [editHeader, setEditHeader] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<"plan" | "confirm" | null>(null);
  const [deposit, setDeposit] = useState("0");
  const [overpaymentAcknowledged, setOverpaymentAcknowledged] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"0" | "1" | "2">("0");
  const [paymentDestinationId, setPaymentDestinationId] = useState("");
  const destinations = useQuery({
    queryKey: ["orders", "payment-destinations"],
    queryFn: getOrderPaymentOptions,
    enabled: paymentDialog !== null && Number(deposit) > 0 && paymentMethod !== "0",
  });
  const activeDestinations = paymentMethod === "1" ? destinations.data?.banks ?? [] : destinations.data?.wallets ?? [];
  const defaultDestination = activeDestinations.find((option) => Number(option.isDefault) === 1) ?? activeDestinations[0];
  const chosenDestination = activeDestinations.some((opt) => String(opt.value) === paymentDestinationId)
    ? paymentDestinationId : (defaultDestination ? String(defaultDestination.value) : "");
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<OrderItem | null>(null);
  const [error, setError] = useState("");
  const confirmKey = useRef(crypto.randomUUID());
  const cancelKey = useRef(crypto.randomUUID());
  const showActivities = perms.includes("orders.activities.view");
  const mayEdit = perms.includes("orders.update");
  const mayConfirm = perms.includes("orders.confirm");
  const mayCancel = perms.includes("orders.cancel");
  function openPaymentDialog(mode: "plan" | "confirm") {
    const saved = order.data;
    setDeposit(saved?.plannedDepositAmount ?? "0");
    setPaymentMethod(String(saved?.plannedPaymentMethod ?? 0) as "0" | "1" | "2");
    setPaymentDestinationId(saved?.plannedPaymentDestinationId ? String(saved.plannedPaymentDestinationId) : "");
    setOverpaymentAcknowledged(false);
    setError("");
    setPaymentDialog(mode);
  }
  async function savePaymentPlan() {
    if (!moneyPattern.test(deposit)) {setError("أدخل مبلغ عربون صحيحًا.");return;}
    const hasDeposit = Number(deposit) > 0;
    if (hasDeposit && paymentMethod !== "0" && !chosenDestination) {
      setError("اختر حساب البنك أو المحفظة.");return;
    }
    try {
      await actions.update.mutateAsync({ id, payload: {
        plannedDepositAmount: deposit,
        plannedPaymentMethod: hasDeposit ? Number(paymentMethod) as 0 | 1 | 2 : null,
        plannedPaymentDestinationId: hasDeposit && paymentMethod !== "0" ? Number(chosenDestination) : null,
      } });
      toast.success("تم حفظ خطة العربون في المسودة دون تسجيل تحصيل.");
      setPaymentDialog(null);
      setError("");
    } catch (e: unknown) {setError(getApiErrorMessage(e,"تعذّر حفظ خطة الدفع."));}
  }
  async function confirm() {
    if (!order.data || !moneyPattern.test(deposit)) {setError("أدخل مبلغًا صحيحًا.");return;}
    if (Number(deposit) > Number(order.data.totalAmount) && !overpaymentAcknowledged) {
      setError("العربون أعلى من إجمالي الأوردر؛ أكد تحويل الزيادة لرصيد العميل الدائن.");return;
    }
    try {
      const hasDeposit = Number(deposit) > 0;
      if (hasDeposit && paymentMethod !== "0" && !chosenDestination) {
        setError("اختر حساب البنك أو المحفظة التي استلمت العربون.");return;
      }
      const payload: Parameters<typeof actions.confirm.mutateAsync>[0]["payload"] = hasDeposit
        ? { depositAmount: deposit, paymentMethod: Number(paymentMethod) as 0 | 1 | 2,
            ...(paymentMethod !== "0" ? { paymentDestinationId: Number(chosenDestination) } : {}) }
        : {};
      await actions.confirm.mutateAsync({ id, key: confirmKey.current, payload });
      toast.success("تم تأكيد الأوردر.");setPaymentDialog(null);setError("");
    } catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر تأكيد الأوردر."));}
  }
  async function cancel() {
    if (reason.trim().length < 3) {setError("سبب الإلغاء مطلوب (3 أحرف على الأقل).");return;}
    try {await actions.cancel.mutateAsync({ id, reason: reason.trim(), key: cancelKey.current });toast.success("تم إلغاء الأوردر.");setCancelOpen(false);setError("");}
    catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر إلغاء الأوردر."));}
  }
  async function removeItem() {
    if (!deleteItem) return;
    try {await actions.removeItem.mutateAsync({ id, itemId: deleteItem.id });toast.success("تم حذف العنصر.");setDeleteItem(null);}
    catch (e: unknown) {toast.error(getApiErrorMessage(e, "لا يمكن حذف آخر عنصر من المسودة."));}
  }
  if (!valid) return <p role="alert">معرّف الأوردر غير صحيح.</p>;
  if (order.isPending) return <LoadingState />;
  if (order.isError) return <ErrorState error={order.error} retry={() => void order.refetch()} />;
  const item = order.data;
  const draft = item.status === 0;
  return <div className="space-y-5">
    <Button asChild variant="ghost"><Link to="/orders"><ArrowRight /> العودة للأوردرات</Link></Button>
    <header className="flex flex-wrap justify-between gap-4">
      <div className="space-y-1"><p className="text-xs text-muted-foreground">تفاصيل الأوردر</p>
        <h1 className="text-2xl font-extrabold">{item.orderNumber ?? `مسودة #${item.id}`}</h1>
        <p className="text-sm text-muted-foreground">{item.customerName} — {item.customerPhone}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-muted px-3 py-2 text-sm font-bold">{item.statusLabel}</span>
        {draft && mayEdit && <Button variant="outline" onClick={() => setEditHeader(true)}><Pencil className="size-4" /> تعديل البيانات</Button>}

        {draft && mayConfirm && <Button onClick={() => openPaymentDialog("confirm")}><CheckCircle2 className="size-4" /> تأكيد الأوردر</Button>}
        {item.status === 1 && item.deliveredAt === null && mayCancel && <Button variant="outline" onClick={() => {setError("");setCancelOpen(true);}}>إلغاء الأوردر</Button>}
      </div>
    </header>
    <section className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-3">
      <div><p className="text-xs text-muted-foreground">الإجمالي</p><p className="mt-2 text-xl font-extrabold">{displayMoney(item.totalAmount)} ج.م</p></div>
      <div><p className="text-xs text-muted-foreground">موعد التسليم</p><p className="mt-2 font-semibold">{item.dueDate ?? "غير محدد"}</p></div>
      <div><p className="text-xs text-muted-foreground">حالة الإنتاج</p><p className="mt-2 font-semibold">{item.productionStatusLabel ?? "لم يبدأ"}</p>
        {item.delayStatusLabel && <p className="mt-1 text-xs text-destructive">{item.delayStatusLabel}</p>}</div>
      {item.notes && <p className="text-sm text-muted-foreground sm:col-span-3">ملاحظات: {item.notes}</p>}
    </section>
    {draft && mayEdit && mayConfirm && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
      <div className="space-y-1">
        <p className="font-semibold">العربون المخطط قبل التأكيد</p>
        <p className="text-xs text-muted-foreground">
          {item.plannedDepositAmount !== null && item.plannedDepositAmount !== undefined ?
            displayMoney(item.plannedDepositAmount) + " ج.م" : "لم يتم تحديد عربون بعد"}
          {Number(item.plannedDepositAmount ?? "0") > 0 &&
            (" — " + (item.plannedPaymentMethod === 1 ? "تحويل بنكي" :
              item.plannedPaymentMethod === 2 ? "محفظة إلكترونية" : "نقدي"))}
          {" · لا يُسجل كتحصيل إلا بعد تأكيد الأوردر"}
        </p>
      </div>
      <Button variant="outline" size="sm" type="button" onClick={() => openPaymentDialog("plan")}>
        <Pencil className="size-4" /> تعديل العربون وطريقة الدفع
      </Button>
    </div>}
    <nav role="tablist" aria-label="أقسام الأوردر" className="inline-flex max-w-full items-center gap-1 rounded-xl bg-muted p-1">
      <button type="button" role="tab" id="order-tab" aria-controls="order-panel" aria-selected={activeTab === "order"}
        onClick={() => setActiveTab("order")}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "order" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
        تفاصيل الأوردر
      </button>
      {showActivities && <button type="button" role="tab" id="activity-tab" aria-controls="activity-panel"
        aria-selected={activeTab === "activity"} onClick={() => setActiveTab("activity")}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "activity" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
        سجل الأحداث
      </button>}
    </nav>
    {activeTab === "order" && <div role="tabpanel" id="order-panel" aria-labelledby="order-tab">
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 className="font-bold">عناصر الأوردر</h2>
        {draft && perms.includes("orders.items.create") && <Button variant="outline" size="sm" onClick={() => setEditItem("new")}><Plus className="size-4" /> إضافة عنصر</Button>}
      </header>
      <div className="space-y-3 p-4">
        {item.items?.map((line) => <article key={line.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h3 className="font-bold">{line.serviceName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">الكمية: {line.quantity} — الوحدة: {displayMoney(line.unitPrice)} ج.م</p>
              {line.specifications && <p className="mt-2 whitespace-pre-wrap text-sm">{line.specifications}</p>}
            </div>
            <div className="flex items-center gap-2"><strong>{displayMoney(line.agreedTotal)} ج.م</strong>
              {draft && perms.includes("orders.items.update") && <Button type="button" variant="ghost" size="icon-sm" aria-label={`تعديل العنصر ${line.id}`} onClick={() => setEditItem(line)}><Pencil /></Button>}
              {draft && perms.includes("orders.items.delete") && <Button type="button" variant="ghost" size="icon-sm" aria-label={`حذف العنصر ${line.id}`} onClick={() => setDeleteItem(line)}><Trash2 className="text-destructive" /></Button>}
            </div>
          </div>
          <OrderFileGallery orderId={id} item={line}
            canList={perms.includes("orders.files.list")} canUpload={draft && perms.includes("orders.files.upload")}
            canView={perms.includes("orders.files.view")} canDelete={draft && perms.includes("orders.files.delete")} />
        </article>)}
      </div>
    </section>

    </div>}
    {activeTab === "activity" && showActivities && <div role="tabpanel" id="activity-panel" aria-labelledby="activity-tab">
      <OrderActivityTimeline orderId={id} enabled={showActivities} />
    </div>}
    {editHeader && <OrderHeaderEditor order={item} canCreateCustomer={perms.includes("customers.create")}
      onClose={() => setEditHeader(false)} />}
    {editItem && <OrderItemEditor key={editItem === "new" ? "new" : editItem.id} order={item}
      item={editItem === "new" ? undefined : editItem} canPricePreview={perms.includes("printing_services.price_preview.view")}
      onClose={() => setEditItem(null)} />}
    {deleteItem && <ConfirmDialog title="حذف عنصر" description="سيُحذف العنصر من المسودة وستُؤرشف ملفاته. لا يمكن حذف آخر عنصر."
      confirmText="حذف العنصر" destructive busy={actions.removeItem.isPending}
      onClose={() => setDeleteItem(null)} onConfirm={() => void removeItem()} />}
    {paymentDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-label={paymentDialog === "plan" ? "تعديل خطة العربون" : "تأكيد الأوردر"} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-card p-6">
        <h2 className="font-bold">{paymentDialog === "plan" ? "تعديل خطة العربون" : "تأكيد الأوردر"}</h2>
        <p className="text-sm text-muted-foreground">{paymentDialog === "plan"
          ? "يمكن تعديل المبلغ وطريقة الدفع وحفظهما في المسودة. لن يُسجل أي تحصيل مالي قبل تأكيد الأوردر."
          : "سيُثبت إجمالي الأوردر على حساب العميل ويُنشأ رقم الأوردر. راجع العربون قبل التأكيد."}</p>
        <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
          <div className="flex justify-between"><span>إجمالي الأوردر</span><strong>{displayMoney(item.totalAmount)} ج.م</strong></div>
          <div className="flex justify-between"><span>العربون</span><strong>{moneyPattern.test(deposit) ? displayMoney(deposit) + " ج.م" : "—"}</strong></div>
          <div className="flex justify-between"><span>المتبقي</span><strong>{moneyPattern.test(deposit) ?
            displayMoney(String(Math.max(0, Number(item.totalAmount) - Number(deposit)).toFixed(2))) + " ج.م" : "—"}</strong></div>
        </div>
        {paymentDialog === "confirm" && item.items?.every((line) => (line.files?.length ?? 0) === 0) && perms.includes("orders.files.list") &&
          <p className="text-xs text-amber-700">لا توجد ملفات تصميم مرفوعة. تأكد أن الأوردر لا يحتاج ملفات قبل التأكيد.</p>}
        <label className="block text-sm font-semibold">قيمة العربون (ج.م)
          <input aria-label="قيمة العربون" dir="ltr" className={fieldClass + " mt-2"}
            value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
        {paymentDialog === "confirm" && Number(deposit) > Number(item.totalAmount) && <label className="flex items-start gap-2 rounded-xl border border-amber-300 p-3 text-xs">
          <input type="checkbox" checked={overpaymentAcknowledged} onChange={(e) => setOverpaymentAcknowledged(e.target.checked)}
            aria-label="تأكيد الزيادة عن قيمة الأوردر" />
          أؤكد أن العربون يتجاوز إجمالي الأوردر، وأن الزيادة ستُسجل كرصيد دائن للعميل وفق قواعد المالية.
        </label>}
        {Number(deposit) > 0 && <div className="space-y-3">
          <label className="block text-sm font-semibold">طريقة الدفع
            <select aria-label="طريقة دفع العربون" className={fieldClass + " mt-2"} value={paymentMethod}
              onChange={(e) => {setPaymentMethod(e.target.value as "0" | "1" | "2");setPaymentDestinationId("");}}>
              <option value="0">نقدي</option><option value="1">تحويل بنكي</option><option value="2">محفظة إلكترونية</option>
            </select>
          </label>
          {paymentMethod !== "0" && <label className="block text-sm font-semibold">وجهة التحصيل *
            <select aria-label="وجهة تحصيل العربون" className={fieldClass + " mt-2"} value={chosenDestination}
              disabled={destinations.isPending || destinations.isError}
              onChange={(e) => setPaymentDestinationId(e.target.value)}>
              <option value="">اختر وجهة التحصيل</option>
              {activeDestinations.map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>}
          {destinations.isError && paymentMethod !== "0" &&
            <p role="alert" className="text-xs text-destructive">تعذّر تحميل وسائل التحصيل. اختر نقدي أو حاول مرة أخرى.</p>}
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={actions.confirm.isPending || actions.update.isPending}
            onClick={() => setPaymentDialog(null)}>رجوع</Button>
          <Button disabled={actions.confirm.isPending || actions.update.isPending}
            onClick={() => paymentDialog === "plan" ? void savePaymentPlan() : void confirm()}>
            {paymentDialog === "plan" ? "حفظ خطة الدفع" : "تأكيد"}
          </Button>
        </div>
      </section>
    </div>}
    {cancelOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-label="إلغاء الأوردر" className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6">
        <h2 className="font-bold">سبب الإلغاء</h2>
        <textarea aria-label="سبب إلغاء الأوردر" className={fieldClass + " min-h-24 py-2"} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={actions.cancel.isPending} onClick={() => setCancelOpen(false)}>رجوع</Button>
          <Button disabled={actions.cancel.isPending} variant="destructive" onClick={() => void cancel()}>إلغاء الأوردر</Button></div>
      </section>
    </div>}
  </div>;
}
