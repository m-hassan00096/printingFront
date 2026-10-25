import { useState } from "react";
import { ArrowRight, ClipboardList, FileClock, Pencil, Wallet } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ErrorState, IdentityStatus, LoadingState, PaginationBar } from "@/features/identity/components/identity-ui";
import { CustomerFormModal } from "../components/customer-form-modal";
import { useCustomer, useCustomerBalance, useCustomerLedger } from "../hooks/use-customers";
import type { LedgerFilters } from "../types/customers.types";

type CustomerTab = "details" | "ledger" | "orders";
const money = (value: string) => <span dir="ltr" className="inline-block tabular-nums">{value} ج.م</span>;

function CustomerField({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div className="min-w-0 rounded-xl bg-muted/50 px-4 py-2.5">
    <dt className="mb-2 text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="break-words text-sm font-bold" dir={ltr ? "ltr" : undefined}>{value}</dd>
  </div>;
}

function BalanceCard({ title, amount, tone = "default" }: {
  title: string; amount: string; tone?: "default" | "debit" | "credit";
}) {
  const toneClass = tone === "debit" ? "text-rose-600" : tone === "credit" ? "text-emerald-600" : "text-foreground";
  return <div className="rounded-2xl border bg-card px-5 py-5 shadow-sm">
    <p className="mb-3 text-xs font-semibold text-muted-foreground">{title}</p>
    <p className={`text-2xl font-extrabold sm:text-3xl ${toneClass}`}>{money(amount)}</p>
  </div>;
}

export function CustomerDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const mayEdit = permissions.includes("customers.update");
  const mayBalance = permissions.includes("finance.balances.view");
  const mayLedger = permissions.includes("finance.ledger.view");
  const mayOrders = permissions.includes("orders.list");
  const customer = useCustomer(valid ? id : 0);
  const balance = useCustomerBalance(valid ? id : 0, mayBalance);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: CustomerTab = requestedTab === "ledger" && mayLedger ? "ledger"
    : requestedTab === "orders" && mayOrders ? "orders" : "details";
  const [filters, setFilters] = useState<LedgerFilters>({ page: 1, dateFrom: "", dateTo: "" });
  // Do not request the ledger until the user opens its tab and has permission.
  const ledger = useCustomerLedger(valid ? id : 0, filters, activeTab === "ledger" && mayLedger);
  const [editing, setEditing] = useState(false);

  const tabs: Array<{ id: CustomerTab; label: string }> = [
    { id: "details", label: "بيانات العميل" },
    ...(mayLedger ? [{ id: "ledger" as const, label: "كشف الحساب" }] : []),
    ...(mayOrders ? [{ id: "orders" as const, label: "الأوردرات" }] : []),
  ];
  function openTab(tab: CustomerTab) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (tab === "details") next.delete("tab");
      else next.set("tab", tab);
      return next;
    });
  }

  if (!valid) return <div role="alert" className="rounded-xl border p-6">معرّف العميل غير صحيح.</div>;
  if (customer.isPending) return <LoadingState />;
  if (customer.isError) return <ErrorState error={customer.error} retry={() => void customer.refetch()} />;

  const value = customer.data;
  const currentDebt = balance.data?.type === 1 ? balance.data.amount : "0.00";
  const currentCredit = balance.data?.type === 2 ? balance.data.amount : "0.00";

  return <div className="space-y-6">
    <div>
      <Button asChild variant="link" className="px-0 text-sm"><Link to="/customers"><ArrowRight className="size-4" /> العودة للعملاء</Link></Button>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">إدارة الطباعة / العملاء</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{value.name}</h1>
          <div className="pt-1">
            <IdentityStatus status={value.status} label={value.statusLabel} />
          </div>
        </div>
        {mayEdit && <Button type="button" onClick={() => setEditing(true)}><Pencil className="size-4" /> تعديل العميل</Button>}
      </header>
    </div>

    {mayBalance && <section aria-label="ملخص الحساب" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Wallet className="size-4 text-primary" /> ملخص الحساب</h2>
        <p className="text-xs text-muted-foreground">القيم من الرصيد الفعلي في دفتر الأستاذ</p>
      </div>
      {balance.isPending ? <LoadingState /> : balance.isError ?
        <ErrorState error={balance.error} retry={() => void balance.refetch()} /> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BalanceCard title="الرصيد الحالي" amount={balance.data.amount} />
          <BalanceCard title="صافي المديونية الحالية" amount={currentDebt} tone="debit" />
          <BalanceCard title="الرصيد الدائن الحالي" amount={currentCredit} tone="credit" />
        </div>}
    </section>}

    <div className="space-y-4">
      <div role="tablist" aria-label="أقسام تفاصيل العميل"
        className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-muted/70 p-1">
        {tabs.map((tab) =>
          <button key={tab.id} type="button" role="tab" id={`customer-tab-${tab.id}`}
            aria-controls={`customer-panel-${tab.id}`} aria-selected={activeTab === tab.id}
            onClick={() => openTab(tab.id)}
            className={activeTab === tab.id
              ? "rounded-lg bg-card px-4 py-2.5 text-sm font-bold text-primary shadow-sm"
              : "rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"}>
            {tab.label}
          </button>)}
      </div>

      <section role="tabpanel" id={`customer-panel-${activeTab}`}
        aria-labelledby={`customer-tab-${activeTab}`} className="overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        {activeTab === "details" && <dl className="grid gap-2.5 sm:grid-cols-2">
          <CustomerField label="الاسم" value={value.name} />
          <CustomerField label="الهاتف" value={value.phone} ltr />
          <CustomerField label="نوع العميل" value={value.customerType?.name ?? "—"} />
          <CustomerField label="العنوان" value={value.address || "—"} />
        </dl>}

        {activeTab === "ledger" && mayLedger && <div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <h2 className="flex items-center gap-2 text-base font-bold"><FileClock className="size-5 text-primary" /> كشف حساب العميل</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold">من
                <input aria-label="من تاريخ" type="date" value={filters.dateFrom}
                  className="h-10 rounded-lg border bg-card px-3"
                  onChange={(event) => setFilters((old) => ({ ...old, dateFrom: event.target.value, page: 1 }))} />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">إلى
                <input aria-label="إلى تاريخ" type="date" value={filters.dateTo}
                  className="h-10 rounded-lg border bg-card px-3"
                  onChange={(event) => setFilters((old) => ({ ...old, dateTo: event.target.value, page: 1 }))} />
              </label>
            </div>
          </div>
          {ledger.isPending ? <LoadingState /> : ledger.isError ?
            <ErrorState error={ledger.error} retry={() => void ledger.refetch()} /> :
          ledger.data.entries.length === 0 ?
            <p className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات مالية للفترة المحددة.</p> :
          <>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
                {["التاريخ", "نوع الحركة", "المبلغ", "التأثير على الرصيد", "ملاحظات"].map((label) =>
                  <th scope="col" key={label} className="px-4 py-3 font-bold">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {ledger.data.entries.map((entry) => <tr key={entry.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums">{entry.effectiveDate}</td>
                  <td className="px-4 py-3 font-semibold">{entry.typeLabel}</td>
                  <td className="px-4 py-3 tabular-nums">{money(entry.amount)}</td>
                  <td className="px-4 py-3 tabular-nums"><span dir="ltr" className="inline-block">{entry.signedAmount}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.note || "—"}</td>
                </tr>)}
              </tbody>
            </table></div>
            <PaginationBar pagination={ledger.data.pagination}
              onPage={(page) => setFilters((old) => ({ ...old, page }))} />
          </>}
        </div>}

        {activeTab === "orders" && mayOrders && <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-2xl bg-muted p-4"><ClipboardList className="size-7 text-primary" /></div>
          <h2 className="font-bold">أوردرات العميل</h2>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground">
            سيتم عرض أوردرات العميل هنا بعد إضافة فلتر العميل وربط شاشة الأوردرات بالـ Backend.
          </p>
          <p className="text-xs text-muted-foreground">حاليًا لا توجد قائمة أوردرات مربوطة بهذه الصفحة.</p>
        </div>}
      </section>
    </div>
    {editing && <CustomerFormModal key={value.id} customer={value} onClose={() => setEditing(false)} />}
  </div>;
}
