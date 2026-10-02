import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { decodeXml, readWorkbook, spreadsheetKind, unzip, workbookText } from '@/modules/quotation/workbook';

/** A minimal zip writer — enough to build a real .xlsx in the test. CRCs are not checked by the reader. */
function zip(files: Record<string, string>, store = false): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content, 'utf8');
    const data = store ? raw : deflateRawSync(raw);
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const QUOTE = {
  'xl/workbook.xml':
    '<workbook><sheets><sheet name="Kharadi 3BHK" sheetId="1" r:id="rId1"/><sheet name="Terms" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/sharedStrings.xml':
    '<sst><si><t>Kitchen</t></si><si><t>Base unit</t></si><si><r><t>18mm BWP </t></r><r><t>ply &amp; laminate</t></r></si><si><t>10% booking, 90% handover</t></si></sst>',
  'xl/worksheets/sheet1.xml':
    '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c><c r="D2"><v>75490</v></c></row>' +
    '<row r="3"></row>' +
    '<row r="4"><c r="B4" t="inlineStr"><is><t>Loft</t></is></c><c r="D4"><v>55880.5</v></c></row>' +
    '</sheetData></worksheet>',
  'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c></row></sheetData></worksheet>',
};

describe('readWorkbook', () => {
  it('reads sheets, shared and inline strings, rich text and numbers, keeping columns', () => {
    const sheets = readWorkbook(zip(QUOTE))!;
    expect(sheets.map((s) => s.name)).toEqual(['Kharadi 3BHK', 'Terms']);
    expect(sheets[0]!.rows).toEqual([
      ['Kitchen'],
      ['Base unit', '', '18mm BWP ply & laminate', '75490'],
      ['', 'Loft', '', '55880.5'],
    ]);
    expect(sheets[1]!.rows).toEqual([['10% booking, 90% handover']]);
  });

  it('reads a stored (uncompressed) workbook too', () => {
    expect(readWorkbook(zip(QUOTE, true))?.[0]?.rows[1]?.[3]).toBe('75490');
  });

  it('refuses what is not a workbook', () => {
    expect(readWorkbook(Buffer.from('%PDF-1.7 not a zip'))).toBeNull();
    expect(readWorkbook(zip({ 'word/document.xml': '<w/>' }))).toBeNull();
  });
});

describe('workbookText', () => {
  it('names each sheet and keeps empty cells visible', () => {
    const text = workbookText(readWorkbook(zip(QUOTE))!);
    expect(text).toContain('## Sheet: Kharadi 3BHK');
    expect(text).toContain('Base unit |  | 18mm BWP ply & laminate | 75490');
  });
});

describe('unzip', () => {
  it('only inflates the entries asked for', () => {
    const files = unzip(zip(QUOTE), (n) => n === 'xl/workbook.xml')!;
    expect([...files.keys()]).toEqual(['xl/workbook.xml']);
  });
});

describe('decodeXml and spreadsheetKind', () => {
  it('decodes entities', () => {
    expect(decodeXml('A &amp; B &lt;1&gt; &#8377;')).toBe('A & B <1> ₹');
  });
  it('knows a workbook by type or by name', () => {
    expect(spreadsheetKind('application/octet-stream', 'Q-104.XLSX')).toBe('xlsx');
    expect(spreadsheetKind('text/csv', 'a')).toBe('csv');
    expect(spreadsheetKind('application/vnd.ms-excel', 'old.xls')).toBeNull();
  });
});
