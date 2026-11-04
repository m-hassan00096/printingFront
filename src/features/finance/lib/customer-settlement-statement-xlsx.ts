import type { AccountSettlementPreview, AccountSettlementRecord } from "../types/account-settlement.types";
import { stylesXml, zipStored } from "./settlement-xlsx";
import { clientPeriodBreakdown, suggestedStatementFrom } from "./customer-settlement-period";
import { cairoToday } from "./account-display";

type DraftProposal = {discount: string; collected: string; remaining: string; reason?: string};
export type CustomerSettlementStatement =
  | {kind: "draft"; preview: AccountSettlementPreview; previous?: AccountSettlementRecord | null; periodFrom?: string; proposal?: DraftProposal}
  | {kind: "saved"; record: AccountSettlementRecord; previous?: AccountSettlementRecord | null; periodFrom?: string};

/**
 * A client-facing statement, separate from the immutable internal settlement evidence.
 * The draft is explicitly NOT a receipt or a posted financial settlement.
 * All booked figures come from the backend preview or a saved immutable snapshot.
 */
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
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
function buildSheet(source: CustomerSettlementStatement, target: "summary" | "details"): string {
  const record = source.kind === "saved" ? source.record : null;
  const preview = record ? record.snapshot?.before : source.kind === "draft" ? source.preview : undefined;
  if (!preview) throw Error("Saved settlement snapshot is required for client statements");
  const previous = source.previous ?? null;
  const periodFrom = record?.dateFrom ?? source.periodFrom ?? suggestedStatementFrom(preview.dateTo, previous);
  if (dateSerial(periodFrom) === null || dateSerial(preview.dateTo) === null || periodFrom > preview.dateTo)
    throw Error("Invalid customer statement period");
  const breakdown = clientPeriodBreakdown(preview, periodFrom, previous);
  const periodOrders = new Set(breakdown.items.map(item => item.orderId)).size;
  const rows: string[] = [], merges: string[] = [];
  let current = 0;
  const next = (): number => ++current;
  const merge = (a: string, b: string): void => {merges.push(a + ":" + b);};
  const fullLine = (label: string, style = 4, height = 28): void => {
    const r = next();
    rows.push(rowXml(r, [textCell("A", r, label, style)], height));
    merge("A" + r, "F" + r);
  };
  const section = (label: string): void => fullLine(label, 2, 30);
  const amountLine = (label: string, amount: string, emphasized = false): void => {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, label, emphasized ? 10 : 4),
      numericCell("F", r, amount, emphasized ? 11 : 5),
    ], emphasized ? 38 : 28));
    merge("A" + r, "E" + r);
  };
  const gap = (): void => {next();};
  const proposal = source.kind === "draft" ? source.proposal : undefined;
  // Client-facing: show accounting context once in the summary, and keep
  // the details sheet for the delivered work and prior cash movements only.
  if (target === "summary") {
    fullLine("مطبعة المصرية | تقرير تصفية الحساب", 1, 39);
    fullLine("العميل: " + preview.customerName +
      (preview.customerPhone ? " | " + preview.customerPhone : ""), 4, 28);
    fullLine("الفترة: " + formattedDate(periodFrom) +
      " إلى " + formattedDate(preview.dateTo), 4, 28);
    if (preview.paymentsThrough !== preview.dateTo)
      fullLine("التحصيلات والردود حتى: " + formattedDate(preview.paymentsThrough), 4, 25);

    if (record) {
      fullLine("رقم التصفية: " + record.number +
        " | تاريخها: " + formattedDate(record.settledOn), 4, 27);
      if (record.needsReview)
        fullLine("تنبيه: حدثت تغييرات بعد التصفية؛ راجع الرصيد الحالي.", 2, 28);
      if (!record.dateFrom)
        fullLine("ملاحظة: تاريخ بداية هذه التصفية القديمة غير مسجّل.", 4, 27);
    } else {
      fullLine("معاينة فقط — التصفية لم تُسجّل بعد.", 2, 28);
    }
    if (previous?.needsReview)
      fullLine("تنبيه: تغيّرت بيانات تصفية سابقة؛ راجع الحساب الحالي.", 2, 28);

    gap();
    section("ملخص الحساب (ج.م)");
    amountLine("رصيد سابق", breakdown.startingBalance);
    amountLine("قيمة الشغل المستلّم", breakdown.deliveredPeriod);
    if (Number(breakdown.workAdjustments) !== 0)
      amountLine("تعديلات أخرى على الشغل", breakdown.workAdjustments);
    amountLine("صافي المدفوعات والردود", breakdown.netPaymentsSince);
    if (Number(breakdown.newDiscounts) !== 0)
      amountLine("خصومات سابقة", breakdown.newDiscounts);
    if (Number(breakdown.otherAdjustments) !== 0)
      amountLine("تسويات أخرى", breakdown.otherAdjustments);

    if (record) {
      amountLine("المستحق قبل التصفية", preview.balanceBefore);
      if (Number(record.discountAmount ?? "0.00") > 0)
        amountLine("خصم التصفية", record.discountAmount);
      amountLine("المدفوع عند التصفية", record.amountCollected);
      amountLine(Number(record.balanceAfter) < 0 ? "رصيد لصالح العميل" : "المتبقي بعد التصفية",
        String(Math.abs(Number(record.balanceAfter))), true);
      if (record.receiptNumber)
        fullLine("رقم إيصال التحصيل: " + record.receiptNumber, 4, 26);
    } else if (proposal) {
      amountLine("المستحق حاليًا", preview.balanceBefore);
      if (Number(proposal.discount) > 0)
        amountLine("خصم مقترح (غير مسجّل)", proposal.discount);
      if (Number(proposal.collected) > 0)
        amountLine("دفعة مقترحة (لم تُحصّل)", proposal.collected);
      amountLine("المتبقي المتوقع بعد الاعتماد", proposal.remaining, true);
      fullLine("المبالغ المقترحة لا تُعتبر مدفوعة قبل تسجيل التصفية.", 4, 27);
    } else {
      const due = Number(preview.balanceBefore);
      amountLine(due < 0 ? "رصيد لصالح العميل" : "المستحق حاليًا",
        String(Math.abs(due)), true);
    }
  }

  if (target === "details") {
    // No repeated customer, phone, period, settlement number, balance or
    // receipt on this tab: all of that belongs to the first worksheet.
    fullLine("تفاصيل الشغل والمدفوعات", 1, 39);
    section("الشغل المستلّم (" + periodOrders + " أوردر)");
    {
      const r = next();
      rows.push(rowXml(r, [
        textCell("A", r, "رقم الأوردر", 3),
        textCell("B", r, "تفاصيل الشغل", 3),
        textCell("C", r, "الكمية", 3),
        textCell("D", r, "سعر الوحدة", 3),
        textCell("E", r, "الإجمالي (ج.م)", 3),
        textCell("F", r, "تاريخ التسليم", 3),
      ], 30));
    }
    if (!breakdown.items.length) {
      fullLine("لا يوجد شغل مستلّم خلال الفترة.", 4, 28);
    } else {
      for (const item of breakdown.items) {
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
        ], item.specifications ? 42 : 32));
      }
    }
    {
      const r = next();
      rows.push(rowXml(r, [
        textCell("A", r, "إجمالي الشغل المستلّم", 10),
        numericCell("E", r, breakdown.deliveredPeriod, 11),
      ], 34));
      merge("A" + r, "D" + r);
    }
    gap();

    section("المدفوعات والردود");
    {
      const r = next();
      rows.push(rowXml(r, [
        textCell("A", r, "التاريخ", 3),
        textCell("B", r, "رقم الإيصال", 3),
        textCell("C", r, "العملية", 3),
        textCell("F", r, "المبلغ (ج.م)", 3),
      ], 30));
      merge("C" + r, "E" + r);
    }
    if (!breakdown.payments.length) {
      fullLine("لا توجد مدفوعات أو ردود خلال الفترة.", 4, 28);
    } else {
      for (const payment of breakdown.payments) {
        const r = next();
        const signed = Number(payment.signedAmount);
        if (!Number.isFinite(signed)) throw Error("Invalid customer payment amount");
        rows.push(rowXml(r, [
          dateCell("A", r, payment.effectiveDate),
          textCell("B", r, payment.receiptNumber || "—"),
          textCell("C", r, payment.typeLabel),
          numericCell("F", r, -signed),
        ], 30));
        merge("C" + r, "E" + r);
      }
    }
    amountLine("صافي المدفوعات والردود", breakdown.netPaymentsSince);
  }

  const widths = (target === "summary" ? [30, 14, 14, 14, 14, 24] : [20, 55, 13, 17, 20, 20]).map((width, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) +
    '" width="' + width + '" customWidth="1"/>').join("");
  return DECL + '<worksheet xmlns="' + NS +
    '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0">' +
    (target === "details" ? '<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>' : '') +
    '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>' +
    widths + '</cols><sheetData>' + rows.join("") + '</sheetData>' +
    '<mergeCells count="' + merges.length + '">' +
    merges.map(ref => '<mergeCell ref="' + ref + '"/>').join("") + '</mergeCells>' +
    '<printOptions horizontalCentered="1"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>' +
    (target === "summary"
      ? '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>'
      : '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>') +
    '</worksheet>';
}

export function buildCustomerSettlementStatementXlsx(source: CustomerSettlementStatement): Uint8Array {
  const summary = buildSheet(source, "summary");
  const details = buildSheet(source, "details");
  // Keep the established native OOXML exporter (no backend request, no new dependency).
  return zipStored([
    {name: "[Content_Types].xml", content: DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name: "_rels/.rels", content: DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: "xl/workbook.xml", content: DECL + '<workbook xmlns="' + NS +
      '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets>' +
      '<sheet name="ملخص التصفية" sheetId="1" r:id="rId1"/>' +
      '<sheet name="تفاصيل التصفية" sheetId="2" r:id="rId2"/>' +
      '</sheets></workbook>'},
    {name: "xl/_rels/workbook.xml.rels", content: DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name: "xl/styles.xml", content: stylesXml()
      .replaceAll("FF1C3156", "FF6250C9")
      .replaceAll("FFE9F1FA", "FFF0EDFC")
      .replaceAll("FF147D76", "FF15845F")
      .replaceAll("FF163B67", "FF5140AD")
      .replaceAll("FF263348", "FF252A40")
      .replaceAll("FFD9E3EE", "FFE5E8F1")},
    {name: "xl/worksheets/sheet1.xml", content: summary},
    {name: "xl/worksheets/sheet2.xml", content: details},
  ]);
}
/**
 * Human-readable Windows-safe name; the two-sheet report content is unchanged.
 * Saved exports are named by the settlement's recorded date, while draft
 * previews use Cairo's current date (never the delivered-work cutoff).
 */
export function customerSettlementStatementFilename(
  source: CustomerSettlementStatement,
  today = cairoToday(),
): string {
  const name = source.kind === "saved"
    ? source.record.snapshot?.before.customerName ?? ""
    : source.preview.customerName;
  const customer = Array.from(name
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
  ).slice(0, 80).join("") || "عميل";
  const date = source.kind === "saved" ? source.record.settledOn : today;
  if (dateSerial(date) === null) throw Error("Invalid customer settlement filename date");
  return "تقرير تصفية " + customer + "_" + date + ".xlsx";
}

export function exportCustomerSettlementStatementXlsx(source: CustomerSettlementStatement): void {
  const bytes = buildCustomerSettlementStatementXlsx(source);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {type: XLSX_MIME});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = customerSettlementStatementFilename(source);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);}, 1000);
}
