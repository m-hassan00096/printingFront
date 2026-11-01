import type { CustomerSettlement } from "../types/settlement.types";

/** A self-contained, dependency-free OOXML export. Text is UTF-8 inlineStr, not CSV. */
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XMLNS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NUM_FMT = 164;
const UNIT_FMT = 165;
const DATE_FMT = 166;
const moneyFormat = '#,##0.00;[Red](#,##0.00);"-"';
const unitFormat = '#,##0.0000;[Red](#,##0.0000);"-"';
const labels = ["التاريخ", "البيان", "رقم الأوردر / الإيصال", "الكمية", "سعر الوحدة", "مدين", "دائن", "الرصيد"];

function xmlText(value: string): string {
  return [...value].filter(char => {
    const point = char.codePointAt(0) ?? 0;
    return point === 9 || point === 10 || point === 13 || point >= 32;
  }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function ref(column: number, row: number): string {
  return String.fromCharCode(65 + column) + row;
}

function textCell(column: number, row: number, value: string, style = 4): string {
  return '<c r="' + ref(column, row) + '" t="inlineStr" s="' + style + '"><is><t xml:space="preserve">' +
    xmlText(value) + '</t></is></c>';
}

function numberCell(column: number, row: number, raw: string | number, style = 5): string {
  const number = Number(raw);
  if (!Number.isFinite(number)) throw Error("Invalid settlement amount");
  return '<c r="' + ref(column, row) + '" s="' + style + '"><v>' + number + '</v></c>';
}

function excelDate(value: string): number | null {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!found) return null;
  const year = Number(found[1]), month = Number(found[2]), day = Number(found[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day) return null;
  return Math.round(instant.getTime() / 86400000) + 25569;
}

function dateCell(column: number, row: number, value: string): string {
  const serial = excelDate(value);
  return serial === null ? textCell(column, row, value) : numberCell(column, row, serial, 6);
}

function tableRow(row: number, cells: string[], height = 25): string {
  return '<row r="' + row + '" ht="' + height + '" customHeight="1">' + cells.join("") + '</row>';
}

function stylesXml(): string {
  const numberFormats = '<numFmts count="3">' +
    '<numFmt numFmtId="' + NUM_FMT + '" formatCode="' + xmlText(moneyFormat) + '"/>' +
    '<numFmt numFmtId="' + UNIT_FMT + '" formatCode="' + xmlText(unitFormat) + '"/>' +
    '<numFmt numFmtId="' + DATE_FMT + '" formatCode="dd/mm/yyyy"/>' +
    '</numFmts>';
  const font = (color: string, size: number, bold: boolean): string =>
    '<font>' + (bold ? '<b/>' : '') + '<sz val="' + size + '"/><color rgb="' + color +
    '"/><name val="Arial"/><family val="2"/></font>';
  const fonts = '<fonts count="4">' + font('FF263348', 11, false) +
    font('FFFFFFFF', 18, true) + font('FFFFFFFF', 11, true) +
    font('FF163B67', 11, true) + '</fonts>';
  const fill = (color: string): string =>
    '<fill><patternFill patternType="solid"><fgColor rgb="' + color +
    '"/><bgColor indexed="64"/></patternFill></fill>';
  const fills = '<fills count="5"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' + fill('FF1C3156') +
    fill('FFE9F1FA') + fill('FF147D76') + '</fills>';
  const borders = '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="hair"><color rgb="FFD9E3EE"/></bottom><diagonal/></border></borders>';
  const xf = (fontId: number, fillId: number, borderId: number, formatId = 0,
    align = 'right'): string => '<xf numFmtId="' + formatId + '" fontId="' + fontId +
    '" fillId="' + fillId + '" borderId="' + borderId +
    '" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1">' +
    '<alignment horizontal="' + align + '" vertical="center" wrapText="1" readingOrder="2"/>' +
    '</xf>';
  const xs = [
    xf(0, 0, 0),       // 0: generic
    xf(1, 2, 0),       // 1: title
    xf(3, 3, 0),       // 2: subtitle
    xf(2, 2, 0),       // 3: table headings
    xf(0, 0, 1),       // 4: text
    xf(0, 0, 1, NUM_FMT), // 5: amount
    xf(0, 0, 1, DATE_FMT), // 6: date
    xf(0, 0, 1, 3, 'center'), // 7: quantity
    xf(3, 3, 0),       // 8: summary label
    xf(3, 3, 0, NUM_FMT), // 9: summary amount
    xf(2, 4, 0),       // 10: final label
    xf(2, 4, 0, NUM_FMT), // 11: final amount
    xf(0, 0, 1, UNIT_FMT), // 12: four-decimal unit price
  ];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="' + XMLNS + '">' + numberFormats + fonts + fills + borders +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + xs.length + '">' + xs.join("") + '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

function sheetXml(statement: CustomerSettlement): string {
  const rows: string[] = [];
  const merges: string[] = [];
  const merge = (from: string, to: string): void => { merges.push(from + ':' + to); };

  rows.push(tableRow(1, [textCell(0, 1, 'Tabaa | كشف تصفية حساب', 1)], 42));
  merge('A1', 'H1');
  rows.push(tableRow(2, [textCell(0, 2, 'العميل: ' + statement.customerName, 2)], 29));
  merge('A2', 'H2');
  rows.push(tableRow(3, [textCell(0, 3, 'الفترة: ' + statement.dateFrom + ' إلى ' + statement.dateTo, 2)], 27));
  merge('A3', 'H3');
  rows.push(tableRow(4, [textCell(0, 4, 'رقم الهاتف: ' + (statement.customerPhone || '—'), 0)], 24));
  merge('A4', 'H4');

  const cards: Array<{col: number; title: string; value: string}> = [
    { col: 0, title: 'رصيد أول الفترة', value: statement.openingBalance },
    { col: 2, title: 'الشغل المستلم', value: statement.deliveredTotal },
    { col: 4, title: 'صافي التحصيلات', value: statement.paymentsTotal },
    { col: 6, title: 'الرصيد المتبقي', value: statement.closingBalance },
  ];
  rows.push(tableRow(6, cards.map(card => textCell(card.col, 6, card.title, 8)), 26));
  rows.push(tableRow(7, cards.map(card => numberCell(card.col, 7, card.value, 9)), 33));
  for (const card of cards) {
    merge(ref(card.col, 6), ref(card.col + 1, 6));
    merge(ref(card.col, 7), ref(card.col + 1, 7));
  }

  rows.push(tableRow(9, labels.map((label, col) => textCell(col, 9, label, 3)), 32));
  rows.push(tableRow(10, [
    textCell(1, 10, 'رصيد أول الفترة', 4),
    numberCell(7, 10, statement.openingBalance, 5),
  ], 27));

  for (const [index, line] of statement.lines.entries()) {
    const row = index + 11;
    const negative = line.signedAmount.startsWith('-');
    const values = [
      dateCell(0, row, line.date),
      textCell(1, row, line.description),
      textCell(2, row, line.orderNumber ?? line.receiptNumber ?? ''),
      ...(line.quantity === null ? [] : [numberCell(3, row, line.quantity, 7)]),
      ...(line.unitPrice === null ? [] : [numberCell(4, row, line.unitPrice, 12)]),
      numberCell(negative ? 6 : 5, row, Math.abs(Number(line.signedAmount))),
      numberCell(7, row, line.runningBalance),
    ];
    rows.push(tableRow(row, values, 28));
  }

  let footer = 12 + statement.lines.length;
  const totalRow = (label: string, value: string, final = false): void => {
    rows.push(tableRow(footer, [
      textCell(0, footer, label, final ? 10 : 8),
      numberCell(7, footer, value, final ? 11 : 9),
    ], final ? 36 : 27));
    merge('A' + footer, 'G' + footer);
    footer++;
  };
  totalRow('إجمالي الشغل المستلم خلال الفترة', statement.deliveredTotal);
  totalRow('صافي التحصيلات خلال الفترة', statement.paymentsTotal);
  if (Number(statement.adjustmentsTotal) !== 0) {
    totalRow('تسويات الرصيد الافتتاحي داخل الفترة', statement.adjustmentsTotal);
  }
  totalRow('المتبقي عن الشغل المستلم (ج.م)', statement.closingBalance, true);
  rows.push(tableRow(footer + 1, [
    textCell(0, footer + 1,
      'هذا الكشف يوضح الشغل المستلم والتحصيلات فقط. الأوردرات المؤكدة وغير المستلمة لا تظهر ضمن المبيعات.', 0),
  ], 35));
  merge('A' + (footer + 1), 'H' + (footer + 1));

  const columns = [19, 63, 26, 13, 19, 21, 21, 24].map((width, index) =>
    '<col min="' + (index + 1) + '" max="' + (index + 1) +
    '" width="' + width + '" customWidth="1"/>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="' + XMLNS + '">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0">' +
    '<pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/>' +
    '<cols>' + columns + '</cols><sheetData>' + rows.join('') + '</sheetData>' +
    '<mergeCells count="' + merges.length + '">' + merges.map(m => '<mergeCell ref="' + m + '"/>').join('') +
    '</mergeCells><printOptions horizontalCentered="1"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>';
}

function zipStored(files: Array<{name: string; content: string}>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map(file => {
    const name = encoder.encode(file.name), data = encoder.encode(file.content);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return { name, data, crc: (crc ^ 0xffffffff) >>> 0 };
  });
  if (entries.length > 65535) throw Error('Too many XLSX entries');
  const localSize = entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  if (localSize + centralSize + 22 >= 0xffffffff) throw Error('XLSX is too large');
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  const put16 = (pos: number, value: number): void => view.setUint16(pos, value, true);
  const put32 = (pos: number, value: number): void => view.setUint32(pos, value, true);
  const now = new Date();
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  let pos = 0;
  const offsets: number[] = [];
  for (const entry of entries) {
    offsets.push(pos);
    put32(pos, 0x04034b50);
    put16(pos + 4, 20);
    put16(pos + 6, 0);
    put16(pos + 8, 0); // STORED; no compression and no external dependency.
    put16(pos + 10, dosTime);
    put16(pos + 12, dosDate);
    put32(pos + 14, entry.crc);
    put32(pos + 18, entry.data.length);
    put32(pos + 22, entry.data.length);
    put16(pos + 26, entry.name.length);
    put16(pos + 28, 0);
    bytes.set(entry.name, pos + 30);
    bytes.set(entry.data, pos + 30 + entry.name.length);
    pos += 30 + entry.name.length + entry.data.length;
  }
  const centralStart = pos;
  for (const [index, entry] of entries.entries()) {
    put32(pos, 0x02014b50);
    put16(pos + 4, 20);
    put16(pos + 6, 20);
    put16(pos + 8, 0);
    put16(pos + 10, 0);
    put16(pos + 12, dosTime);
    put16(pos + 14, dosDate);
    put32(pos + 16, entry.crc);
    put32(pos + 20, entry.data.length);
    put32(pos + 24, entry.data.length);
    put16(pos + 28, entry.name.length);
    put16(pos + 30, 0);
    put16(pos + 32, 0);
    put16(pos + 34, 0);
    put16(pos + 36, 0);
    put32(pos + 38, 0);
    put32(pos + 42, offsets[index]);
    bytes.set(entry.name, pos + 46);
    pos += 46 + entry.name.length;
  }
  put32(pos, 0x06054b50);
  put16(pos + 4, 0);
  put16(pos + 6, 0);
  put16(pos + 8, entries.length);
  put16(pos + 10, entries.length);
  put32(pos + 12, pos - centralStart);
  put32(pos + 16, centralStart);
  put16(pos + 20, 0);
  return bytes;
}

export function buildSettlementXlsx(statement: CustomerSettlement): Uint8Array {
  const files = [
    { name: '[Content_Types].xml', content:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>' },
    { name: '_rels/.rels', content:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>' },
    { name: 'xl/workbook.xml', content:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="' + XMLNS + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets><sheet name="كشف التصفية" sheetId="1" r:id="rId1"/></sheets>' +
      '</workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' },
    { name: 'xl/styles.xml', content: stylesXml() },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(statement) },
  ];
  return zipStored(files);
}

export function exportSettlementXlsx(statement: CustomerSettlement): void {
  const bytes = buildSettlementXlsx(statement);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tabaa-settlement-' + statement.customerId + '-' + statement.dateTo + '.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
