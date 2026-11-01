import { describe, expect, it } from "vitest";
import { buildSettlementXlsx } from "@/features/finance/lib/settlement-xlsx";
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
  it("preserves Arabic, real numeric/date cells and RTL formatting",()=>{
    const files=unpack(buildSettlementXlsx(statement));
    expect([...files.keys()].sort()).toEqual(['[Content_Types].xml','_rels/.rels','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/workbook.xml','xl/worksheets/sheet1.xml'].sort());
    expect(files.get('xl/workbook.xml')).toContain('name="كشف الشغل المسلّم"');
    const sheet=files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('rightToLeft="1"'); expect(sheet).toContain('showGridLines="0"');
    expect(sheet).toContain('<col min="1" max="1" width="19"'); expect(sheet).toContain('<col min="2" max="2" width="63"');
    expect(sheet).toContain('شركة طباعة &amp; &lt;خدمات&gt;'); expect(sheet).toContain('كروت شخصية وجهين');
    expect(sheet).toContain('رقم الأوردر / الإيصال'); expect(sheet).toContain('r="A11" s="6"');
    expect(sheet).toContain('r="D11" s="7"><v>1200</v>'); expect(sheet).toContain('r="E11" s="12"><v>0.5</v>');
    expect(files.get('xl/styles.xml')).toContain('formatCode="dd/mm/yyyy"'); expect(files.get('xl/styles.xml')).toContain('#,##0.0000');
    expect(new DOMParser().parseFromString(sheet,'application/xml').querySelector('parsererror')).toBeNull();
  });
  it("shows all five reconciliation amounts above the ledger, including opening adjustments",()=>{
    const sheet=unpack(buildSettlementXlsx({...statement,openingBalance:'0.00',adjustmentsTotal:'5000.00',deliveredTotal:'50.00',paymentsTotal:'100.00',closingBalance:'4950.00'})).get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('رصيد افتتاحي سُجل داخل الفترة');
    expect(sheet).toContain('r="A7" s="9"><v>0</v>'); expect(sheet).toContain('r="C7" s="9"><v>5000</v>');
    expect(sheet).toContain('r="E7" s="9"><v>50</v>'); expect(sheet).toContain('r="G7" s="9"><v>100</v>');
    expect(sheet).toContain('r="H8" s="11"><v>4950</v>');
    expect(sheet).toContain('ليس إيصال سداد أو إثبات تقفيل مالي');
  });
  it("reports cash and closing amounts without exposing private ledger reconciliation",()=>{
    const sheet=unpack(buildSettlementXlsx(statement)).get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('r="G12" s="5"><v>50</v>'); expect(sheet).toContain('r="H12" s="5"><v>750</v>');
    expect(sheet).toContain('رصيد نهاية الفترة'); expect(sheet).not.toContain('5250'); expect(sheet).not.toContain('6000');
  });
  it("writes untrusted text as escaped inline strings, never as formulas",()=>{
    const sheet=unpack(buildSettlementXlsx({...statement,customerName:'=1+1',lines:[{...statement.lines[0],description:'@SUM(1,2)'}]})).get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('t="inlineStr"'); expect(sheet).toContain('العميل: =1+1'); expect(sheet).toContain('@SUM(1,2)'); expect(sheet).not.toContain('<f>');
  });
});
