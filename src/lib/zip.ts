/**
 * A ZIP file from a few files, stored without compression (the handover
 * pack: drawings and sheets that are already compressed, gathered in the
 * browser so nothing large passes through a server function). Plain ZIP:
 * opens in Windows, macOS and every phone. UTF-8 names. Pure; tested in
 * tests/zip.test.ts.
 */

let table: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

/** The CRC-32 a ZIP needs for each file. */
export function crc32(data: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = t[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS time and date, as ZIP stores them. */
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31),
    date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** The ZIP's bytes. Names that repeat get " (2)", " (3)"… before the extension. */
export function makeZip(entries: readonly ZipEntry[], at = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosTime(at);
  const used = new Map<string, number>();
  const named = entries.map((e) => {
    const n = (used.get(e.name) ?? 0) + 1;
    used.set(e.name, n);
    const name = n === 1 ? e.name : e.name.replace(/(\.[^.]*)?$/, (ext) => ` (${n})${ext}`);
    return { name: enc.encode(name), data: e.data, crc: crc32(e.data) };
  });
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of named) {
    const local = new Uint8Array(30 + e.name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true); // version needed
    v.setUint16(6, 0x0800, true); // UTF-8 names
    v.setUint16(8, 0, true); // stored
    v.setUint16(10, time, true);
    v.setUint16(12, date, true);
    v.setUint32(14, e.crc, true);
    v.setUint32(18, e.data.length, true);
    v.setUint32(22, e.data.length, true);
    v.setUint16(26, e.name.length, true);
    v.setUint16(28, 0, true);
    local.set(e.name, 30);
    const central = new Uint8Array(46 + e.name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // made by
    c.setUint16(6, 20, true); // needed
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, e.crc, true);
    c.setUint32(20, e.data.length, true);
    c.setUint32(24, e.data.length, true);
    c.setUint16(28, e.name.length, true);
    c.setUint32(42, offset, true);
    central.set(e.name, 46);
    locals.push(local, e.data);
    centrals.push(central);
    offset += local.length + e.data.length;
  }
  const cdSize = centrals.reduce((a, x) => a + x.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, named.length, true);
  ev.setUint16(10, named.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + end.length);
  let at2 = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at2);
    at2 += part.length;
  }
  return out;
}
