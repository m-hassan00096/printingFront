import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getOrderPaymentOptions } from "../api/order-options.api";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ConfirmDialog, ErrorState, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { OrderItemEditor } from "../components/order-item-editor";
import { OrderHeaderEditor } from "../components/order-header-editor";
import { OrderActivityTimeline } from "../components/order-activity";
import { OrderFileGallery } from "../components/order-file-gallery";
import { useOrder, useOrderActions } from "../hooks/use-orders";
import type { OrderItem } from "../types/orders.types";

const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;
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
  const [returnToReview, setReturnToReview] = useState(false);
  const [deposit, setDeposit] = useState("0");
  const [overpaymentAcknowledged, setOverpaymentAcknowledged] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"0" | "1" | "2">("0");
  const [paymentDestinationId, setPaymentDestinationId] = useState("");
  const destinations = useQuery({
    queryKey: ["orders", "payment-destinations"],
    queryFn: getOrderPaymentOptions,
    enabled: (paymentDialog !== null && Number(deposit) > 0 && paymentMethod !== "0") ||
      (order.data?.status === 0 && Number(order.data.plannedDepositAmount ?? "0") > 0 &&
        order.data.plannedPaymentMethod !== 0 && order.data.plannedPaymentMethod !== null),
  });
  const activeDestinations = paymentMethod === "1" ? destinations.data?.banks ?? [] : destinations.data?.wallets ?? [];
  const defaultDestination = activeDestinations.find((option) => Number(option.isDefault) === 1) ?? activeDestinations[0];
  const chosenDestination = paymentDestinationId
    ? (activeDestinations.some((opt) => String(opt.value) === paymentDestinationId) ? paymentDestinationId : "")
    : (defaultDestination ? String(defaultDestination.value) : "");
  const savedPaymentOptions = order.data?.plannedPaymentMethod === 1
    ? destinations.data?.banks ?? [] : destinations.data?.wallets ?? [];
  const savedDestinationLabel = savedPaymentOptions.find(
    (option) => option.value === order.data?.plannedPaymentDestinationId)?.label;
  const plannedAmount = order.data?.plannedDepositAmount ?? "0";
  const plannedRemaining = order.data
    ? Math.max(0, Number(order.data.totalAmount) - Number(plannedAmount)) : 0;
  const paymentLabel = (method: number | null | undefined) =>
    method === 1 ? "تحويل بنكي" : method === 2 ? "محفظة إلكترونية" : "نقدي";
  const paymentIsBusy = actions.update.isPending || actions.confirm.isPending;
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<OrderItem | null>(null);
  const [error, setError] = useState("");
  const confirmAttempt = useRef({fingerprint:"",key:crypto.randomUUID()});
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
    setReturnToReview(false);
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
      await order.refetch();
      toast.success("تم حفظ بيانات العربون في المسودة، دون تسجيل تحصيل.");
      setPaymentDialog(returnToReview ? "confirm" : null);
      setReturnToReview(false);
      setError("");
    } catch (e: unknown) {setError(getApiErrorMessage(e,"تعذّر حفظ خطة الدفع."));}
  }
  async function confirm() {
    if (!order.data || !moneyPattern.test(deposit)) {setError("بيانات العربون غير صالحة؛ ارجع لتعديلها.");return;}
    if (Number(deposit) > Number(order.data.totalAmount) && !overpaymentAcknowledged) {
      setError("العربون أعلى من إجمالي الأوردر؛ أكد تحويل الزيادة لرصيد العميل الدائن.");return;
    }
    try {
      const hasDeposit = Number(deposit) > 0;
      if (hasDeposit && paymentMethod !== "0" &&
          (destinations.isPending || destinations.isError || !chosenDestination)) {
        setError("حساب التحصيل غير متاح حاليًا. راجع بيانات العربون قبل التأكيد.");return;
      }
      const payload: Parameters<typeof actions.confirm.mutateAsync>[0]["payload"] = hasDeposit
        ? { depositAmount: deposit, paymentMethod: Number(paymentMethod) as 0 | 1 | 2,
            ...(paymentMethod !== "0" ? { paymentDestinationId: Number(chosenDestination) } : {}) }
        : {};
      const fingerprint = JSON.stringify(payload);
      if (confirmAttempt.current.fingerprint !== fingerprint)
        confirmAttempt.current = { fingerprint, key: crypto.randomUUID() };
      await actions.confirm.mutateAsync({ id, key: confirmAttempt.current.key, payload });
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
        <h1 className="text-xl font-semibold">{item.orderNumber ?? `مسودة #${item.id}`}</h1>
        <p className="text-sm text-muted-foreground">{item.customerName} — {item.customerPhone}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-muted px-3 py-2 text-sm font-bold">{item.statusLabel}</span>
        {draft && mayEdit && <Button variant="outline" onClick={() => setEditHeader(true)}><Pencil className="size-4" /> تعديل البيانات</Button>}

        {draft && mayConfirm && <Button onClick={() => openPaymentDialog("confirm")}><CheckCircle2 className="size-4" /> تأكيد الأوردر</Button>}
        {item.status === 1 && item.deliveredAt === null && mayCancel && <Button variant="outline" onClick={() => {setError("");setCancelOpen(true);}}>إلغاء الأوردر</Button>}
      </div>
    </header>
    <section className="grid gap-3 rounded-lg border bg-card p-5  sm:grid-cols-3">
      <div><p className="text-xs text-muted-foreground">الإجمالي</p><p className="mt-2 text-xl font-extrabold"><MoneyAmount amount={item.totalAmount} /></p></div>
      <div><p className="text-xs text-muted-foreground">موعد التسليم</p><p className="mt-2 font-semibold">{item.dueDate ?? "غير محدد"}</p></div>
      <div><p className="text-xs text-muted-foreground">حالة الإنتاج</p><p className="mt-2 font-semibold">{item.productionStatusLabel ?? "لم يبدأ"}</p>
        {item.delayStatusLabel && <p className="mt-1 text-xs text-destructive">{item.delayStatusLabel}</p>}</div>
      {item.notes && <p className="text-sm text-muted-foreground sm:col-span-3">ملاحظات: {item.notes}</p>}
    </section>
    <nav role="tablist" aria-label="أقسام الأوردر" className="inline-flex max-w-full items-center gap-1 rounded-xl bg-muted p-1">
      <button type="button" role="tab" id="order-tab" aria-controls="order-panel" aria-selected={activeTab === "order"}
        onClick={() => setActiveTab("order")}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "order" ? "bg-card text-foreground " : "text-muted-foreground hover:text-foreground"}`}>
        تفاصيل الأوردر
      </button>
      {showActivities && <button type="button" role="tab" id="activity-tab" aria-controls="activity-panel"
        aria-selected={activeTab === "activity"} onClick={() => setActiveTab("activity")}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "activity" ? "bg-card text-foreground " : "text-muted-foreground hover:text-foreground"}`}>
        سجل الأحداث
      </button>}
    </nav>
    {activeTab === "order" && <div role="tabpanel" id="order-panel" aria-labelledby="order-tab">
    {draft && (mayConfirm || mayEdit) && <section aria-labelledby="draft-payment-title"
      className="mb-4 rounded-lg border bg-card px-4 py-3  sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="draft-payment-title" className="text-sm font-bold">الدفع عند التأكيد</h2>
          <p className="mt-1 text-xs text-muted-foreground">بيانات العربون محفوظة للمراجعة · لم يُسجَّل أي تحصيل بعد</p>
        </div>
        {mayEdit && <Button type="button" variant="outline" size="sm"
          onClick={() => openPaymentDialog("plan")}><Pencil className="size-4" /> تعديل</Button>}
      </header>
      <dl className="mt-3 grid gap-3 border-t pt-3 text-sm sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">العربون المحدد</dt>
          <dd className="mt-1 font-bold"><MoneyAmount amount={plannedAmount} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">المتبقي المتوقع</dt>
          <dd className="mt-1 font-bold"><MoneyAmount amount={plannedRemaining} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">وسيلة الدفع</dt>
          <dd className="mt-1 font-semibold">
            {Number(plannedAmount) > 0 ? paymentLabel(item.plannedPaymentMethod) : "بدون عربون"}
            {Number(plannedAmount) > 0 && item.plannedPaymentMethod !== null &&
              item.plannedPaymentMethod !== 0 && savedDestinationLabel &&
              <span className="block truncate text-xs font-normal text-muted-foreground" title={savedDestinationLabel}>
                {savedDestinationLabel}
              </span>}
          </dd>
        </div>
      </dl>
    </section>}
    <section className="overflow-hidden rounded-lg border bg-card ">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 className="font-bold">عناصر الأوردر</h2>
        {draft && perms.includes("orders.items.create") && <Button variant="outline" size="sm" onClick={() => setEditItem("new")}><Plus className="size-4" /> إضافة عنصر</Button>}
      </header>
      <div className="space-y-3 p-4">
        {item.items?.map((line) => <article key={line.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h3 className="font-bold">{line.serviceName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">الكمية: {line.quantity} — الوحدة: <MoneyAmount amount={line.unitPrice} maximumFractionDigits={4} /></p>
              {line.specifications && <p className="mt-2 whitespace-pre-wrap text-sm">{line.specifications}</p>}
            </div>
            <div className="flex items-center gap-2"><strong><MoneyAmount amount={line.agreedTotal} /></strong>
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
      <section role="dialog" aria-modal="true" aria-label={paymentDialog === "plan" ? "تعديل بيانات العربون" : "تأكيد الأوردر"}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-card p-5 shadow-xl sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{paymentDialog === "plan" ? "تعديل بيانات العربون" : "تأكيد الأوردر"}</h2>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="إغلاق"
            className="shrink-0" disabled={paymentIsBusy}
            onClick={() => {setError("");setReturnToReview(false);setPaymentDialog(null);}}>
            <X className="size-4" />
          </Button>
        </header>
        {paymentDialog === "plan" ? <>
          <p className="text-sm text-muted-foreground">حدد المبلغ ووسيلة الدفع. لن يُسجل أي تحصيل قبل تأكيد الأوردر.</p>
          <label className="block text-sm font-semibold">قيمة العربون (ج.م)
            <input aria-label="قيمة العربون" dir="ltr" inputMode="decimal" className={fieldClass + " mt-2"}
              value={deposit} disabled={paymentIsBusy}
              onChange={(e) => {setDeposit(e.target.value);setError("");}} />
          </label>
          {Number(deposit) > 0 && <div className="space-y-3">
            <label className="block text-sm font-semibold">طريقة الدفع
              <select aria-label="طريقة دفع العربون" className={fieldClass + " mt-2"} value={paymentMethod}
                disabled={paymentIsBusy}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as "0" | "1" | "2");
                  setPaymentDestinationId("");setError("");
                }}>
                <option value="0">نقدي</option><option value="1">تحويل بنكي</option><option value="2">محفظة إلكترونية</option>
              </select>
            </label>
            {paymentMethod !== "0" && <label className="block text-sm font-semibold">
              {paymentMethod === "1" ? "الحساب البنكي" : "المحفظة الإلكترونية"} *
              <select aria-label="وجهة تحصيل العربون" className={fieldClass + " mt-2"} value={chosenDestination}
                disabled={paymentIsBusy || destinations.isPending || destinations.isError}
                onChange={(e) => {setPaymentDestinationId(e.target.value);setError("");}}>
                <option value="">اختر حساب التحصيل</option>
                {activeDestinations.map((option) =>
                  <option key={option.value} value={option.value}>
                    {option.label}{Number(option.isDefault) === 1 ? " (افتراضي)" : ""}
                  </option>)}
              </select>
            </label>}
            {paymentMethod !== "0" && destinations.isPending &&
              <p role="status" className="text-xs text-muted-foreground">جاري تحميل وسائل التحصيل...</p>}
            {paymentMethod !== "0" && destinations.isError &&
              <button type="button" className="text-xs text-destructive underline"
                onClick={() => void destinations.refetch()}>تعذّر تحميل وسائل التحصيل — إعادة المحاولة</button>}
          </div>}
          {moneyPattern.test(deposit) && <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-sm">
            <span>المتبقي المتوقع</span>
            <strong><MoneyAmount amount={Math.max(0, Number(item.totalAmount) - Number(deposit))} /></strong>
          </div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" disabled={paymentIsBusy}
              onClick={() => {setReturnToReview(false);setPaymentDialog(null);}}>إلغاء</Button>
            <Button disabled={paymentIsBusy || (Number(deposit) > 0 && paymentMethod !== "0" &&
              (destinations.isPending || destinations.isError || !chosenDestination))}
              onClick={() => void savePaymentPlan()}>حفظ بيانات العربون</Button>
          </div>
        </> : <>
          <p className="text-sm text-muted-foreground">
            راجع التفاصيل قبل تأكيد الأوردر. سيتم تسجيل المديونية والعربون عند التأكيد فقط.
          </p>
          <div className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex justify-between gap-3"><span>إجمالي الأوردر</span>
              <strong><MoneyAmount amount={item.totalAmount} /></strong></div>
            <div className="flex justify-between gap-3"><span>العربون المطلوب تحصيله</span>
              <strong><MoneyAmount amount={deposit} /></strong></div>
            <div className="flex justify-between gap-3"><span>وسيلة الدفع</span>
              <strong>{Number(deposit) > 0 ? paymentLabel(Number(paymentMethod)) : "بدون عربون"}</strong>
            </div>
            {Number(deposit) > 0 && paymentMethod !== "0" &&
              <div className="flex justify-between gap-3">
                <span>حساب التحصيل</span>
                <strong className="text-left">{destinations.isPending ? "جاري التحقق..." :
                  activeDestinations.find((account) => String(account.value) === chosenDestination)?.label ??
                  "الحساب غير متاح"}</strong>
              </div>}
            <div className="flex justify-between gap-3 border-t pt-3">
              <span className="font-semibold">المتبقي بعد التأكيد</span>
              <strong><MoneyAmount amount={Math.max(0, Number(item.totalAmount) - Number(deposit))} /></strong>
            </div>
          </div>
          {Number(deposit) > Number(item.totalAmount) && <label className="flex items-start gap-2 rounded-xl border border-[#F0C000]/40 p-3 text-xs">
            <input type="checkbox" checked={overpaymentAcknowledged}
              onChange={(e) => {setOverpaymentAcknowledged(e.target.checked);setError("");}}
              aria-label="تأكيد الزيادة عن قيمة الأوردر" />
            أؤكد أن الزيادة عن قيمة الأوردر ستُسجل كرصيد دائن للعميل.
          </label>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {Number(deposit) > 0 && paymentMethod !== "0" &&
            (destinations.isError || (!destinations.isPending && !chosenDestination)) &&
            <p role="alert" className="text-xs text-destructive">
              حساب التحصيل المحفوظ غير متاح حاليًا. ارجع لتعديل بيانات العربون قبل التأكيد.
            </p>}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t pt-4">
            <Button className="min-w-0 px-2 text-xs sm:px-4 sm:text-sm"
              disabled={paymentIsBusy || !moneyPattern.test(deposit) ||
                (Number(deposit) > Number(item.totalAmount) && !overpaymentAcknowledged) ||
                (Number(deposit) > 0 && paymentMethod !== "0" &&
                  (destinations.isPending || destinations.isError || !chosenDestination))}
              onClick={() => void confirm()}>
              {Number(deposit) > 0 ? "تأكيد الأوردر وتحصيل العربون" : "تأكيد الأوردر"}
            </Button>
            {mayEdit && <Button variant="outline" className="shrink-0 px-2 text-xs sm:px-4 sm:text-sm"
              disabled={paymentIsBusy}
              onClick={() => {setError("");setReturnToReview(true);setPaymentDialog("plan");}}>
              رجوع للتعديل
            </Button>}
          </div>
        </>}
      </section>
    </div>}
    {cancelOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-label="إلغاء الأوردر" className="w-full max-w-md space-y-4 rounded-lg bg-card p-6">
        <h2 className="font-bold">سبب الإلغاء</h2>
        <textarea aria-label="سبب إلغاء الأوردر" className={fieldClass + " min-h-24 py-2"} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={actions.cancel.isPending} onClick={() => setCancelOpen(false)}>رجوع</Button>
          <Button disabled={actions.cancel.isPending} variant="destructive" onClick={() => void cancel()}>إلغاء الأوردر</Button></div>
      </section>
    </div>}
  </div>;
}
