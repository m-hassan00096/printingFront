import type { AccountSettlementPreview, AccountSettlementRecord } from "../types/account-settlement.types";
import { stylesXml, zipStored } from "./settlement-xlsx";

type DraftProposal = {discount: string; collected: string; remaining: string; reason?: string};
export type CustomerSettlementStatement =
  | {kind: "draft"; preview: AccountSettlementPreview; proposal?: DraftProposal}
  | {kind: "saved"; record: AccountSettlementRecord};

/**
 * A client-facing statement, separate from the immutable internal settlement evidence.
 * The draft is explicitly NOT a receipt or a posted financial settlement.
 * All booked figures come from the backend preview or a saved immutable snapshot.
 */
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const COLS = ["A", "B", "C", "D", "E", "F"] as const;
const xml = (value: string): string => [...value].filter(char => {
  const cp = char.codePointAt(0) ?? 0;
  return cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff);
}).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function textCell(col: string, row: number, value: string, style = 4): string {
  // Inline strings never execute a malicious customer-supplied Excel formula.
  return '<c r="' + col + row + '" t="inlineStr" s="' + style +
    '"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
}
function numericCell(col: string, row: number, value: number | string, style = 5): string {
  const parsed = Number(value);
  if (value === "" || !Number.isFinite(parsed)) throw Error("Invalid customer statement number");
  return '<c r="' + col + row + '" s="' + style + '"><v>' + parsed + '</v></c>';
}
function dateSerial(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
  return Math.round(d.getTime() / 86400000) + 25569;
}
function dateCell(col: string, row: number, date: string): string {
  const serial = dateSerial(date);
  return serial === null ? textCell(col, row, date) : numericCell(col, row, serial, 6);
}
function formattedDate(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return parts ? parts[3] + "/" + parts[2] + "/" + parts[1] : value;
}
function rowXml(row: number, cells: string[], height = 27): string {
  return '<row r="' + row + '" ht="' + height + '" customHeight="1">' + cells.join("") + '</row>';
}
function buildSheet(source: CustomerSettlementStatement): string {
  const saved = source.kind === "saved";
  const record = saved ? source.record : null;
  const preview = saved ? record!.snapshot?.before : source.preview;
  if (!preview) throw Error("Saved settlement snapshot is required for client statements");

  const rows: string[] = [], merges: string[] = [];
  let current = 0;
  const next = (): number => ++current;
  const merged = (start: string, end: string): void => {merges.push(start + ":" + end);};
  const fullLine = (label: string, style = 4, height = 27): void => {
    const r = next();
    rows.push(rowXml(r, [textCell("A", r, label, style)], height));
    merged("A" + r, "F" + r);
  };
  const section = (label: string): void => fullLine(label, 3, 33);
  const entry = (label: string, value: string, emphasize = false): void => {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, label, emphasize ? 10 : 8),
      numericCell("F", r, value, emphasize ? 11 : 9),
    ], emphasize ? 35 : 28));
    merged("A" + r, "E" + r);
  };
  const gap = (): void => {next();};

  fullLine("طَبعة | كشف حساب العميل للتصفية", 1, 42);
  fullLine("العميل: " + preview.customerName + (preview.customerPhone ? " | " + preview.customerPhone : ""), 2, 30);
  fullLine("الشغل المستلّم حتى " + formattedDate(preview.dateTo) +
    " | الدفعات محسوبة حتى " + formattedDate(preview.paymentsThrough), 2, 30);
  if (record) {
    fullLine("تصفية مسجلة: " + record.number + " | تاريخ التسجيل: " + formattedDate(record.settledOn), 2, 30);
    fullLine(record.needsReview
      ? "تنبيه: هذه التصفية التاريخية تحتاج مراجعة بسبب تغيير لاحق في الحساب."
      : "كشف تاريخي وقت تسجيل التصفية، وليس بيان الرصيد الحالي للعميل.", 2, 31);
  } else {
    fullLine("كشف للمراجعة قبل التصفية — لم يتم تسجيل تصفية أو تحصيل جديد بهذا الكشف.", 2, 33);
    fullLine("البيانات تمثل الرصيد عند إصدار الكشف وقد تتغير قبل اعتماد التصفية.", 4, 29);
  }
  fullLine("يشمل الشغل المستلّم فقط، مع صافي حركات التحصيل حتى التاريخ الموضّح.", 4, 27);
  gap();
  section("ملخص حساب التصفية (جنيه مصري)");
  entry("الرصيد الافتتاحي المحتسب", preview.openingBalance);
  entry("إجمالي قيمة الشغل المستلّم", preview.deliveredTotal);
  entry("صافي التحصيلات السابقة بعد الردود والإلغاءات", preview.netPayments);
  entry("الخصومات المسجلة سابقًا (ليست أموالًا محصّلة)", preview.discountsTotal ?? "0.00");
  entry("الرصيد قبل التصفية (موجب: مستحق / سالب: رصيد للعميل)", preview.balanceBefore, true);

  if (record) {
    entry("خصم هذه التصفية (ليس تحصيلًا)", record.discountAmount ?? "0.00");
    entry("المبلغ المحصّل فعليًا عند التصفية", record.amountCollected);
    entry("الرصيد المتبقي وقت تسجيل التصفية", record.balanceAfter, true);
    if (record.discountReason && Number(record.discountAmount) > 0)
      fullLine("سبب الخصم: " + record.discountReason, 4, 30);
    if (record.receiptNumber) fullLine("رقم إيصال التحصيل: " + record.receiptNumber, 4, 27);
  } else if (source.kind === "draft" && source.proposal) {
    entry("خصم مقترح — لم يُسجّل", source.proposal.discount);
    entry("تحصيل متوقع — لم يُستلم ولم يُسجّل", source.proposal.collected);
    entry("رصيد متوقع فقط إذا اعتُمد المقترح", source.proposal.remaining, true);
    if (Number(source.proposal.discount) > 0 && source.proposal.reason)
      fullLine("سبب الخصم المقترح: " + source.proposal.reason, 4, 29);
    fullLine("الخصم والتحصيل أعلاه مقترحان فقط؛ لا يمثلان إيصال قبض أو إبراء ذمة.", 2, 32);
  }
  gap();
  section("تفاصيل الشغل المستلّم المشمول في التصفية");
  {
    const r = next();
    rows.push(rowXml(r, ["تاريخ التسليم", "رقم الأوردر", "الشغل / المقاسات",
      "الكمية", "سعر الوحدة", "الإجمالي (ج.م)"]
      .map((heading, i) => textCell(COLS[i], r, heading, 3)), 33));
  }
  if (preview.items.length === 0) {
    fullLine("لا توجد بنود شغل مستلّم في هذا النطاق.", 4, 29);
  } else {
    for (const item of preview.items) {
      const r = next();
      const dimensions = item.widthCm && item.heightCm
        ? " | " + item.widthCm + " × " + item.heightCm + " سم" : "";
      const description = item.description + dimensions +
        (item.specifications ? " | " + item.specifications : "");
      rows.push(rowXml(r, [
        dateCell("A", r, item.deliveryDate),
        textCell("B", r, item.orderNumber || "—"),
        textCell("C", r, description),
        numericCell("D", r, item.quantity, 7),
        numericCell("E", r, item.unitPrice, 12),
        numericCell("F", r, item.amount),
      ], item.specifications ? 42 : 31));
    }
  }
  entry("إجمالي الشغل المستلّم", preview.deliveredTotal, true);
  gap();
  section("تفاصيل حركات التحصيل والرد السابقة (ج.م)");
  {
    const r = next();
    rows.push(rowXml(r, ["التاريخ", "الإيصال", "الحركة", "تحصيل", "رد / إلغاء", "توضيح"]
      .map((heading, i) => textCell(COLS[i], r, heading, 3)), 33));
  }
  if (!preview.payments?.length) {
    fullLine("لا توجد حركات تحصيل أو رد مسجّلة قبل هذه التصفية.", 4, 29);
  } else {
    for (const payment of preview.payments) {
      const r = next();
      const signed = Number(payment.signedAmount);
      if (!Number.isFinite(signed)) throw Error("Invalid customer payment movement");
      rows.push(rowXml(r, [
        dateCell("A", r, payment.effectiveDate),
        textCell("B", r, payment.receiptNumber || "—"),
        textCell("C", r, payment.typeLabel),
        ...(signed < 0 ? [numericCell("D", r, -signed)] : []),
        ...(signed > 0 ? [numericCell("E", r, signed)] : []),
        textCell("F", r, payment.outsideWorkScope ? "دفعة مرتبطة بشغل غير مستلّم" : ""),
      ], 30));
    }
  }
  entry("صافي التحصيلات السابقة بعد الردود والإلغاءات", preview.netPayments, true);
  gap();
  fullLine("صافي الدفعات يشمل كل الحركات المسجلة للعميل حتى تاريخ الكشف، بما فيها العربون.", 4, 33);
  fullLine("الخصومات السابقة مذكورة بإجماليها في الملخص وليست ضمن التحصيلات النقدية.", 4, 33);
  fullLine(record
    ? "كشف تاريخي للتصفية المحددة؛ قد تختلف مديونية العميل الحالية بسبب حركات لاحقة."
    : "كشف للمراجعة فقط؛ يُعتمد سداد أو خصم جديد حصريًا بعد تسجيله رسميًا في النظام.", 2, 33);
  const widths = [20,27,62,17,22,34].map((w, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) +
    '" width="' + w + '" customWidth="1"/>').join("");
  return DECL + '<worksheet xmlns="' + NS +
    '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0">' +
    '<pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>' +
    widths + '</cols><sheetData>' + rows.join("") + '</sheetData>' +
    '<mergeCells count="' + merges.length + '">' +
    merges.map(ref => '<mergeCell ref="' + ref + '"/>').join("") + '</mergeCells>' +
    '<printOptions horizontalCentered="1"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
}
export function buildCustomerSettlementStatementXlsx(source: CustomerSettlementStatement): Uint8Array {
  const worksheet = buildSheet(source);
  return zipStored([
    {name: "[Content_Types].xml", content: DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name: "_rels/.rels", content: DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: "xl/workbook.xml", content: DECL + '<workbook xmlns="' + NS +
      '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets>' +
      '<sheet name="كشف حساب التصفية" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name: "xl/_rels/workbook.xml.rels", content: DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name: "xl/styles.xml", content: stylesXml()},
    {name: "xl/worksheets/sheet1.xml", content: worksheet},
  ]);
}
export function exportCustomerSettlementStatementXlsx(source: CustomerSettlementStatement): void {
  const bytes = buildCustomerSettlementStatementXlsx(source);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {type: XLSX_MIME});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeId = source.kind === "draft"
    ? "draft-" + source.preview.customerId + "-" + source.preview.dateTo
    : source.record.number.replace(/[^A-Za-z0-9_-]/g, "-");
  link.href = url;
  link.download = "tabaa-customer-settlement-statement-" + safeId + ".xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
