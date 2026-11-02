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
  const record = source.kind === "saved" ? source.record : null;
  const preview = record ? record.snapshot?.before : source.kind === "draft" ? source.preview : undefined;
  if (!preview) throw Error("Saved settlement snapshot is required for client statements");

  const rows: string[] = [], merges: string[] = [];
  let current = 0;
  const next = (): number => ++current;
  const merge = (a: string, b: string): void => {merges.push(a + ":" + b);};
  const fullLine = (label: string, style = 4, height = 27): void => {
    const r = next();
    rows.push(rowXml(r, [textCell("A", r, label, style)], height));
    merge("A" + r, "F" + r);
  };
  const section = (label: string): void => fullLine(label, 3, 32);
  const amountLine = (label: string, amount: string, emphasized = false): void => {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, label, emphasized ? 10 : 8),
      numericCell("F", r, amount, emphasized ? 11 : 9),
    ], emphasized ? 35 : 29));
    merge("A" + r, "E" + r);
  };
  const gap = (): void => {next();};
  const proposal = source.kind === "draft" ? source.proposal : undefined;
  const balance = record?.balanceAfter ?? proposal?.remaining ?? preview.balanceBefore;
  const balanceNumber = Number(balance);
  if (!Number.isFinite(balanceNumber)) throw Error("Invalid customer statement balance");
  const balanceLabel = balanceNumber < 0
    ? (record ? "رصيد لصالحك بعد التصفية" : "رصيد لصالحك")
    : record ? "المتبقي عليك بعد التصفية"
      : proposal ? "المتبقي المتوقع بعد المقترح" : "المبلغ المستحق عليك";

  // Give the customer the answer first; technical ledger movements belong in the internal export.
  fullLine("طَبعة | كشف حساب العميل", 1, 42);
  fullLine("العميل: " + preview.customerName +
    (preview.customerPhone ? " | الهاتف: " + preview.customerPhone : ""), 2, 31);
  if (record) {
    fullLine("رقم التصفية: " + record.number + " | التاريخ: " + formattedDate(record.settledOn), 4, 27);
    fullLine(record.needsReview
      ? "تنبيه: هذا الحساب التاريخي يحتاج مراجعة بسبب معاملة لاحقة."
      : "كشف للحساب وقت تسجيل التصفية.", 2, 28);
  } else {
    fullLine("كشف للمراجعة قبل التصفية | الشغل حتى " + formattedDate(preview.dateTo), 2, 29);
    fullLine("لم يتم تسجيل تحصيل أو خصم جديد بهذا الكشف.", 4, 27);
  }
  fullLine("الدفعات السابقة محسوبة حتى " + formattedDate(preview.paymentsThrough), 4, 27);
  gap();

  const hero = next();
  rows.push(rowXml(hero, [
    textCell("A", hero, balanceLabel, 10),
    numericCell("F", hero, String(Math.abs(balanceNumber)), 11),
  ], 44));
  merge("A" + hero, "E" + hero);
  gap();
  section("ملخص حسابك (جنيه مصري)");
  if (Number(preview.openingBalance) !== 0)
    amountLine("رصيد سابق على الحساب", preview.openingBalance);
  amountLine("قيمة الشغل المستلّم", preview.deliveredTotal);
  amountLine("مدفوعات سابقة (صافي)", preview.netPayments);
  if (Number(preview.discountsTotal ?? "0.00") !== 0)
    amountLine("خصومات سابقة", preview.discountsTotal ?? "0.00");
  amountLine("المستحق قبل هذه التصفية", preview.balanceBefore, true);

  if (record) {
    if (Number(record.discountAmount ?? "0.00") > 0)
      amountLine("خصم في هذه التصفية", record.discountAmount);
    amountLine("المدفوع في هذه التصفية", record.amountCollected);
    amountLine("المتبقي بعد التصفية", record.balanceAfter, true);
    if (record.receiptNumber)
      fullLine("رقم إيصال الدفعة: " + record.receiptNumber, 4, 27);
  } else if (proposal) {
    if (Number(proposal.discount) > 0)
      amountLine("خصم مقترح (غير مسجل)", proposal.discount);
    if (Number(proposal.collected) > 0)
      amountLine("دفعة مقترحة (غير مدفوعة)", proposal.collected);
    amountLine("المتبقي المتوقع", proposal.remaining, true);
    if (proposal.reason && Number(proposal.discount) > 0)
      fullLine("سبب الخصم المقترح: " + proposal.reason, 4, 28);
    fullLine("الخصم والدفعة أعلاه مجرد اقتراح، وليسا إيصال دفع أو تصفية مسجلة.", 2, 32);
  }
  gap();

  section("تفاصيل الشغل الذي استلمته");
  const header = next();
  rows.push(rowXml(header, [
    textCell("A", header, "رقم الأوردر", 3),
    textCell("B", header, "الشغل", 3),
    textCell("C", header, "الكمية", 3),
    textCell("D", header, "سعر الوحدة", 3),
    textCell("E", header, "القيمة (ج.م)", 3),
    textCell("F", header, "تاريخ التسليم", 3),
  ], 32));

  if (!preview.items.length) {
    fullLine("لا يوجد شغل مستلّم في هذا الكشف.", 4, 28);
  } else {
    for (const item of preview.items) {
      const r = next();
      const dimensions = item.widthCm && item.heightCm
        ? " | " + item.widthCm + " × " + item.heightCm + " سم" : "";
      rows.push(rowXml(r, [
        textCell("A", r, item.orderNumber || "—"),
        textCell("B", r, item.description + dimensions +
          (item.specifications ? " | " + item.specifications : "")),
        numericCell("C", r, item.quantity, 7),
        numericCell("D", r, item.unitPrice, 12),
        numericCell("E", r, item.amount),
        dateCell("F", r, item.deliveryDate),
      ], item.specifications ? 40 : 30));
    }
  }
  gap();
  fullLine("الدفعات السابقة هي صافي المبالغ المعتمدة بعد أي إلغاء أو رد.", 4, 27);
  fullLine(record
    ? "هذا الكشف يوضح الحساب وقت التصفية بتاريخ " + formattedDate(record.settledOn) +
      " وقد يتغير الرصيد مع معاملات لاحقة."
    : "كشف للمراجعة فقط. المبلغ المستحق قد يتغير قبل تسجيل التصفية.", 4, 34);

  const widths = [27, 62, 15, 20, 23, 23].map((width, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) +
    '" width="' + width + '" customWidth="1"/>').join("");
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
  window.setTimeout(() => {if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);}, 1000);
}
