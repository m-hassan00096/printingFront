import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ConfirmDialog, ErrorState, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { fetchOrderFile } from "../api/orders.api";
import { useOrder, useOrderActions, useOrderFiles, useOrderActivities } from "../hooks/use-orders";
import type { Order, OrderItem, OrderItemPayload } from "../types/orders.types";

const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;
function ItemEditor({ order, item, onClose }: { order: Order; item?: OrderItem; onClose: () => void }) {
  const actions = useOrderActions();
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [agreedTotal, setAgreedTotal] = useState(item?.agreedTotal ?? "");
  const [specifications, setSpecifications] = useState(item?.specifications ?? "");
  const [serviceId, setServiceId] = useState(item?.serviceId ? String(item.serviceId) : "");
  const [error, setError] = useState("");
  const busy = actions.addItem.isPending || actions.editItem.isPending;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 1000000 || !moneyPattern.test(agreedTotal) || !serviceId) {
      setError("حدد الخدمة والكمية وإجمالي السعر بصورة صحيحة.");return;
    }
    try {
      const payload: OrderItemPayload = { serviceId: Number(serviceId), quantity: Number(quantity),
        agreedTotal, specifications: specifications.trim() || null };
      if (item) {
        const edited: Partial<OrderItemPayload> = {};
        if (payload.quantity !== item.quantity) edited.quantity = payload.quantity;
        if (payload.agreedTotal !== item.agreedTotal) edited.agreedTotal = payload.agreedTotal;
        if (payload.specifications !== item.specifications) edited.specifications = payload.specifications;
        if (!Object.keys(edited).length) {onClose();return;}
        await actions.editItem.mutateAsync({ id: order.id, itemId: item.id, payload: edited });
      } else await actions.addItem.mutateAsync({ id: order.id, payload });
      toast.success("تم حفظ العنصر.");onClose();
    } catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر حفظ العنصر."));}
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <section role="dialog" aria-modal="true" aria-label={item ? "تعديل عنصر" : "إضافة عنصر"}
      className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
      <h2 className="mb-4 text-lg font-bold">{item ? "تعديل عنصر" : "إضافة عنصر"}</h2>
      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <label className="block text-sm font-semibold">معرّف خدمة الطباعة *
          <input aria-label="معرّف خدمة الطباعة" type="number" min="1" className={fieldClass + " mt-2"}
            value={serviceId} disabled={!!item || busy} onChange={(e) => setServiceId(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">الكمية *
          <input aria-label="كمية العنصر" type="number" min="1" className={fieldClass + " mt-2"} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">إجمالي السعر المتفق عليه *
          <input aria-label="إجمالي السعر" className={fieldClass + " mt-2"} dir="ltr" value={agreedTotal} onChange={(e) => setAgreedTotal(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">المواصفات
          <textarea aria-label="مواصفات العنصر" className={fieldClass + " mt-2 min-h-20 py-2"} value={specifications} onChange={(e) => setSpecifications(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>حفظ</Button></div>
      </form>
    </section>
  </div>;
}

function ItemFiles({ orderId, item, canList, canUpload, canDelete, canView }: {
  orderId: number;item: OrderItem;canList: boolean;canUpload: boolean;canDelete: boolean;canView: boolean;
}) {
  const files = useOrderFiles(orderId, item.id, canList);
  const actions = useOrderActions();
  const [error, setError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    try { await actions.upload.mutateAsync({ id: orderId, itemId: item.id, file });toast.success("تم رفع الملف."); }
    catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر رفع الملف."));}
  }
  async function download(fileId: number, name: string) {
    try {
      const blob = await fetchOrderFile(orderId, item.id, fileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;link.download = name;document.body.appendChild(link);link.click();link.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر تحميل الملف."));}
  }
  async function remove(fileId: number) {
    try {await actions.deleteFile.mutateAsync({ id: orderId, itemId: item.id, fileId });toast.success("تم نقل الملف للأرشيف.");}
    catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر حذف الملف."));}
  }
  return <div className="mt-3 space-y-2 border-t pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-xs font-semibold"><Paperclip className="size-4" /> الملفات</h4>
      {canUpload && <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-primary">
        <Upload className="size-4" /> رفع ملف
        <input aria-label={`رفع ملف للعنصر ${item.id}`} type="file" className="sr-only" disabled={actions.upload.isPending}
          onChange={(e) => {void upload(e.target.files?.[0]);e.target.value = "";}} />
      </label>}
    </div>
    {canList && (files.isPending ? <p className="text-xs text-muted-foreground">جاري تحميل الملفات...</p>
      : files.isError ? <button type="button" onClick={() => void files.refetch()} className="text-xs text-destructive underline">تعذّر تحميل الملفات — إعادة المحاولة</button>
      : (files.data?.length ? files.data.map((file) => <div key={file.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-xs">
        <span className="break-all">{file.name} ({(file.sizeBytes / 1024).toFixed(0)} KB)</span>
        <div className="flex gap-2">
          {canView && <button type="button" className="font-semibold text-primary underline" onClick={() => void download(file.id, file.name)}>تحميل</button>}
          {canDelete && <button type="button" className="font-semibold text-destructive underline"
            disabled={actions.deleteFile.isPending} onClick={() => void remove(file.id)}>حذف</button>}
        </div>
      </div>) : <p className="text-xs text-muted-foreground">لا توجد ملفات.</p>))}
    {!canList && <p className="text-xs text-muted-foreground">لا توجد صلاحية لعرض الملفات.</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

export function OrderDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data: session } = useCurrentUser();
  const perms = session?.permissions ?? [];
  const order = useOrder(valid ? id : 0);
  const actions = useOrderActions();
  const [editItem, setEditItem] = useState<OrderItem | "new" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deposit, setDeposit] = useState("0");
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<OrderItem | null>(null);
  const [error, setError] = useState("");
  const confirmKey = useRef(crypto.randomUUID());
  const cancelKey = useRef(crypto.randomUUID());
  const showActivities = perms.includes("orders.activities.view");
  const activities = useOrderActivities(valid ? id : 0, showActivities);
  const mayEdit = perms.includes("orders.update");
  const mayConfirm = perms.includes("orders.confirm");
  const mayCancel = perms.includes("orders.cancel");
  async function confirm() {
    if (!order.data || !moneyPattern.test(deposit)) {setError("أدخل مبلغًا صحيحًا.");return;}
    try {
      // Cash deposit; non-cash destinations require an active account selection.
      await actions.confirm.mutateAsync({ id, key: confirmKey.current, payload: deposit === "0" || Number(deposit) === 0 ? {} : { depositAmount: deposit, paymentMethod: 0 } });
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
        {draft && mayConfirm && <Button onClick={() => {setError("");setConfirmOpen(true);}}><CheckCircle2 className="size-4" /> تأكيد الأوردر</Button>}
        {item.status === 1 && item.deliveredAt === null && mayCancel && <Button variant="outline" onClick={() => {setError("");setCancelOpen(true);}}>إلغاء الأوردر</Button>}
      </div>
    </header>
    <section className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-3">
      <div><p className="text-xs text-muted-foreground">الإجمالي</p><p className="mt-2 text-xl font-extrabold">{item.totalAmount} ج.م</p></div>
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
              <p className="mt-1 text-xs text-muted-foreground">الكمية: {line.quantity} — الوحدة: {line.unitPrice} ج.م</p>
              {line.specifications && <p className="mt-2 whitespace-pre-wrap text-sm">{line.specifications}</p>}
            </div>
            <div className="flex items-center gap-2"><strong>{line.agreedTotal} ج.م</strong>
              {draft && perms.includes("orders.items.update") && <Button type="button" variant="ghost" size="icon-sm" aria-label={`تعديل العنصر ${line.id}`} onClick={() => setEditItem(line)}><Pencil /></Button>}
              {draft && perms.includes("orders.items.delete") && <Button type="button" variant="ghost" size="icon-sm" aria-label={`حذف العنصر ${line.id}`} onClick={() => setDeleteItem(line)}><Trash2 className="text-destructive" /></Button>}
            </div>
          </div>
          <ItemFiles orderId={id} item={line}
            canList={perms.includes("orders.files.list")} canUpload={perms.includes("orders.files.upload")}
            canView={perms.includes("orders.files.view")} canDelete={perms.includes("orders.files.delete")} />
        </article>)}
      </div>
    </section>
    {showActivities && <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 font-bold">سجل النشاط</h2>
      {activities.isPending ? <p className="text-xs">جاري تحميل النشاط...</p> : activities.isError ?
        <p role="alert" className="text-xs text-destructive">تعذّر تحميل النشاط.</p> :
        activities.data?.length ? <ul className="space-y-2 text-xs">{activities.data.map((a) =>
          <li key={a.id} className="border-b py-2">{a.eventType} — {a.createdAt}</li>)}</ul> :
        <p className="text-xs text-muted-foreground">لا توجد أنشطة.</p>}
    </section>}
    {editItem && <ItemEditor key={editItem === "new" ? "new" : editItem.id} order={item}
      item={editItem === "new" ? undefined : editItem} onClose={() => setEditItem(null)} />}
    {deleteItem && <ConfirmDialog title="حذف عنصر" description="سيُحذف العنصر من المسودة وستُؤرشف ملفاته. لا يمكن حذف آخر عنصر."
      confirmText="حذف العنصر" destructive busy={actions.removeItem.isPending}
      onClose={() => setDeleteItem(null)} onConfirm={() => void removeItem()} />}
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-label="تأكيد الأوردر" className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6">
        <h2 className="font-bold">تأكيد الأوردر</h2>
        <p className="text-sm text-muted-foreground">سيُثبت إجمالي الأوردر على حساب العميل ويُنشأ رقم الأوردر. يمكن تسجيل عربون نقدي الآن.</p>
        <label className="block text-sm font-semibold">عربون نقدي (ج.م)
          <input aria-label="عربون نقدي" dir="ltr" className={fieldClass + " mt-2"} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
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
    {mayEdit && draft && <p className="text-xs text-muted-foreground">تعديل بيانات رأس الأوردر متاح ضمن العمليات التالية للـ Draft، بينما تفاصيل العناصر محفوظة حسب كل عنصر.</p>}
  </div>;
}
