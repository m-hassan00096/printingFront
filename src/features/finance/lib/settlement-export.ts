import type { CustomerSettlement } from "../types/settlement.types";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";

const columns = [
  "التاريخ", "البيان", "رقم الأوردر", "الكمية", "سعر الوحدة",
  "مدين", "دائن", "الرصيد",
];

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function printSettlement(statement: CustomerSettlement): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  const rows = statement.lines.map(line => {
    const debit = line.signedAmount.startsWith("-") ? "" : line.signedAmount;
    const credit = line.signedAmount.startsWith("-") ? line.signedAmount.slice(1) : "";
    return "<tr><td>" + escapeHtml(formatCollectionDate(line.date)) +
      "</td><td>" + escapeHtml(line.description) + "</td><td>" +
      escapeHtml(line.orderNumber ?? line.receiptNumber ?? "") + "</td><td>" +
      escapeHtml(line.quantity ?? "") + "</td><td>" +
      escapeHtml(line.unitPrice ?? "") + "</td><td>" + escapeHtml(debit) +
      "</td><td>" + escapeHtml(credit) + "</td><td>" +
      escapeHtml(line.runningBalance) + "</td></tr>";
  }).join("");
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>Tabaa — تصفية حساب</title><style>' +
    'body{font:14px Tahoma,Arial,sans-serif;color:#18243b;padding:24px}h1{margin-bottom:8px}' +
    'table{border-collapse:collapse;width:100%;margin-top:20px;font-size:12px}' +
    'th,td{border-bottom:1px solid #dce3ed;padding:9px;text-align:right;vertical-align:top}' +
    'th{background:#edf1f9} .summary{display:flex;justify-content:space-between;gap:12px;margin-top:18px}' +
    '.summary div{border:1px solid #dce3ed;border-radius:6px;padding:10px;flex:1}' +
    '.total{font-size:21px;font-weight:bold} .muted{color:#53637c} ' +
    '@page{size:A4 landscape;margin:12mm}</style></head><body>' +
    '<h1>Tabaa — كشف تصفية حساب</h1><p><strong>العميل: </strong>' +
    escapeHtml(statement.customerName) + '</p><p class="muted">الفترة من ' +
    escapeHtml(formatCollectionDate(statement.dateFrom)) + ' إلى ' +
    escapeHtml(formatCollectionDate(statement.dateTo)) + '</p>' +
    '<div class="summary"><div>رصيد سابق<br><span class="total">' +
    escapeHtml(statement.openingBalance) + '</span></div>' +
    '<div>الشغل المستلم<br><span class="total">' + escapeHtml(statement.deliveredTotal) +
    '</span></div><div>صافي المدفوعات<br><span class="total">' +
    escapeHtml(statement.paymentsTotal) + '</span></div><div>المتبقي<br><span class="total">' +
    escapeHtml(statement.closingBalance) + '</span></div></div>' +
    '<table><thead><tr>' + columns.map(label => '<th>' + escapeHtml(label) + '</th>').join("") +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="muted">المبالغ بالجنيه المصري. الكشف يخص الشغل المستلم، وليس جميع الأوردرات المؤكدة.</p>' +
    '</body></html>';
  popup.document.open();
  popup.document.write(html);
  popup.addEventListener("load", () => {
    popup.focus();
    popup.print();
  }, { once: true });
  popup.document.close();
  return true;
}
