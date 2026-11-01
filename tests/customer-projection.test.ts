import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_PROJECT_SELECT, customerPhases, toCustomerProject, type CustomerProjectRow } from '@/modules/portal/customer-project-view';
import { toCustomerDesign } from '@/modules/studio-design/customer-view';

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
  // Phases 2–5 (PHASES-2-5-FOUNDATION.md): what the new tables hold that must stay inside.
  siteNote: 'SITE-NOTE-plumber was drunk',
  internalNote: 'INTERNAL-NOTE-only your team',
  disputeNote: 'DISPUTE-NOTE-to our team',
  delayNote: 'DELAY-NOTE-we forgot to order',
  paymentNote: 'PAYMENT-NOTE-UTR 998877',
  lat: '18.5204303',
  eventPayload: 'EVENT-PAYLOAD-SECRET',
  dedupeKey: 'reminder|SECRET-DEDUPE',
  clientRef: 'client-ref-SECRET',
  assignee: 'm-assignee-SECRET',
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
  // Phases 2–5
  'disputeNote',
  'lat',
  'lng',
  'recordedById',
  'customerConfirmedById',
  'disputedById',
  'actorId',
  'payload',
  'dedupeKey',
  'clientRef',
  'crewMemberId',
  'assigneeId',
  'byId',
  // The step tracker: a step's stored weight, scope, photo link and post link stay inside (weights cross only as pct).
  'weightBp',
  'inScope',
  'donePhotoId',
  'doneSiteLogId',
  'doneSource',
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
    siteLogs: [
      {
        id: 'log1',
        date: D('2026-10-10T00:00:00Z'),
        kind: 'UPDATE',
        note: SECRET.siteNote,
        voicePath: SECRET.voicePath,
        transcript: SECRET.transcript,
        transcriptLang: 'mr',
        customerText: 'Kitchen carcasses are up.',
        postedById: SECRET.staffId,
        clientRef: SECRET.clientRef,
        // Phase 2: the rest of a real row, selected or not.
        reason: null,
        customerLang: 'en',
        postedAt: D('2026-10-10T11:30:00Z'),
        createdAt: D('2026-10-10T14:00:00Z'),
        correctsId: null,
        stageId: 'stage-SECRET',
        photos: [
          {
            storagePath: SECRET.photoPath,
            lat: Number(SECRET.lat),
            lng: 73.8567437,
            voicePath: SECRET.voicePath,
            transcript: SECRET.transcript,
            transcriptLang: 'mr',
            takenAt: D('2026-10-10T11:20:00Z'),
            fromGallery: true,
            customerText: 'Kitchen carcass levelled and fixed to the wall.',
            customerLang: 'en',
            // The step this photo ticked (the step tracker): only its name may cross, and only when it is starred (customer milestones).
            doneStep: { id: 'step-SECRET', label: 'Carcass complete with hardware', doneById: SECRET.staffId, weightBp: 1000, donePhotoId: 'photo-SECRET', customerMilestone: true },
          },
        ],
        crew: [
          {
            crewName: 'Ramesh Pawar',
            crewRole: 'Carpenter',
            arrivedAt: D('2026-10-10T04:10:00Z'),
            crewMemberId: 'crew-1',
            phone: SECRET.crewPhone,
            wages: SECRET.wages,
            crewMember: { phone: SECRET.crewPhone },
          },
        ],
        ticked: [
          { room: 'Kitchen', label: 'Carcass levelled', doneById: SECRET.staffId, customerMilestone: true },
          // Not starred: the studio's own step, never named to the customer.
          { room: 'Kitchen', label: 'Hardware stage 1 ordered SECRET-UNSTARRED', doneById: SECRET.staffId, customerMilestone: false },
        ],
      },
      {
        id: 'log2',
        date: D('2026-10-10T00:00:00Z'),
        kind: 'CORRECTION',
        reason: null,
        note: SECRET.siteNote,
        voicePath: SECRET.voicePath,
        transcript: SECRET.transcript,
        customerText: 'The loft shutters went up after lunch.',
        customerLang: 'en',
        postedAt: D('2026-10-10T12:30:00Z'),
        correctsId: 'log1',
        postedById: SECRET.staffId,
        clientRef: `${SECRET.clientRef}-2`,
        photos: [],
        crew: [],
        ticked: [],
      },
      {
        id: 'log3',
        date: D('2026-10-09T00:00:00Z'),
        kind: 'NOBODY',
        reason: 'WAITING_CUSTOMER_DECISION',
        note: SECRET.siteNote,
        customerText: null,
        customerLang: null,
        postedAt: D('2026-10-09T05:00:00Z'),
        correctsId: null,
        postedById: SECRET.staffId,
        clientRef: `${SECRET.clientRef}-3`,
        photos: [],
        crew: [],
        ticked: [],
      },
    ],
    dateChanges: [{ id: 'dc1', field: 'PLANNED_END', reason: 'STUDIO', note: SECRET.delayNote, byId: SECRET.staffId }],
    payments: [
      {
        id: 'pay1',
        stageIndex: 0,
        amountPaise: BigInt(1_00_000_00),
        note: SECRET.paymentNote,
        recordedById: SECRET.staffId,
        disputeNote: SECRET.disputeNote,
        disputedById: SECRET.customerId,
        // Phase 5: paid is counted from the rows, so this one is the customer's confirmed payment.
        receivedOn: D('2026-09-02T00:00:00Z'),
        recordedAt: D('2026-09-02T10:00:00Z'),
        customerConfirmedAt: D('2026-09-03T10:00:00Z'),
        customerConfirmedById: SECRET.customerId,
      },
    ],
    events: [{ id: 'e1', type: 'site.posted', actorId: SECRET.staffId, payload: { secret: SECRET.eventPayload }, dedupeKey: SECRET.dedupeKey }],
    quoteChanges: [{ id: 'qc1', label: 'Shutter finish: Gloss', deltaPaise: BigInt(12_000_00), byId: SECRET.customerId }],
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
        choices: [
          { id: 'o1', label: 'Matte', deltaPaise: BigInt(0), studioCostDeltaPaise: BigInt(4242), photoPath: SECRET.photoPath },
          { id: 'o2', label: 'Gloss', deltaPaise: BigInt(12_000_00), studioCostDeltaPaise: SECRET.studioCost },
        ],
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
        assigneeId: SECRET.assignee,
        events: [
          { kind: 'ACCEPTED', at: D('2026-10-02T06:00:00Z'), fixBy: D('2026-10-05T00:00:00Z'), internalNote: SECRET.internalNote, assigneeId: SECRET.assignee, byId: SECRET.staffId },
          { kind: 'FIXED', at: D('2026-10-04T00:00:00Z'), photoPaths: [SECRET.photoPath], voicePath: SECRET.voicePath, transcript: SECRET.transcript, transcriptLang: 'mr', customerText: 'Edge banding replaced' },
        ],
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
    // Phases 2–5: columns that exist now and must never be selected for the customer.
    for (const k of [
      'studioCostDeltaPaise',
      'transcript',
      'transcriptLang',
      'voicePath',
      'internalNote',
      'phone',
      'disputeNote',
      'lat',
      'lng',
      'payload',
      'dedupeKey',
      'actorId',
      'assigneeId',
      'assignee',
      'recordedById',
      'customerConfirmedById',
      'disputedById',
      'clientRef',
      'crewMember',
    ]) {
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

describe('the stages the customer sees', () => {
  const now = D('2026-10-11T00:00:00Z');
  const withStages = (stages: unknown) => ({ ...(leakyRow() as unknown as Record<string, unknown>), stages }) as unknown as CustomerProjectRow;

  it('reads the plan built from the quote when the project has one, in the same shape, under the keys the app knows', () => {
    const row = withStages([
      { kind: 'DESIGN', name: 'Design', plannedEnd: D('2026-09-20T00:00:00Z'), actualEnd: D('2026-09-18T00:00:00Z'), notes: SECRET.teamNotes },
      { kind: 'CIVIL', name: 'Civil and electrical', plannedEnd: D('2026-10-05T00:00:00Z'), actualEnd: null },
      { kind: 'CARPENTRY', name: 'Carpentry', plannedEnd: D('2026-11-15T00:00:00Z'), actualEnd: null },
      { kind: 'FINISH', name: 'Painting and finishing', plannedEnd: D('2026-11-25T00:00:00Z'), actualEnd: null },
      { kind: 'HANDOVER', name: 'Handover', plannedEnd: D('2026-11-30T00:00:00Z'), actualEnd: null },
    ]);
    const out = toCustomerProject(row, SECRET.customerId, now);
    expect(out.stages).toEqual([
      { key: 'DESIGN', label: 'Design', targetOn: D('2026-09-20T00:00:00Z'), state: 'done', late: false },
      { key: 'SITE', label: 'Civil and electrical', targetOn: D('2026-10-05T00:00:00Z'), state: 'now', late: true },
      { key: 'INSTALL', label: 'Carpentry', targetOn: D('2026-11-15T00:00:00Z'), state: 'next', late: false },
      { key: 'FINISH', label: 'Painting and finishing', targetOn: D('2026-11-25T00:00:00Z'), state: 'later', late: false },
      { key: 'HANDOVER', label: 'Handover', targetOn: D('2026-11-30T00:00:00Z'), state: 'later', late: false },
    ]);
    expect(JSON.stringify(out)).not.toContain(SECRET.teamNotes);
  });

  it('falls back to the fixed stages and doneStages for a project with no plan yet', () => {
    for (const stages of [undefined, []]) {
      const out = toCustomerProject(withStages(stages), SECRET.customerId, now);
      expect(out.stages.map((s) => s.key)).toEqual(['DESIGN', 'PRODUCTION', 'SITE', 'INSTALL', 'FINISH', 'HANDOVER']);
    }
  });

  it('selects only what the tracker needs from the plan', () => {
    // Phase 3 adds the id, the start and each item's room, label and done (never who ticked it).
    expect(CUSTOMER_PROJECT_SELECT.stages.select).toEqual({
      kind: true,
      name: true,
      plannedEnd: true,
      actualEnd: true,
      id: true,
      plannedStart: true,
      // Studio OS Phase 2: a design step's id (to place a moved day; never sent), whose step it is and its payment gate.
      items: {
        orderBy: { sortOrder: 'asc' },
        // Customer milestones: the studio's star, read to keep every other step back.
        select: { room: true, label: true, doneAt: true, weightBp: true, inScope: true, plannedOn: true, id: true, responsible: true, gatePayment: true, customerMilestone: true, effortMin: true },
      },
    });
  });
});

describe('the step tracker: percentages and steps (docs/studio-workspace/STEP-TRACKER.md)', () => {
  const now = D('2026-10-11T00:00:00Z');
  const step = (label: string, weightBp: number, doneAt: Date | null, more: Record<string, unknown> = {}) => ({
    id: `step-${label}`,
    room: 'Execution stage 1',
    label,
    weightBp,
    inScope: true,
    plannedOn: D('2026-10-01T00:00:00Z'),
    doneAt,
    doneById: SECRET.staffId,
    doneSource: doneAt ? 'TICK' : null,
    donePhotoId: doneAt ? 'photo-SECRET' : null,
    doneSiteLogId: doneAt ? 'log-SECRET' : null,
    ...more,
  });
  const row = () =>
    ({
      ...(leakyRow() as unknown as Record<string, unknown>),
      stages: [
        {
          id: 'st1',
          kind: 'DESIGN',
          name: 'Design',
          plannedStart: D('2026-09-01T00:00:00Z'),
          plannedEnd: D('2026-09-15T00:00:00Z'),
          actualEnd: D('2026-09-14T00:00:00Z'),
          items: [step('Design signed off', 2000, D('2026-09-14T00:00:00Z'), { room: 'Design', customerMilestone: true })],
        },
        {
          id: 'st2',
          kind: 'CIVIL',
          name: 'POP, civil and electricals',
          plannedStart: D('2026-09-15T00:00:00Z'),
          plannedEnd: D('2026-10-20T00:00:00Z'),
          actualEnd: null,
          items: [
            step('POP framing', 2000, D('2026-10-02T06:00:00Z'), { customerMilestone: true }),
            // Customer milestones: a step the studio did not star counts in the % but never crosses by name, day or count.
            step('POP wiring', 2000, D('2026-10-03T06:00:00Z'), { label: 'POP wiring SECRET-UNSTARRED', plannedOn: D('2026-10-09T00:00:00Z') }),
            step('POP sheets', 2000, null, { customerMilestone: true }),
            step('PVC POP work', 2000, null, { inScope: false, label: 'PVC POP work SECRET-OUT-OF-SCOPE', customerMilestone: true }),
          ],
        },
        { id: 'st3', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: D('2026-10-20T00:00:00Z'), plannedEnd: D('2026-11-15T00:00:00Z'), actualEnd: null, items: [step('Carcass complete', 2000, null, { room: 'Execution stage 2A' })] },
        { id: 'st4', kind: 'FINISH', name: 'Finishing', plannedStart: D('2026-11-15T00:00:00Z'), plannedEnd: D('2026-11-25T00:00:00Z'), actualEnd: null, items: [] },
        { id: 'st5', kind: 'HANDOVER', name: 'Handover', plannedStart: D('2026-11-25T00:00:00Z'), plannedEnd: D('2026-11-30T00:00:00Z'), actualEnd: null, items: [] },
      ],
      dateChanges: [],
    }) as unknown as CustomerProjectRow;
  const out = toCustomerProject(row(), SECRET.customerId, now);
  const t = out.tracker!;

  it('sends the project’s percentage and each stage’s from EVERY in-scope step, starred or not, sharing a not-in-scope step’s weight', () => {
    // In scope: 2000 + (2000 + 2000 + 2000) + 2000 = 10 000; done 2000 + 2000 + 2000 (the unstarred one too) → 60%.
    expect(out.progressPct).toBe(60);
    expect(t.progressPct).toBe(60);
    expect(t.stages.map((s) => s.progressPct)).toEqual([100, 66, 0, 0, 0]);
  });

  it('sends only the starred in-scope steps (the milestones), with their group, share, done and days — never an unstarred or not-in-scope one', () => {
    expect(t.stages[1]!.steps).toEqual([
      { label: 'POP framing', group: 'Execution stage 1', pct: 20, done: true, doneOn: '2026-10-02', plannedOn: '2026-10-01' },
      { label: 'POP sheets', group: 'Execution stage 1', pct: 20, done: false, doneOn: null, plannedOn: '2026-10-01' },
    ]);
    expect(t.stages[1]!.checklist).toEqual({ done: 1, total: 2 });
    expect(t.current!.rooms).toEqual([{ room: 'Execution stage 1', items: [{ label: 'POP framing', done: true }, { label: 'POP sheets', done: false }] }]);
    // A stage with no star shows its % and no step.
    expect(t.stages[2]!.steps).toEqual([]);
    expect(t.stages[2]!.checklist).toEqual({ done: 0, total: 0 });
    const json = JSON.stringify(out);
    expect(json).not.toContain('SECRET-OUT-OF-SCOPE');
    expect(json).not.toContain('SECRET-UNSTARRED');
    // Nor the unstarred steps' days, nor an unstarred stage's step.
    const tj = JSON.stringify(t);
    expect(tj).not.toContain('2026-10-09');
    expect(tj).not.toContain('2026-10-03');
    expect(tj).not.toContain('Carcass complete');
  });

  it('carries no stored weight, scope, photo link, post link or who ticked', () => {
    const keys = keysOf(out);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k), k).toBe(false);
    const json = JSON.stringify(out);
    for (const v of [SECRET.staffId, 'photo-SECRET', 'log-SECRET', 'step-SECRET']) expect(json).not.toContain(v);
  });

  it('is null with no plan', () => {
    const legacy = toCustomerProject({ ...(row() as unknown as Record<string, unknown>), stages: [] } as unknown as CustomerProjectRow, SECRET.customerId, now);
    expect(legacy.progressPct).toBeNull();
  });
});

describe('Phase 4: a snag’s progress, from its events (portal/snag-view.ts)', () => {
  const fixed = D('2026-10-04T00:00:00Z');
  const row = (events: unknown[], userId = SECRET.customerId, now = D('2026-10-06T00:00:00Z')) => {
    const r = leakyRow() as unknown as { snags: { events: unknown[] }[] };
    r.snags[0]!.events = events;
    return toCustomerProject(r as unknown as CustomerProjectRow, userId, now, NO_LINKS_FOR_TEST);
  };
  const RAISED = { id: 'e0', kind: 'RAISED', at: D('2026-10-02T00:00:00Z'), photoPaths: [SECRET.photoPath], byId: SECRET.customerId };
  const ACCEPTED = { id: 'e1', kind: 'ACCEPTED', at: D('2026-10-02T06:00:00Z'), fixBy: D('2026-10-05T12:00:00Z'), internalNote: SECRET.internalNote, assigneeId: SECRET.assignee };
  const FIXED = { id: 'e2', kind: 'FIXED', at: fixed, photoPaths: [SECRET.photoPath], voicePath: SECRET.voicePath, transcript: SECRET.transcript, customerText: 'Filler strip fitted.' };

  it('a fix waits for the owner, with the sentence, the fix-by date and when it closes by itself', () => {
    const out = row([RAISED, ACCEPTED, FIXED]);
    expect(out.snags[0]!.progress).toEqual({
      state: 'fixed',
      fixBy: '2026-10-05T12:00:00.000Z',
      fixedAt: fixed.toISOString(),
      fixSentence: 'Filler strip fitted.',
      studioReason: null,
      notFixedReason: null,
      closedAt: null,
      closedBy: null,
      autoClosesOn: '2026-10-11T00:00:00.000Z',
      daysToFix: null,
      canAnswer: true,
    });
    const json = JSON.stringify(out);
    for (const v of [SECRET.internalNote, SECRET.assignee, SECRET.transcript, SECRET.voicePath]) expect(json).not.toContain(v);
  });

  it('family see it but cannot answer', () => {
    expect(row([RAISED, FIXED], SECRET.familyUserId).snags[0]!.progress.canAnswer).toBe(false);
  });

  it('closes by itself seven days after the fix, before any cron', () => {
    const p = row([RAISED, FIXED], SECRET.customerId, D('2026-10-11T00:00:00Z')).snags[0]!.progress;
    expect(p).toMatchObject({ state: 'closed', closedBy: 'auto', canAnswer: false, daysToFix: 2 });
  });

  it('shows the studio’s dispute reason, and the customer may agree', () => {
    const p = row([RAISED, { id: 'e3', kind: 'DISPUTED', at: D('2026-10-03T00:00:00Z'), note: 'Hairline in the natural stone' }]).snags[0]!.progress;
    expect(p).toMatchObject({ state: 'disputed', studioReason: 'Hairline in the natural stone', canAnswer: true });
  });

  it('a confirmed fix says the customer closed it', () => {
    const p = row([RAISED, FIXED, { id: 'e4', kind: 'CONFIRMED', at: D('2026-10-05T00:00:00Z') }]).snags[0]!.progress;
    expect(p).toMatchObject({ state: 'closed', closedBy: 'you', daysToFix: 2 });
  });

  it('selects only the event columns the customer may see', () => {
    const snags = CUSTOMER_PROJECT_SELECT.snags.select as unknown as { events: { select: Record<string, boolean> } };
    expect(Object.keys(snags.events.select).sort()).toEqual(['at', 'customerText', 'fixBy', 'id', 'kind', 'note']);
  });
});

const NO_LINKS_FOR_TEST = { updatePhotos: [], snagPhotos: [], fixedPhotos: [], docUrls: [] };

describe('Phase 2: the site feed from the daily site log (portal/site-feed-view.ts)', () => {
  const now = D('2026-10-11T06:00:00Z');
  const out = toCustomerProject(leakyRow(), SECRET.customerId, now, {
    updatePhotos: [['https://signed/1']],
    snagPhotos: [],
    fixedPhotos: [],
    docUrls: [],
    siteLogPhotos: [['https://signed/site-1'], [], []],
  });

  it('shows each day once, newest first, with the correction beside the original, never instead of it', () => {
    expect(out.siteLogs.map((d) => [d.day, d.kind])).toEqual([
      ['2026-10-10', 'update'],
      ['2026-10-09', 'nobody'],
    ]);
    expect(out.siteLogs[0]!.corrections).toHaveLength(1);
    expect(out.siteLogs[0]!.corrections[0]).toMatchObject({ kind: 'correction', text: 'The loft shutters went up after lunch.' });
  });

  it('puts each photo with its own sentence, its time and the gallery label', () => {
    expect(out.siteLogs[0]!.photos).toEqual([
      {
        url: 'https://signed/site-1',
        text: 'Kitchen carcass levelled and fixed to the wall.',
        takenAt: '2026-10-10T11:20:00.000Z',
        fromGallery: true,
        doneStep: 'Carcass complete with hardware',
      },
    ]);
    const json = JSON.stringify(out.siteLogs);
    for (const v of ['step-SECRET', 'photo-SECRET', SECRET.staffId]) expect(json).not.toContain(v);
    expect(out.siteLogs[0]!.text).toBe('Kitchen carcasses are up.');
    expect(out.siteLogs[0]!.done).toEqual([{ room: 'Kitchen', label: 'Carcass levelled' }]);
    expect(json).not.toContain('SECRET-UNSTARRED');
  });

  it('names the step a photo ticked only when the studio starred it (customer milestones)', () => {
    const row = leakyRow() as unknown as { siteLogs: { photos: { doneStep: Record<string, unknown> | null }[] }[] };
    row.siteLogs[0]!.photos[0]!.doneStep = { ...row.siteLogs[0]!.photos[0]!.doneStep, label: 'POP wiring SECRET-UNSTARRED', customerMilestone: false };
    const feed = toCustomerProject(row as unknown as CustomerProjectRow, SECRET.customerId, now).siteLogs;
    expect(feed[0]!.photos[0]).toMatchObject({ text: 'Kitchen carcass levelled and fixed to the wall.', doneStep: null });
    expect(JSON.stringify(feed)).not.toContain('SECRET-UNSTARRED');
  });

  it('gives the crew as first name, role and arrival time only', () => {
    expect(out.siteLogs[0]!.crew).toEqual([{ name: 'Ramesh', role: 'Carpenter', arrivedAt: '2026-10-10T04:10:00.000Z' }]);
    expect(JSON.stringify(out.siteLogs)).not.toContain('Pawar');
  });

  it('says why nobody was on site, and that waiting on the customer is not the studio’s delay', () => {
    expect(out.siteLogs[1]).toMatchObject({
      reason: 'waiting-customer-decision',
      reasonText: 'Waiting for your decision',
      countsAgainstStudio: false,
      photos: [],
    });
  });

  it('carries no recording, transcript, place, note, poster or crew phone from the site log', () => {
    const json = JSON.stringify(out.siteLogs);
    for (const v of [SECRET.voicePath, SECRET.transcript, SECRET.siteNote, SECRET.lat, SECRET.staffId, SECRET.clientRef, SECRET.crewPhone, SECRET.wages, SECRET.photoPath, 'stage-SECRET']) {
      expect(json).not.toContain(v);
    }
    const keys = keysOf(out.siteLogs);
    for (const k of ['voicePath', 'transcript', 'transcriptLang', 'note', 'lat', 'lng', 'postedById', 'clientRef', 'crewMemberId', 'crewMember', 'phone', 'storagePath', 'doneById', 'stageId']) {
      expect(keys.has(k), k).toBe(false);
    }
  });

  it('selects only the customer’s columns from the site log', () => {
    const sel = keysOf(CUSTOMER_PROJECT_SELECT.siteLogs);
    for (const k of ['note', 'voicePath', 'transcript', 'transcriptLang', 'lat', 'lng', 'postedById', 'clientRef', 'crewMember', 'crewMemberId', 'doneById', 'phone', 'donePhotoId', 'weightBp']) {
      expect(sel.has(k), k).toBe(false);
    }

  });

  it('lists working days with nothing posted by 21:00 IST, from the day site work started', () => {
    const row = leakyRow() as unknown as Record<string, unknown>;
    // Posts on Fri 9 and Sat 10 Oct; Mon 12 and Tue 13 are working days with nothing.
    const at = (iso: string) => toCustomerProject({ ...row, updates: [] } as unknown as CustomerProjectRow, SECRET.customerId, D(iso)).siteMissedDays;
    expect(at('2026-10-13T10:00:00Z')).toEqual(['2026-10-12']); // 15:30 IST: today not missed yet
    expect(at('2026-10-13T16:00:00Z')).toEqual(['2026-10-13', '2026-10-12']); // 21:30 IST
    expect(at('2026-10-11T16:00:00Z')).toEqual([]); // Sunday: not a working day
  });
});

describe('Phase 3: the tracker, moved dates and computed statuses (portal/tracker-view.ts)', () => {
  const now = D('2026-10-11T00:00:00Z'); // a Sunday in India
  const row = () =>
    ({
      ...(leakyRow() as unknown as Record<string, unknown>),
      stages: [
        { id: 'st1', kind: 'DESIGN', name: 'Design', plannedStart: D('2026-09-01T00:00:00Z'), plannedEnd: D('2026-09-15T00:00:00Z'), actualEnd: D('2026-09-14T00:00:00Z'), items: [] },
        {
          id: 'st2',
          kind: 'CIVIL',
          name: 'Civil and electrical',
          plannedStart: D('2026-09-15T00:00:00Z'),
          plannedEnd: D('2026-10-05T00:00:00Z'),
          actualEnd: null,
          items: [
            { room: 'Kitchen', label: 'Plumbing points', doneAt: D('2026-10-01T00:00:00Z'), doneById: SECRET.staffId, doneSource: 'VOICE', customerMilestone: true },
            { room: 'Kitchen', label: 'Dado tiles', doneAt: null, customerMilestone: true },
            { room: 'Bedroom 1', label: 'Wiring', doneAt: null, customerMilestone: true },
            { room: 'Bedroom 1', label: 'Conduit SECRET-UNSTARRED', doneAt: null },
          ],
        },
        { id: 'st3', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: D('2026-10-05T00:00:00Z'), plannedEnd: D('2026-11-15T00:00:00Z'), actualEnd: null, items: [] },
        { id: 'st4', kind: 'FINISH', name: 'Painting', plannedStart: D('2026-11-15T00:00:00Z'), plannedEnd: D('2026-11-25T00:00:00Z'), actualEnd: null, items: [] },
        { id: 'st5', kind: 'HANDOVER', name: 'Handover', plannedStart: D('2026-11-25T00:00:00Z'), plannedEnd: D('2026-11-30T00:00:00Z'), actualEnd: null, items: [] },
      ],
      dateChanges: [
        {
          id: 'dc9',
          stageId: 'st5',
          field: 'HANDOVER',
          fromDate: D('2026-11-25T00:00:00Z'),
          toDate: D('2026-11-30T00:00:00Z'),
          reason: 'CUSTOMER_CHANGE',
          decisionId: null,
          note: SECRET.delayNote,
          byId: SECRET.staffId,
          at: D('2026-10-02T06:00:00Z'),
        },
      ],
    }) as unknown as CustomerProjectRow;
  const out = toCustomerProject(row(), SECRET.customerId, now);
  const t = out.tracker!;

  it('shows a moved date as old date, new date and the reason in plain words, never the PM note', () => {
    expect(t.moves).toHaveLength(1);
    expect(t.moves[0]).toMatchObject({ field: 'handover', from: '2026-11-25', to: '2026-11-30', reason: 'CUSTOMER_CHANGE', customer: true });
    expect(t.moves[0]!.words).toBe('Handover is now 30 Nov (was 25 Nov): a change you asked for.');
    const json = JSON.stringify(t);
    expect(json).not.toContain(SECRET.delayNote);
    expect(json).not.toContain(SECRET.staffId);
    expect(keysOf(t).has('note')).toBe(false);
    expect(keysOf(t).has('byId')).toBe(false);
  });

  it('computes stage and overall status, never typed, with the customer days labelled as theirs', () => {
    expect(out.stageStatus).toEqual({ key: 'SITE', label: 'Civil and electrical', status: 'late', lateDays: 5 });
    // Planned 25 Nov; now 30 Nov + 5 working days of overrun = 5 Dec: 9 working days late, 4 of them the customer's.
    // The client never reads "overall · N days late" (owner, 27 Oct 2026): only the days their own delays cost.
    expect(t.overall).toMatchObject({ plannedHandover: '2026-11-25', forecastHandover: '2026-12-05', lateDays: 0, customerDays: 4, studioDays: 0 });
    expect(out.overallLateDays).toBe(0);
  });

  it('sends planned vs actual per stage and the current room checklist, without who ticked', () => {
    expect(t.stages.map((s) => [s.key, s.status])).toEqual([
      ['DESIGN', 'done'],
      ['SITE', 'late'],
      ['INSTALL', 'upcoming'],
      ['FINISH', 'upcoming'],
      ['HANDOVER', 'upcoming'],
    ]);
    expect(t.stages[0]).toMatchObject({ plannedEnd: '2026-09-15', actualEnd: '2026-09-14', earlyDays: 1 });
    expect(t.stages[4]).toMatchObject({ originalEnd: '2026-11-25', plannedEnd: '2026-11-30', moved: { customer: true } });
    expect(t.current).toEqual({
      key: 'SITE',
      label: 'Civil and electrical',
      rooms: [
        { room: 'Kitchen', items: [{ label: 'Plumbing points', done: true }, { label: 'Dado tiles', done: false }] },
        { room: 'Bedroom 1', items: [{ label: 'Wiring', done: false }] },
      ],
    });
    // Customer milestones: an unstarred step of the current stage is not in its checklist either.
    expect(JSON.stringify(t)).not.toContain('SECRET-UNSTARRED');
    expect(keysOf(out).has('doneById')).toBe(false);
    expect(keysOf(out).has('doneSource')).toBe(false);
  });

  it('selects the date changes without the note or who moved them', () => {
    expect(CUSTOMER_PROJECT_SELECT.dateChanges.select).toEqual({ stageId: true, field: true, fromDate: true, toDate: true, reason: true, decisionId: true, at: true });
  });

  it('still sends overallLateDays and stageStatus for a project with no plan (no tracker)', () => {
    const legacy = toCustomerProject({ ...(row() as unknown as Record<string, unknown>), stages: [] } as unknown as CustomerProjectRow, SECRET.customerId, now);
    expect(legacy.tracker).toBeNull();
    expect(typeof legacy.overallLateDays).toBe('number');
    expect(legacy.stageStatus).not.toBeUndefined();
  });
});

import { NO_LINKS as NO_LINKS_P5 } from '@/modules/portal/customer-project-view';

describe('Phase 5: decisions as rows, money from payment rows, the locker (portal/money-locker-view.ts)', () => {
  const now = D('2026-10-11T00:00:00Z');
  const out = toCustomerProject(leakyRow(), SECRET.customerId, now, { ...NO_LINKS_P5, choicePhotos: [['https://signed/o1', '']] });

  it('sends the options with their price change and photo link, never the studio cost or the storage path', () => {
    expect(out.decisions[0]!.choices).toEqual([
      { id: 'o1', label: 'Matte', detail: null, photo: 'https://signed/o1', swatch: null, deltaPaise: 0 },
      { id: 'o2', label: 'Gloss', detail: null, photo: null, swatch: null, deltaPaise: 12_000_00 },
    ]);
    const json = JSON.stringify(out.decisions);
    expect(json).not.toContain('4242');
    expect(json).not.toContain('studioCost');
  });

  it('counts paid from the payment rows, with each entry and nothing internal', () => {
    expect(out.payments).toMatchObject({ paidPaise: 1_00_000_00, waitingPaise: 0, changesPaise: 12_000_00, totalPaise: 10_12_000_00 });
    expect(out.payments!.entries).toEqual([
      { id: 'pay1', stageIndex: 0, stage: 'Booking', amountPaise: 1_00_000_00, receivedOn: '2026-09-02', mode: null, status: 'confirmed', receiptDocumentId: null, canAnswer: false },
    ]);
    expect(out.money?.contractPaise).toBe(10_12_000_00);
  });

  it('lets only the owner answer for a payment', () => {
    const asFamily = toCustomerProject(leakyRow(), SECRET.familyUserId, now);
    expect(asFamily.payments!.entries.every((e) => !e.canAnswer)).toBe(true);
  });

  it('reads the changes so far from the recorded quote changes', () => {
    expect(out.changes.totalPaise).toBe(12_000_00);
  });

  it('selects no internal payment, quote-change or option column', () => {
    const sel = CUSTOMER_PROJECT_SELECT as unknown as Record<string, { select: Record<string, unknown> }>;
    for (const k of ['note', 'disputeNote', 'recordedById', 'customerConfirmedById', 'disputedById']) expect(sel.payments!.select[k], k).toBeUndefined();
    expect(sel.quoteChanges!.select.byId).toBeUndefined();
    expect((CUSTOMER_PROJECT_SELECT.decisions.select.choices.select as Record<string, unknown>).studioCostDeltaPaise).toBeUndefined();
  });
});


describe('Studio OS Phase 2: the design card (studio-design/customer-view.ts) never leaks the team’s side', () => {
  const now = D('2026-10-11T00:00:00Z');
  const DESIGN_SECRET = {
    doneNote: 'DONE-NOTE-client was rude on call',
    visitNote: 'VISIT-NOTE-gate code 4455',
    delayNote: 'DELAY-NOTE-Meera forgot',
    measureNote: 'MEASURE-NOTE-wall is crooked',
    designerId: 'm-designer-SECRET',
    stepId: 'step-SECRET-1',
    fileId: 'doc-step-SECRET',
  };
  const row = {
    ...(leakyRow() as unknown as Record<string, unknown>),
    paymentPhases: [
      { label: 'Booking advance', pct: null, amountPaise: 25_000_00 },
      { label: 'Design advance', pct: 5, amountPaise: 50_000_00 },
      { label: 'Design closure', pct: 10, amountPaise: 1_00_000_00 },
    ],
    payments: [],
    quoteChanges: [],
    stages: [
      {
        id: 'st-d',
        kind: 'DESIGN',
        name: 'Design',
        plannedStart: D('2026-10-01T00:00:00Z'),
        plannedEnd: D('2026-10-25T00:00:00Z'),
        actualEnd: null,
        items: [
          {
            id: DESIGN_SECRET.stepId,
            room: 'Design',
            label: 'Site visit and measurement',
            doneAt: D('2026-10-02T06:00:00Z'),
            weightBp: 20,
            inScope: true,
            plannedOn: D('2026-10-02T00:00:00Z'),
            responsible: 'DESIGNER',
            gatePayment: null,
            doneNote: DESIGN_SECRET.doneNote,
            doneById: SECRET.staffId,
            doneDocumentId: DESIGN_SECRET.fileId,
            customerMilestone: true,
          },
          // Not starred (customer milestones): the studio's own step. Its payment gate still says what the design waits on.
          { id: 'step-2', room: 'Design', label: 'First draft SECRET-UNSTARRED', doneAt: null, weightBp: 20, inScope: true, plannedOn: D('2026-10-09T00:00:00Z'), responsible: 'DESIGNER', gatePayment: 1 },
          { id: 'step-3', room: 'Design', label: 'Approve the layout', doneAt: null, weightBp: 10, inScope: true, plannedOn: D('2026-10-10T00:00:00Z'), responsible: 'CLIENT', gatePayment: null, customerMilestone: true },
          { id: 'step-4', room: 'Design', label: 'SECRET-OUT-OF-SCOPE-DESIGN', doneAt: null, weightBp: 10, inScope: false, plannedOn: null, responsible: 'DESIGNER', gatePayment: null, customerMilestone: true },
          { id: 'step-5', room: 'Design', label: 'First 3D and renders', doneAt: null, weightBp: 10, inScope: true, plannedOn: D('2026-10-15T00:00:00Z'), responsible: 'DESIGNER', gatePayment: null, customerMilestone: true },
        ],
      },
    ],
    designerId: DESIGN_SECRET.designerId,
    designer: { id: DESIGN_SECRET.designerId, user: { name: 'Meera Joshi', phone: SECRET.crewPhone } },
    moodBoardSharedAt: D('2026-10-03T06:00:00Z'),
    moodBoardNote: 'Pick two looks for the living room.',
    siteVisits: [
      { id: 'v1', at: D('2026-10-14T05:30:00Z'), purpose: 'Measurement', status: 'BOOKED', note: DESIGN_SECRET.visitNote, byId: SECRET.staffId },
      { id: 'v2', at: D('2026-10-12T05:30:00Z'), purpose: 'Called off', status: 'CANCELLED', note: DESIGN_SECRET.visitNote, byId: SECRET.staffId },
    ],
    measurements: [{ room: 'Living', lengthMm: 4572, widthMm: 3658, heightMm: 2896, note: DESIGN_SECRET.measureNote, updatedById: SECRET.staffId }],
    documents: [
      { id: 'dr1', kind: 'DRAWINGS', title: '2D layout, Living', storageKey: SECRET.storageKey, contentType: 'application/pdf', bytes: 1000, createdAt: D('2026-10-04T00:00:00Z'), sharedAt: D('2026-10-04T00:00:00Z'), version: 1, supersedesId: null, designKind: 'LAYOUT_2D', room: 'Living', uploadedById: SECRET.staffId },
      { id: 'dr2', kind: 'DRAWINGS', title: '2D layout, Living', storageKey: SECRET.storageKey, contentType: 'application/pdf', bytes: 1000, createdAt: D('2026-10-06T00:00:00Z'), sharedAt: D('2026-10-06T00:00:00Z'), version: 2, supersedesId: 'dr1', designKind: 'LAYOUT_2D', room: 'Living', uploadedById: SECRET.staffId },
    ],
    designReviews: [
      { documentId: 'dr1', verdict: 'CHANGES', comment: 'Move the TV wall', at: D('2026-10-05T00:00:00Z'), byUserId: SECRET.customerId },
      { documentId: 'dr2', verdict: 'APPROVED', comment: null, at: D('2026-10-07T00:00:00Z'), byUserId: SECRET.customerId },
    ],
    stepDelays: [{ stepId: 'step-2', toDate: D('2026-10-09T00:00:00Z'), reason: 'CLIENT_UNAVAILABLE', side: 'CLIENT', note: DESIGN_SECRET.delayNote, byId: SECRET.staffId }],
    designClosedAt: null,
    designChanges: null,
  } as unknown as CustomerProjectRow;
  const out = toCustomerProject(row, SECRET.customerId, now);
  const design = out.design!;
  const json = JSON.stringify(out);

  /* Owner, 27 Oct 2026 (DESIGN-PROCESS-PLAN.md Decision 11, now on every plan): every design step by name, never a date. */
  it('shows every design step, starred or not, with no dates, the next one, the payment it waits on and whose step it is', () => {
    expect(design.designer).toBe('Meera');
    expect(design.steps.map((s) => s.label)).toEqual(['Site visit and measurement', 'First draft SECRET-UNSTARRED', 'Approve the layout', 'First 3D and renders']);
    expect(design.next).toMatchObject({ label: 'First draft SECRET-UNSTARRED', yours: false, waitingFor: 'Design advance', moved: null });
    expect(design.waitingFor).toBe('Design advance');
    expect(design.yourStep).toBeNull();
    expect(design.steps.every((s) => s.plannedOn === null && s.doneOn === null && s.moved === null)).toBe(true);
    // % from every in-scope step: 20 done of 20 + 20 + 10 + 10.
    expect(design.pct).toBe(33);
  });

  it('never carries a design step’s day or why it moved', () => {
    const dj = JSON.stringify({ design: out.design, tracker: out.tracker });
    expect(dj).not.toContain('2026-10-09');
    expect(dj).not.toContain('Moved to a day that suits you.');
  });

  it('names the client’s own next step even when it is not starred, so they know it waits on them', () => {
    const own = toCustomerDesign(
      {
        actualEnd: null,
        items: [
          { label: 'Brief', doneAt: D('2026-10-02T06:00:00Z'), plannedOn: null, weightBp: 10, inScope: true, responsible: 'DESIGNER', customerMilestone: true },
          { label: 'Send your floor plan', doneAt: null, plannedOn: D('2026-10-05T00:00:00Z'), weightBp: 10, inScope: true, responsible: 'CLIENT' },
          { label: 'Internal review SECRET-UNSTARRED', doneAt: null, plannedOn: null, weightBp: 10, inScope: true, responsible: 'DESIGNER' },
        ],
      },
      {},
      [],
      null,
    )!;
    expect(own.yourStep).toBe('Send your floor plan');
    expect(own.steps.map((s) => s.label)).toEqual(['Brief', 'Send your floor plan', 'Internal review SECRET-UNSTARRED']);
    expect(own.next).toMatchObject({ label: 'Send your floor plan', yours: true, plannedOn: null });
  });

  it('shows the mood board message, the booked visit (not the cancelled one), the sizes and the drawing’s answer', () => {
    expect(design.moodBoard).toEqual({ shared: true, sharedOn: '2026-10-03', note: 'Pick two looks for the living room.' });
    expect(design.visits).toEqual([{ id: 'v1', at: '2026-10-14T05:30:00.000Z', purpose: 'Measurement', status: 'booked', answer: null, reason: null }]); // the visit's id and the client's answer (1 Nov 2026); never the team's note
    expect(design.measurements).toEqual([{ room: 'Living', size: "15' × 12'", height: "9' 6\"" }]);
    expect(design.drawings).toEqual([
      { id: 'dr2', kind: 'LAYOUT_2D', kindLabel: '2D layout', room: 'Living', title: '2D layout, Living', version: 2, versionLabel: '2.0', state: 'approved', answeredOn: '2026-10-07', comment: null },
    ]);
  });

  it('carries no step note, file, visit note, delay note, measurement note, designer id or phone', () => {
    for (const [name, value] of Object.entries({ ...DESIGN_SECRET, crewPhone: SECRET.crewPhone, staffId: SECRET.staffId, storageKey: SECRET.storageKey })) {
      expect(json, name).not.toContain(value);
    }
    expect(json).not.toContain('SECRET-OUT-OF-SCOPE-DESIGN');
    const keys = keysOf(out.design);
    for (const k of ['doneNote', 'doneDocumentId', 'byUserId', 'designerId', 'byId', 'updatedById', 'phone', 'gatePayment', 'responsible', 'weightBp']) expect(keys.has(k), k).toBe(false);
  });

  it('selects none of the team’s design columns', () => {
    const selected = keysOf(CUSTOMER_PROJECT_SELECT);
    for (const k of ['doneNote', 'doneDocumentId', 'byUserId', 'designerId', 'updatedById']) expect(selected.has(k), k).toBe(false);
    const sel = CUSTOMER_PROJECT_SELECT as unknown as Record<string, { select: Record<string, unknown> }>;
    expect(sel.siteVisits!.select.note).toBeUndefined();
    expect(sel.stepDelays!.select.note).toBeUndefined();
    expect(sel.measurements!.select.note).toBeUndefined();
    expect((sel.designer!.select.user as { select: Record<string, unknown> }).select.phone).toBeUndefined();
  });

  it('shows what changed at closing, read defensively', () => {
    const closed = toCustomerProject(
      {
        ...(row as unknown as Record<string, unknown>),
        designClosedAt: D('2026-10-20T00:00:00Z'),
        designChanges: { salesTotalPaise: 100, designTotalPaise: 150, lines: [{ kind: 'ADDED', room: 'Living', product: 'TV unit', wasPaise: 0, nowPaise: 50 }, { kind: 'BOGUS' }] },
      } as unknown as CustomerProjectRow,
      SECRET.customerId,
      now,
    ).design!;
    expect(closed.closedOn).toBe('2026-10-20');
    expect(closed.changes).toEqual({ salesTotalPaise: 100, designTotalPaise: 150, lines: [{ kind: 'ADDED', room: 'Living', product: 'TV unit', wasPaise: 0, nowPaise: 50 }] });
  });
});

describe('the project lifecycle (portal/lifecycle-view.ts) never leaks the team’s side', () => {
  const now = D('2026-10-11T00:00:00Z');
  const LIFE_SECRET = {
    closureNote: 'CLOSURE-NOTE-we undercharged',
    closureLine: 'CLOSURE-LINE-SECRET',
    signedBy: 'u-signed-by-SECRET',
    crewMoney: 'CREW-MONEY-777',
  };
  const base = leakyRow() as unknown as Record<string, unknown>;
  const row = {
    ...base,
    phase: 'SNAGS',
    warrantyEndsOn: null,
    provisionalHandoverAt: D('2026-10-01T00:00:00Z'),
    closedOutAt: D('2026-10-05T00:00:00Z'),
    handoverSignedById: LIFE_SECRET.signedBy,
    closures: [{ id: 'c1', version: 1, final: true, note: LIFE_SECRET.closureNote, totalPaise: BigInt(777), lines: [{ description: LIFE_SECRET.closureLine, note: LIFE_SECRET.closureNote }] }],
    workOrders: [{ id: 'wo1', lines: [{ item: 'Carcass', ratePaise: BigInt(77700), agreedPaise: LIFE_SECRET.crewMoney }] }],
    // Every snag closed: the client may sign off.
    snags: [],
    stages: [
      {
        id: 'st-d',
        kind: 'DESIGN',
        name: 'Design',
        plannedStart: D('2026-08-01T00:00:00Z'),
        plannedEnd: D('2026-08-20T00:00:00Z'),
        actualEnd: D('2026-08-20T00:00:00Z'),
        items: [{ id: 'd1', room: 'Design', label: 'Design closure SECRET-UNSTARRED', doneAt: null, weightBp: 200, inScope: true, plannedOn: null, responsible: 'DESIGNER', gatePayment: null, customerMilestone: false }],
      },
      {
        id: 'st-h',
        kind: 'HANDOVER',
        name: 'Handover',
        plannedStart: D('2026-09-20T00:00:00Z'),
        plannedEnd: D('2026-10-01T00:00:00Z'),
        actualEnd: D('2026-10-01T00:00:00Z'),
        items: [{ id: 'h1', room: 'Handover', label: 'Provisional handover', doneAt: D('2026-10-01T06:00:00Z'), weightBp: 9800, inScope: true, plannedOn: null, responsible: null, gatePayment: null, customerMilestone: true }],
      },
    ],
  } as unknown as CustomerProjectRow;
  const out = toCustomerProject(row, SECRET.customerId, now);
  const json = JSON.stringify(out);

  it('says where the project is and lets the owner sign off once every snag is closed', () => {
    expect(out.lifecycle).toMatchObject({ phase: 'snags', current: { kind: 'snags' }, next: { kind: 'sign_off' }, canSignOff: true, openSnags: 0 });
    expect(out.lifecycle.blocker?.kind).toBe('sign_off');
  });

  it('never carries the closure, who signed off or crew money', () => {
    for (const v of Object.values(LIFE_SECRET)) expect(json).not.toContain(v);
    const keys = keysOf(out);
    for (const k of ['closures', 'handoverSignedById', 'closedOutAt', 'provisionalHandoverAt', 'workOrders', 'finalDuePaise', 'extrasPaise']) expect(keys.has(k), k).toBe(false);
  });

  it('selects none of the lifecycle’s internal columns', () => {
    const selected = keysOf(CUSTOMER_PROJECT_SELECT);
    for (const k of ['closures', 'handoverSignedById', 'workOrders', 'teamNotes']) expect(selected.has(k), k).toBe(false);
    expect(selected.has('phase')).toBe(true);
    expect(selected.has('warrantyEndsOn')).toBe(true);
  });

  it('family see the phase but cannot sign off', () => {
    const fam = toCustomerProject(row, SECRET.familyUserId, now);
    expect(fam.lifecycle.canSignOff).toBe(false);
  });

  it('reads a warranty that has ended as closed, with its end day', () => {
    const w = toCustomerProject({ ...(row as unknown as Record<string, unknown>), phase: 'WARRANTY', warrantyEndsOn: D('2026-10-10T00:00:00Z') } as unknown as CustomerProjectRow, SECRET.customerId, now);
    expect(w.lifecycle).toMatchObject({ phase: 'closed', warrantyEndsOn: '2026-10-10', canSignOff: false, next: null });
  });
});

describe('change orders and sign-offs (15 Oct 2026): what crosses', () => {
  const now = D('2026-10-15T06:00:00Z');
  const INTERNAL = {
    creator: 'u-creator-SECRET-CO',
    decider: 'u-decider-SECRET-CO',
    releaser: 'u-releaser-SECRET-CO',
    quote: 'quote-SECRET-CO',
    product: 'product-SECRET-CO',
    rate: 'RATE-SECRET-CO',
    ip: '198.51.100.77',
    ua: 'UA-SECRET-Mozilla',
    hash: 'HASH-SECRET-0f0f',
    signer: 'u-signer-SECRET',
    requester: 'u-requester-SECRET',
  };
  const row = () => {
    const base = leakyRow() as unknown as Record<string, unknown> & { payments: Record<string, unknown>[] };
    return {
      ...base,
      payments: [
        ...base.payments,
        {
          id: 'pay-co',
          stageIndex: 2,
          amountPaise: BigInt(4_000_00),
          note: SECRET.paymentNote,
          recordedById: SECRET.staffId,
          receivedOn: D('2026-10-14T00:00:00Z'),
          recordedAt: D('2026-10-14T10:00:00Z'),
          customerConfirmedAt: null,
          disputedAt: null,
          correctsId: null,
          changeOrderId: 'co1',
        },
      ],
      changeOrders: [
        {
          id: 'co1',
          number: 1,
          title: 'Loft in bedroom 2',
          reason: 'Asked for on site',
          status: 'APPROVED',
          workPaise: BigInt(10_000_00),
          discountPaise: BigInt(0),
          gstBps: 1800,
          gstPaise: BigInt(1_800_00),
          totalPaise: BigInt(11_800_00),
          sentAt: D('2026-10-13T06:00:00Z'),
          decidedAt: D('2026-10-14T06:00:00Z'),
          declineReason: null,
          photoDocumentId: 'doc1',
          createdById: INTERNAL.creator,
          decidedById: INTERNAL.decider,
          releasedById: INTERNAL.releaser,
          quoteId: INTERNAL.quote,
          lines: [{ product: 'Loft', room: 'Bedroom 2', details: null, unit: 'AREA', widthMm: 1200, heightMm: 600, qtyMilli: null, productId: INTERNAL.product, amountPaise: BigInt(10_000_00), ratePaise: INTERNAL.rate }],
        },
      ],
      signoffs: [
        {
          id: 's1',
          kind: 'DESIGN_FINAL',
          quoteNumber: 'Q-1-D',
          revisionN: 2,
          totalPaise: BigInt(10_00_000_00),
          requestedAt: D('2026-10-14T06:00:00Z'),
          signedAt: null,
          withdrawnAt: null,
          signerName: null,
          ip: INTERNAL.ip,
          userAgent: INTERNAL.ua,
          contentHash: INTERNAL.hash,
          signedById: INTERNAL.signer,
          requestedById: INTERNAL.requester,
          revision: { quote: { revisions: [{ n: 2 }] } },
        },
      ],
    } as unknown as CustomerProjectRow;
  };
  const out = toCustomerProject(row(), SECRET.customerId, now, { updatePhotos: [], snagPhotos: [], fixedPhotos: [], docUrls: ['https://signed/doc'] });
  const json = JSON.stringify(out);

  it('carries the extra work and the request to sign, with what is due', () => {
    expect(out.extras).toHaveLength(1);
    expect(out.extras[0]).toMatchObject({ number: 1, title: 'Loft in bedroom 2', state: 'approved', totalPaise: 11_800_00, paidPaise: 4_000_00, duePaise: 7_800_00, photoUrl: 'https://signed/doc' });
    expect(out.signoffs[0]).toMatchObject({ kind: 'DESIGN_FINAL', state: 'waiting', canSign: true });
    expect(out.lifecycle.blocker).toMatchObject({ kind: 'pay_extra', amountPaise: 7_800_00 });
  });

  it('carries no internal id, rate, IP, user agent or hash', () => {
    for (const [name, value] of Object.entries(INTERNAL)) expect(json, name).not.toContain(value);
    const keys = keysOf(out);
    for (const k of ['createdById', 'decidedById', 'releasedById', 'quoteId', 'productId', 'ratePaise', 'ip', 'userAgent', 'contentHash', 'signedById', 'requestedById', 'changeOrderId']) {
      expect(keys.has(k), k).toBe(false);
    }
  });

  it('selects no internal column of a change order or a sign-off', () => {
    const co = keysOf(CUSTOMER_PROJECT_SELECT.changeOrders.select);
    for (const k of ['createdById', 'decidedById', 'releasedById', 'quoteId', 'ratePaise', 'events', 'cancelledAt']) expect(co.has(k), k).toBe(false);
    const so = keysOf(CUSTOMER_PROJECT_SELECT.signoffs.select);
    for (const k of ['ip', 'userAgent', 'contentHash', 'signedHash', 'signedById', 'requestedById', 'agreedText']) expect(so.has(k), k).toBe(false);
    expect(CUSTOMER_PROJECT_SELECT.changeOrders.where).toEqual({ status: { in: ['SENT_TO_CLIENT', 'APPROVED', 'DECLINED', 'PAID', 'RELEASED'] } });
  });
});
