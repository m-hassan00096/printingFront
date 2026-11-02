import type { CustomerSettlement } from "../types/settlement.types";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { deliveredWorkReport } from "./delivered-work-report";

const columns = ["التاريخ", "رقم الأوردر", "الشغل / الحالة", "الكمية", "سعر القطعة", "القيمة"];
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, character => (
    {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character] ?? character
  ));
}

/** Exact same delivery-only rows and totals used on screen and in the XLSX. */
export function renderDeliveredWorkHtml(statement: CustomerSettlement): string {
  const work = deliveredWorkReport(statement);
  const rows = work.lines.map(line => "<tr>" +
    "<td>" + escapeHtml(formatCollectionDate(line.date)) + "</td>" +
    "<td dir='ltr'>" + escapeHtml(line.orderNumber ?? "—") + "</td>" +
    "<td>" + escapeHtml(line.kind === "delivery_cancellation" ? "إلغاء تسليم" : line.description) + "</td>" +
    "<td>" + escapeHtml(line.quantity ?? "—") + "</td>" +
    "<td>" + escapeHtml(line.unitPrice ?? "—") + "</td>" +
    "<td dir='ltr'>" + escapeHtml(line.signedAmount) + "</td>" +
    "</tr>").join("");
  const summary = [
    ["عدد الأوردرات المستلّمة", work.deliveredOrderCount],
    ["إجمالي الشغل المستلّم", work.grossDelivered],
    ["إلغاءات التسليم", work.cancelledDelivered],
    ["صافي الشغل المستلّم", work.netDelivered],
  ].map(([label, value]) => "<div><span>" + escapeHtml(label) +
    "</span><strong>" + escapeHtml(value) + "</strong></div>").join("");
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>طَبعة — تقرير الشغل المستلّم</title><style>' +
    'body{font:14px Tahoma,Arial,sans-serif;color:#18243b;padding:20px}' +
    'table{border-collapse:collapse;width:100%;margin-top:20px;font-size:12px}' +
    'th,td{border-bottom:1px solid #dce3ed;padding:9px;text-align:right}' +
    'th{background:#edf1f9}.summary{display:flex;gap:10px;margin-top:16px}' +
    '.summary div{flex:1;border:1px solid #dce3ed;padding:10px}' +
    '.summary strong{display:block;font-size:18px;margin-top:8px}' +
    '.muted{color:#53637c}tfoot{font-weight:bold;background:#edf1f9}' +
    '@page{size:A4 landscape;margin:12mm}</style></head><body>' +
    '<h1>طَبعة — تقرير الشغل المستلّم</h1><p><strong>العميل: </strong>' + escapeHtml(statement.customerName) +
    '</p><p>الفترة من ' + escapeHtml(formatCollectionDate(statement.dateFrom)) +
    ' إلى ' + escapeHtml(formatCollectionDate(statement.dateTo)) + '</p>' +
    '<div class="summary">' + summary + '</div>' +
    '<table><thead><tr>' + columns.map(title => '<th>' + escapeHtml(title) + '</th>').join("") +
    '</tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="5">صافي الشغل المستلّم</td><td>' +
    escapeHtml(work.netDelivered) + '</td></tr></tfoot></table>' +
    '<p class="muted">جميع المبالغ بالجنيه المصري. الإلغاءات تخصم من قيمة التسليمات، وقد تخص تسليمات تمت قبل الفترة. ' +
    'هذا تقرير للشغل المستلّم، وليس كشف مديونية أو إيصال سداد أو إثبات تقفيل مالي. ' +
    'الدفعات والأرصدة تُراجع من كشف الحساب.</p></body></html>';
}

export function printSettlement(statement: CustomerSettlement): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  const html = renderDeliveredWorkHtml(statement);
  popup.document.open();
  popup.document.write(html);
  popup.addEventListener("load", () => {popup.focus(); popup.print();}, {once: true});
  popup.document.close();
  return true;
}
