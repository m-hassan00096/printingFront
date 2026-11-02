import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer, Plus, ArrowRight, Eye, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { ErrorState, LoadingState, EmptyState } from "@/features/identity/components/identity-ui";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { fetchSettlementRecords, fetchSettlementRecord } from "../api/settlement.api";
import { printSettlement } from "../lib/settlement-export";
import { exportSettlementXlsx } from "../lib/settlement-xlsx";
import { CreateSettlementDialog } from "./create-settlement-dialog";
import type { CustomerSettlement, SettlementRecord } from "../types/settlement.types";

const statusText = {
  settled: "تمت التسوية",
  partial: "جزئية",
  unpaid: "بدون تحصيل",
  credit: "رصيد دائن",
};

function cairoToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function StatementDetails({ record, canSeeReconciliation }: {
  record: SettlementRecord;
  canSeeReconciliation: boolean;
}) {
  const statement: CustomerSettlement = record.statement;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-bold">{record.number}</h3>
        <p className="text-sm text-muted-foreground">
          تشمل من {formatCollectionDate(record.dateFrom)} حتى {formatCollectionDate(record.dateTo)}
          {" "}· تاريخ التصفية {formatCollectionDate(record.settledOn)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => {
          if (!printSettlement(statement)) toast.error("اسمح للمتصفح بفتح نافذة الطباعة.");
        }}><Printer className="size-4"/> طباعة / PDF</Button>
        <Button variant="outline" size="sm" onClick={() => exportSettlementXlsx(statement)}>
          <FileSpreadsheet className="size-4"/> تصدير Excel
        </Button>
      </div>
    </div>

    {record.collectionReversed && <p role="status" className="rounded-lg border p-3 text-sm font-semibold text-destructive">
      تم عكس التحصيل المرتبط بهذه التصفية لاحقًا. الكشف التالي يوضح المبالغ المسجلة وقت حفظها، وليس الرصيد الحالي.
    </p>}

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {([
        ["رصيد سابق", statement.openingBalance],
        ["الشغل المستلم", statement.deliveredTotal],
        ["صافي المدفوعات", statement.paymentsTotal],
        ["المتبقي بعد التصفية", statement.closingBalance],
      ] as const).map(([label, amount]) => <div key={label} className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 text-base font-bold"><MoneyAmount amount={amount}/></div>
      </div>)}
    </div>

    <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-3">
      <div><span className="block text-xs text-muted-foreground">خصم هذه التصفية</span>
        <strong><MoneyAmount amount={record.discountAmount}/></strong></div>
      <div><span className="block text-xs text-muted-foreground">المبلغ المحصل</span>
        <strong><MoneyAmount amount={record.collectedAmount}/></strong></div>
      <div><span className="block text-xs text-muted-foreground">الرصيد قبل العملية</span>
        <strong><MoneyAmount amount={record.balanceBefore}/></strong></div>
      {record.discountReason && <p className="sm:col-span-3">سبب الخصم: {record.discountReason}</p>}
      {record.note && <p className="sm:col-span-3">ملاحظات: {record.note}</p>}
    </div>

    {statement.lines.length > 0 ? <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] text-right text-sm">
        <thead className="bg-muted/60 text-xs">
          <tr>{["التاريخ", "البيان", "المرجع", "الكمية", "سعر الوحدة", "مدين", "دائن", "الرصيد"]
            .map(label => <th key={label} className="px-3 py-3 font-bold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {statement.lines.map(line => {
            const isCredit = line.signedAmount.startsWith("-");
            return <tr key={line.key}>
              <td className="whitespace-nowrap px-3 py-2">{formatCollectionDate(line.date)}</td>
              <td className="max-w-[360px] px-3 py-2">{line.description}</td>
              <td className="whitespace-nowrap px-3 py-2">{line.orderNumber ?? line.receiptNumber ?? "—"}</td>
              <td className="px-3 py-2">{line.quantity ?? "—"}</td>
              <td className="px-3 py-2">
                {line.unitPrice ? <MoneyAmount amount={line.unitPrice} maximumFractionDigits={4}/> : "—"}
              </td>
              <td className="px-3 py-2">{isCredit ? "—" : <MoneyAmount amount={line.signedAmount}/>}</td>
              <td className="px-3 py-2">{isCredit ? <MoneyAmount amount={line.signedAmount.slice(1)}/> : "—"}</td>
              <td className="px-3 py-2 font-bold"><MoneyAmount amount={line.runningBalance}/></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <EmptyState title="لا توجد حركات" detail="لا توجد تسليمات أو تحصيلات خلال الفترة."/>}

    {canSeeReconciliation && <p className="text-xs text-muted-foreground">
      للمراجعة الداخلية فقط: رصيد Finance حتى نهاية الفترة قبل تسجيل التصفية
      {" "}<MoneyAmount amount={statement.financeBalanceAsOf}/>،
      والفرق عن كشف الشغل المستلم <MoneyAmount amount={statement.undeliveredDifference}/>.
    </p>}
  </div>;
}

export function CustomerSettlementPanel({ customerId }: { customerId: number }) {
  const permissions = useCurrentUser().data?.permissions ?? [];
  const canCreate = permissions.includes("finance.settlements.create");
  const canDiscount = permissions.includes("finance.settlements.discount");
  const canCollect = permissions.includes("finance.collections.create");
  const canSeeReconciliation = permissions.includes("finance.ledger.view");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const records = useQuery({
    queryKey: ["finance", "settlement-records", customerId, page],
    queryFn: () => fetchSettlementRecords(customerId, page),
    enabled: customerId > 0,
  });
  const detail = useQuery({
    queryKey: ["finance", "settlement-record", customerId, selectedId],
    queryFn: () => fetchSettlementRecord(customerId, selectedId!),
    enabled: selectedId !== null && customerId > 0,
  });
  const noNewPeriod = Boolean(records.data?.nextDateFrom &&
    records.data.nextDateFrom > cairoToday());

  return <section className="space-y-4 rounded-xl border bg-card p-4"
    aria-label="تصفية حساب العميل">
    {selectedId === null ? <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">سجل التصفيات</h2>
          <p className="text-xs text-muted-foreground">
            التصفيات المحفوظة للشغل المستلم فقط، مع الخصومات والتحصيلات الفعلية.
          </p>
        </div>
        {canCreate && <Button type="button" disabled={records.isPending || noNewPeriod}
          onClick={() => setCreating(true)}>
          <Plus className="size-4"/> تصفية جديدة
        </Button>}
      </div>
      {noNewPeriod && <p className="text-sm text-muted-foreground">
        آخر تصفية تشمل اليوم بالفعل. التصفية التالية تبدأ من الغد.
      </p>}
      {records.isPending && <LoadingState/>}
      {records.isError && <ErrorState error={records.error} retry={() => void records.refetch()}/>}
      {records.isSuccess && (records.data.settlements.length === 0
        ? <EmptyState title="لا توجد تصفيات سابقة" detail="اضغط «تصفية جديدة» لحفظ أول تصفية للعميل."/>
        : <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[850px] text-right text-sm">
              <thead className="bg-muted/60 text-xs">
                <tr>{["رقم التصفية", "تاريخ الحفظ", "تشمل من", "تشمل حتى",
                  "الخصم", "المحصل", "المتبقي", "النتيجة", "الإجراء"]
                  .map(label => <th key={label} className="px-3 py-3 font-bold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {records.data.settlements.map(record => <tr key={record.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold" dir="ltr">{record.number}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatCollectionDate(record.settledOn)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatCollectionDate(record.dateFrom)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatCollectionDate(record.dateTo)}</td>
                  <td className="px-3 py-2"><MoneyAmount amount={record.discountAmount}/></td>
                  <td className="px-3 py-2"><MoneyAmount amount={record.collectedAmount}/></td>
                  <td className="px-3 py-2 font-bold"><MoneyAmount amount={record.balanceAfter}/></td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {statusText[record.status]}
                    {record.collectionReversed && <span className="block text-xs text-destructive">تحصيل معكوس</span>}
                  </td>
                  <td className="px-3 py-2"><Button type="button" size="sm" variant="outline"
                    onClick={() => setSelectedId(record.id)}><Eye className="size-4"/> عرض التفاصيل</Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {records.data.pagination.lastPage > 1 && <div className="flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" disabled={page <= 1}
              onClick={() => setPage(n => Math.max(1, n - 1))}>
              <ChevronRight className="size-4"/> السابق
            </Button>
            <span className="text-xs">صفحة {page} من {records.data.pagination.lastPage}</span>
            <Button size="sm" variant="outline" disabled={page >= records.data.pagination.lastPage}
              onClick={() => setPage(n => n + 1)}>
              التالي <ChevronLeft className="size-4"/>
            </Button>
          </div>}
        </>)}
    </> : <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
        <ArrowRight className="size-4"/> العودة لسجل التصفيات
      </Button>
      {detail.isPending && <LoadingState/>}
      {detail.isError && <ErrorState error={detail.error} retry={() => void detail.refetch()}/>}
      {detail.isSuccess && <StatementDetails record={detail.data}
        canSeeReconciliation={canSeeReconciliation}/>}
    </>}
    {creating && <CreateSettlementDialog customerId={customerId}
      nextDateFrom={records.data?.nextDateFrom ?? null}
      canDiscount={canDiscount} canCollect={canCollect}
      onClose={() => setCreating(false)}
      onSuccess={id => { setCreating(false); setSelectedId(id); setPage(1); }}/>}
  </section>;
}
