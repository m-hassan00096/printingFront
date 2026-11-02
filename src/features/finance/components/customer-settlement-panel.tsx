import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileSpreadsheet, Printer, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { ErrorState, LoadingState, EmptyState } from "@/features/identity/components/identity-ui";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { fetchCustomerSettlement } from "../api/settlement.api";
import { printSettlement } from "../lib/settlement-export";
import { exportSettlementXlsx } from "../lib/settlement-xlsx";
import { deliveredWorkReport } from "../lib/delivered-work-report";
import { cairoToday } from "../lib/account-display";
import type { SettlementPeriod } from "../types/settlement.types";
import { toast } from "sonner";

function defaultPeriod(): SettlementPeriod {
  const to = cairoToday();
  return {from: to.slice(0, 8) + "01", to};
}

export function CustomerSettlementPanel({customerId, canViewOrders = false}: {customerId: number; canViewOrders?: boolean}) {
  const [period, setPeriod] = useState<SettlementPeriod>(defaultPeriod);
  const [applied, setApplied] = useState<SettlementPeriod | null>(defaultPeriod);
  const valid = Boolean(period.from && period.to && period.from <= period.to && period.to <= cairoToday());
  const report = useQuery({
    queryKey: ["finance", "settlement", customerId, applied?.from, applied?.to],
    queryFn: () => fetchCustomerSettlement(customerId, applied!),
    enabled: applied !== null && customerId > 0,
    staleTime: 0,
  });
  const statement = applied && report.isSuccess ? report.data : null;
  const deliveries = statement ? deliveredWorkReport(statement) : null;

  function change(which: keyof SettlementPeriod, date: string) {
    setPeriod(previous => ({...previous, [which]: date}));
    setApplied(null);
  }
  function show() {
    if (!valid) return;
    if (applied?.from === period.from && applied?.to === period.to) void report.refetch();
    else setApplied({...period});
  }

  return <section className="space-y-4" aria-label="كشف الشغل المسلّم للعميل">
    <p className="text-sm leading-6 text-muted-foreground">
      الشغل الذي استلمه العميل بالفعل خلال الفترة. المدفوعات والمديونيات في «كشف الحساب»، والتحصيل والتقفيل في «تصفية الحساب».
    </p>

    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <CreatedDatePicker label="من تاريخ الكشف" value={period.from} max={period.to || undefined} onChange={value => change("from", value)}/>
      <CreatedDatePicker label="إلى تاريخ الكشف" value={period.to} min={period.from || undefined} max={cairoToday()} onChange={value => change("to", value)}/>
      <Button disabled={!valid || report.isFetching} onClick={show}><Search className="size-4"/> عرض الشغل</Button>
    </div>

    {!valid && <p role="alert" className="text-sm text-destructive">اختر فترة صحيحة لا تتجاوز اليوم.</p>}
    {!applied && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">الفترة تغيرت. اضغط «عرض الشغل» لتطبيقها.</p>}
    {applied && report.isPending && <LoadingState/>}
    {applied && report.isError && <ErrorState error={report.error} retry={() => void report.refetch()}/>}

    {statement && deliveries && <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <h3 className="text-sm font-bold">الشغل من {formatCollectionDate(statement.dateFrom)} إلى {formatCollectionDate(statement.dateTo)}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (!printSettlement(statement)) toast.error("اسمح للمتصفح بفتح نافذة الطباعة.");
          }}><Printer className="size-4"/> طباعة / PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportSettlementXlsx(statement)}>
            <FileSpreadsheet className="size-4"/> تصدير Excel
          </Button>
        </div>
      </div>

      <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="ملخص الشغل المستلّم">
        <div>
          <dt className="text-sm text-muted-foreground">عدد الأوردرات المستلّمة</dt>
          <dd className="mt-2 text-lg font-bold tabular-nums">{deliveries.deliveredOrderCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">إجمالي الشغل المستلّم</dt>
          <dd className="mt-2 font-bold"><MoneyAmount amount={deliveries.grossDelivered}/></dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">إلغاءات التسليم</dt>
          <dd className="mt-2 font-bold"><MoneyAmount amount={deliveries.cancelledDelivered}/></dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">صافي الشغل خلال الفترة</dt>
          <dd className="mt-2 text-lg font-extrabold text-primary"><MoneyAmount amount={deliveries.netDelivered}/></dd>
        </div>
      </dl>

      {deliveries.lines.length ? <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-right text-sm" aria-label="تفاصيل الشغل المستلّم">
          <thead className="bg-muted/50"><tr>
            {["تاريخ الحركة", "رقم الأوردر", "الشغل / الحالة", "الكمية", "سعر القطعة", "القيمة"].map(title =>
              <th key={title} scope="col" className="px-3 py-3 text-xs font-semibold">{title}</th>)}
          </tr></thead>
          <tbody className="divide-y">
            {deliveries.lines.map(line => <tr key={line.key} className={line.kind === "delivery_cancellation" ? "bg-muted/20" : ""}>
              <td className="whitespace-nowrap px-3 py-3">{formatCollectionDate(line.date)}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {canViewOrders && line.orderId
                  ? <Link to={"/orders/" + line.orderId} className="text-primary underline underline-offset-2"><span dir="ltr">{line.orderNumber ?? "فتح الأوردر"}</span></Link>
                  : <span dir="ltr">{line.orderNumber ?? "—"}</span>}
              </td>
              <td className="min-w-[250px] px-3 py-3">
                {line.kind === "delivery_cancellation"
                  ? <span className="font-semibold text-muted-foreground">إلغاء تسليم</span>
                  : line.description}
              </td>
              <td className="px-3 py-3 tabular-nums">{line.quantity ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-3">{line.unitPrice !== null
                ? <MoneyAmount amount={line.unitPrice} maximumFractionDigits={4}/>
                : "—"}</td>
              <td className={"whitespace-nowrap px-3 py-3 font-semibold " + (line.kind === "delivery_cancellation" ? "text-destructive" : "")}>
                <MoneyAmount amount={line.signedAmount}/>
              </td>
            </tr>)}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr><th scope="row" colSpan={5} className="px-3 py-3 text-right">صافي الشغل المستلّم</th>
              <td className="whitespace-nowrap px-3 py-3 font-bold"><MoneyAmount amount={deliveries.netDelivered}/></td></tr>
          </tfoot>
        </table>
      </div> : <EmptyState title="لا يوجد شغل مستلّم في الفترة" detail="لا توجد تسليمات أو إلغاءات تسليم خلال الفترة المختارة."/>}
      <p className="text-xs leading-5 text-muted-foreground">
        الإلغاءات تخصم من قيمة التسليمات، بما فيها إلغاء تسليم تم في فترة سابقة.
        هذا تقرير شغل وليس رصيد مديونية أو إيصال تحصيل. راجع «كشف الحساب» لمعرفة المبالغ المستحقة والمدفوعات.
      </p>
    </>}
  </section>;
}
