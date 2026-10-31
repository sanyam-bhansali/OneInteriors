/**
 * A small in-memory stand-in for the Prisma calls the Phase 5 flows make
 * (project/decision-flow.ts, payments-flow.ts, locker.ts), so the tests can
 * run a pick or a payment end to end and then read the rows back. Not a
 * database: it answers the shapes those modules ask for and nothing else.
 *
 * One studio (s1) with an owner, a PM and a supervisor (both on p1) and an
 * accounts member; one project p1 signed at ₹10,00,000 in three stages
 * (40/40/20); its customer u-cust and a family member u-fam.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

export function makeDb() {
  const members: Record<string, Row> = {
    'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE' },
    'u-pm': { id: 'm-pm', studioId: 's1', userId: 'u-pm', role: 'PM', status: 'ACTIVE' },
    'u-sup': { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE' },
    'u-acc': { id: 'm-acc', studioId: 's1', userId: 'u-acc', role: 'ACCOUNTS', status: 'ACTIVE' },
  };
  const assigned = new Set(['p1:m-pm', 'p1:m-sup']);
  const s = {
    project: {
      id: 'p1',
      contractPaise: BigInt(10_00_000_00),
      paymentPhases: [
        { label: 'Booking', pct: 40, amountPaise: 4_00_000_00 },
        { label: 'Carpentry', pct: 40, amountPaise: 4_00_000_00 },
        { label: 'Handover', pct: 20, amountPaise: 2_00_000_00 },
      ] as Row[],
      paidPhases: [] as Row[],
    },
    payments: [] as Row[],
    quoteChanges: [] as Row[],
    decisions: [] as Row[],
    options: [] as Row[],
    votes: [] as Row[],
    materials: [
      { id: 'mat1', projectId: 'p1', room: 'Kitchen', item: 'Shutters', spec: 'Sage matte laminate', quoteLineId: 'ql-shutters', productCode: null, orderedAt: null, sortOrder: 0 },
      { id: 'mat2', projectId: 'p1', room: 'Kitchen', item: 'Hinges', spec: 'Soft-close', quoteLineId: 'ql-hinges', productCode: null, orderedAt: null, sortOrder: 1 },
    ] as Row[],
    documents: [] as Row[],
    events: [] as Row[],
    dateChanges: [] as Row[],
    stages: [
      { id: 'st-carp', projectId: 'p1', kind: 'CARPENTRY', name: 'Carpentry', sortOrder: 0, plannedStart: new Date('2026-10-01T00:00:00Z'), plannedEnd: new Date('2026-10-30T00:00:00Z'), actualEnd: null },
      { id: 'st-hand', projectId: 'p1', kind: 'HANDOVER', name: 'Handover', sortOrder: 1, plannedStart: new Date('2026-11-02T00:00:00Z'), plannedEnd: new Date('2026-11-05T00:00:00Z'), actualEnd: null },
    ] as Row[],
    checklist: [{ id: 'ci1', stageId: 'st-carp', quoteLineId: 'ql-shutters' }] as Row[],
    family: [{ projectId: 'p1', userId: 'u-fam', name: 'Rahul Shah', joinedAt: new Date('2026-09-01T00:00:00Z'), removedAt: null }] as Row[],
  };

  const projectView = (id: string): Row | null =>
    id !== 'p1'
      ? null
      : {
          ...s.project,
          introduction: {
            studioId: 's1',
            studio: { tradeName: 'Teakline Studio', workingDays: [1, 2, 3, 4, 5, 6], holidays: [] },
            brief: { userId: 'u-cust', contactName: 'Priya Shah', user: { name: 'Priya Shah' }, society: 'Ivy Towers', locality: 'Baner', propertyType: 'FLAT_2BHK' },
          },
          payments: s.payments.map((r) => ({ ...r, receiptDocument: s.documents.find((d) => d.id === r.receiptDocumentId) ?? null })),
          quoteChanges: s.quoteChanges,
          family: s.family.filter((f) => f.joinedAt && !f.removedAt),
          materials: s.materials,
        };

  const decisionView = (d: Row): Row => ({
    ...d,
    choices: s.options.filter((o) => o.decisionId === d.id).sort((a, b) => a.sortOrder - b.sortOrder),
    votes: s.votes.filter((v) => v.decisionId === d.id),
    project: projectView(d.projectId),
  });

  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date) && 'not' in v) return row[k] !== v.not;
      if (v && typeof v === 'object' && !(v instanceof Date)) return true; // relation filters: not modelled
      return row[k] === v;
    });

  const client: Row = {
    studioMember: { findUnique: async (a: Row) => members[a.where.userId] ?? null },
    studioProjectMember: {
      findUnique: async (a: Row) => {
        const k = a.where.homeProjectId_memberId;
        return assigned.has(`${k.homeProjectId}:${k.memberId}`) ? { id: 'spm' } : null;
      },
    },
    homeProject: {
      findUnique: async (a: Row) => projectView(a.where.id),
      // Honours the one filter that matters here: projectsVisibleTo's "none" (`id: { in: [] }`).
      findMany: async (a: Row) => (Array.isArray(a?.where?.id?.in) && a.where.id.in.length === 0 ? [] : [projectView('p1')]),
      update: async (a: Row) => {
        Object.assign(s.project, a.data);
        return projectView(a.where.id);
      },
    },
    $queryRaw: async () => [],
    $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(client),
    /* 1 Nov 2026: a payment recorded before the client joined counts as paid (payments-flow.ts). None here: the client is in the app. */
    homeProjectInvite: { findMany: async () => [] },
    homeProjectPayment: {
      create: async (a: Row) => {
        const row = {
          id: nextId('pay'),
          mode: null,
          receiptDocumentId: null,
          note: null,
          correctsId: null,
          customerConfirmedAt: null,
          customerConfirmedById: null,
          disputedAt: null,
          disputedById: null,
          disputeNote: null,
          recordedAt: new Date(Date.now() + seq),
          ...a.data,
        };
        s.payments.push(row);
        return row;
      },
      findUnique: async (a: Row) => {
        const r = s.payments.find((x) => x.id === a.where.id);
        return r ? { ...r, project: projectView(r.projectId), corrections: s.payments.filter((x) => x.correctsId === r.id) } : null;
      },
      updateMany: async (a: Row) => {
        const r = s.payments.find((x) => matches(x, a.where));
        if (!r) return { count: 0 };
        Object.assign(r, a.data);
        return { count: 1 };
      },
    },
    homeDocument: {
      create: async (a: Row) => {
        const row = { id: nextId('doc'), createdAt: new Date(), deletedAt: null, sharedAt: null, version: 1, supersedesId: null, ...a.data };
        s.documents.push(row);
        return row;
      },
      findFirst: async (a: Row) =>
        s.documents.filter((d) => matches(d, a.where)).sort((x, y) => y.version - x.version)[0] ?? null,
      findMany: async (a: Row) => s.documents.filter((d) => matches(d, a.where)),
      findUnique: async (a: Row) => s.documents.find((d) => d.id === a.where.id) ?? null,
      updateMany: async (a: Row) => {
        const rows = s.documents.filter((d) => matches(d, a.where));
        rows.forEach((d) => Object.assign(d, a.data));
        return { count: rows.length };
      },
    },
    homeProjectEvent: {
      create: async (a: Row) => {
        const row = { id: nextId('ev'), ...a.data };
        s.events.push(row);
        return row;
      },
      createMany: async (a: Row) => {
        let count = 0;
        for (const d of a.data) {
          if (d.dedupeKey && s.events.some((e) => e.dedupeKey === d.dedupeKey)) continue;
          s.events.push({ id: nextId('ev'), ...d });
          count += 1;
        }
        return { count };
      },
    },
    homeDecision: {
      create: async (a: Row) => {
        const row = { id: nextId('dec'), pickedOptionId: null, chosenIndex: null, chosenAt: null, chosenById: null, quoteLineId: null, ...a.data };
        s.decisions.push(row);
        return row;
      },
      findUnique: async (a: Row) => {
        const d = s.decisions.find((x) => x.id === a.where.id);
        return d ? decisionView(d) : null;
      },
      findFirst: async (a: Row) => {
        const d = s.decisions.find((x) => x.id === a.where.id);
        const familyUser = a.where.project?.family?.some?.userId;
        if (!d || (familyUser && !s.family.some((f) => f.userId === familyUser && f.joinedAt && !f.removedAt))) return null;
        return decisionView(d);
      },
      findMany: async (a: Row) => s.decisions.filter((d) => matches(d, a.where)).map(decisionView),
      updateMany: async (a: Row) => {
        const d = s.decisions.find((x) => x.id === a.where.id && x.pickedOptionId === a.where.pickedOptionId);
        if (!d) return { count: 0 };
        Object.assign(d, a.data);
        return { count: 1 };
      },
    },
    homeDecisionOption: {
      createMany: async (a: Row) => {
        for (const d of a.data) s.options.push({ id: nextId('opt'), ...d });
        return { count: a.data.length };
      },
    },
    decisionVote: {
      upsert: async (a: Row) => {
        const k = a.where.decisionId_userId;
        const v = s.votes.find((x) => x.decisionId === k.decisionId && x.userId === k.userId);
        if (v) Object.assign(v, a.update);
        else s.votes.push({ id: nextId('vote'), ...a.create });
        return {};
      },
    },
    homeQuoteChange: {
      create: async (a: Row) => {
        const row = { id: nextId('qc'), ...a.data };
        s.quoteChanges.push(row);
        return row;
      },
    },
    homeMaterial: {
      findFirst: async (a: Row) => s.materials.find((m) => matches(m, a.where)) ?? null,
      findUnique: async (a: Row) => {
        const m = s.materials.find((x) => x.id === a.where.id);
        return m ? { ...m } : null;
      },
      findMany: async (a: Row) => s.materials.filter((m) => matches(m, a.where)),
      update: async (a: Row) => {
        const m = s.materials.find((x) => x.id === a.where.id)!;
        Object.assign(m, a.data);
        return m;
      },
      updateMany: async (a: Row) => {
        const rows = s.materials.filter((m) => matches(m, a.where));
        rows.forEach((m) => Object.assign(m, a.data));
        return { count: rows.length };
      },
    },
    homeProjectStage: {
      findMany: async () => [...s.stages].sort((a, b) => a.sortOrder - b.sortOrder),
      update: async (a: Row) => {
        const st = s.stages.find((x) => x.id === a.where.id)!;
        Object.assign(st, a.data);
        return st;
      },
    },
    homeChecklistItem: {
      findFirst: async (a: Row) => s.checklist.find((c) => c.quoteLineId === a.where.quoteLineId) ?? null,
      // Steps with planned days (the step tracker); none in these tests.
      findMany: async () => [],
    },
    homeProjectDateChange: {
      create: async (a: Row) => {
        const row = { id: nextId('dc'), ...a.data };
        s.dateChanges.push(row);
        return row;
      },
    },
  };
  return { client, s, members };
}

export type FakeDb = ReturnType<typeof makeDb>;
