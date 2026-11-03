import type { AccountSettlementPreview, AccountSettlementRecord } from "../types/account-settlement.types";
import { stylesXml, zipStored } from "./settlement-xlsx";
import { clientPeriodBreakdown, suggestedStatementFrom } from "./customer-settlement-period";

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
  const section = (label: string): void => fullLine(label, 3, 33);
  const amountLine = (label: string, amount: string, emphasized = false): void => {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, label, emphasized ? 10 : 8),
      numericCell("F", r, amount, emphasized ? 11 : 9),
    ], emphasized ? 38 : 28));
    merge("A" + r, "E" + r);
  };
  const gap = (): void => {next();};
  const proposal = source.kind === "draft" ? source.proposal : undefined;
  // The prominent balance is always real, never hypothetical unposted cash.
  const actualBalance = record?.balanceAfter ?? preview.balanceBefore;
  const amount = Number(actualBalance);
  if (!Number.isFinite(amount)) throw Error("Invalid customer statement balance");
  const balanceLabel = amount < 0 ? "رصيد لصالح العميل" :
    record ? "المتبقي بعد التصفية المسجّلة" : "المطلوب من العميل الآن";

  fullLine(target === "summary" ? "طَبعة | ملخص تصفية حساب العميل" : "طَبعة | تفاصيل تصفية حساب العميل", 1, 44);
  fullLine("العميل: " + preview.customerName +
    (preview.customerPhone ? " | الهاتف: " + preview.customerPhone : ""), 2, 31);
  fullLine("الأوردرات المستلّمة من " + formattedDate(periodFrom) +
    " إلى " + formattedDate(preview.dateTo), 2, 31);
  fullLine("الدفعات والحركات المالية محسوبة حتى " + formattedDate(preview.paymentsThrough), 4, 26);
  if (record && !record.dateFrom)
    fullLine("تصفية قديمة: بداية التقرير للعرض فقط وغير مسجّلة ضمن تاريخ التصفية الأصلي.", 4, 29);
  if (record) {
    fullLine("رقم التصفية الحالية: " + record.number +
      " | تم تسجيلها: " + formattedDate(record.settledOn), 2, 29);
    if (record.needsReview) fullLine("تنبيه: حصل تغيير مالي لاحق ويجب مراجعة الرصيد الحالي.", 2, 31);
    else fullLine("هذا كشف تاريخي وقت تسجيل التصفية وليس الرصيد الحالي بالضرورة.", 4, 29);
  } else {
    fullLine("تصفية جديدة — لم تُسجّل بعد، ولا يوجد رقم تصفية حالية.", 2, 30);
  }
  if (previous) {
    fullLine("آخر تصفية سابقة: " + previous.number + " | بتاريخ " +
      formattedDate(previous.settledOn) + " | الشغل حتى " +
      formattedDate(previous.dateTo), 2, 32);
    if (previous.needsReview)
      fullLine("تنبيه: حدث تغيير بعد آخر تصفية سابقة وقد يؤثر على حساب الفترة.", 2, 30);
  } else {
    fullLine("لا توجد تصفية سابقة مسجّلة لهذا العميل.", 4, 28);
  }
  if (target === "summary") {
    fullLine("عدد الأوردرات المستلّمة خلال الفترة: " + periodOrders, 4, 28);
    gap();
    const hero = next();
  rows.push(rowXml(hero, [
    textCell("A", hero, balanceLabel, 10),
    numericCell("F", hero, Math.abs(amount), 11),
  ], 46));
  merge("A" + hero, "E" + hero);
  gap();

  section("ملخص الحساب (جنيه مصري)");
  amountLine(previous ? "المتبقي من آخر تصفية" : "الرصيد المرحّل قبل الفترة",
    breakdown.startingBalance);
  amountLine(previous ? "شغل مستلّم بعد آخر تصفية" : "إجمالي الشغل المستلّم خلال الفترة",
    breakdown.deliveredPeriod);
  if (Number(breakdown.workAdjustments) !== 0)
    amountLine("شغل أو تعديلات خارج أوردرات الفترة المعروضة", breakdown.workAdjustments);
  amountLine(previous ? "صافي مدفوعات بعد آخر تصفية" : "صافي مدفوعات خلال الفترة",
    breakdown.netPaymentsSince);
  if (Number(breakdown.newDiscounts) !== 0)
    amountLine("خصومات مسجّلة منذ آخر تصفية (ليست تحصيلًا)", breakdown.newDiscounts);
  if (Number(breakdown.otherAdjustments) !== 0)
    amountLine("تغيّرات مالية أخرى في الحساب", breakdown.otherAdjustments);
  amountLine("المستحق قبل التصفية الحالية", preview.balanceBefore, true);

  if (record) {
    if (Number(record.discountAmount ?? "0.00") > 0)
      amountLine("خصم التصفية الحالية (ليس مبلغًا مدفوعًا)", record.discountAmount);
    amountLine("المبلغ المدفوع في التصفية الحالية", record.amountCollected);
    amountLine("المتبقي بعد التصفية الحالية", record.balanceAfter, true);
    if (record.receiptNumber) fullLine("إيصال دفعة التصفية الحالية: " + record.receiptNumber, 4, 27);
  } else if (proposal) {
    if (Number(proposal.discount) > 0) amountLine("خصم مقترح — غير مسجّل", proposal.discount);
    if (Number(proposal.collected) > 0) amountLine("دفعة متوقعة — لم تُستلم", proposal.collected);
    amountLine("المتبقي المتوقع إذا تم اعتماد المقترح", proposal.remaining, true);
    if (proposal.reason && Number(proposal.discount) > 0)
      fullLine("سبب الخصم المقترح: " + proposal.reason, 4, 27);
    fullLine("المقترح ليس إيصال سداد ولا يُخصم من المستحق الفعلي قبل التسجيل.", 2, 31);
  }
    gap();
    fullLine("لمراجعة تفاصيل الأوردرات وحركات الدفع والرد، افتح ورقة «تفاصيل التصفية».", 4, 34);
  }

  if (target === "details") {
    section("الأوردرات التي تم استلامها خلال الفترة (" + periodOrders + " أوردر)");
  {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, "رقم الأوردر", 3),
      textCell("B", r, "تفاصيل الشغل", 3),
      textCell("C", r, "الكمية", 3),
      textCell("D", r, "سعر الوحدة", 3),
      textCell("E", r, "القيمة (ج.م)", 3),
      textCell("F", r, "تاريخ التسليم", 3),
    ], 32));
  }
  if (!breakdown.items.length) {
    fullLine("لا توجد أوردرات مستلمة جديدة بين التاريخين.", 4, 30);
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
      ], item.specifications ? 41 : 31));
    }
  }
  {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, "إجمالي أوردرات الفترة (" + periodOrders + " أوردر)", 10),
      numericCell("E", r, breakdown.deliveredPeriod, 11),
    ], 36));
    merge("A" + r, "D" + r);
  }
  gap();

  section(previous ? "مدفوعات العميل بعد آخر تصفية" : "مدفوعات العميل خلال الفترة");
  {
    const r = next();
    rows.push(rowXml(r, [
      textCell("A", r, "تاريخ الحركة", 3),
      textCell("B", r, "رقم الإيصال", 3),
      textCell("C", r, "نوع الحركة", 3),
      textCell("F", r, "صافي الدفعة (ج.م)", 3),
    ], 32));
    merge("C" + r, "E" + r);
  }
  if (!breakdown.payments.length) {
    fullLine("لا توجد دفعات أو ردود مسجّلة في هذه الفترة.", 4, 30);
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
  amountLine("صافي المدفوعات بعد الرد والإلغاء", breakdown.netPaymentsSince, true);
  gap();

  section(record ? "إجراءات التصفية المسجّلة" : "حالة التصفية الحالية");
  amountLine("المستحق قبل التصفية الحالية", preview.balanceBefore);
  if (record) {
    if (Number(record.discountAmount ?? "0.00") > 0)
      amountLine("خصم هذه التصفية (ليس تحصيلًا نقديًا)", record.discountAmount);
    amountLine("المبلغ المحصل فعليًا في هذه التصفية", record.amountCollected);
    amountLine("المتبقي بعد الخصم والتحصيل", record.balanceAfter, true);
    if (record.receiptNumber)
      fullLine("إيصال التحصيل الحالي: " + record.receiptNumber, 4, 29);
  } else if (proposal) {
    if (Number(proposal.discount) > 0)
      amountLine("خصم مقترح — غير مسجّل", proposal.discount);
    if (Number(proposal.collected) > 0)
      amountLine("تحصيل متوقع — غير مسجّل", proposal.collected);
    amountLine("المتبقي المتوقع عند اعتماد المقترح", proposal.remaining, true);
    fullLine("هذه مجرد مبالغ مقترحة؛ لم يتم تسجيل تحصيل أو خصم فعلي.", 2, 34);
  } else {
    fullLine("التصفية الحالية لم تُسجّل؛ لا يوجد تحصيل أو خصم جديد.", 4, 30);
  }
  gap();
  fullLine("الدفعات الموجبة تعني مالًا تم استلامه؛ والسالبة ردًا أو إلغاء تحصيل.", 4, 30);
  fullLine("الأرصدة التراكمية لكل حركة وتفاصيل الحركات الأخرى تُراجع من كشف الحساب داخل النظام.", 4, 34);
  fullLine(record
    ? "هذا كشف تاريخي. راجع الرصيد الحالي إذا حدثت دفعات أو تعديلات لاحقة."
    : "للمراجعة قبل التصفية فقط. المبلغ المقترح لا يصبح مدفوعًا إلا بعد تسجيله.", 4, 35);
  }

  const widths = (target === "summary" ? [26, 14, 14, 14, 14, 25] : [27, 61, 18, 19, 23, 25]).map((width, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) +
    '" width="' + width + '" customWidth="1"/>').join("");
  return DECL + '<worksheet xmlns="' + NS +
    '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0">' +
    (target === "details" ? '<pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/>' : '') +
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
export function exportCustomerSettlementStatementXlsx(source: CustomerSettlementStatement): void {
  const bytes = buildCustomerSettlementStatementXlsx(source);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {type: XLSX_MIME});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeId = source.kind === "draft"
    ? "draft-" + source.preview.customerId + "-" + source.preview.dateTo
    : source.record.number.replace(/[^A-Za-z0-9_-]/g, "-");
  const to = source.kind === "draft" ? source.preview.dateTo : source.record.dateTo;
  const from = source.periodFrom ?? to.slice(0, 8) + "01";
  link.href = url;
  link.download = "tabaa-settlement-report-" + safeId + "-" + from + "-to-" + to + ".xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);}, 1000);
}
