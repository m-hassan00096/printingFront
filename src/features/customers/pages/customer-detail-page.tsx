import { useState } from "react";
import { ArrowRight, Pencil, Wallet, FileClock, ClipboardList } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ErrorState, IdentityStatus, LoadingState, PaginationBar, SectionHeader } from "@/features/identity/components/identity-ui";
import { CustomerFormModal } from "../components/customer-form-modal";
import { useCustomer, useCustomerBalance, useCustomerLedger } from "../hooks/use-customers";
import type { LedgerFilters } from "../types/customers.types";

function DetailsItem({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div><dt className="mb-2 text-xs font-semibold text-muted-foreground">{label}</dt>
    <dd className="break-words text-sm font-bold" dir={ltr ? "ltr" : undefined}>{value}</dd></div>;
}

export function CustomerDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data: session } = useCurrentUser();
  const mayEdit = session?.permissions.includes("customers.update") ?? false;
  const mayBalance = session?.permissions.includes("finance.balances.view") ?? false;
  const mayLedger = session?.permissions.includes("finance.ledger.view") ?? false;
  const customer = useCustomer(valid ? id : 0);
  const balance = useCustomerBalance(valid ? id : 0, mayBalance);
  const [filters, setFilters] = useState<LedgerFilters>({ page: 1, dateFrom: "", dateTo: "" });
  const ledger = useCustomerLedger(valid ? id : 0, filters, mayLedger);
  const [editing, setEditing] = useState(false);

  if (!valid) return <div role="alert" className="rounded-xl border p-6">معرّف العميل غير صحيح.</div>;
  if (customer.isPending) return <LoadingState />;
  if (customer.isError) return <ErrorState error={customer.error} retry={() => void customer.refetch()} />;
  const value = customer.data;

  return <div className="space-y-6">
    <Button asChild variant="ghost"><Link to="/customers"><ArrowRight /> العودة للعملاء</Link></Button>
    <SectionHeader title="تفاصيل العميل" detail="بيانات العميل الأساسية والعمليات المالية المرتبطة به."
      actions={mayEdit && <Button onClick={() => setEditing(true)}><Pencil /> تعديل العميل</Button>} />
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <h3 className="text-lg font-extrabold">{value.name}</h3>
        <IdentityStatus status={value.status} label={value.statusLabel} />
      </div>
      <dl className="grid gap-5 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <DetailsItem label="اسم العميل" value={value.name} />
        <DetailsItem label="رقم الهاتف" value={value.phone} ltr />
        <DetailsItem label="نوع العميل" value={value.customerType?.name ?? "—"} />
        <DetailsItem label="العنوان" value={value.address || "—"} />
      </dl>
    </section>
    {mayBalance && <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="mb-4 flex items-center gap-3"><Wallet className="size-5 text-primary" /><h3 className="text-lg font-extrabold">رصيد العميل</h3></div>
      {balance.isPending ? <LoadingState /> : balance.isError ? <ErrorState error={balance.error} retry={() => void balance.refetch()} /> :
        <div className="flex flex-wrap items-end gap-3">
          <strong className="text-3xl font-extrabold tabular-nums">{balance.data.amount} ج.م</strong>
          <span className="text-sm font-semibold text-muted-foreground">
            {balance.data.type === 1 ? "مديونية على العميل" : balance.data.type === 2 ? "رصيد دائن للعميل" : balance.data.typeLabel}
          </span>
        </div>}
      <p className="mt-3 text-xs text-muted-foreground">الرصيد محسوب من دفتر الأستاذ في النظام المالي.</p>
    </section>}
    {mayLedger && <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
        <div className="flex items-center gap-3"><FileClock className="size-5 text-primary" /><h3 className="text-lg font-extrabold">كشف الحساب</h3></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold">من
            <input aria-label="من تاريخ" type="date" value={filters.dateFrom} className="h-10 rounded-lg border bg-card px-3"
              onChange={(e) => setFilters((old) => ({ ...old, dateFrom: e.target.value, page: 1 }))} />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold">إلى
            <input aria-label="إلى تاريخ" type="date" value={filters.dateTo} className="h-10 rounded-lg border bg-card px-3"
              onChange={(e) => setFilters((old) => ({ ...old, dateTo: e.target.value, page: 1 }))} />
          </label>
        </div>
      </div>
      {ledger.isPending ? <LoadingState /> : ledger.isError ? <ErrorState error={ledger.error} retry={() => void ledger.refetch()} /> :
      ledger.data.entries.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات مالية للفترة المحددة.</p> :
      <>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
            {["التاريخ", "نوع الحركة", "المبلغ", "التأثير على الرصيد", "ملاحظات"].map((h) =>
              <th scope="col" key={h} className="px-4 py-3 font-bold">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y">
            {ledger.data.entries.map((entry) => <tr key={entry.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 tabular-nums">{entry.effectiveDate}</td>
              <td className="px-4 py-3 font-semibold">{entry.typeLabel}</td>
              <td className="px-4 py-3 tabular-nums">{entry.amount} ج.م</td>
              <td dir="ltr" className="px-4 py-3 text-right tabular-nums">{entry.signedAmount}</td>
              <td className="px-4 py-3 text-muted-foreground">{entry.note || "—"}</td>
            </tr>)}
          </tbody>
        </table></div>
        <PaginationBar pagination={ledger.data.pagination} onPage={(page) => setFilters((old) => ({ ...old, page }))} />
      </>}
    </section>}
    <section className="flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
      <ClipboardList className="size-5 shrink-0" />
      <span>طلبات العميل هتظهر هنا بعد ربط موديول Orders.</span>
    </section>
    {editing && <CustomerFormModal key={value.id} customer={value} onClose={() => setEditing(false)} />}
  </div>;
}
