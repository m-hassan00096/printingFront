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
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { useOrderActions, useOrders } from "../hooks/use-orders";
import { CreatedDatePicker } from "../components/created-date-picker";
import type { Order, OrderFilters } from "../types/orders.types";

function pageOf(raw: string | null): number {
  const result = Number(raw);
  return Number.isSafeInteger(result) && result > 0 ? result : 1;
}
function formatCreatedAt(value: string | null): { date: string; time: string } | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Cairo",
  }).formatToParts(parsed);
  const timeParts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Cairo",
  }).formatToParts(parsed);
  const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const date = `${part(dateParts, "day")} / ${part(dateParts, "month")} / ${part(dateParts, "year")}`;
  const suffix = part(timeParts, "dayPeriod") === "PM"
    ? uiMessages.orders.eveningAbbreviation : uiMessages.orders.morningAbbreviation;
  const time = `${part(timeParts, "hour")}:${part(timeParts, "minute")} ${suffix}`;
  return { date, time };
}
const productionStyles: Record<number, string> = {
  0: "border-slate-200 bg-slate-100 text-slate-700",
  1: "border-indigo-100 bg-indigo-50 text-indigo-700",
  2: "border-amber-100 bg-amber-50 text-amber-700",
  3: "border-emerald-200 bg-emerald-100 text-emerald-800",
  4: "border-teal-100 bg-teal-50 text-teal-700",
};
function ProductionBadge({ order }: { order: Pick<Order, "status" | "productionStatus" | "productionStatusLabel"> }) {
  if (order.productionStatus === null) return <span className="text-muted-foreground">—</span>;
  const archived = order.status === 2;
  return <div className="flex flex-col items-start gap-1">
    <Badge variant="outline" className={productionStyles[order.productionStatus] ?? productionStyles[0]}>
      {order.productionStatusLabel ?? "—"}
    </Badge>
    {archived && <span className="text-[11px] text-muted-foreground">{uiMessages.orders.lastProductionStage}</span>}
  </div>;
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
    lateOnly: params.get("lateOnly") === "1", readyDueToday: params.get("readyDueToday") === "1", createdFrom: params.get("createdFrom") ?? "", createdTo: params.get("createdTo") ?? "", sort: params.get("sort") ?? "-id", page: pageOf(params.get("page")),
  };
  const hasActiveFilters = Boolean(
    draftSearch.trim() || filters.search || filters.status || filters.productionStatus ||
    filters.lateOnly || filters.readyDueToday || filters.createdFrom || filters.createdTo ||
    filters.sort !== "-id" || params.has("openOnly")
  );
  function clearFilters() {
    setDraftSearch("");
    setParams(new URLSearchParams(), { replace: true });
  }
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
      // Operational quick filters represent distinct queues, never mix their counts.
      if (name === "lateOnly" && value) next.delete("readyDueToday");
      if (name === "readyDueToday" && value) next.delete("lateOnly");
      // Remove obsolete dashboard URL parameter when any filter changes.
      next.delete("openOnly");
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
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-semibold">
            <input type="checkbox" aria-label={uiMessages.orders.readyDueTodayFilter} checked={filters.readyDueToday}
              onChange={(e) => setFilter("readyDueToday", e.target.checked ? "1" : "")} />
            {uiMessages.orders.readyDueTodayFilter}
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-[#e8eaf2] bg-[#fbfcff] px-4 py-3 xl:px-5">
        <div className="flex h-9 shrink-0 items-center gap-2 text-xs font-semibold text-[#4c5975]">
          <CalendarDays className="size-4 text-primary" />
          {uiMessages.orders.createdDateFilter}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[160px_160px]">
          <CreatedDatePicker label={uiMessages.orders.createdFrom} value={filters.createdFrom} max={filters.createdTo || undefined}
            onChange={(value) => setFilter("createdFrom", value)} />
          <CreatedDatePicker label={uiMessages.orders.createdTo} value={filters.createdTo} min={filters.createdFrom || undefined}
            onChange={(value) => setFilter("createdTo", value)} />
        </div>
        <Button type="button" variant="ghost" size="sm" className="ms-auto"
          disabled={!hasActiveFilters} onClick={clearFilters}>
          {uiMessages.orders.clearAllFilters}
        </Button>
        {filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo &&
          <p role="alert" className="text-xs text-destructive">{uiMessages.orders.invalidCreatedRange}</p>}
      </div>
      {orders.isPending ? <LoadingState /> : orders.isError ?
        <ErrorState error={orders.error} retry={() => void orders.refetch()} /> :
        orders.data.orders.length === 0 ? <EmptyState title="لا توجد أوردرات" detail="أضف أوردر جديد أو غيّر الفلاتر." /> :
        <>
          <div className="overflow-x-auto"><table className="w-full min-w-[1140px] text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              {["الأوردر", "العميل", "الهاتف", "الإجمالي", "الحالة", "الإنتاج", uiMessages.orders.createdAtColumn, uiMessages.orders.dueDateColumn, "الإجراءات"].map((label) =>
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
              <td className="px-4 py-3"><ProductionBadge order={order} /></td>
              <td className="px-4 py-3">
                {formatCreatedAt(order.createdAt) ? <div className="flex flex-col items-start gap-0.5">
                  <span dir="ltr" className="whitespace-nowrap tabular-nums font-medium">{formatCreatedAt(order.createdAt)?.date}</span>
                  <span dir="ltr" className="text-[11px] text-muted-foreground tabular-nums">{formatCreatedAt(order.createdAt)?.time}</span>
                </div> : <span className="text-muted-foreground">—</span>}
              </td>
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
