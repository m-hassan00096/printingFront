import type { CustomerSettlement } from "../types/settlement.types";
import { deliveredWorkReport } from "./delivered-work-report";

/** Native UTF-8 OOXML. Export is a historical report, never evidence of cash settlement. */
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XMLNS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NUM_FMT = 164, UNIT_FMT = 165, DATE_FMT = 166;
const moneyFormat = '#,##0.00;[Red](#,##0.00);0.00';
const unitFormat = '#,##0.0000;[Red](#,##0.0000);0.0000';
const labels = ["التاريخ", "رقم الأوردر", "الشغل / الحالة", "الكمية", "سعر القطعة", "القيمة"];
function xmlText(value: string): string {
  return [...value].filter(char => {
    const point = char.codePointAt(0) ?? 0;
    return point === 9 || point === 10 || point === 13 || (point >= 32 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) || (point >= 0x10000 && point <= 0x10ffff);
  }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function ref(column: number, row: number): string {return String.fromCharCode(65 + column) + row;}
function textCell(column: number, row: number, value: string, style = 4): string {
  return '<c r="' + ref(column, row) + '" t="inlineStr" s="' + style + '"><is><t xml:space="preserve">' + xmlText(value) + '</t></is></c>';
}
function numberCell(column: number, row: number, raw: string | number, style = 5): string {
  const number = Number(raw);
  if (!Number.isFinite(number)) throw Error("Invalid statement amount");
  return '<c r="' + ref(column, row) + '" s="' + style + '"><v>' + number + '</v></c>';
}
function excelDate(value: string): number | null {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!found) return null;
  const year = Number(found[1]), month = Number(found[2]), day = Number(found[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== day) return null;
  return Math.round(instant.getTime() / 86400000) + 25569;
}
function dateCell(column: number, row: number, value: string): string {
  const serial = excelDate(value);
  return serial === null ? textCell(column, row, value) : numberCell(column, row, serial, 6);
}
function tableRow(row: number, cells: string[], height = 25): string {
  return '<row r="' + row + '" ht="' + height + '" customHeight="1">' + cells.join('') + '</row>';
}
function stylesXml(): string {
  const formats = '<numFmts count="3"><numFmt numFmtId="' + NUM_FMT + '" formatCode="' + xmlText(moneyFormat) + '"/><numFmt numFmtId="' + UNIT_FMT + '" formatCode="' + xmlText(unitFormat) + '"/><numFmt numFmtId="' + DATE_FMT + '" formatCode="dd/mm/yyyy"/></numFmts>';
  const font = (color: string, size: number, bold: boolean) => '<font>' + (bold ? '<b/>' : '') + '<sz val="' + size + '"/><color rgb="' + color + '"/><name val="Arial"/><family val="2"/></font>';
  const fonts = '<fonts count="4">' + font('FF263348', 11, false) + font('FFFFFFFF', 18, true) + font('FFFFFFFF', 11, true) + font('FF163B67', 11, true) + '</fonts>';
  const fill = (color: string) => '<fill><patternFill patternType="solid"><fgColor rgb="' + color + '"/><bgColor indexed="64"/></patternFill></fill>';
  const fills = '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' + fill('FF1C3156') + fill('FFE9F1FA') + fill('FF147D76') + '</fills>';
  const borders = '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFD9E3EE"/></bottom><diagonal/></border></borders>';
  const xf = (fontId: number, fillId: number, borderId: number, formatId = 0, align = 'right') => '<xf numFmtId="' + formatId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="' + align + '" vertical="center" wrapText="1" readingOrder="2"/></xf>';
  const xs = [xf(0,0,0), xf(1,2,0), xf(3,3,0), xf(2,2,0), xf(0,0,1), xf(0,0,1,NUM_FMT), xf(0,0,1,DATE_FMT), xf(0,0,1,3,'center'), xf(3,3,0), xf(3,3,0,NUM_FMT), xf(2,4,0), xf(2,4,0,NUM_FMT), xf(0,0,1,UNIT_FMT)];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + XMLNS + '">' + formats + fonts + fills + borders + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + xs.length + '">' + xs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}
function sheetXml(statement: CustomerSettlement): string {
  const work = deliveredWorkReport(statement);
  const rows: string[] = [], merges: string[] = [];
  const merge = (from: string, to: string): void => {merges.push(from + ":" + to);};

  rows.push(tableRow(1, [textCell(0,1,"طَبعة | تقرير الشغل المستلّم للعميل",1)],42)); merge("A1","F1");
  rows.push(tableRow(2, [textCell(0,2,"العميل: " + statement.customerName,2)],29)); merge("A2","F2");
  rows.push(tableRow(3, [textCell(0,3,"الفترة: " + statement.dateFrom + " إلى " + statement.dateTo,2)],27)); merge("A3","F3");
  rows.push(tableRow(4, [textCell(0,4,"رقم الهاتف: " + (statement.customerPhone || "—"),0)],24)); merge("A4","F4");

  // Only deliveries and their cancellations. No opening balance, receipts or
  // customer debt ever appear in this exported delivered-work report.
  const summaries = [
    {col:0,title:"عدد الأوردرات المستلّمة",value:String(work.deliveredOrderCount)},
    {col:2,title:"إجمالي الشغل المستلّم",value:work.grossDelivered},
    {col:4,title:"إلغاءات التسليم",value:work.cancelledDelivered},
  ];
  rows.push(tableRow(6,summaries.map(x=>textCell(x.col,6,x.title,8)),30));
  rows.push(tableRow(7,summaries.map(x=>numberCell(x.col,7,x.value,x.col===0 ? 7 : 9)),33));
  for (const card of summaries) {merge(ref(card.col,6),ref(card.col+1,6));merge(ref(card.col,7),ref(card.col+1,7));}
  rows.push(tableRow(8,[textCell(0,8,"صافي الشغل المستلّم",10),numberCell(5,8,work.netDelivered,11)],36));merge("A8","E8");
  rows.push(tableRow(10,labels.map((label,col)=>textCell(col,10,label,3)),32));

  for (const [index,line] of work.lines.entries()) {
    const row = 11 + index;
    rows.push(tableRow(row,[
      dateCell(0,row,line.date),
      textCell(1,row,line.orderNumber ?? "—"),
      textCell(2,row,line.kind === "delivery_cancellation" ? "إلغاء تسليم" : line.description),
      ...(line.quantity === null ? [] : [numberCell(3,row,line.quantity,7)]),
      ...(line.unitPrice === null ? [] : [numberCell(4,row,line.unitPrice,12)]),
      numberCell(5,row,line.signedAmount,5),
    ],28));
  }

  const footer = 11 + work.lines.length;
  rows.push(tableRow(footer,[
    textCell(0,footer,"صافي الشغل المستلّم خلال الفترة",10),
    numberCell(5,footer,work.netDelivered,11),
  ],36));merge("A"+footer,"E"+footer);
  rows.push(tableRow(footer+1,[textCell(0,footer+1,
    "الإلغاءات تخصم من الشغل المستلّم، وقد تخص تسليمات تمت قبل بداية الفترة.",0)],32));
  merge("A"+(footer+1),"F"+(footer+1));
  rows.push(tableRow(footer+2,[textCell(0,footer+2,
    "تقرير الشغل المستلّم فقط، وليس كشف مديونية أو إيصال سداد أو إثبات تقفيل مالي. الدفعات تُراجع من كشف الحساب.",0)],37));
  merge("A"+(footer+2),"F"+(footer+2));

  const columns = [19,27,63,13,20,24].map((width,index) =>
    '<col min="' + (index+1) + '" max="' + (index+1) + '" width="' + width + '" customWidth="1"/>').join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="' + XMLNS + '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0">' +
    '<pane ySplit="10" topLeftCell="A11" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>' + columns +
    '</cols><sheetData>' + rows.join("") + '</sheetData><mergeCells count="' + merges.length +
    '">' + merges.map(value=>'<mergeCell ref="'+value+'"/>').join("") +
    '</mergeCells><printOptions horizontalCentered="1"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
}
function zipStored(files: Array<{name: string; content: string}>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map(file => {
    const name = encoder.encode(file.name), data = encoder.encode(file.content);
    let crc = 0xffffffff;
    for (const byte of data) {crc ^= byte; for (let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return {name,data,crc:(crc^0xffffffff)>>>0};
  });
  if (entries.length > 65535) throw Error('Too many XLSX entries');
  const localSize = entries.reduce((sum,entry) => sum+30+entry.name.length+entry.data.length,0);
  const centralSize = entries.reduce((sum,entry) => sum+46+entry.name.length,0);
  if (localSize+centralSize+22 >= 0xffffffff) throw Error('XLSX is too large');
  const bytes = new Uint8Array(localSize+centralSize+22), view = new DataView(bytes.buffer);
  const put16 = (pos: number,value: number): void => view.setUint16(pos,value,true);
  const put32 = (pos: number,value: number): void => view.setUint32(pos,value,true);
  const now = new Date();
  const dosDate = ((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
  const dosTime = (now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2);
  let pos=0;
  const offsets: number[]=[];
  for (const entry of entries) {
    offsets.push(pos); put32(pos,0x04034b50); put16(pos+4,20); put16(pos+6,0); put16(pos+8,0);
    put16(pos+10,dosTime); put16(pos+12,dosDate); put32(pos+14,entry.crc); put32(pos+18,entry.data.length); put32(pos+22,entry.data.length);
    put16(pos+26,entry.name.length); put16(pos+28,0); bytes.set(entry.name,pos+30); bytes.set(entry.data,pos+30+entry.name.length);
    pos+=30+entry.name.length+entry.data.length;
  }
  const centralStart=pos;
  for (const [index,entry] of entries.entries()) {
    put32(pos,0x02014b50); put16(pos+4,20); put16(pos+6,20); put16(pos+8,0); put16(pos+10,0);
    put16(pos+12,dosTime); put16(pos+14,dosDate); put32(pos+16,entry.crc); put32(pos+20,entry.data.length); put32(pos+24,entry.data.length);
    put16(pos+28,entry.name.length); put16(pos+30,0); put16(pos+32,0); put16(pos+34,0); put16(pos+36,0); put32(pos+38,0); put32(pos+42,offsets[index]);
    bytes.set(entry.name,pos+46); pos+=46+entry.name.length;
  }
  put32(pos,0x06054b50); put16(pos+4,0); put16(pos+6,0); put16(pos+8,entries.length); put16(pos+10,entries.length);
  put32(pos+12,pos-centralStart); put32(pos+16,centralStart); put16(pos+20,0);
  return bytes;
}
export function buildSettlementXlsx(statement: CustomerSettlement): Uint8Array {
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipStored([
    {name:'[Content_Types].xml',content:declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:'_rels/.rels',content:declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',content:declaration+'<workbook xmlns="'+XMLNS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="الشغل المستلّم" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',content:declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',content:stylesXml()}, {name:'xl/worksheets/sheet1.xml',content:sheetXml(statement)},
  ]);
}
export function exportSettlementXlsx(statement: CustomerSettlement): void {
  const bytes=buildSettlementXlsx(statement), blob=new Blob([bytes.buffer as ArrayBuffer],{type:MIME});
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url; link.download='tabaa-delivered-work-'+statement.customerId+'-'+statement.dateTo+'.xlsx';
  document.body.append(link); link.click(); link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
