import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useOrder } from "../hooks/use-orders";
import { depositedCents, exactMoneyCents, getOrderDepositReceipts } from "../api/order-print.api";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { Button } from "@/shared/components/ui/button";
import { ErrorState, LoadingState } from "@/features/identity/components/identity-ui";
import "./order-print-page.css";

function amount(value: string | number, maximumFractionDigits = 2): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-EG", {
    minimumFractionDigits: maximumFractionDigits === 2 ? 2 : 0,
    maximumFractionDigits,
  }).format(number);
}

function cairoDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(parsed);
}

function safePrintTitle(orderNumber: string | null, customerName: string): string {
  const safe = customerName.replace(/[<>:"/\\|?*\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 55);
  return "أوردر " + (orderNumber ?? "مسودة") + " - " + (safe || "العميل");
}

export function OrderPrintPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const order = useOrder(valid ? id : 0);
  const needsReceipts = Boolean(order.data && order.data.status !== 0);
  const receipts = useQuery({
    queryKey: ["orders", "print-deposit-receipts", id, order.data?.orderNumber],
    queryFn: () => getOrderDepositReceipts(order.data!),
    enabled: valid && needsReceipts,
    staleTime: 0,
    retry: false,
  });
  const ready = Boolean(order.data && Array.isArray(order.data.items) &&
    (!needsReceipts || receipts.isSuccess));
  const autoPrintTriggered = useRef(false);

  useEffect(() => {
    if (!order.data) return;
    const oldTitle = document.title;
    document.title = safePrintTitle(order.data.orderNumber, order.data.customerName);
    return () => { document.title = oldTitle; };
  }, [order.data]);

  useEffect(() => {
    if (!ready || autoPrintTriggered.current) return;
    // The route is opened directly by the user's PDF click. Wait for fonts and
    // initial paint; the manual print button remains available as a fallback.
    const timeout = window.setTimeout(() => {
      if (autoPrintTriggered.current) return;
      const start = () => {
        if (autoPrintTriggered.current) return;
        autoPrintTriggered.current = true;
        window.print();
      };
      if (document.fonts?.ready) void document.fonts.ready.then(start, start);
      else start();
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [ready]);

  if (!valid) return <p role="alert" className="p-6">رقم الأوردر غير صحيح.</p>;
  if (order.isPending) return <LoadingState />;
  if (order.isError) return <ErrorState error={order.error} retry={() => void order.refetch()} />;
  if (needsReceipts && receipts.isPending) return <LoadingState />;
  if (needsReceipts && receipts.isError)
    return <ErrorState error={receipts.error} retry={() => void receipts.refetch()} />;
  const item = order.data;
  if (!Array.isArray(item.items))
    return <p role="alert" className="p-6">تفاصيل بنود الأوردر غير مكتملة. لا يمكن طباعة مستند غير مكتمل.</p>;

  const paid = needsReceipts ? receipts.data ?? [] : [];
  const depositCents = depositedCents(paid);
  const paidAmount = depositCents / 100;
  const totalCents = exactMoneyCents(item.totalAmount);
  const total = totalCents / 100;
  const remaining = Math.max(0, totalCents - depositCents) / 100;
  const overpaid = Math.max(0, depositCents - totalCents) / 100;
  const print = () => {
    autoPrintTriggered.current = true;
    window.print();
  };

  return <main dir="rtl" className="order-print-canvas">
    <div className="order-print-toolbar" aria-label="خيارات طباعة الأوردر">
      <Button type="button" onClick={print}>
        <Printer className="size-4" /> طباعة / حفظ PDF
      </Button>
      <Button variant="outline" asChild>
        <Link to={"/orders/" + item.id}><ArrowRight className="size-4" /> تفاصيل الأوردر</Link>
      </Button>
      <p className="text-xs text-muted-foreground">اختر الطابعة أو «حفظ كـ PDF» من نافذة الطباعة.</p>
    </div>

    <article id="order-print-document" className="order-print-paper">
      <header className="order-print-heading">
        <div className="order-print-identity">
          <p className="order-print-brand">مطبعة المصرية</p>
          <h1>بيان تفاصيل الأوردر</h1>
        </div>
        <div className="order-print-number">
          <span>رقم الأوردر</span>
          <strong dir="ltr">{item.orderNumber ?? "مسودة #" + item.id}</strong>
          <small>الحالة: {item.statusLabel}</small>
        </div>
      </header>

      <section aria-label="بيانات الأوردر والعميل" className="order-print-metadata">
        <div><span>اسم العميل</span><strong>{item.customerName}</strong></div>
        <div><span>رقم الهاتف</span><strong dir="ltr">{item.customerPhone || "—"}</strong></div>
        <div><span>تاريخ الأوردر</span><strong dir="ltr">{cairoDate(item.confirmedAt ?? item.createdAt)}</strong></div>
        <div><span>موعد التسليم</span><strong dir="ltr">{formatCollectionDate(item.dueDate)}</strong></div>
      </section>

      {item.status === 0 && <p className="order-print-warning">مسودة غير مؤكدة — لا توجد عملية تحصيل عربون مسجّلة.</p>}
      {item.status === 2 && <p className="order-print-warning">الأوردر ملغي — هذا البيان للرجوع إليه فقط.</p>}

      <section aria-label="بنود الأوردر" className="order-print-section">
        <h2>بنود الأوردر</h2>
        <table className="order-print-table order-print-items-table">
          <thead>
            <tr>
              <th scope="col">البند</th>
              <th scope="col">الكمية</th>
              <th scope="col">سعر الوحدة (ج.م)</th>
              <th scope="col">الإجمالي (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            {item.items.map((line) => <tr key={line.id}>
              <td>
                <strong>{line.serviceName}</strong>
                {line.specifications && <p className="order-print-item-note">{line.specifications}</p>}
                {line.widthCm && line.heightCm && <p className="order-print-item-note">
                  المقاس: {line.widthCm} × {line.heightCm} سم
                </p>}
              </td>
              <td className="order-print-numeric">{line.quantity}</td>
              <td className="order-print-numeric" dir="ltr">{amount(line.unitPrice, 4)}</td>
              <td className="order-print-numeric" dir="ltr">{amount(line.agreedTotal)}</td>
            </tr>)}
          </tbody>
        </table>
      </section>

      {paid.length > 0 && <section aria-label="تحصيل العربون" className="order-print-section">
        <h2>إيصالات العربون</h2>
        <table className="order-print-table order-print-receipts-table">
          <thead>
            <tr>
              <th scope="col">رقم الإيصال</th>
              <th scope="col">طريقة الدفع</th>
              <th scope="col">التاريخ</th>
              <th scope="col">المبلغ (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            {paid.map(receipt => <tr key={receipt.id}>
              <td>
                <strong dir="ltr">{receipt.receiptNumber}</strong>
                {receipt.actualReceiptNumber && <p className="order-print-item-note">
                  مرجع خارجي: <span dir="ltr">{receipt.actualReceiptNumber}</span>
                </p>}
              </td>
              <td>
                {receipt.paymentMethodLabel}
                {receipt.destinationLabel && <p className="order-print-item-note">{receipt.destinationLabel}</p>}
              </td>
              <td className="order-print-numeric" dir="ltr">{formatCollectionDate(receipt.collectedOn)}</td>
              <td className="order-print-numeric" dir="ltr">{amount(receipt.amount)}</td>
            </tr>)}
          </tbody>
        </table>
      </section>}

      <section aria-label="ملخص مبالغ الأوردر" className="order-print-summary-section">
        <h2>ملخص الحساب</h2>
        <dl className="order-print-balance-summary">
          <div><dt>إجمالي الأوردر</dt><dd dir="ltr">{amount(total)} ج.م</dd></div>
          <div><dt>العربون المدفوع فعليًا</dt><dd dir="ltr">{amount(paidAmount)} ج.م</dd></div>
          <div className="order-print-remaining"><dt>الباقي بعد العربون</dt><dd dir="ltr">{amount(remaining)} ج.م</dd></div>
        </dl>
        {overpaid > 0 && <p className="order-print-overpayment">
          العربون المحصّل يزيد عن إجمالي الأوردر بمبلغ {amount(overpaid)} ج.م؛ راجع رصيد العميل.
        </p>}
        {item.status === 0 && <p className="order-print-no-deposit">
          العربون المخطّط للمسودة ليس تحصيلًا فعليًا.
        </p>}
      </section>

      <footer className="order-print-footnote">
        هذا بيان أوردر، وليس إيصال سداد. الباقي محسوب بعد العربون فقط، ولا يشمل تحصيلات التسليم أو التسويات أو ردود الأموال اللاحقة.
      </footer>
    </article>
  </main>;
}
