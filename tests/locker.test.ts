import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canRemove, canSupersede, checkProductCode, customerVisible, decisionOfDoc, newestVersions, type DocRow } from '@/modules/project/locker-rules';
import { visibleDocIndexes, customerMaterials } from '@/modules/portal/money-locker-view';
import { docMeta, generatedDocLink } from '@/modules/portal/documents';
import { makeDb, type FakeDb } from './phase5-fake-db';

/**
 * The home locker (studio workspace Phase 5): documents are versioned, a
 * shared one can only be superseded (never edited or removed), the customer
 * sees the newest shared version, drafts stay with the team, product codes
 * arrive with the order, and decision outcomes file themselves.
 */

const D = (s: string) => new Date(s);
const doc = (over: Partial<DocRow>): DocRow => ({ id: 'x', version: 1, supersedesId: null, sharedAt: D('2026-10-01T00:00:00Z'), deletedAt: null, ...over });

describe('versions', () => {
  const v1 = doc({ id: 'v1' });
  const v2 = doc({ id: 'v2', version: 2, supersedesId: 'v1' });
  const draft3 = doc({ id: 'v3', version: 3, supersedesId: 'v2', sharedAt: null });

  it('only the newest of a chain can get a new version, numbered one up', () => {
    expect(canSupersede(v2, [v1, v2])).toEqual({ ok: true, version: 3 });
    expect(canSupersede(v1, [v1, v2]).ok).toBe(false);
    expect(canSupersede(doc({ id: 'gone', deletedAt: D('2026-10-02T00:00:00Z') }), []).ok).toBe(false);
  });

  it('a shared document cannot be removed; a draft can', () => {
    expect(canRemove(v1)).toEqual({ ok: false, error: 'The customer already has this one, so it stays. Upload a new version to replace it.' });
    expect(canRemove(draft3)).toEqual({ ok: true });
  });

  it('the customer sees the newest SHARED version; a draft revision leaves the shared one showing', () => {
    expect(customerVisible([v1, v2, draft3]).map((d) => d.id)).toEqual(['v2']);
    expect(newestVersions([v1, v2, draft3]).map((d) => d.id)).toEqual(['v3']);
    // The projection reads shared documents only, so the same rule there is "drop what a shared one replaced".
    expect(visibleDocIndexes([{ id: 'v2', supersedesId: 'v1' }, { id: 'v1', supersedesId: null }, { id: 'other' }])).toEqual([0, 2]);
  });
});

describe('materials and product codes', () => {
  it('takes a code as printed, refuses junk, clears with empty', () => {
    expect(checkProductCode('  HET-SC 110/A ')).toEqual({ ok: true, value: 'HET-SC 110/A' });
    expect(checkProductCode('')).toEqual({ ok: true, value: null });
    expect(checkProductCode('<script>').ok).toBe(false);
    expect(checkProductCode('x'.repeat(61)).ok).toBe(false);
  });

  it('the customer sees the code only once ordered', () => {
    expect(
      customerMaterials([
        { id: 'm1', room: 'Kitchen', item: 'Hinges', spec: 'Soft-close', productCode: 'HET-110', orderedAt: D('2026-10-05T00:00:00Z') },
        { id: 'm2', room: 'Kitchen', item: 'Shutters', spec: 'Walnut', productCode: 'TYPO', orderedAt: null },
      ]),
    ).toEqual([
      { id: 'm1', room: 'Kitchen', item: 'Hinges', spec: 'Soft-close', productCode: 'HET-110', ordered: true },
      { id: 'm2', room: 'Kitchen', item: 'Shutters', spec: 'Walnut', productCode: null, ordered: false },
    ]);
  });
});

describe('decision outcomes, filed as records', () => {
  it('point at the decision and open its page', () => {
    expect(decisionOfDoc('decision:d123')).toBe('d123');
    expect(decisionOfDoc('project_p1/x.pdf')).toBeNull();
    expect(generatedDocLink('decision:d123', 'https://oneinteriors.in/')).toBe('https://oneinteriors.in/app/decision?id=d123');
    expect(docMeta({ contentType: 'application/x-decision', bytes: 0, createdAt: D('2026-10-11T06:00:00Z') })).toBe('Your choice · 11 Oct');
  });
});

// ── The locker flow against the stand-in ───────────────────────

const current = vi.hoisted(() => ({ db: null as unknown as { client: Record<string, unknown> }, user: null as null | { id: string; role: string } }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => current.db.client[k as string] }) }));
vi.mock('@/modules/auth/session', () => {
  const RANK = { CUSTOMER: 0, STUDIO: 1, OPS: 2, ADMIN: 3 } as const;
  return {
    getCurrentUser: vi.fn(async () => current.user),
    hasRole: (u: { role: keyof typeof RANK } | null, role: keyof typeof RANK) => !!u && RANK[u.role] >= RANK[role],
  };
});
const told = vi.hoisted(() => [] as unknown[]);
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(async (_u: string, e: unknown) => void told.push(e)), notifyStudio: vi.fn(), notifyOps: vi.fn() }));
vi.mock('@/modules/storage/project-docs', () => ({ signedDocUrls: vi.fn(async (k: string[]) => k.map((x) => `https://signed/${x}`)), storeProjectDoc: vi.fn(async () => ({ ok: true, path: 'project_p1/drawing.pdf' })) }));
vi.mock('@/modules/storage/site-photos', () => ({ signedSitePhotoUrls: vi.fn(async () => []), storeSitePhoto: vi.fn() }));

import { removeDocument, setMaterialCode, shareDocument, studioLocker, uploadDocument } from '@/modules/project/locker';

let db: FakeDb;
const as = (id: string) => {
  current.user = { id, role: 'STUDIO' };
};
const pdf = () => new File(['%PDF'], 'kitchen.pdf', { type: 'application/pdf' });

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  vi.stubEnv('SAMPLE_DATA_ONLY', '');
  db = makeDb();
  current.db = db;
  told.length = 0;
});

describe('the studio files drawings', () => {
  it('a draft stays with the team until shared; sharing tells the customer; once shared it cannot be removed, only replaced', async () => {
    as('u-pm');
    const r = await uploadDocument('p1', { kind: 'DRAWINGS', title: 'Kitchen elevations', share: false }, pdf());
    expect(r.ok).toBe(true);
    const id = db.s.documents[0]!.id as string;
    expect(db.s.documents[0]!.sharedAt).toBeNull();
    expect(told).toEqual([]);
    expect(await shareDocument(id)).toEqual({ ok: true, id });
    expect(told).toEqual([{ kind: 'document', studio: 'Teakline Studio', title: 'Kitchen elevations' }]);
    expect(await removeDocument(id)).toEqual({ ok: false, error: 'The customer already has this one, so it stays. Upload a new version to replace it.' });
    expect(db.s.documents[0]!.deletedAt).toBeNull();

    expect((await uploadDocument('p1', { kind: '', title: '', share: true, supersedesId: id }, pdf())).ok).toBe(true);
    expect(db.s.documents[1]).toMatchObject({ kind: 'DRAWINGS', title: 'Kitchen elevations', version: 2, supersedesId: id });
    expect(await uploadDocument('p1', { kind: 'DRAWINGS', title: 'x', share: true, supersedesId: id }, pdf())).toEqual({
      ok: false,
      error: 'There is a newer version of this document already. Replace that one.',
    });
    expect(db.s.events.map((e) => e.type)).toEqual(['document.filed', 'document.shared', 'document.superseded', 'document.shared']);
    const view = await studioLocker('p1');
    expect(view!.docs.map((d) => [d.version, d.shared])).toEqual([[2, true]]);
  });

  it('a draft can be removed', async () => {
    as('u-owner');
    await uploadDocument('p1', { kind: 'OTHER', title: 'Rough sketch', share: false }, pdf());
    const id = db.s.documents[0]!.id as string;
    expect(await removeDocument(id)).toEqual({ ok: true, id });
    expect(db.s.documents[0]!.deletedAt).not.toBeNull();
  });

  it('a product code marks the material ordered, once, with its event', async () => {
    as('u-pm');
    expect(await setMaterialCode('mat2', { code: 'HET-SC-110' })).toEqual({ ok: true, id: 'mat2' });
    expect(db.s.materials[1]).toMatchObject({ productCode: 'HET-SC-110' });
    expect(db.s.materials[1]!.orderedAt).toBeInstanceOf(Date);
    expect(db.s.events.map((e) => e.type)).toEqual(['material.ordered']);
  });

  it('a supervisor and accounts cannot touch the locker', async () => {
    as('u-sup');
    expect(await uploadDocument('p1', { kind: 'DRAWINGS', title: 'x', share: true }, pdf())).toMatchObject({ ok: false });
    expect(await setMaterialCode('mat1', { code: 'A1' })).toMatchObject({ ok: false });
    as('u-acc');
    expect(await uploadDocument('p1', { kind: 'DRAWINGS', title: 'x', share: true }, pdf())).toMatchObject({ ok: false });
    expect(db.s.documents).toEqual([]);
    expect(db.s.materials[0]!.productCode).toBeNull();
  });
});
