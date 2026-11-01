import type { CustomerSettlement } from "../types/settlement.types";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import { absoluteAmount, balanceDescription } from "./account-display";
const columns = ['التاريخ','البيان','المرجع','الكمية','سعر القطعة','زيادة على الحساب','دفعة / تخفيض','الرصيد'];
function escapeHtml(value: unknown): string {return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c] ?? c);}
export function printSettlement(statement: CustomerSettlement): boolean {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.opener = null;
  const rows = statement.lines.map(line => '<tr><td>' + escapeHtml(formatCollectionDate(line.date)) + '</td><td>' + escapeHtml(line.description) + '</td><td>' + escapeHtml(line.orderNumber ?? line.receiptNumber ?? '') + '</td><td>' + escapeHtml(line.quantity ?? '') + '</td><td>' + escapeHtml(line.unitPrice ?? '') + '</td><td>' + escapeHtml(line.signedAmount.startsWith('-') ? '' : line.signedAmount) + '</td><td>' + escapeHtml(line.signedAmount.startsWith('-') ? absoluteAmount(line.signedAmount) : '') + '</td><td>' + escapeHtml(balanceDescription(line.runningBalance) + ' ' + absoluteAmount(line.runningBalance)) + '</td></tr>').join('');
  const summary = [
    ['رصيد بداية الفترة',statement.openingBalance], ['رصيد افتتاحي سُجل داخل الفترة',statement.adjustmentsTotal],
    ['صافي الشغل المسلّم',statement.deliveredTotal], ['صافي دفعات العميل',statement.paymentsTotal],
    ['رصيد نهاية الفترة — ' + balanceDescription(statement.closingBalance),absoluteAmount(statement.closingBalance)],
  ].map(([title,value]) => '<div>' + escapeHtml(title) + '<br><strong>' + escapeHtml(value) + ' ج.م</strong></div>').join('');
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طَبعة — كشف الشغل المسلّم</title><style>body{font:14px Tahoma,Arial,sans-serif;color:#18243b;padding:20px}table{border-collapse:collapse;width:100%;margin-top:20px;font-size:12px}th,td{border-bottom:1px solid #dce3ed;padding:9px;text-align:right}th{background:#edf1f9}.summary{display:flex;gap:10px;margin-top:16px}.summary div{flex:1;border:1px solid #dce3ed;padding:10px}.summary strong{font-size:18px}.muted{color:#53637c}@page{size:A4 landscape;margin:12mm}</style></head><body>' +
    '<h1>طَبعة — كشف الشغل المسلّم للعميل</h1><p><strong>العميل: </strong>' + escapeHtml(statement.customerName) + '</p><p>الفترة من ' + escapeHtml(formatCollectionDate(statement.dateFrom)) + ' إلى ' + escapeHtml(formatCollectionDate(statement.dateTo)) + '</p>' +
    '<div class="summary">' + summary + '</div><p class="muted">رصيد النهاية = رصيد البداية + الرصيد الافتتاحي داخل الفترة + صافي الشغل المسلّم − صافي الدفعات.</p><table><thead><tr>' + columns.map(title => '<th>' + escapeHtml(title) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table><p class="muted">جميع المبالغ بالجنيه المصري. هذا كشف تاريخي للمراجعة وليس إيصال سداد أو إثبات تقفيل مالي. يشمل دفعات العميل والمقدمات حتى نهاية الفترة.</p></body></html>';
  popup.document.open(); popup.document.write(html);
  popup.addEventListener('load', () => {popup.focus(); popup.print();}, {once:true}); popup.document.close();
  return true;
}
