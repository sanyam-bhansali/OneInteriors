import { describe, expect, it } from 'vitest';
import { checkUpload, docFileName, finalsOf, handoverMissing, isHandoverDocsStep, nameWord, versionLabels, type DocVersion } from '@/modules/studio-design/documents';
import { crc32, makeZip } from '@/lib/zip';

/** Project documents (owner and Hauspire's design team, 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md §3). */

describe('version numbers', () => {
  const chain = [
    { id: 'a', version: 1, supersedesId: null },
    { id: 'b', version: 2, supersedesId: 'a' },
    { id: 'c', version: 3, supersedesId: 'b' },
    { id: 'd', version: 4, supersedesId: 'c' },
  ];

  it('the first upload is 1.0 and each upload after it adds .1', () => {
    expect([...versionLabels(chain, new Set()).entries()]).toEqual([
      ['a', '1.0'],
      ['b', '1.1'],
      ['c', '1.2'],
      ['d', '1.3'],
    ]);
  });

  it('a version the client approved becomes the next whole number; the next upload counts on from it', () => {
    const v = versionLabels(chain, new Set(['b']));
    expect([v.get('a'), v.get('b'), v.get('c'), v.get('d')]).toEqual(['1.0', '2.0', '2.1', '2.2']);
    const twice = versionLabels(chain, new Set(['b', 'd']));
    expect(twice.get('d')).toBe('3.0');
  });

  it('keeps chains apart', () => {
    const v = versionLabels([...chain.slice(0, 2), { id: 'x', version: 1, supersedesId: null }], new Set(['x']));
    expect([v.get('b'), v.get('x')]).toEqual(['1.1', '2.0']);
  });
});

describe('file names', () => {
  it('TYPE_Studio_Client_date_time_vX.Y.ext, in India’s time, words run together', () => {
    expect(docFileName({ type: 'LAYOUT_2D', studio: 'Hauspire', client: 'Rohan Kulkarni', at: new Date('2026-10-25T09:00:00Z'), version: '1.0', ext: 'pdf' })).toBe(
      '2D_Hauspire_RohanKulkarni_2026-10-25_1430_v1.0.pdf',
    );
    expect(docFileName({ type: 'WORKING', room: 'master bedroom', studio: 'HAUSPIRE', client: 'Meera', at: new Date('2026-10-25T20:00:00Z'), version: '2.1', ext: 'dwg' })).toBe(
      'WD_MasterBedroom_HAUSPIRE_Meera_2026-10-26_0130_v2.1.dwg',
    );
  });

  it('never carries characters a file system refuses', () => {
    expect(nameWord('Mr. A/B: "Patil"', 'X')).toBe('MrABPatil');
    expect(nameWord('   ', 'Client')).toBe('Client');
  });
});

describe('finals', () => {
  const d = (id: string, o: Partial<DocVersion> = {}): DocVersion => ({ id, type: 'LAYOUT_2D', room: null, version: 1, supersedesId: null, shared: true, answer: null, at: new Date('2026-10-20T00:00:00Z'), ...o });

  it('the newest approved version counts; a newer one waiting is flagged', () => {
    const f = finalsOf([d('a', { answer: 'APPROVED' }), d('b', { version: 2, supersedesId: 'a' })]);
    expect(f).toEqual([{ id: 'a', type: 'LAYOUT_2D', room: null, state: 'approved', versions: 2, newerWaiting: true }]);
  });

  it('else the newest shared, waiting or with changes asked; else the newest draft', () => {
    expect(finalsOf([d('a', { answer: 'CHANGES' }), d('b', { version: 2, shared: false })])[0]).toMatchObject({ id: 'a', state: 'changes' });
    expect(finalsOf([d('a', { shared: false })])[0]).toMatchObject({ id: 'a', state: 'draft' });
    expect(finalsOf([d('m', { type: 'MATERIAL_LIST' })])[0]).toMatchObject({ state: 'shared' });
  });

  it('one line per type and room, in the order of the work', () => {
    const f = finalsOf([d('w', { type: 'WORKING', room: 'Kitchen' }), d('k', { type: 'WORKING', room: 'Bedroom' }), d('l')]);
    expect(f.map((x) => [x.type, x.room])).toEqual([
      ['LAYOUT_2D', null],
      ['WORKING', 'Bedroom'],
      ['WORKING', 'Kitchen'],
    ]);
  });

  it('the handover pack needs approved working and electrical drawings, and a material and cut list', () => {
    expect(handoverMissing(finalsOf([d('w', { type: 'WORKING' })]))).toEqual(['Working drawings', 'Electrical drawings & quotation', 'Material list', 'Factory cut list']);
    const ready = finalsOf([
      d('w', { type: 'WORKING', answer: 'APPROVED' }),
      d('e', { type: 'ELECTRICAL', answer: 'APPROVED' }),
      d('m', { type: 'MATERIAL_LIST', shared: false }),
      d('c', { type: 'CUT_LIST' }),
    ]);
    expect(handoverMissing(ready)).toEqual([]);
    expect(isHandoverDocsStep('Final documentation for handover')).toBe(true);
    expect(isHandoverDocsStep('Working drawings final')).toBe(false);
  });
});

describe('uploads', () => {
  it('take drawings, sheets and models up to 50 MB, by extension', () => {
    expect(checkUpload('Plan.DWG', 1000)).toEqual({ ok: true, ext: 'dwg', contentType: 'application/acad' });
    expect(checkUpload('cut.xlsx', 1000)).toMatchObject({ ok: true, ext: 'xlsx' });
    expect(checkUpload('photo.jpeg', 1000)).toMatchObject({ ok: true, ext: 'jpg' });
    expect(checkUpload('model.skp', 51 * 1024 * 1024)).toMatchObject({ ok: false });
    expect(checkUpload('virus.exe', 10)).toMatchObject({ ok: false });
    expect(checkUpload('a.pdf', 0)).toMatchObject({ ok: false });
  });
});

describe('the zip of the handover pack', () => {
  it('stores every file with its CRC, and renames a repeated name', () => {
    const enc = new TextEncoder();
    expect(crc32(enc.encode('hello'))).toBe(0x3610a686);
    const z = makeZip([
      { name: 'a.pdf', data: enc.encode('one') },
      { name: 'a.pdf', data: enc.encode('two') },
    ]);
    const text = new TextDecoder('latin1').decode(z);
    expect(text.startsWith('PK\x03\x04')).toBe(true);
    expect(text).toContain('a (2).pdf');
    // The end record: two entries.
    const end = new DataView(z.buffer, z.length - 22);
    expect(end.getUint32(0, true)).toBe(0x06054b50);
    expect(end.getUint16(10, true)).toBe(2);
  });
});
