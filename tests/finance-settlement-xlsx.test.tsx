import { describe, expect, it } from "vitest";
import { buildSettlementXlsx } from "@/features/finance/lib/settlement-xlsx";
import { deliveredWorkReport } from "@/features/finance/lib/delivered-work-report";
import { renderDeliveredWorkHtml } from "@/features/finance/lib/settlement-export";
import type { CustomerSettlement } from "@/features/finance/types/settlement.types";

const statement: CustomerSettlement = {
  customerId:7, customerName:"شركة طباعة & <خدمات>", customerPhone:"01012345678",
  dateFrom:"2026-10-01", dateTo:"2026-11-01", openingBalance:"200.00", deliveredTotal:"600.00",
  paymentsTotal:"50.00", adjustmentsTotal:"0.00", closingBalance:"750.00", financeBalanceAsOf:"6000.00", undeliveredDifference:"5250.00",
  lines:[
    {key:"delivery:1:item:10",kind:"delivered_item",date:"2026-10-15",description:"كروت شخصية وجهين",orderId:1,orderNumber:"ORD-123",receiptNumber:null,quantity:1200,unitPrice:"0.5000",signedAmount:"600.00",runningBalance:"800.00"},
    {key:"finance:25",kind:"collection",date:"2026-11-01",description:"تحصيل نقدي",orderId:null,orderNumber:null,receiptNumber:"COL-25",quantity:null,unitPrice:null,signedAmount:"-50.00",runningBalance:"750.00"},
  ],
};
function unpack(archive: Uint8Array): Map<string,string> {
  const result=new Map<string,string>(), view=new DataView(archive.buffer,archive.byteOffset,archive.byteLength), decode=new TextDecoder();
  let offset=0;
  while(offset+30<=archive.length&&view.getUint32(offset,true)===0x04034b50){
    expect(view.getUint16(offset+8,true)).toBe(0);
    const length=view.getUint32(offset+18,true), nameLength=view.getUint16(offset+26,true), extra=view.getUint16(offset+28,true);
    const name=decode.decode(archive.slice(offset+30,offset+30+nameLength)), start=offset+30+nameLength+extra;
    result.set(name,decode.decode(archive.slice(start,start+length))); offset=start+length;
  }
  expect(view.getUint32(offset,true)).toBe(0x02014b50);
  return result;
}
describe("native delivered-work XLSX export",()=>{
  it("contains only delivered items in Arabic, with real number/date cells and RTL layout",()=>{
    const files=unpack(buildSettlementXlsx(statement));
    expect([...files.keys()].sort()).toEqual([
      "[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels",
      "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
    ].sort());
    expect(files.get("xl/workbook.xml")).toContain('name="الشغل المستلّم"');
    const sheet=files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('showGridLines="0"');
    expect(sheet).toContain('<col min="1" max="1" width="19"');
    expect(sheet).toContain('<col min="3" max="3" width="63"');
    expect(sheet).toContain("شركة طباعة &amp; &lt;خدمات&gt;");
    expect(sheet).toContain("كروت شخصية وجهين");
    expect(sheet).toContain("رقم الأوردر");
    expect(sheet).toContain('r="A11" s="6"');
    expect(sheet).toContain('r="D11" s="7"><v>1200</v>');
    expect(sheet).toContain('r="E11" s="12"><v>0.5</v>');
    expect(sheet).toContain('r="F11" s="5"><v>600</v>');
    expect(sheet).not.toContain("COL-25");
    expect(sheet).not.toContain("تحصيل نقدي");
    expect(files.get("xl/styles.xml")).toContain('formatCode="dd/mm/yyyy"');
    expect(files.get("xl/styles.xml")).toContain("#,##0.0000");
    expect(new DOMParser().parseFromString(sheet,"application/xml").querySelector("parsererror")).toBeNull();
  });

  it("does not include opening balances, payments or outstanding customer debt",()=>{
    const sheet=unpack(buildSettlementXlsx({
      ...statement,openingBalance:"1111.00",adjustmentsTotal:"5000.00",
      deliveredTotal:"600.00",paymentsTotal:"2222.00",closingBalance:"3888.00",
    })).get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain("عدد الأوردرات المستلّمة");
    expect(sheet).toContain("إجمالي الشغل المستلّم");
    expect(sheet).toContain("إلغاءات التسليم");
    expect(sheet).toContain("صافي الشغل المستلّم");
    expect(sheet).toContain('r="C7" s="9"><v>600</v>');
    expect(sheet).toContain('r="F8" s="11"><v>600</v>');
    expect(sheet).not.toContain("1111");
    expect(sheet).not.toContain("5000");
    expect(sheet).not.toContain("2222");
    expect(sheet).not.toContain("3888");
    expect(sheet).not.toContain("رصيد نهاية الفترة");
    expect(sheet).not.toContain("إيصال");
  });

  it("keeps cancellation history as negative work and excludes unrelated cash rows",()=>{
    const cancelled: CustomerSettlement = {
      ...statement,
      deliveredTotal: "0.00",
      lines: [...statement.lines, {
        key:"delivery-cancel:1",kind:"delivery_cancellation",date:"2026-11-01",description:"إلغاء التسليم",
        orderId:1,orderNumber:"ORD-123",receiptNumber:null,quantity:null,unitPrice:null,
        signedAmount:"-600.00",runningBalance:"150.00",
      }],
    };
    const work=deliveredWorkReport(cancelled);
    expect(work.deliveredOrderCount).toBe(1);
    expect(work.deliveredItemCount).toBe(1);
    expect(work.grossDelivered).toBe("600.00");
    expect(work.cancelledDelivered).toBe("600.00");
    expect(work.netDelivered).toBe("0.00");
    expect(work.lines.map(line=>line.kind)).toEqual(["delivered_item","delivery_cancellation"]);
    const sheet=unpack(buildSettlementXlsx(cancelled)).get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain("إلغاء تسليم");
    expect(sheet).toContain('r="F11" s="5"><v>600</v>');
    expect(sheet).toContain('r="F12" s="5"><v>-600</v>');
    expect(sheet).not.toContain("COL-25");
    expect(sheet).not.toContain("تحصيل نقدي");
    const html=renderDeliveredWorkHtml(cancelled);
    expect(html).toContain("إلغاء تسليم");
    expect(html).toContain("كروت شخصية وجهين");
    expect(html).not.toContain("COL-25");
    expect(html).not.toContain("تحصيل نقدي");
    expect(html).not.toContain("رصيد افتتاحي");
    expect(html).not.toContain("750.00");
  });

  it("safely escapes untrusted customer and item text, not spreadsheet formulas or HTML",()=>{
    const malicious = {...statement, customerName:'=1+1<&', lines:[
      {...statement.lines[0],description:'@SUM(1,2)<script>alert(1)</script>'},
      statement.lines[1],
    ]};
    const sheet=unpack(buildSettlementXlsx(malicious)).get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain("العميل: =1+1&lt;&amp;");
    expect(sheet).toContain("@SUM(1,2)&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(sheet).not.toContain("<f>");
    expect(new DOMParser().parseFromString(sheet,"application/xml").querySelector("parsererror")).toBeNull();
    const html=renderDeliveredWorkHtml(malicious);
    expect(html).toContain("=1+1&lt;&amp;");
    expect(html).toContain("@SUM(1,2)&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
