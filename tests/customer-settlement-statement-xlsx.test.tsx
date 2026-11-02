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
  dateTo: "2026-11-01", settledOn: "2026-11-02",
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
const xmlSheet = (bytes: Uint8Array) => unzip(bytes).get("xl/worksheets/sheet1.xml")!;

describe("Client-facing financial settlement statement", () => {
  it("exports a single Arabic RTL draft workbook from actual backend balance, with work and cash movements", () => {
    const files = unzip(buildCustomerSettlementStatementXlsx({kind: "draft", preview}));
    expect(files.size).toBe(6);
    expect(files.get("xl/workbook.xml")).toContain('sheet name="كشف حساب التصفية"');
    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('showGridLines="0"');
    expect(sheet).toContain("كشف للمراجعة قبل التصفية");
    expect(sheet).toContain("لم يتم تسجيل تصفية أو تحصيل جديد");
    expect(sheet).toContain("=5+6 &amp; &lt;أحمد&gt;");
    expect(sheet).toContain("@SUM(A1) &lt;بنر&gt;");
    expect(sheet).toContain("لون: أسود &amp; أبيض");
    expect(sheet).toContain("200.0000 × 150.0000 سم");
    expect(sheet).toContain("ORD-11");
    expect(sheet).toContain("COL-90");
    expect(sheet).toContain("عكس تحصيل");
    expect(sheet).toContain("رد للعميل");
    expect(sheet).toContain("دفعة مرتبطة بشغل غير مستلّم");
    expect(sheet).toContain("صافي التحصيلات السابقة بعد الردود والإلغاءات");
    expect(sheet).toContain('<v>2500</v>');
    expect(sheet).toContain('<v>3000</v>');
    expect(sheet).toContain('<v>500</v>');
    expect(sheet).toContain('<v>700</v>');
    expect(sheet).toContain('<v>100</v>');
    expect(sheet).toMatch(/<c r="A\d+" s="6"><v>\d+<\/v><\/c>/);
    expect(sheet).not.toContain("مبلغ محصّل فعليًا عند التصفية");
    expect(sheet).not.toContain("الخصم والتحصيل أعلاه مقترحان");
    expect(sheet).not.toContain("<f>");
    expect(sheet).not.toContain("previewHash");
    expect(sheet).not.toContain("ملاحظة داخلية");
    expect(new DOMParser().parseFromString(sheet, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("marks entered amounts as unposted proposals, not completed receipts, in an exported draft", () => {
    const proposal = {discount: "1000.00", collected: "500.00", remaining: "1000.00",
      reason: "اتفاق مع العميل"};
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "draft", preview, proposal}));
    expect(sheet).toContain("خصم مقترح — لم يُسجّل");
    expect(sheet).toContain("تحصيل متوقع — لم يُستلم ولم يُسجّل");
    expect(sheet).toContain("رصيد متوقع فقط إذا اعتُمد المقترح");
    expect(sheet).toContain("اتفاق مع العميل");
    expect(sheet).toContain("لا يمثلان إيصال قبض أو إبراء ذمة");
    expect(sheet).toContain('<v>1000</v>');
    expect(sheet).toContain('<v>500</v>');
    expect(sheet).not.toContain("تصفية مسجلة");
  });

  it("exports a saved settlement from its immutable before-snapshot with actual cash and discount, not today's balance", () => {
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "saved", record}));
    expect(sheet).toContain("تصفية مسجلة: SET-2026-00005");
    expect(sheet).toContain("كشف تاريخي وقت تسجيل التصفية");
    expect(sheet).toContain("خصم هذه التصفية (ليس تحصيلًا)");
    expect(sheet).toContain("المبلغ المحصّل فعليًا عند التصفية");
    expect(sheet).toContain("الرصيد المتبقي وقت تسجيل التصفية");
    expect(sheet).toContain("خصم &amp; اتفاق");
    expect(sheet).toContain("COL-94");
    expect(sheet).toContain('<v>2500</v>');
    expect(sheet).toContain('<v>1000</v>');
    expect(sheet).toContain('<v>500</v>');
    expect(sheet).not.toContain("ملاحظة داخلية");
    expect(sheet).not.toContain("إنشاء إيصال");
    expect(sheet).not.toContain("خصم مقترح");
    expect(new DOMParser().parseFromString(sheet, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("warns when a recorded settlement is later reversed while preserving the original snapshot", () => {
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({
      kind: "saved", record: {...record, needsReview: true, status: "needs_review"},
    }));
    expect(sheet).toContain("هذه التصفية التاريخية تحتاج مراجعة بسبب تغيير لاحق");
    expect(sheet).toContain('<v>1000</v>');
    expect(sheet).toContain("قد تختلف مديونية العميل الحالية");
  });

  it("handles credit balances, zero work, empty payments, and invalid numeric values", () => {
    const empty: AccountSettlementPreview = {
      ...preview, items: [], payments: [], openingBalance: "-75.00",
      deliveredTotal: "0.00", netPayments: "0.00", balanceBefore: "-75.00",
      dueNow: "0.00", creditInScope: "75.00",
    };
    const sheet = xmlSheet(buildCustomerSettlementStatementXlsx({kind: "draft", preview: empty}));
    expect(sheet).toContain("لا توجد بنود شغل مستلّم");
    expect(sheet).toContain("لا توجد حركات تحصيل أو رد");
    expect(sheet).toContain('<v>-75</v>');
    expect(() => buildCustomerSettlementStatementXlsx({
      kind: "draft", preview: {...preview, netPayments: "1e999"},
    })).toThrow("Invalid customer statement number");
    expect(() => buildCustomerSettlementStatementXlsx({
      kind: "saved", record: {...record, snapshot: undefined},
    })).toThrow("Saved settlement snapshot");
  });
});
