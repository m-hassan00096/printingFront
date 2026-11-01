import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { ErrorState, LoadingState, EmptyState } from "@/features/identity/components/identity-ui";
import { CreatedDatePicker } from "@/features/orders/components/created-date-picker";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { fetchCustomerSettlement } from "../api/settlement.api";
import { exportSettlementCsv, printSettlement } from "../lib/settlement-export";
import type { SettlementPeriod } from "../types/settlement.types";
import { toast } from "sonner";

function defaultPeriod(): SettlementPeriod {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? "";
  const to = part("year") + "-" + part("month") + "-" + part("day");
  return { from: part("year") + "-" + part("month") + "-01", to };
}

export function CustomerSettlementPanel({ customerId }: { customerId: number }) {
  const [period, setPeriod] = useState<SettlementPeriod>(defaultPeriod);
  const [applied, setApplied] = useState<SettlementPeriod | null>(null);
  const valid = Boolean(period.from && period.to && period.from <= period.to &&
    period.to <= defaultPeriod().to);
  const report = useQuery({
    queryKey: ["finance", "settlement", customerId, applied?.from, applied?.to],
    queryFn: () => fetchCustomerSettlement(customerId, applied!),
    enabled: applied !== null && customerId > 0,
    staleTime: 0,
  });
  const statement = applied && report.isSuccess ? report.data : null;
  function change(which: keyof SettlementPeriod, date: string) {
    setPeriod(previous => ({ ...previous, [which]: date }));
    setApplied(null);
  }
  function show() {
    if (!valid) return;
    if (applied?.from === period.from && applied?.to === period.to) {
      void report.refetch();
    } else {
      setApplied({ ...period });
    }
  }

  return <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="تصفية حساب العميل">
    <div className="space-y-1">
      <h2 className="font-bold">تصفية حساب</h2>
      <p className="text-xs text-muted-foreground">
        كشف للشغل الذي تم تسليمه فقط. لا ينشئ مديونية أو تحصيلًا جديدًا.
      </p>
    </div>

    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <CreatedDatePicker label="من تاريخ التصفية" value={period.from} max={period.to || undefined}
        onChange={value => change("from", value)} />
      <CreatedDatePicker label="إلى تاريخ التصفية" value={period.to}
        min={period.from || undefined} max={defaultPeriod().to}
        onChange={value => change("to", value)} />
      <Button type="button" disabled={!valid || report.isFetching} onClick={show}>
        <Search className="size-4" /> عرض الكشف
      </Button>
    </div>
    {!valid && <p className="text-sm text-destructive" role="alert">
      اختر تاريخ بداية ونهاية صحيحين، لا يتجاوزان تاريخ اليوم.
    </p>}

    {applied && report.isPending && <LoadingState />}
    {applied && report.isError && <ErrorState error={report.error} retry={() => void report.refetch()} />}
    {!applied && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
      اختر الفترة واضغط «عرض الكشف».
    </p>}

    {statement && <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <h3 className="text-sm font-bold">
          الشغل المستلم من {formatCollectionDate(statement.dateFrom)} إلى {formatCollectionDate(statement.dateTo)}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (!printSettlement(statement)) toast.error("اسمح للمتصفح بفتح نافذة الطباعة.");
          }}><Printer className="size-4" /> طباعة / PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportSettlementCsv(statement)}>
            <FileSpreadsheet className="size-4" /> Excel (CSV)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          ["رصيد سابق", statement.openingBalance],
          ["الشغل المستلم", statement.deliveredTotal],
          ["صافي المدفوعات", statement.paymentsTotal],
          ["المتبقي عن الشغل المستلم", statement.closingBalance],
        ] as const).map(([title,amount])=><div key={title}
          className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 text-base font-bold"><MoneyAmount amount={amount}/></p>
        </div>)}
      </div>

      {statement.lines.length ? <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-right text-sm">
          <thead className="bg-muted/60 text-xs">
            <tr>{["التاريخ","البيان","المرجع","الكمية","سعر الوحدة","مدين","دائن","الرصيد"].map(name =>
              <th key={name} className="px-3 py-3 font-bold">{name}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {statement.lines.map(line => {
              const credit = line.signedAmount.startsWith("-");
              return <tr key={line.key}>
                <td className="whitespace-nowrap px-3 py-2">{formatCollectionDate(line.date)}</td>
                <td className="max-w-[360px] px-3 py-2">{line.description}</td>
                <td className="whitespace-nowrap px-3 py-2">{line.orderNumber ?? line.receiptNumber ?? "—"}</td>
                <td className="px-3 py-2">{line.quantity ?? "—"}</td>
                <td className="px-3 py-2">{line.unitPrice ? <MoneyAmount amount={line.unitPrice}/> : "—"}</td>
                <td className="px-3 py-2">{credit ? "—" : <MoneyAmount amount={line.signedAmount}/>}</td>
                <td className="px-3 py-2">{credit ? <MoneyAmount amount={line.signedAmount.slice(1)}/> : "—"}</td>
                <td className="px-3 py-2 font-bold"><MoneyAmount amount={line.runningBalance}/></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <EmptyState title="لا توجد حركات" detail="لا توجد تسليمات أو تحصيلات في الفترة المختارة."/>}

      {statement.adjustmentsTotal !== "0.00" && <p className="text-xs text-muted-foreground">
        تشمل هذه الفترة تسوية رصيد افتتاحي بقيمة <MoneyAmount amount={statement.adjustmentsTotal}/>.
      </p>}
      <p className="text-xs text-muted-foreground">
        للمراجعة الداخلية فقط: رصيد Finance حتى نهاية الفترة
        {" "}<MoneyAmount amount={statement.financeBalanceAsOf}/>،
        والفرق عن كشف الشغل المستلم <MoneyAmount amount={statement.undeliveredDifference}/>.
        الفرق يشمل المديونيات المؤكدة التي لم تدخل ضمن التسليمات بعد.
      </p>
    </>}
  </section>;
}
