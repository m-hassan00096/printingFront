import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Eye, Plus, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { uiMessages } from "@/shared/translations/ar/ui";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { formatCollectionDate } from "@/features/collections/components/collection-date-field";
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { useOrderActions, useOrders } from "../hooks/use-orders";
import type { Order, OrderFilters } from "../types/orders.types";

function pageOf(raw: string | null): number {
  const result = Number(raw);
  return Number.isSafeInteger(result) && result > 0 ? result : 1;
}
function OrderStatusBadge({ order }: { order: Pick<Order, "status" | "statusLabel"> }) {
  const variant = order.status === 0 ? "outline" : order.status === 1 ? "default" : "destructive";
  return (
    <Badge variant={variant} className={order.status === 0 ? "border-slate-200 bg-slate-100 text-slate-700" : undefined}>
      {order.statusLabel}
    </Badge>
  );
}

export function OrdersPage() {
  const { data: session } = useCurrentUser();
  const perms = session?.permissions ?? [];
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const [draftSearch, setDraftSearch] = useState(search);
  const filters: OrderFilters = {
    search, status: params.get("status") ?? "", productionStatus: params.get("productionStatus") ?? "",
    lateOnly: params.get("lateOnly") === "1", openOnly: params.get("openOnly") === "1", sort: params.get("sort") ?? "-id", page: pageOf(params.get("page")),
  };
  const orders = useOrders(filters);
  const actions = useOrderActions();
  const [deleting, setDeleting] = useState<Order | null>(null);
  useEffect(() => setDraftSearch(search), [search]);
  useEffect(() => {
    if (search === draftSearch) return;
    const timer = window.setTimeout(() => setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (draftSearch.trim()) next.set("search", draftSearch.trim()); else next.delete("search");
      next.delete("page"); return next;
    }), 350);
    return () => window.clearTimeout(timer);
  }, [search, draftSearch, setParams]);
  function setFilter(name: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value); else next.delete(name);
      // Open-only is meaningful as a refinement of the late-order filter here.
      if (name === "lateOnly" && !value) next.delete("openOnly");
      if (name !== "page") next.delete("page");
      return next;
    });
  }
  async function deleteDraft() {
    if (!deleting) return;
    try {
      await actions.remove.mutateAsync(deleting.id);
      toast.success("تم حذف المسودة.");
      setDeleting(null);
    } catch (e: unknown) { toast.error(getApiErrorMessage(e, "تعذّر حذف المسودة.")); }
  }
  return <div className="space-y-6">
    <SectionHeader title="الأوردرات" detail="متابعة الطلبات والعملاء ومراحل الإنتاج والتسليم."
      actions={perms.includes("orders.create") && <Button asChild><Link to="/orders/new"><Plus /> إضافة أوردر</Link></Button>} />
    <section className="overflow-hidden rounded-xl border border-[#e8eaf2] bg-white shadow-[0_6px_20px_#26396b08]">
      <div role="group" aria-label={uiMessages.orders.filtersLabel}
        className="grid grid-cols-1 gap-3 border-b bg-white p-4 sm:grid-cols-2 xl:flex xl:flex-nowrap xl:items-end xl:gap-3 xl:p-5">
        <div className="min-w-0 sm:col-span-2 xl:min-w-[200px] xl:flex-1 [&>label]:max-w-none">
          <SearchField value={draftSearch} onChange={setDraftSearch} placeholder="رقم الأوردر، العميل أو الهاتف" />
        </div>
        <label className="min-w-0 text-xs font-semibold xl:w-28 xl:shrink-0">
          الحالة
          <select aria-label="حالة الأوردر" className={fieldClass + " mt-1 w-full"} value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">الكل</option><option value="0">مسودة</option><option value="1">مؤكد</option><option value="2">ملغي</option>
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold xl:w-40 xl:shrink-0">
          الإنتاج
          <select aria-label="حالة الإنتاج" className={fieldClass + " mt-1 w-full"} value={filters.productionStatus}
            onChange={(e) => setFilter("productionStatus", e.target.value)}>
            <option value="">كل المراحل</option><option value="0">لم يبدأ</option><option value="1">في الإنتاج</option>
            <option value="2">جاهز جزئيًا</option><option value="3">جاهز للتسليم</option><option value="4">تم التسليم</option>
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold xl:w-32 xl:shrink-0">
          الترتيب
          <select aria-label="ترتيب الأوردرات" className={fieldClass + " mt-1 w-full"} value={filters.sort}
            onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="-id">الأحدث</option><option value="id">الأقدم</option>
            <option value="due_date">موعد التسليم الأقرب</option><option value="-due_date">الأبعد</option>
          </select>
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:col-span-2 xl:min-h-9 xl:shrink-0 xl:flex-nowrap">
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-semibold">
            <input type="checkbox" checked={filters.lateOnly}
              onChange={(e) => setFilter("lateOnly", e.target.checked ? "1" : "")} />
            المتأخرة فقط
          </label>
          {filters.lateOnly && (
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-semibold">
              <input type="checkbox" aria-label="لم يتم تسليمها" checked={filters.openOnly}
                onChange={(e) => setFilter("openOnly", e.target.checked ? "1" : "")} />
              لم يتم تسليمها
            </label>
          )}
        </div>
      </div>
      {orders.isPending ? <LoadingState /> : orders.isError ?
        <ErrorState error={orders.error} retry={() => void orders.refetch()} /> :
        orders.data.orders.length === 0 ? <EmptyState title="لا توجد أوردرات" detail="أضف أوردر جديد أو غيّر الفلاتر." /> :
        <>
          <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              {["الأوردر", "العميل", "الهاتف", "الإجمالي", "الحالة", "الإنتاج", uiMessages.orders.dueDateColumn, "الإجراءات"].map((label) =>
                <th scope="col" key={label} className="px-4 py-3 font-semibold">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y">{orders.data.orders.map((order) => <tr key={order.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">{perms.includes("orders.view") ?
                <Link className="flex items-center gap-2 font-mono text-xs font-semibold text-primary hover:underline" to={`/orders/${order.id}`}>
                  <ClipboardList className="size-4 text-primary" /> {order.orderNumber ?? `مسودة #${order.id}`}
                </Link> :
                <span className="inline-flex items-center gap-2 font-mono text-xs font-medium"><ClipboardList className="size-4 text-primary" />
                  {order.orderNumber ?? `مسودة #${order.id}`}</span>}</td>
              <td className="px-4 py-3">{order.customerName}</td><td className="px-4 py-3 tabular-nums">{order.customerPhone}</td>
              <td className="px-4 py-3 font-semibold"><MoneyAmount amount={order.totalAmount} /></td>
              <td className="px-4 py-3"><OrderStatusBadge order={order} /></td>
              <td className="px-4 py-3">{order.productionStatusLabel ?? "—"}</td>
              <td className="px-4 py-3">
                {order.dueDate ? (
                  <div className="flex flex-col items-start gap-1">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span dir="ltr" className="tabular-nums">{formatCollectionDate(order.dueDate)}</span>
                    </span>
                    {order.delayStatus === 1 && order.delayStatusLabel && (
                      <span className="text-xs font-semibold text-destructive">{order.delayStatusLabel}</span>
                    )}
                  </div>
                ) : (
                  <span className="whitespace-nowrap text-muted-foreground">{uiMessages.orders.noDueDate}</span>
                )}
              </td>
              <td className="px-4 py-3"><div className="flex gap-1">
                {perms.includes("orders.view") && <Button variant="ghost" size="icon-sm" asChild><Link aria-label={`عرض أوردر ${order.orderNumber ?? order.id}`} to={`/orders/${order.id}`}><Eye /></Link></Button>}
                {order.status === 0 && perms.includes("orders.delete") && <Button type="button" variant="ghost" size="icon-sm" aria-label={`حذف مسودة ${order.id}`} onClick={() => setDeleting(order)}><Trash2 className="text-destructive" /></Button>}
              </div></td>
            </tr>)}</tbody></table></div>
          <PaginationBar pagination={orders.data.pagination} onPage={(page) => setFilter("page", String(page))} />
        </>}
    </section>
    {deleting && <ConfirmDialog title="حذف مسودة" description="سيتم حذف المسودة فقط. لا يمكن حذف أوردر مؤكد بهذه العملية."
      confirmText="حذف المسودة" destructive busy={actions.remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => void deleteDraft()} />}
  </div>;
}
