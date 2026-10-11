import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_PROJECT_SELECT, customerPhases, toCustomerProject, type CustomerProjectRow } from '@/modules/portal/customer-project-view';

/**
 * What crosses to the customer (docs/studio-workspace/STUDIO-WORKSPACE-
 * BUILD.md §5). The projection is fed a row carrying every internal field
 * the studio side has or will have — studio cost, transcript, voice path,
 * internal notes, crew phone, who posted what — and the output must contain
 * none of them, by key or by value. Then: what is selected at all, drafts
 * kept back, and the payment plan read from the signed copy.
 */

const db = vi.hoisted(() => ({ findMany: vi.fn(async (_args?: unknown) => [] as unknown[]) }));
vi.mock('@/lib/prisma', () => ({ prisma: { homeProject: { findMany: db.findMany } } }));
vi.mock('@/modules/storage/site-photos', () => ({ signedSitePhotoUrls: vi.fn(async () => []) }));
vi.mock('@/modules/storage/project-docs', () => ({ signedDocUrls: vi.fn(async () => []) }));

/** Values that must never reach the customer. Each is unique, so finding it anywhere in the output is a leak. */
const SECRET = {
  studioCost: 'STUDIO-COST-4242',
  transcript: 'TRANSCRIPT-bhai yeh shutter',
  voicePath: 'voice/SECRET-VOICE.m4a',
  teamNotes: 'TEAM-NOTES-customer is difficult',
  crewPhone: '+919811111111',
  wages: 'WAGES-900',
  vendorRate: 'VENDOR-RATE-55',
  storageKey: 'project-docs/SECRET-KEY.pdf',
  photoPath: 'site-photos/SECRET-PHOTO.jpg',
  staffId: 'u-staff-SECRET',
  familyUserId: 'u-family-SECRET',
  customerId: 'u-customer-SECRET',
};

/** Keys that must never appear in the output. */
const FORBIDDEN_KEYS = [
  'studioCostDeltaPaise',
  'studioCost',
  'transcript',
  'transcriptLang',
  'voicePath',
  'teamNotes',
  'internalNote',
  'crewPhone',
  'phone',
  'wages',
  'vendorRate',
  'ratePaise',
  'postedById',
  'uploadedById',
  'raisedById',
  'chosenById',
  'doneById',
  'remindedAt',
  'storageKey',
  'photoPaths',
  'fixedPhotoPaths',
  'userId',
  'paidPhases',
  'paymentPhases',
  'deletedAt',
];

const D = (s: string) => new Date(s);

/** A row with the selected fields AND every internal one a careless query could bring along. */
function leakyRow(): CustomerProjectRow {
  const row = {
    id: 'p1',
    startOn: D('2026-09-01T00:00:00Z'),
    totalDays: 90,
    doneStages: [],
    plan: 'BASIC',
    contractPaise: BigInt(10_00_000_00),
    paymentPhases: [
      { label: 'Booking', pct: 10, amountPaise: 1_00_000_00 },
      { label: 'Delivery', pct: 60, amountPaise: 6_00_000_00 },
      { label: 'Handover', pct: 30, amountPaise: 3_00_000_00 },
    ],
    paidPhases: [{ index: 0, paidOn: '2026-09-02', remindedAt: SECRET.studioCost }],
    teamNotes: SECRET.teamNotes,
    introduction: {
      brief: { userId: SECRET.customerId },
      studio: {
        tradeName: 'Studio One',
        paymentPhases: [
          { label: 'Studio now asks', pct: 60 },
          { label: 'Rest', pct: 40 },
        ],
        phone: SECRET.crewPhone,
      },
    },
    updates: [
      {
        id: 'up1',
        note: 'Carcasses delivered',
        stage: null,
        createdAt: D('2026-09-10T10:00:00Z'),
        byStudio: true,
        photoPaths: [SECRET.photoPath],
        postedById: SECRET.staffId,
        voicePath: SECRET.voicePath,
        transcript: SECRET.transcript,
        crew: [{ crewName: 'Ramesh', crewRole: 'Carpenter', crewPhone: SECRET.crewPhone, wages: SECRET.wages }],
      },
    ],
    decisions: [
      {
        id: 'd1',
        title: 'Shutter finish',
        why: 'Cutting next week',
        dueOn: D('2026-12-01T00:00:00Z'),
        options: [
          { name: 'Matte', note: 'In the quote', extraPaise: 0, studioCostDeltaPaise: SECRET.studioCost },
          { name: 'Gloss', note: null, extraPaise: 12_000_00, studioCostDeltaPaise: SECRET.studioCost, vendorRate: SECRET.vendorRate },
        ],
        chosenIndex: 1,
        chosenAt: D('2026-10-01T00:00:00Z'),
        chosenById: SECRET.customerId,
        byStudio: true,
        postedById: SECRET.staffId,
        remindedAt: D('2026-09-29T00:00:00Z'),
        votes: [{ userId: SECRET.familyUserId, optionIndex: 0, note: 'Matte please' }],
      },
    ],
    family: [{ userId: SECRET.familyUserId, name: 'Asha', phone: SECRET.crewPhone }],
    snags: [
      {
        id: 's1',
        title: 'Chipped shutter',
        room: 'Kitchen',
        note: 'Left of the hob',
        status: 'FIXED',
        createdAt: D('2026-10-02T00:00:00Z'),
        raisedByStudio: false,
        raisedById: SECRET.customerId,
        photoPaths: [SECRET.photoPath],
        fixBy: D('2026-10-05T00:00:00Z'),
        fixedAt: D('2026-10-04T00:00:00Z'),
        fixedNote: 'Edge banding replaced',
        fixedPhotoPaths: [SECRET.photoPath],
        voicePath: SECRET.voicePath,
        transcript: SECRET.transcript,
        internalNote: SECRET.teamNotes,
        causedBy: SECRET.staffId,
      },
    ],
    documents: [
      {
        id: 'doc1',
        kind: 'AGREEMENT',
        title: 'Agreement',
        storageKey: SECRET.storageKey,
        contentType: 'application/pdf',
        bytes: 120_000,
        createdAt: D('2026-09-01T00:00:00Z'),
        uploadedById: SECRET.staffId,
        sharedAt: D('2026-09-01T00:00:00Z'),
      },
    ],
  };
  return row as unknown as CustomerProjectRow;
}

function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysOf(v, out);
    }
  }
  return out;
}

describe('the customer projection never leaks an internal field', () => {
  const now = D('2026-10-11T00:00:00Z');
  const out = toCustomerProject(leakyRow(), SECRET.customerId, now, {
    updatePhotos: [['https://signed/1']],
    snagPhotos: [['https://signed/2']],
    fixedPhotos: [['https://signed/3']],
    docUrls: ['https://signed/doc'],
  });
  const json = JSON.stringify(out);

  it('carries no internal value anywhere', () => {
    for (const [name, value] of Object.entries(SECRET)) expect(json, name).not.toContain(value);
  });

  it('carries no internal key anywhere', () => {
    const keys = keysOf(out);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k), k).toBe(false);
  });

  it('still carries what the customer should see', () => {
    expect(out.role).toBe('owner');
    expect(out.studio).toBe('Studio One');
    expect(out.updates[0]).toMatchObject({ note: 'Carcasses delivered', photos: ['https://signed/1'] });
    expect(out.decisions[0]!.options.map((o) => o.name)).toEqual(['Matte', 'Gloss']);
    expect(out.decisions[0]!.votes[0]).toEqual({ name: 'Asha', optionIndex: 0, note: 'Matte please', mine: false });
    expect(out.snags[0]).toMatchObject({ fixedNote: 'Edge banding replaced', fixedPhotos: ['https://signed/3'] });
    expect(out.documents[0]).toMatchObject({ title: 'Agreement', url: 'https://signed/doc' });
    expect(out.money?.paidPaise).toBe(1_00_000_00);
  });

  it('shows the payment plan as signed, not the studio’s current one', () => {
    expect(out.phases).toEqual([
      { label: 'Booking', pct: 10 },
      { label: 'Delivery', pct: 60 },
      { label: 'Handover', pct: 30 },
    ]);
  });
});

describe('what the projection reads at all', () => {
  const selected = keysOf(CUSTOMER_PROJECT_SELECT);

  it('selects no internal column', () => {
    // storageKey and photo paths ARE read, to sign links; the test above proves they never come out.
    for (const k of ['teamNotes', 'postedById', 'uploadedById', 'raisedById', 'chosenById', 'remindedAt', 'invitedById']) {
      expect(selected.has(k), k).toBe(false);
    }
  });

  it('reads only documents the studio shared, and none removed', () => {
    expect(CUSTOMER_PROJECT_SELECT.documents.where).toEqual({ deletedAt: null, sharedAt: { not: null } });
  });

  it('is the select the server module queries with', async () => {
    const { customerProjects } = await import('@/modules/portal/customer-project');
    await customerProjects('u1');
    const args = db.findMany.mock.calls[0]![0] as { select: unknown; include?: unknown };
    expect(args.select).toBe(CUSTOMER_PROJECT_SELECT);
    expect(args.include).toBeUndefined();
  });
});

describe('customerPhases', () => {
  it('reads the signed stages, working out a percent signed only as an amount', () => {
    expect(
      customerPhases(
        [
          { label: 'Booking', pct: null, amountPaise: 25_000 },
          { label: 'Handover', amountPaise: 75_000 },
        ],
        [{ label: 'Other', pct: 100 }],
      ),
    ).toEqual([
      { label: 'Booking', pct: 25 },
      { label: 'Handover', pct: 75 },
    ]);
  });

  it('falls back to the studio’s filed schedule only when nothing was signed', () => {
    const filed = [
      { label: 'Booking', pct: 40 },
      { label: 'Handover', pct: 60 },
    ];
    expect(customerPhases(null, filed)).toEqual(filed);
    expect(customerPhases(null, null)).toBeNull();
  });
});
