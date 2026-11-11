/**
 * Read the first sheet of an .xlsx file in the browser, with no library: an
 * .xlsx is a zip of XML files, the browser unzips with DecompressionStream,
 * and DOMParser reads the XML. Phone numbers come out as the digits the
 * workbook holds, not Excel's "9.87654E+09" (csv.ts `looksDestroyed`).
 *
 * Browser-only. Handles shared strings, inline strings, numbers and
 * booleans, and skips gaps by the cell reference (A1, C1 …).
 */

interface ZipEntry {
  name: string;
  method: number;
  size: number;
  offset: number;
}

function entries(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  /* End of central directory: the last 22+ bytes, signature 0x06054b50. */
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.push({ name, method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf);
  const nameLen = v.getUint16(e.offset + 26, true);
  const extraLen = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error('unsupported compression');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const textOf = (el: Element | null) => (el ? Array.from(el.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('') : '');

/** The first worksheet's rows, as text cells. */
export async function readXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const list = entries(buf);
  const find = (name: string) => list.find((e) => e.name === name);
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  const shared: string[] = [];
  const ss = find('xl/sharedStrings.xml');
  if (ss) {
    const doc = parse(await readEntry(buf, ss));
    for (const si of Array.from(doc.getElementsByTagName('si'))) shared.push(textOf(si));
  }

  /* The first sheet in the workbook's own order, through its relationship. */
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = find('xl/workbook.xml');
  const rels = find('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = parse(await readEntry(buf, wb)).getElementsByTagName('sheet')[0];
    const rid = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = Array.from(parse(await readEntry(buf, rels)).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sheet = find(sheetPath) ?? list.find((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sheet) throw new Error('no sheet');
  const doc = parse(await readEntry(buf, sheet));
  const rows: string[][] = [];
  for (const r of Array.from(doc.getElementsByTagName('row'))) {
    const row: string[] = [];
    for (const c of Array.from(r.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const i = ref ? colIndex(ref) : row.length;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let value = v;
      if (t === 's') value = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') value = textOf(c.getElementsByTagName('is')[0] ?? null);
      else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      while (row.length < i) row.push('');
      row[i] = value;
    }
    rows.push(row);
  }
  return rows;
}
