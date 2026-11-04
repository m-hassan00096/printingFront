import type { AccountSettlementRecord } from "../types/account-settlement.types";
import { absoluteAmount, balanceDescription } from "./account-display";

function escape(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
}
export function renderAccountSettlementEvidence(record: AccountSettlementRecord): string {
  const before = record.snapshot?.before;
  if (!before) throw new Error("Settlement snapshot is required");
  const money = (value: string) => escape(value) + " ج.م";
  const row = (title: string, value: string) => `<tr><th>${escape(title)}</th><td>${money(value)}</td></tr>`;
  const items = before.items.map(item => `<tr><td>${escape(item.orderNumber)}</td><td>${escape(item.description)}${item.widthCm && item.heightCm ? " — " + escape(item.widthCm) + " × " + escape(item.heightCm) + " سم" : ""}</td><td>${escape(item.quantity)}</td><td>${money(item.amount)}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escape(record.number)}</title><style>
  body{font:14px Tahoma,Arial,sans-serif;color:#17243c;margin:24px}h1{font-size:24px}.notice{padding:12px;border:1px solid #aaa}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{text-align:right;padding:10px;border-bottom:1px solid #ddd}.total{font-size:20px;font-weight:bold}.warn{border:2px solid #a33;padding:12px} @page{size:A4;margin:15mm}
  </style></head><body><h1>مطبعة المصرية — إثبات تصفية مالية</h1><p>${escape(record.number)} · تاريخ التنفيذ: ${escape(record.settledOn)}</p>
  <p>العميل: <strong>${escape(before.customerName)}</strong> · الهاتف: ${escape(before.customerPhone)}</p>
  <p>شغل مسلّم حتى ${escape(record.dateTo)}، مع احتساب دفعات الحساب حتى ${escape(before.paymentsThrough)}.</p>
  <p class="notice">${escape(record.statusLabel)}</p>${record.needsReview ? '<p class="warn">حدث إلغاء أو رد مالي بعد تسجيل هذه التصفية. الأرقام التالية لقطة وقت التسجيل وليست إثباتًا بأن الرصيد الحالي مسدد.</p>' : ''}
  <table><tbody>${row("الرصيد الافتتاحي المحتسب",before.openingBalance)}${row("الشغل المسلّم",before.deliveredTotal)}${row("صافي الدفعات السابقة",before.netPayments)}${row("الخصومات السابقة",before.discountsTotal ?? '0.00')}${row("الرصيد قبل العملية",record.balanceBefore)}${row("خصم هذه التصفية",record.discountAmount ?? '0.00')}${record.discountReason ? '<tr><th>سبب الخصم</th><td>' + escape(record.discountReason) + '</td></tr>' : ''}${row("المبلغ المحصّل في هذه العملية",record.amountCollected)}
  <tr class="total"><th>بعد التصفية — ${escape(balanceDescription(record.balanceAfter))}</th><td>${money(absoluteAmount(record.balanceAfter))}</td></tr>
  ${row("رصيد الحساب الكلي بعد العملية",record.accountBalanceAfter)}</tbody></table>
  <p>إيصال التحصيل المرتبط: ${escape(record.receiptNumber ?? "لا يوجد تحصيل جديد")}</p>
  <p>الخصومات تخفيضات حسابية لا تُعتبر تحصيلًا نقديًا. المتبقي وقت التصفية لا يلغي باقي أوردرات العميل غير المستلمة.</p>
  <p>هذه تصفية تراكمية لحساب العميل، وليست توزيعًا للدفعات على فواتير منفردة. أي مقدمات مدرجة في صافي الدفعات لا تُخصم مرة ثانية. رصيد النطاق الدائن ليس تصريحًا برد أموال.</p>
  <table><thead><tr><th>الأوردر</th><th>الشغل المشمول</th><th>الكمية</th><th>القيمة</th></tr></thead><tbody>${items}</tbody></table>
  <p>${escape(record.note ?? "")}</p></body></html>`;
}
