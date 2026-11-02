import { describe, expect, it } from "vitest";
import { buildAccountSettlementXlsx } from "@/features/finance/lib/account-settlement-xlsx";
import type { AccountSettlementRecord } from "@/features/finance/types/account-settlement.types";

const record: AccountSettlementRecord = {
  id: 5, number: "SET-2026-00005", customerId: 7,
  dateTo: "2026-11-01", settledOn: "2026-11-02",
  status: "partial", originalStatus: "partial",
  statusLabel: "تصفية جزئية — يوجد متبقٍ",
  needsReview: false,
  balanceBefore: "2500.00", amountCollected: "500.00",
  discountAmount: "1000.00", discountReason: "خصم متفق عليه",
  discountLedgerEntryId: 91,
  balanceAfter: "1000.00", accountBalanceAfter: "1500.00",
  collectionId: 90, receiptNumber: "COL-2026-00090",
  createdAt: "2026-11-02T12:00:00Z", createdBy: 1, note: "نص ملاحظة",
  snapshot: {
    before: {
      customerId: 7, customerName: "طباعة & <شركة>",
      customerPhone: "01012345678",
      dateTo: "2026-11-01", paymentsThrough: "2026-11-02",
      scope: "cumulative_delivered_work", previewHash: "a".repeat(64),
      openingBalance: "0.00", deliveredTotal: "3000.00",
      grossCollections: "500.00", collectionReversals: "0.00",
      refundsTotal: "0.00", netPayments: "500.00", discountsTotal: "0.00",
      advancesForOtherWork: "0.00", balanceBefore: "2500.00",
      dueNow: "2500.00", creditInScope: "0.00",
      accountBalance: "3000.00", outsideBalance: "500.00",
      hasWork: true,
      items: [{
        id: 2, orderId: 11, orderNumber: "ORD-00011",
        deliveryDate: "2026-11-01", description: "بنر وجهين",
        specifications: "طباعة <خاص>", quantity: 10,
        unitPrice: "300.0000", amount: "3000.00",
        pricingMethod: "square_meter", widthCm: "200.0000", heightCm: "150.0000",
      }],
      payments: [],
    },
    after: {
      customerId: 7, customerName: "طباعة & <شركة>",
      customerPhone: "01012345678",
      dateTo: "2026-11-01", paymentsThrough: "2026-11-02",
      scope: "cumulative_delivered_work", previewHash: "b".repeat(64),
      openingBalance: "0.00", deliveredTotal: "3000.00",
      grossCollections: "1000.00", collectionReversals: "0.00",
      refundsTotal: "0.00", netPayments: "1000.00", discountsTotal: "1000.00",
      advancesForOtherWork: "0.00", balanceBefore: "1000.00",
      dueNow: "1000.00", creditInScope: "0.00",
      accountBalance: "1500.00", outsideBalance: "500.00",
      hasWork: true, items: [], payments: [],
    },
    receiptNumber: "COL-2026-00090",
  },
};

function unpack(archive: Uint8Array): Map<string, string> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decode = new TextDecoder();
  const result = new Map<string, string>();
  let cursor = 0;
  while (cursor + 30 <= archive.length && view.getUint32(cursor, true) === 0x04034b50) {
    const size = view.getUint32(cursor + 18, true);
    const nameLen = view.getUint16(cursor + 26, true);
    const extraLen = view.getUint16(cursor + 28, true);
    const name = decode.decode(archive.slice(cursor + 30, cursor + 30 + nameLen));
    const data = cursor + 30 + nameLen + extraLen;
    result.set(name, decode.decode(archive.slice(data, data + size)));
    cursor = data + size;
  }
  expect(view.getUint32(cursor, true)).toBe(0x02014b50);
  return result;
}

describe("Customer financial settlement evidence Excel", () => {
  it("separates the fixed discount from actual cash in native Arabic RTL XLSX", () => {
    const files = unpack(buildAccountSettlementXlsx(record));
    expect([...files.keys()].sort()).toEqual([
      "[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels",
      "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
    ].sort());
    expect(files.get("xl/workbook.xml")).toContain('sheet name="إثبات التصفية"');
    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain("طباعة &amp; &lt;شركة&gt;");
    expect(sheet).toContain("خصم هذه التصفية (ليس تحصيلًا)");
    expect(sheet).toContain("خصم متفق عليه");
    expect(sheet).toContain("COL-2026-00090");
    expect(sheet).toContain("ORD-00011");
    expect(sheet).toContain("200.0000 × 150.0000 سم");
    expect(sheet).toContain('r="F15" s="9"><v>1000</v>');
    expect(sheet).toContain('r="F16" s="9"><v>500</v>');
    expect(sheet).toContain('r="F17" s="11"><v>1000</v>');
    expect(sheet).not.toContain("<f>");
    expect(new DOMParser().parseFromString(sheet, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("marks historically reversed receipts as needing review without changing the original figures", () => {
    const modified = {...record, needsReview: true, status: "needs_review" as const,
      statusLabel: "تحتاج مراجعة بعد تحصيل معكوس"};
    const sheet = unpack(buildAccountSettlementXlsx(modified)).get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain("هذا إثبات تاريخي يحتاج مراجعة");
    expect(sheet).toContain('r="F16" s="9"><v>500</v>');
  });

  it("requires a saved immutable statement snapshot and safely escapes all customer text", () => {
    expect(() => buildAccountSettlementXlsx({...record, snapshot: undefined})).toThrow();
    const malicious = {
      ...record,
      snapshot: {...record.snapshot!, before: {
        ...record.snapshot!.before,
        customerName: '=1+1<script>alert("x")</script>',
        items: [{...record.snapshot!.before.items[0], description: '@SUM(A1) <script>'}],
      }},
    };
    const sheet = unpack(buildAccountSettlementXlsx(malicious)).get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('=1+1&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(sheet).toContain('@SUM(A1) &lt;script&gt;');
    expect(sheet).not.toContain("<script>");
    expect(new DOMParser().parseFromString(sheet, "application/xml").querySelector("parsererror")).toBeNull();
  });
});
