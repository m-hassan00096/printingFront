import { describe, expect, it } from "vitest";
import { buildCustomerSettlementStatementXlsx } from "@/features/finance/lib/customer-settlement-statement-xlsx";
import type { AccountSettlementPreview, AccountSettlementRecord } from "@/features/finance/types/account-settlement.types";

const preview: AccountSettlementPreview = {
  customerId: 7, customerName: "=5+6 & <أحمد>", customerPhone: "01012345678",
  dateTo: "2026-11-01", paymentsThrough: "2026-11-02",
  scope: "cumulative_delivered_work", previewHash: "a".repeat(64),
  openingBalance: "0.00", deliveredTotal: "3000.00",
  grossCollections: "700.00", collectionReversals: "100.00", refundsTotal: "100.00",
  netPayments: "500.00", discountsTotal: "0.00",
  advancesForOtherWork: "150.00", balanceBefore: "2500.00",
  dueNow: "2500.00", creditInScope: "0.00", accountBalance: "3000.00",
  outsideBalance: "500.00", hasWork: true,
  items: [{
    id: 1, orderId: 11, orderNumber: "ORD-11",
    deliveryDate: "2026-11-01", description: "@SUM(A1) <بنر>", specifications: "لون: أسود & أبيض",
    quantity: 10, unitPrice: "300.0000", amount: "3000.00",
    pricingMethod: "square_meter", widthCm: "200.0000", heightCm: "150.0000",
  }],
  payments: [{
    entryId: 90, type: 2, typeLabel: "تحصيل", effectiveDate: "2026-10-01",
    signedAmount: "-700.00", collectionId: 90, receiptNumber: "COL-90",
    orderId: null, outsideWorkScope: false,
  }, {
    entryId: 91, type: 4, typeLabel: "عكس تحصيل", effectiveDate: "2026-10-02",
    signedAmount: "100.00", collectionId: null, receiptNumber: null,
    orderId: null, outsideWorkScope: false,
  }, {
    entryId: 92, type: 5, typeLabel: "رد للعميل", effectiveDate: "2026-10-03",
    signedAmount: "100.00", collectionId: null, receiptNumber: null,
    orderId: 29, outsideWorkScope: true,
  }],
};
const record: AccountSettlementRecord = {
  id: 5, number: "SET-2026-00005", customerId: 7,
  dateFrom: "2026-11-01", dateTo: "2026-11-01", settledOn: "2026-11-02",
  status: "partial", originalStatus: "partial",
  statusLabel: "تصفية جزئية", needsReview: false,
  balanceBefore: "2500.00", discountAmount: "1000.00", discountReason: "خصم & اتفاق",
  discountLedgerEntryId: 93, amountCollected: "500.00",
  balanceAfter: "1000.00", accountBalanceAfter: "1500.00",
  collectionId: 94, receiptNumber: "COL-94",
  createdAt: "2026-11-02T20:00:00Z", createdBy: 1, note: "ملاحظة داخلية",
  snapshot: {
    before: preview,
    after: {...preview, balanceBefore: "1000.00", dueNow: "1000.00",
      netPayments: "1000.00", discountsTotal: "1000.00"},
    receiptNumber: "COL-94",
  },
};

function unzip(archive: Uint8Array): Map<string, string> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder(), files = new Map<string, string>();
  let cursor = 0;
  while (cursor + 30 <= archive.length && view.getUint32(cursor, true) === 0x04034b50) {
    const nameSize = view.getUint16(cursor + 26, true);
    const extraSize = view.getUint16(cursor + 28, true);
    const size = view.getUint32(cursor + 18, true);
    const name = decoder.decode(archive.slice(cursor + 30, cursor + 30 + nameSize));
    const start = cursor + 30 + nameSize + extraSize;
    files.set(name, decoder.decode(archive.slice(start, start + size)));
    cursor = start + size;
  }
  expect(view.getUint32(cursor, true)).toBe(0x02014b50);
  return files;
}
const xmlSummary = (bytes: Uint8Array) => unzip(bytes).get("xl/worksheets/sheet1.xml")!;
const xmlDetails = (bytes: Uint8Array) => unzip(bytes).get("xl/worksheets/sheet2.xml")!;
// Legacy reconciliations check statement data across BOTH purpose-specific sheets.
const xmlSheet = (bytes: Uint8Array) => xmlSummary(bytes) + xmlDetails(bytes);

describe("Customer statement tied to the last saved settlement", () => {
  it("keeps the draft unnumbered, shows true due first, and hides historical movement noise", () => {
    const files = unzip(buildCustomerSettlementStatementXlsx({kind: "draft", preview}));
    expect(files.size).toBe(7);
    expect(files.get("xl/workbook.xml")).toContain('sheet name="ملخص التصفية" sheetId="1" r:id="rId1"');
    expect(files.get("xl/workbook.xml")).toContain('sheet name="تفاصيل التصفية" sheetId="2" r:id="rId2"');
    const summary = files.get("xl/worksheets/sheet1.xml")!;
    const details = files.get("xl/worksheets/sheet2.xml")!;
    const sheet = summary + details;
    expect(summary).toContain('rightToLeft="1"');
    expect(details).toContain('rightToLeft="1"');
    expect(summary).toContain("طَبعة | ملخص تصفية حساب العميل");
    expect(details).toContain("طَبعة | تفاصيل تصفية حساب العميل");
    expect(summary).toContain("ملخص الحساب");
    expect(summary).not.toContain("ORD-11");
    expect(details).toContain("ORD-11");
    expect(details).not.toContain("الرصيد المرحّل قبل الفترة");
    expect(sheet).toContain("المطلوب من العميل الآن");
    expect(sheet).toContain("تصفية جديدة — لم تُسجّل بعد");
    expect(sheet).toContain("لا توجد تصفية سابقة");
    expect(sheet).not.toContain("رقم التصفية الحالية:");
    expect(sheet).toContain("ملخص الحساب");
    expect(sheet).toContain("صافي مدفوعات خلال الفترة");
    expect(sheet).toContain("الأوردرات التي تم استلامها خلال الفترة (1 أوردر)");
    expect(sheet).toContain("من 01/11/2026 إلى 01/11/2026");
    expect(sheet).toContain("ORD-11");
    expect(sheet).toContain("=5+6 &amp; &lt;أحمد&gt;");
    expect(sheet).toContain("@SUM(A1) &lt;بنر&gt;");
    expect(sheet).toContain("لون: أسود &amp; أبيض");
    expect(sheet).toContain("200.0000 × 150.0000 سم");
    expect(sheet).toContain('<v>2500</v>');
    expect(sheet).toContain('<v>3000</v>');
    expect(sheet).not.toContain("COL-90");
    expect(sheet).not.toContain("عكس تحصيل");
    expect(sheet).not.toContain("رد للعميل");
    expect(sheet).not.toContain("<f>");
    expect(sheet).not.toContain("previewHash");
    for (const xml of [summary, details])
      expect(new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("builds a valid two-sheet Arabic workbook with purpose-specific content, relationships and print setup", () => {
    const bytes = buildCustomerSettlementStatementXlsx({kind: "saved", record});
    const files = unzip(bytes);
    expect([...files.keys()].sort()).toEqual([
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels", "xl/styles.xml",
      "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml",
    ].sort());
    const contents = files.get("[Content_Types].xml")!;
    expect(contents).toContain('PartName="/xl/worksheets/sheet1.xml"');
    expect(contents).toContain('PartName="/xl/worksheets/sheet2.xml"');
    const rels = files.get("xl/_rels/workbook.xml.rels")!;
    expect(rels).toContain('Id="rId1"');
    expect(rels).toContain('Target="worksheets/sheet1.xml"');
    expect(rels).toContain('Id="rId2"');
    expect(rels).toContain('Target="worksheets/sheet2.xml"');
    expect(rels).toContain('Id="rId3"');
    expect(rels).toContain('Target="styles.xml"');

    const summary = xmlSummary(bytes), details = xmlDetails(bytes);
    expect(summary).toContain('rightToLeft="1"');
    expect(details).toContain('rightToLeft="1"');
    expect(summary).toContain('orientation="portrait" fitToWidth="1" fitToHeight="1"');
    expect(details).toContain('orientation="landscape" fitToWidth="1" fitToHeight="0"');
    expect(summary).toContain("المستحق قبل التصفية الحالية");
    expect(summary).toContain("المبلغ المدفوع في التصفية الحالية");
    expect(summary).toContain("المتبقي بعد التصفية الحالية");
    expect(summary).not.toContain("ORD-11");
    expect(summary).not.toContain("لون: أسود");
    expect(details).toContain("الأوردرات التي تم استلامها");
    expect(details).toContain("ORD-11");
    expect(details).toContain("@SUM(A1) &lt;بنر&gt;");
    expect(details).toContain("صافي المدفوعات بعد الرد والإلغاء");
    expect(details).toContain("إجراءات التصفية المسجّلة");
    expect(details).toContain("المبلغ المحصل فعليًا في هذه التصفية");
    expect(details).toContain("COL-94");
    expect(details).not.toContain("ملاحظة داخلية");
    expect(summary).not.toContain("ملاحظة داخلية");
    expect(summary + details).not.toContain("<f>");
    expect(files.get("xl/styles.xml")).toContain("FF6250C9");
    for (const [name, value] of files) {
      if (name.endsWith(".xml") || name.endsWith(".rels"))
        expect(new DOMParser().parseFromString(value, "application/xml").querySelector("parsererror")).toBeNull();
    }
  });

  it("labels an unposted payment as a proposal and does not remove it from the real due", () => {
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "draft", preview,
      proposal: {discount: "1000.00", collected: "500.00", remaining: "1000.00", reason: "اتفاق مع العميل"}}));
    expect(sheet).toContain("المطلوب من العميل الآن");
    expect(sheet).toContain("خصم مقترح — غير مسجّل");
    expect(sheet).toContain("دفعة متوقعة — لم تُستلم");
    expect(sheet).toContain("المتبقي المتوقع إذا تم اعتماد المقترح");
    expect(sheet).toContain("المقترح ليس إيصال سداد");
    expect(sheet).toContain('<v>2500</v>');
    expect(sheet).toContain('<v>1000</v>');
    expect(sheet).toContain('<v>500</v>');
    expect(sheet).not.toContain("رقم التصفية الحالية:");
  });

  it("shows a registered historical settlement, its real cash, discount and saved remainder", () => {
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "saved", record}));
    expect(sheet).toContain("رقم التصفية الحالية: SET-2026-00005");
    expect(sheet).toContain("المتبقي بعد التصفية المسجّلة");
    expect(sheet).toContain("خصم التصفية الحالية (ليس مبلغًا مدفوعًا)");
    expect(sheet).toContain("المبلغ المدفوع في التصفية الحالية");
    expect(sheet).toContain("المتبقي بعد التصفية الحالية");
    expect(sheet).toContain("COL-94");
    expect(sheet).toContain('<v>2500</v>');
    expect(sheet).toContain('<v>1000</v>');
    expect(sheet).toContain('<v>500</v>');
    expect(sheet).not.toContain("COL-90");
    expect(sheet).not.toContain("ملاحظة داخلية");
    expect(sheet).not.toContain("دفعة متوقعة");
    const savedBytes = buildCustomerSettlementStatementXlsx({kind: "saved", record});
    for (const xml of [xmlSummary(savedBytes), xmlDetails(savedBytes)])
      expect(new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("warns about a reviewed historical settlement without changing saved figures", () => {
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "saved",
      record: {...record, needsReview: true, status: "needs_review"}}));
    expect(sheet).toContain("حصل تغيير مالي لاحق ويجب مراجعة الرصيد الحالي");
    expect(sheet).toContain('<v>1000</v>');
  });

  it("validates invalid periods, credit accounts, invalid money and missing immutable snapshots", () => {
    const empty: AccountSettlementPreview = {...preview, items: [], payments: [],
      openingBalance: "-75.00", deliveredTotal: "0.00", netPayments: "0.00",
      balanceBefore: "-75.00", dueNow: "0.00", creditInScope: "75.00"};
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "draft", preview: empty}));
    expect(sheet).toContain("رصيد لصالح العميل");
    expect(sheet).toContain("لا توجد أوردرات مستلمة جديدة بين التاريخين");
    expect(sheet).toContain('<v>75</v>');
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft", preview,
      periodFrom: "2026-11-02"})).toThrow("Invalid customer statement period");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft", preview,
      periodFrom: "2026-02-30"})).toThrow("Invalid customer statement period");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: {...preview, netPayments: "1e999"}})).toThrow("Invalid settlement financial amount");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: {...preview, items: [{...preview.items[0], amount: "999999.00"}]},
    })).toThrow("Invalid delivered-work statement totals");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "saved",
      record: {...record, snapshot: undefined}})).toThrow("Saved settlement snapshot");
  });

  it("filters and sorts orders by the date period while reconciling earlier work into the opening balance", () => {
    const original = preview.items[0];
    const older = {...original, id: 8, orderId: 20, orderNumber: "ORD-OCT",
      deliveryDate: "2026-10-20", description: "شغل قديم", amount: "120.00"};
    const newest = {...original, id: 9, orderId: 21, orderNumber: "ORD-NOV",
      deliveryDate: "2026-11-01", description: "شغل نوفمبر", amount: "3000.00"};
    const earlier = {...original, id: 4, orderId: 18, orderNumber: "ORD-FIRST",
      deliveryDate: "2026-10-22", description: "شغل في أكتوبر", amount: "500.00"};
    const mixed = {...preview, items: [newest, earlier, older], deliveredTotal: "3620.00",
      balanceBefore: "3120.00"};
    const november = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: mixed, periodFrom: "2026-11-01"}));
    expect(november).toContain("ORD-NOV");
    expect(november).not.toContain("ORD-OCT");
    expect(november).toContain("الرصيد المرحّل قبل الفترة");
    expect(november).toContain('<v>120</v>'); // 620 older work minus 500 older net paid
    expect(november).toContain('<v>3120</v>');
    const october = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: mixed, periodFrom: "2026-10-01"}));
    expect(october).toContain("الأوردرات التي تم استلامها خلال الفترة (3 أوردر)");
    expect(october.indexOf("ORD-OCT")).toBeLessThan(october.indexOf("ORD-FIRST"));
    expect(october.indexOf("ORD-FIRST")).toBeLessThan(october.indexOf("ORD-NOV"));
    expect(october).toContain("COL-90");
    expect(october).toContain("عكس تحصيل");
    expect(october).toContain("رد للعميل");
  });

  it("uses the last settlement's exact ledger watermark, even for cash reversed on the same day", () => {
    const oldWork = {...preview.items[0], id: 55, orderId: 15, orderNumber: "ORD-OLD",
      deliveryDate: "2026-10-24", description: "شغل سابق", amount: "1500.00"};
    const newerWork = {...preview.items[0], id: 56, orderId: 16,
      orderNumber: "ORD-NEW", deliveryDate: "2026-10-28", description: "شغل جديد", amount: "1200.00"};
    const historicalAfter: AccountSettlementPreview = {...preview, items: [oldWork], payments: [{
      entryId: 90, type: 2, typeLabel: "تحصيل", effectiveDate: "2026-10-25",
      signedAmount: "-500.00", collectionId: 90, receiptNumber: "COL-OLD",
      orderId: null, outsideWorkScope: false,
    }], deliveredTotal: "1500.00", netPayments: "500.00", balanceBefore: "1000.00",
      dueNow: "1000.00", sourceManifest: {ledgerMaxId: 90, creditEntryIds: [90],
        deliveryIds: [1], orderIds: [15]}, dateTo: "2026-10-24"};
    const previous: AccountSettlementRecord = {...record, id: 3, number: "SET-2026-00003",
      dateFrom: "2026-10-01", dateTo: "2026-10-24", settledOn: "2026-10-25", balanceAfter: "1000.00",
      amountCollected: "0.00", discountAmount: "0.00", receiptNumber: null,
      snapshot: {before: historicalAfter, after: historicalAfter, receiptNumber: null}};
    const live: AccountSettlementPreview = {...preview, items: [newerWork, oldWork],
      dateTo: "2026-11-03", paymentsThrough: "2026-11-03",
      deliveredTotal: "2700.00", netPayments: "750.00", balanceBefore: "1950.00",
      dueNow: "1950.00", payments: [...historicalAfter.payments,
        {entryId: 91, type: 2, typeLabel: "تحصيل", effectiveDate: "2026-10-25",
          signedAmount: "-350.00", collectionId: 91, receiptNumber: "COL-NEW",
          orderId: null, outsideWorkScope: false},
        {entryId: 92, type: 4, typeLabel: "عكس تحصيل", effectiveDate: "2026-10-25",
          signedAmount: "100.00", collectionId: null, receiptNumber: null,
          orderId: null, outsideWorkScope: false}]};
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({
      kind: "draft", preview: live, previous,
    }));
    expect(sheet).toContain("آخر تصفية سابقة: SET-2026-00003");
    expect(sheet).toContain("من 25/10/2026 إلى 03/11/2026");
    expect(sheet).toContain("المتبقي من آخر تصفية");
    expect(sheet).toContain("صافي مدفوعات بعد آخر تصفية");
    expect(sheet).toContain("ORD-NEW");
    expect(sheet).not.toContain("ORD-OLD");
    expect(sheet).toContain("COL-NEW");
    expect(sheet).not.toContain("COL-OLD");
    expect(sheet).toContain("عكس تحصيل");
    expect(sheet).toContain('<v>1200</v>');
    expect(sheet).toContain('<v>250</v>'); // 350 collected, 100 reversed
    expect(sheet).toContain('<v>1950</v>'); // 1,000 prior + 1,200 new - 250 actual net
    const saved: AccountSettlementRecord = {...record, dateTo: live.dateTo,
      settledOn: "2026-11-03", balanceBefore: "1950.00", amountCollected: "1000.00",
      discountAmount: "0.00", balanceAfter: "950.00", receiptNumber: "COL-CURRENT",
      snapshot: {before: live, after: {...live, netPayments: "1750.00"},
        receiptNumber: "COL-CURRENT"}};
    const savedSheet = xmlSheet(buildCustomerSettlementStatementXlsx({
      kind: "saved", record: saved, previous,
    }));
    expect(savedSheet).toContain("رقم التصفية الحالية: SET-2026-00005");
    expect(savedSheet).toContain("المبلغ المدفوع في التصفية الحالية");
    expect(savedSheet).toContain("COL-CURRENT");
    expect(savedSheet).toContain('<v>950</v>');
    expect(savedSheet).toContain("COL-NEW");
    expect(savedSheet).not.toContain("COL-OLD");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: live, previous, periodFrom: "2026-10-24"})).toThrow("begins before");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: live, previous: {...previous, snapshot: undefined}})).toThrow("missing its saved");
    expect(() => buildCustomerSettlementStatementXlsx({kind: "draft",
      preview: live, previous: {...previous, snapshot: {
        before: historicalAfter, after: {...historicalAfter, sourceManifest: undefined}, receiptNumber: null,
      }}})).toThrow("no reliable receipt cutoff");
  });
});
