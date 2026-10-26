import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderPaymentOptions } from "../api/order-options.api";
import { getCustomer } from "@/features/customers/api/customers.api";
import { CustomerFormModal } from "@/features/customers/components/customer-form-modal";
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
  const qc = useQueryClient();
  const [customerModal, setCustomerModal] = useState(false);
  const [editItem, setEditItem] = useState<OrderItem | "new" | null>(null);
  const [editHeader, setEditHeader] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deposit, setDeposit] = useState("0");
  const [overpaymentAcknowledged, setOverpaymentAcknowledged] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"0" | "1" | "2">("0");
  const [paymentDestinationId, setPaymentDestinationId] = useState("");
  const destinations = useQuery({
    queryKey: ["orders", "payment-destinations"],
    queryFn: getOrderPaymentOptions,
    enabled: confirmOpen && Number(deposit) > 0 && paymentMethod !== "0",
  });
  const activeDestinations = paymentMethod === "1" ? destinations.data?.banks ?? [] : destinations.data?.wallets ?? [];
  const defaultDestination = activeDestinations.find((option) => Number(option.isDefault) === 1) ?? activeDestinations[0];
  const chosenDestination = paymentDestinationId || (defaultDestination ? String(defaultDestination.value) : "");
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<OrderItem | null>(null);
  const [error, setError] = useState("");
  const confirmKey = useRef(crypto.randomUUID());
  const cancelKey = useRef(crypto.randomUUID());
  const showActivities = perms.includes("orders.activities.view");
  const canEditCustomer = perms.includes("customers.update") && perms.includes("customers.view");
  const currentCustomer = useQuery({
    queryKey: ["orders", "customer-to-edit", order.data?.customerId],
    queryFn: () => getCustomer(order.data!.customerId),
    enabled: customerModal && canEditCustomer && !!order.data?.customerId,
  });
  const mayEdit = perms.includes("orders.update");
  const mayConfirm = perms.includes("orders.confirm");
  const mayCancel = perms.includes("orders.cancel");
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
      toast.success("تم تأكيد الأوردر.");setConfirmOpen(false);setError("");
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
        {canEditCustomer && <Button variant="outline" onClick={() => setCustomerModal(true)}>
          <Pencil className="size-4" /> تعديل بيانات العميل
        </Button>}
        {draft && mayConfirm && <Button onClick={() => {setError("");setConfirmOpen(true);}}><CheckCircle2 className="size-4" /> تأكيد الأوردر</Button>}
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
    <OrderActivityTimeline orderId={id} enabled={showActivities} />
    {editHeader && <OrderHeaderEditor order={item} canCreateCustomer={perms.includes("customers.create")}
      onClose={() => setEditHeader(false)} />}
    {editItem && <OrderItemEditor key={editItem === "new" ? "new" : editItem.id} order={item}
      item={editItem === "new" ? undefined : editItem} canPricePreview={perms.includes("printing_services.price_preview.view")}
      onClose={() => setEditItem(null)} />}
    {customerModal && (currentCustomer.isPending ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div role="status" className="rounded-2xl bg-card p-6 text-sm">جاري تحميل بيانات العميل...</div>
    </div> : currentCustomer.isError ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="space-y-3 rounded-2xl bg-card p-6"><p role="alert">تعذّر تحميل بيانات العميل.</p>
        <Button variant="outline" onClick={() => setCustomerModal(false)}>إغلاق</Button>
        <Button onClick={() => void currentCustomer.refetch()}>إعادة المحاولة</Button>
      </div>
    </div> : <CustomerFormModal customer={currentCustomer.data}
      onClose={() => setCustomerModal(false)} onSaved={() => {
        void qc.invalidateQueries({queryKey:orderKeys.detail(id)});
        void qc.invalidateQueries({queryKey:orderKeys.list});
        void qc.invalidateQueries({queryKey:["orders","customer-to-edit",item.customerId]});
      }} />)}
    {deleteItem && <ConfirmDialog title="حذف عنصر" description="سيُحذف العنصر من المسودة وستُؤرشف ملفاته. لا يمكن حذف آخر عنصر."
      confirmText="حذف العنصر" destructive busy={actions.removeItem.isPending}
      onClose={() => setDeleteItem(null)} onConfirm={() => void removeItem()} />}
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-label="تأكيد الأوردر" className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6">
        <h2 className="font-bold">تأكيد الأوردر</h2>
        <p className="text-sm text-muted-foreground">سيُثبت إجمالي الأوردر على حساب العميل ويُنشأ رقم الأوردر. يمكن تسجيل العربون الآن.</p>
        <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
          <div className="flex justify-between"><span>إجمالي الأوردر</span><strong>{displayMoney(item.totalAmount)} ج.م</strong></div>
          <div className="flex justify-between"><span>العربون</span><strong>{moneyPattern.test(deposit) ? displayMoney(deposit) + " ج.م" : "—"}</strong></div>
          <div className="flex justify-between"><span>المتبقي</span><strong>{moneyPattern.test(deposit) ?
            displayMoney(String(Math.max(0, Number(item.totalAmount) - Number(deposit)).toFixed(2))) + " ج.م" : "—"}</strong></div>
        </div>
        {item.items?.every((line) => (line.files?.length ?? 0) === 0) && perms.includes("orders.files.list") &&
          <p className="text-xs text-amber-700">لا توجد ملفات تصميم مرفوعة. تأكد أن الأوردر لا يحتاج ملفات قبل التأكيد.</p>}
        <label className="block text-sm font-semibold">قيمة العربون (ج.م)
          <input aria-label="قيمة العربون" dir="ltr" className={fieldClass + " mt-2"}
            value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
        {Number(deposit) > Number(item.totalAmount) && <label className="flex items-start gap-2 rounded-xl border border-amber-300 p-3 text-xs">
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
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={actions.confirm.isPending} onClick={() => setConfirmOpen(false)}>رجوع</Button>
          <Button disabled={actions.confirm.isPending} onClick={() => void confirm()}>تأكيد</Button></div>
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
