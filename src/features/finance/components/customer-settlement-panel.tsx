import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { ErrorState, LoadingState, EmptyState } from "@/features/identity/components/identity-ui";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { fetchCustomerSettlement } from "../api/settlement.api";
import { printSettlement } from "../lib/settlement-export";
import { exportSettlementXlsx } from "../lib/settlement-xlsx";
import { absoluteAmount, balanceDescription, cairoToday } from "../lib/account-display";
import type { SettlementPeriod } from "../types/settlement.types";
import { toast } from "sonner";

function defaultPeriod(): SettlementPeriod {
  const to = cairoToday();
  return {from: to.slice(0, 8) + "01", to};
}
export function CustomerSettlementPanel({customerId}: {customerId: number}) {
  const [period, setPeriod] = useState<SettlementPeriod>(defaultPeriod);
  const [applied, setApplied] = useState<SettlementPeriod | null>(defaultPeriod);
  const valid = Boolean(period.from && period.to && period.from <= period.to && period.to <= cairoToday());
  const report = useQuery({queryKey: ["finance", "settlement", customerId, applied?.from, applied?.to],
    queryFn: () => fetchCustomerSettlement(customerId, applied!), enabled: applied !== null && customerId > 0, staleTime: 0});
  const statement = applied && report.isSuccess ? report.data : null;
  function change(which: keyof SettlementPeriod, date: string) {setPeriod(previous => ({...previous, [which]: date})); setApplied(null);}
  function show() {if (!valid) return; if (applied?.from === period.from && applied?.to === period.to) void report.refetch(); else setApplied({...period});}
  return <section className="space-y-4" aria-label="كشف الشغل المسلّم للعميل">
    <header><h2 className="text-lg font-bold">كشف حساب الشغل المستلّم</h2><p className="mt-1 text-sm text-muted-foreground">كشف المبالغ المتعلقة بالشغل اللي العميل استلمه. التقفيل الفعلي من «تصفية الحساب».</p></header>
    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <CreatedDatePicker label="من تاريخ الكشف" value={period.from} max={period.to || undefined} onChange={value => change("from", value)}/>
      <CreatedDatePicker label="إلى تاريخ الكشف" value={period.to} min={period.from || undefined} max={cairoToday()} onChange={value => change("to", value)}/>
      <Button disabled={!valid || report.isFetching} onClick={show}><Search className="size-4"/> عرض الكشف</Button>
    </div>
    {!valid && <p role="alert" className="text-sm text-destructive">اختر فترة صحيحة لا تتجاوز اليوم.</p>}
    {!applied && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">الفترة تغيرت. اضغط «عرض الكشف» لتطبيقها.</p>}
    {applied && report.isPending && <LoadingState/>}
    {applied && report.isError && <ErrorState error={report.error} retry={() => void report.refetch()}/>}
    {statement && <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><h3 className="text-sm font-bold">الشغل المسلّم من {formatCollectionDate(statement.dateFrom)} إلى {formatCollectionDate(statement.dateTo)}</h3>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => {if (!printSettlement(statement)) toast.error("اسمح للمتصفح بفتح نافذة الطباعة.");}}><Printer className="size-4"/> طباعة / PDF</Button><Button variant="outline" size="sm" onClick={() => exportSettlementXlsx(statement)}><FileSpreadsheet className="size-4"/> تصدير Excel</Button></div>
      </div>
      <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="ملخص حساب الفترة">
        <div><dt className="text-sm text-muted-foreground">رصيد بداية الفترة</dt><dd className="mt-2 font-bold"><MoneyAmount amount={statement.openingBalance}/></dd></div>
        <div><dt className="text-sm text-muted-foreground">رصيد افتتاحي سُجل داخل الفترة</dt><dd className="mt-2 font-bold"><MoneyAmount amount={statement.adjustmentsTotal}/></dd></div>
        <div><dt className="text-sm text-muted-foreground">صافي الشغل المسلّم</dt><dd className="mt-2 font-bold"><MoneyAmount amount={statement.deliveredTotal}/></dd></div>
        <div><dt className="text-sm text-muted-foreground">صافي دفعات العميل</dt><dd className="mt-2 font-bold"><MoneyAmount amount={statement.paymentsTotal}/></dd></div>
        <div><dt className="text-sm text-muted-foreground">رصيد نهاية الفترة — {balanceDescription(statement.closingBalance)}</dt><dd className="mt-2 text-lg font-extrabold text-primary"><MoneyAmount amount={absoluteAmount(statement.closingBalance)}/></dd></div>
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">رصيد النهاية = رصيد البداية + الرصيد الافتتاحي المسجل داخل الفترة + صافي الشغل المسلّم − صافي الدفعات. هذا رصيد تاريخي وليس أمرًا بتحصيله الآن.</p>
      {statement.lines.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-muted/50"><tr>
        {['التاريخ','البيان','المرجع','الكمية','سعر القطعة','زيادة على الحساب','دفعة / تخفيض','الرصيد بعد الحركة'].map(title => <th key={title} className="px-3 py-3 text-xs font-semibold">{title}</th>)}
      </tr></thead><tbody className="divide-y">{statement.lines.map(line => {
        const credit = line.signedAmount.startsWith("-");
        return <tr key={line.key}><td className="whitespace-nowrap px-3 py-3">{formatCollectionDate(line.date)}</td><td className="max-w-[360px] px-3 py-3">{line.description}</td>
          <td className="whitespace-nowrap px-3 py-3"><span dir="ltr" className="inline-block">{line.orderNumber ?? line.receiptNumber ?? "—"}</span></td><td className="px-3 py-3">{line.quantity ?? "—"}</td>
          <td className="px-3 py-3">{line.unitPrice ? <MoneyAmount amount={line.unitPrice} maximumFractionDigits={4}/> : "—"}</td>
          <td className="px-3 py-3">{credit ? "—" : <MoneyAmount amount={line.signedAmount}/>}</td><td className="px-3 py-3">{credit ? <MoneyAmount amount={absoluteAmount(line.signedAmount)}/> : "—"}</td>
          <td className="whitespace-nowrap px-3 py-3 font-semibold">{balanceDescription(line.runningBalance)} · <MoneyAmount amount={absoluteAmount(line.runningBalance)}/></td></tr>;
      })}</tbody></table></div> : <EmptyState title="لا توجد حركات" detail="لا توجد تسليمات أو تحصيلات في الفترة المختارة."/>}
      <details className="text-sm"><summary className="cursor-pointer font-semibold text-muted-foreground">مطابقة داخلية مع الحساب الكلي</summary><p className="mt-2 leading-6 text-muted-foreground">رصيد الحساب الكلي حتى نهاية الفترة: <MoneyAmount amount={statement.financeBalanceAsOf}/>، والفرق عن هذا الكشف: <MoneyAmount amount={statement.undeliveredDifference}/>. الفرق يشمل مديونيات مؤكدة خارج التسليمات. لا تظهر هذه المطابقة في نسخة العميل.</p></details>
    </>}
  </section>;
}
