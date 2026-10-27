import { useEffect, useState } from "react";
import { ClipboardList, Eye, Plus, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { useOrderActions, useOrders } from "../hooks/use-orders";
import type { Order, OrderFilters } from "../types/orders.types";

function pageOf(raw: string | null): number {
  const result = Number(raw);
  return Number.isSafeInteger(result) && result > 0 ? result : 1;
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
      <div className="flex flex-wrap items-center gap-3 border-b bg-white p-5">
        <SearchField value={draftSearch} onChange={setDraftSearch} placeholder="رقم الأوردر، العميل أو الهاتف" />
        <label className="text-xs font-bold">الحالة
          <select aria-label="حالة الأوردر" className={fieldClass + " mt-1 w-32"} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">الكل</option><option value="0">مسودة</option><option value="1">مؤكد</option><option value="2">ملغي</option>
          </select>
        </label>
        <label className="text-xs font-bold">الإنتاج
          <select aria-label="حالة الإنتاج" className={fieldClass + " mt-1 w-44"} value={filters.productionStatus} onChange={(e) => setFilter("productionStatus", e.target.value)}>
            <option value="">كل المراحل</option><option value="0">لم يبدأ</option><option value="1">في الإنتاج</option>
            <option value="2">جاهز جزئيًا</option><option value="3">جاهز للتسليم</option><option value="4">تم التسليم</option>
          </select>
        </label>
        <label className="text-xs font-bold">الترتيب
          <select aria-label="ترتيب الأوردرات" className={fieldClass + " mt-1 w-36"} value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="-id">الأحدث</option><option value="id">الأقدم</option>
            <option value="due_date">موعد التسليم الأقرب</option><option value="-due_date">الأبعد</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={filters.lateOnly} onChange={(e) => setFilter("lateOnly", e.target.checked ? "1" : "")} />
          المتأخرة فقط
        </label>
        {filters.lateOnly && <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" aria-label="لم يتم تسليمها" checked={filters.openOnly}
            onChange={(e) => setFilter("openOnly", e.target.checked ? "1" : "")} />
          لم يتم تسليمها (المتأخرة حاليًا)
        </label>}
      </div>
      {orders.isPending ? <LoadingState /> : orders.isError ?
        <ErrorState error={orders.error} retry={() => void orders.refetch()} /> :
        orders.data.orders.length === 0 ? <EmptyState title="لا توجد أوردرات" detail="أضف أوردر جديد أو غيّر الفلاتر." /> :
        <>
          <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              {["الأوردر", "العميل", "الهاتف", "الإجمالي", "الحالة", "الإنتاج", "التسليم", "الإجراءات"].map((label) =>
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
              <td className="px-4 py-3">{order.statusLabel}</td>
              <td className="px-4 py-3">{order.productionStatusLabel ?? "—"}{order.delayStatusLabel && <p className="text-xs text-destructive">{order.delayStatusLabel}</p>}</td>
              <td className="px-4 py-3">{order.dueDate ?? "—"}</td>
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
