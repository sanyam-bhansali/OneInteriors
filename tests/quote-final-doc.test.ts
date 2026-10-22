import { describe, expect, it } from 'vitest';
import { changeSentence, deltaText, finalCounts, finalRooms, sizeText, withKnownDetails, type FinalLineInput } from '@/modules/studio-quote/final-doc';
import { docRooms } from '@/modules/studio-quote/document';
import { cleanNote, LINE_NOTE_MAX } from '@/modules/studio-quote/line-note';
import { contentKey, readRevisionLines, type RevisionLine, type RevisionTerms } from '@/modules/studio-sales/revision-rules';

const line = (p: Partial<FinalLineInput> & { room: string; product: string; amountPaise: number }): FinalLineInput => ({
  code: 'MODULAR',
  unit: 'AREA',
  details: null,
  widthMm: null,
  heightMm: null,
  qtyMilli: null,
  ...p,
});

/* The team's own example (15 Oct 2026). */
const was = [
  line({ room: 'Kitchen', product: 'Wall cabinets', widthMm: 2400, heightMm: 600, amountPaise: 39_000_00, details: 'Carcass and shutters.' }),
  line({ room: 'Kitchen', product: 'Wall cabinets vertical', widthMm: 600, heightMm: 900, amountPaise: 12_000_00 }),
  line({ room: 'Master Bedroom', product: 'Dressing unit mirror', unit: 'UNIT', code: 'ONSITE', qtyMilli: 1000, amountPaise: 8_000_00 }),
  line({ room: 'Master Bedroom', product: 'Wardrobe', widthMm: 1800, heightMm: 2100, amountPaise: 90_000_00 }),
];
const now = [
  line({ room: 'Kitchen', product: 'Wall cabinets', widthMm: 2400, heightMm: 697, amountPaise: 46_000_00, details: 'Carcass and shutters.', note: 'Height raised to meet the chimney.' }),
  line({ room: 'Master Bedroom', product: 'Wardrobe', widthMm: 1800, heightMm: 2100, amountPaise: 90_000_00 }),
  line({ room: 'Master Bedroom', product: 'Dressing unit mirror', unit: 'UNIT', code: 'ONSITE', qtyMilli: 5000, amountPaise: 40_000_00 }),
  line({ room: 'Kitchen', product: 'Tall unit', widthMm: 600, heightMm: 2100, amountPaise: 45_000_00 }),
];

describe('the Final (Original vs Revised) document', () => {
  const rooms = finalRooms(was, now, ['Kitchen', 'Master Bedroom']);

  it('keeps every line, room by room, with work code, details, note and sizes before and after', () => {
    expect(rooms.map((r) => r.room)).toEqual(['Kitchen', 'Master Bedroom']);
    const k = rooms[0]!;
    expect(k.rows.map((r) => [r.product, r.kind])).toEqual([
      ['Wall cabinets', 'CHANGED'],
      ['Tall unit', 'ADDED'],
      ['Wall cabinets vertical', 'REMOVED'],
    ]);
    const wc = k.rows[0]!;
    expect(wc).toMatchObject({ code: 'MO-01', details: 'Carcass and shutters.', sizeWas: '2400 × 600 mm', sizeNow: '2400 × 697 mm', sizeChanged: true, wasPaise: 39_000_00, nowPaise: 46_000_00, deltaPaise: 7_000_00, note: 'Height raised to meet the chimney.' });
    expect(k.rows[2]).toMatchObject({ sizeWas: '600 × 900 mm', sizeNow: '', wasPaise: 12_000_00, nowPaise: 0, deltaPaise: -12_000_00 });
  });

  it('gives each room both sub-totals and the difference', () => {
    expect(rooms[0]).toMatchObject({ wasPaise: 51_000_00, nowPaise: 91_000_00, deltaPaise: 40_000_00 });
    expect(rooms[1]).toMatchObject({ wasPaise: 98_000_00, nowPaise: 130_000_00, deltaPaise: 32_000_00 });
    expect(rooms[1]!.rows.find((r) => r.product === 'Wardrobe')!.kind).toBe('UNCHANGED');
    expect(finalCounts(rooms)).toEqual({ added: 1, changed: 2, removed: 1 });
  });

  it('says each change the way the team does', () => {
    const [wc, tall, vertical] = rooms[0]!.rows;
    expect(changeSentence('Kitchen', wc!)).toBe('Kitchen — Wall cabinets: 2400 × 600 mm → 2400 × 697 mm; ₹39,000 → ₹46,000 (+ ₹7,000).');
    expect(changeSentence('Kitchen', vertical!)).toBe('Kitchen — Wall cabinets vertical (600 × 900 mm) removed: ₹12,000 less.');
    expect(changeSentence('Kitchen', tall!)).toBe('Kitchen — Tall unit added, 600 × 2100 mm: ₹45,000 more.');
    const mirror = rooms[1]!.rows.find((r) => r.product === 'Dressing unit mirror')!;
    expect(changeSentence('Master Bedroom', mirror)).toBe('Master Bedroom — Dressing unit mirror: 1 nos → 5 nos; ₹8,000 → ₹40,000 (+ ₹32,000).');
    expect(changeSentence('Master Bedroom', rooms[1]!.rows.find((r) => r.product === 'Wardrobe')!)).toBeNull();
    expect(deltaText(-12_000_00)).toBe('− ₹12,000');
  });

  it('marks a changed work code or changed details, even at the same price', () => {
    const r = finalRooms(
      [line({ room: 'Hall', product: 'TV unit', code: 'MODULAR', unit: 'UNIT', qtyMilli: 1000, amountPaise: 30_000_00, details: 'Laminate' })],
      [line({ room: 'Hall', product: 'TV unit', code: 'ONSITE', unit: 'UNIT', qtyMilli: 1000, amountPaise: 30_000_00, details: 'Veneer' })],
      ['Hall'],
    )[0]!.rows[0]!;
    expect(r).toMatchObject({ kind: 'CHANGED', code: 'NM-01', codeWas: 'MO-01', details: 'Veneer', detailsWas: 'Laminate', sizeChanged: false, deltaPaise: 0 });
    expect(changeSentence('Hall', r)).toBe('Hall — TV unit: work code MO-01 → NM-01; details changed; price unchanged at ₹30,000.');
  });

  it('pairs the same product twice by what did not change, then in order', () => {
    const r = finalRooms(
      [line({ room: 'Bed 2', product: 'Wardrobe', widthMm: 1500, heightMm: 2100, amountPaise: 60_000_00 }), line({ room: 'Bed 2', product: 'Wardrobe', widthMm: 1800, heightMm: 2100, amountPaise: 72_000_00 })],
      [line({ room: 'Bed 2', product: 'Wardrobe', widthMm: 1800, heightMm: 2100, amountPaise: 72_000_00 })],
      ['Bed 2'],
    )[0]!.rows;
    expect(r.map((x) => [x.kind, x.sizeWas || x.sizeNow])).toEqual([
      ['UNCHANGED', '1800 × 2100 mm'],
      ['REMOVED', '1500 × 2100 mm'],
    ]);
  });

  it('fills details an old frozen side lacks from the quotation, and keeps its own', () => {
    const filled = withKnownDetails([line({ room: 'Kitchen', product: 'Wall cabinets', amountPaise: 1 }), line({ room: 'Kitchen', product: 'Loft', amountPaise: 1, details: 'Own' })], [
      line({ room: 'Kitchen', product: 'Wall cabinets', amountPaise: 1, details: 'From the quotation' }),
      line({ room: 'Kitchen', product: 'Loft', amountPaise: 1, details: 'Other' }),
    ]);
    expect(filled.map((l) => l.details)).toEqual(['From the quotation', 'Own']);
  });

  it('prints sizes for each unit', () => {
    expect(sizeText({ unit: 'AREA', widthMm: 2400, heightMm: null, qtyMilli: null })).toBe('2400 mm');
    expect(sizeText({ unit: 'SQFT', widthMm: null, heightMm: null, qtyMilli: 34_390 })).toBe('34.39 sqft');
    expect(sizeText({ unit: 'RFT', widthMm: null, heightMm: null, qtyMilli: 12_000 })).toBe('12 rft');
  });
});

describe('notes on quotation lines', () => {
  it('stores a note trimmed and capped, blank as none', () => {
    expect(cleanNote('  Handles as per sample \r\n')).toBe('Handles as per sample');
    expect(cleanNote('   ')).toBeNull();
    expect(cleanNote(42)).toBeNull();
    expect(cleanNote('x'.repeat(LINE_NOTE_MAX + 50))!.length).toBe(LINE_NOTE_MAX);
  });

  it('prints the note on the quotation PDF rows', () => {
    const rows = docRooms([{ ...now[0]!, note: '  Height raised. ' }, now[3]!], ['Kitchen'], 0)[0]!.rows;
    expect(rows.map((r) => r.note)).toEqual(['Height raised.', '']);
  });

  it('is kept in a revision, and a changed note is a changed quotation; old revisions key as before', () => {
    const terms: RevisionTerms = { feeBps: 0, discountBps: 0, onSpotPaise: 0, onSpotLabel: null, bookingAdvancePaise: 0, gstBps: 0, phases: null };
    const base: RevisionLine = { room: 'Kitchen', product: 'Loft', code: 'MODULAR', unit: 'AREA', details: null, widthMm: 1000, heightMm: 600, qtyMilli: null, ratePaise: 100, amountPaise: 6_000 };
    const old = readRevisionLines([{ ...base }]);
    expect(old[0]!.note ?? null).toBeNull();
    expect(contentKey(old, terms)).toBe(contentKey([{ ...base, note: null }], terms));
    expect(contentKey([{ ...base, note: 'A' }], terms)).not.toBe(contentKey([{ ...base, note: 'B' }], terms));
    expect(readRevisionLines([{ ...base, note: 'Kept' }])[0]!.note).toBe('Kept');
  });
});
