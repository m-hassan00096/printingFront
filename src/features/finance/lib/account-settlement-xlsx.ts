import type { AccountSettlementRecord } from "../types/account-settlement.types";
import { zipStored, stylesXml } from "./settlement-xlsx";

/** Arabic RTL financial evidence, distinct from the delivered-work-only report. */
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function xmlText(text: string): string {
  return [...text].filter(char => {
    const p = char.codePointAt(0) ?? 0;
    return p === 9 || p === 10 || p === 13 || (p >= 32 && p <= 0xd7ff) ||
      (p >= 0xe000 && p <= 0xfffd) || (p >= 0x10000 && p <= 0x10ffff);
  }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function textCell(column: string, row: number, text: string, style = 4): string {
  return '<c r="' + column + row + '" t="inlineStr" s="' + style +
    '"><is><t xml:space="preserve">' + xmlText(text) + '</t></is></c>';
}
function numberCell(column: string, row: number, money: string, style = 5): string {
  const n = Number(money);
  if (!Number.isFinite(n)) throw Error("Invalid financial settlement amount");
  return '<c r="' + column + row + '" s="' + style + '"><v>' + n + '</v></c>';
}
function row(index: number, cells: string[], height = 27): string {
  return '<row r="' + index + '" ht="' + height + '" customHeight="1">' +
    cells.join("") + '</row>';
}

function worksheet(record: AccountSettlementRecord): string {
  const before = record.snapshot?.before;
  if (!before) throw Error("This settlement has no saved report snapshot");

  const rows: string[] = [], merges: string[] = [];
  const merge = (a: string, b: string): void => { merges.push(a + ':' + b); };
  const heading = (r: number, label: string, style = 2): void => {
    rows.push(row(r, [textCell('A', r, label, style)], 29));
    merge('A' + r, 'F' + r);
  };
  heading(1, 'طَبعة | إثبات تصفية حساب العميل', 1);
  heading(2, 'رقم التصفية: ' + record.number);
  heading(3, 'العميل: ' + before.customerName + ' — ' + (before.customerPhone || '—'));
  heading(4, 'الشغل حتى: ' + record.dateTo + ' · تاريخ التصفية: ' + record.settledOn);
  heading(5, 'الدفعات السابقة محسوبة حتى: ' + before.paymentsThrough);
  heading(6, 'النتيجة: ' + record.statusLabel);
  if (record.needsReview) heading(7, 'تحذير: حدث إلغاء أو رد مالي لاحق؛ هذا إثبات تاريخي يحتاج مراجعة.', 2);
  else heading(7, 'هذه الأرقام لقطة وقت تسجيل التصفية، وليست رصيد الحساب الحالي.', 2);

  const summary: Array<[string, string]> = [
    ['الرصيد الافتتاحي المحتسب', before.openingBalance],
    ['قيمة الشغل المستلم', before.deliveredTotal],
    ['صافي الدفعات السابقة (نقد فعلي)', before.netPayments],
    ['الخصومات السابقة (ليست نقدًا)', before.discountsTotal ?? '0.00'],
    ['المستحق قبل هذه التصفية', record.balanceBefore],
    ['خصم هذه التصفية (ليس تحصيلًا)', record.discountAmount ?? '0.00'],
    ['المبلغ المحصل فعليًا في هذه التصفية', record.amountCollected],
    ['المتبقي بعد الخصم والتحصيل', record.balanceAfter],
    ['رصيد حساب العميل الكلي بعد العملية', record.accountBalanceAfter],
  ];
  rows.push(row(9, [textCell('A', 9, 'تفاصيل الحساب', 3),
    textCell('F', 9, 'القيمة بالجنيه', 3)], 31));
  merge('A9', 'E9');
  summary.forEach(([label, amount], idx) => {
    const r = 10 + idx, last = idx === summary.length - 2;
    rows.push(row(r, [textCell('A', r, label, last ? 10 : 8),
      numberCell('F', r, amount, last ? 11 : 9)], last ? 36 : 27));
    merge('A' + r, 'E' + r);
  });

  const noteRow = 20;
  heading(noteRow, 'سبب الخصم: ' + (record.discountReason || 'لا يوجد خصم'));
  heading(noteRow + 1, 'ملاحظات التصفية: ' + (record.note || '—'));
  heading(noteRow + 2, 'إيصال التحصيل المرتبط: ' + (record.receiptNumber || 'لا يوجد تحصيل'));
  heading(noteRow + 4, 'الشغل المستلم المشمول بالحساب', 2);
  const header = noteRow + 5;
  rows.push(row(header, [
    textCell('A', header, 'رقم الأوردر', 3),
    textCell('B', header, 'الشغل', 3),
    textCell('C', header, 'الكمية', 3),
    textCell('D', header, 'سعر القطعة', 3),
    textCell('E', header, 'القيمة', 3),
    textCell('F', header, 'تاريخ التسليم', 3),
  ], 32));
  before.items.forEach((item, index) => {
    const r = header + 1 + index;
    rows.push(row(r, [
      textCell('A', r, item.orderNumber || '—'),
      textCell('B', r, item.description +
        (item.widthCm && item.heightCm ? ' — ' + item.widthCm + ' × ' + item.heightCm + ' سم' : '')),
      numberCell('C', r, String(item.quantity), 7),
      numberCell('D', r, item.unitPrice, 12),
      numberCell('E', r, item.amount),
      textCell('F', r, item.deliveryDate),
    ], 29));
  });
  const end = header + before.items.length + 2;
  heading(end, 'هذا الإثبات لا يعتبر الخصم تحصيلًا، ولا يغلق تلقائيًا أوردرات غير مستلمة.');
  const columns = [27,62,15,21,22,24].map((width, index) =>
    '<col min="' + (index + 1) + '" max="' + (index + 1) +
    '" width="' + width + '" customWidth="1"/>').join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="' + NS + '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="20"/><cols>' + columns + '</cols><sheetData>' + rows.join("") +
    '</sheetData><mergeCells count="' + merges.length + '">' +
    merges.map(ref => '<mergeCell ref="' + ref + '"/>').join("") +
    '</mergeCells><printOptions horizontalCentered="1"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
}

export function buildAccountSettlementXlsx(record: AccountSettlementRecord): Uint8Array {
  const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipStored([
    {name: '[Content_Types].xml', content: decl +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name: '_rels/.rels', content: decl +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: 'xl/workbook.xml', content: decl + '<workbook xmlns="' + NS +
      '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets><sheet name="إثبات التصفية" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name: 'xl/_rels/workbook.xml.rels', content: decl +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name: 'xl/styles.xml', content: stylesXml()},
    {name: 'xl/worksheets/sheet1.xml', content: worksheet(record)},
  ]);
}

export function exportAccountSettlementXlsx(record: AccountSettlementRecord): void {
  const bytes = buildAccountSettlementXlsx(record);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {type: MIME});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'tabaa-account-settlement-' + record.number + '.xlsx';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
