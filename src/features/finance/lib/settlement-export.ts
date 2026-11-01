import type { CustomerSettlement } from "../types/settlement.types";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";

const columns = [
  "التاريخ", "البيان", "رقم الأوردر", "الكمية", "سعر الوحدة",
  "مدين", "دائن", "الرصيد",
];

/** Never let untrusted customer names/specifications execute spreadsheet formulas. */
function safeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const numeric = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text);
  const escaped = !numeric && /^[=+@-]/.test(text.trimStart()) ? "'" + text : text;
  return '"' + escaped.replaceAll('"', '""') + '"';
}

function reportRows(statement: CustomerSettlement): Array<Array<string | number | null>> {
  return [
    ["كشف تصفية حساب — Tabaa"],
    ["العميل", statement.customerName],
    ["من", statement.dateFrom, "إلى", statement.dateTo],
    [],
    columns,
    ["", "الرصيد السابق", "", null, null, null, null, statement.openingBalance],
    ...statement.lines.map(line => [
      line.date,
      line.description,
      line.orderNumber ?? line.receiptNumber ?? "",
      line.quantity,
      line.unitPrice,
      line.signedAmount.startsWith("-") ? null : line.signedAmount,
      line.signedAmount.startsWith("-") ? line.signedAmount.slice(1) : null,
      line.runningBalance,
    ]),
    [],
    ["", "إجمالي الشغل المستلم", "", null, null, statement.deliveredTotal],
    ["", "صافي المدفوعات", "", null, null, null, statement.paymentsTotal],
    ["", "تسويات افتتاحية داخل الفترة", "", null, null, statement.adjustmentsTotal],
    ["", "المتبقي عن الشغل المستلم", "", null, null, null, statement.closingBalance],
  ];
}

/** UTF-8 CSV is Excel-compatible without adding an XLSX library/dependency. */
export function exportSettlementCsv(statement: CustomerSettlement): void {
  const rows = reportRows(statement);
  const csv = "\uFEFFsep=,\r\n" +
    rows.map(row => row.map(safeCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tabaa-settlement-" + statement.customerId + "-" + statement.dateTo + ".csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
