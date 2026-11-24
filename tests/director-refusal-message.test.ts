import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Owner, 24 Nov 2026: "if someone tries to make some changes there it should trigger a msg that only the owner of
 * this lead can make changes". A director reads every lead and quotation; every lead or quotation write refused
 * because they are a director says DIRECTOR_CHANGE_REFUSED. Anyone else keeps the message they had.
 */

const state = vi.hoisted(() => ({
  member: null as unknown,
  /** What `findFirst` returns, per model (null: nothing matched the where, as for a director's write fence). */
  first: {} as Record<string, unknown>,
  /** What `findMany` returns, per model. */
  many: {} as Record<string, unknown[]>,
  /** What `updateMany` reports. */
  count: 0,
}));

vi.mock('@/lib/prisma', () => {
  const model = (name: string) => ({
    findFirst: async () => state.first[name] ?? null,
    findUnique: async () => state.first[name] ?? null,
    findMany: async () => state.many[name] ?? [],
    updateMany: async () => ({ count: state.count }),
    deleteMany: async () => ({ count: 0 }),
    createMany: async () => ({ count: 0 }),
    count: async () => 0,
  });
  return { prisma: new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? model(k) : undefined) }) };
});

vi.mock('@/modules/studio/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/studio/access')>()),
  currentMember: async () => state.member,
}));

import { DIRECTOR_CHANGE_REFUSED, refusalFor, type MemberRole } from '@/modules/studio/roles';
import { editLeadDetails } from '@/modules/studio-sales/leads';
import { logContact, updateClient } from '@/modules/studio-practice/clients';
import { DIRECTOR_READ_ONLY, READ_ONLY_QUOTE, saveQuoteLines } from '@/modules/studio-quote/quotes';
import { sendAgain } from '@/modules/studio-sales/revisions';

const base = { status: 'ACTIVE', fullSoftware: true, studioId: 'studio1', userId: 'u1' } as const;
const DIRECTOR = { ...base, role: 'OWNER', director: true, id: 'dir1' };
/* A Phase 1 salesperson (no sales role): works only the leads assigned to them. */
const SALES = { ...base, role: 'SALES', id: 'rep1' };

/** Someone else's lead, seen through the scope. */
const LEAD = { id: 'lead1', assignedToId: 'rep2', poolTeamId: null, name: 'Asha' };

beforeEach(() => {
  state.member = null;
  state.first = {};
  state.many = { studioStage: [{ id: 'st2', name: 'Calling 2', kind: 'OPEN', colour: null, isIntake: false, sortOrder: 20, _count: { clients: 0 } }] };
  state.count = 0;
});

describe('the director refusal', () => {
  it('is one sentence, and quotations say the same', () => {
    expect(DIRECTOR_CHANGE_REFUSED).toBe('Only the owner of this lead can make changes.');
    expect(DIRECTOR_READ_ONLY).toBe(DIRECTOR_CHANGE_REFUSED);
  });

  it('replaces the fallback only for a director', () => {
    expect(refusalFor(DIRECTOR as MemberRole, 'x')).toBe(DIRECTOR_CHANGE_REFUSED);
    expect(refusalFor({ member: DIRECTOR as MemberRole }, 'x')).toBe(DIRECTOR_CHANGE_REFUSED);
    expect(refusalFor(SALES as MemberRole, 'x')).toBe('x');
    expect(refusalFor({ ...base, role: 'OWNER', id: 'o1' } as MemberRole, 'x')).toBe('x');
    expect(refusalFor(null, 'x')).toBe('x');
    /* Staff viewing as a director are refused for viewing, not for being a director. */
    expect(refusalFor({ ...DIRECTOR, viewOnly: true } as MemberRole, 'x')).toBe('x');
  });
});

describe('a director pressing a write', () => {
  beforeEach(() => {
    state.member = DIRECTOR;
  });

  it('editing a lead', async () => {
    state.first.studioClient = LEAD;
    expect(await editLeadDetails({ clientId: 'lead1', name: 'Asha B' } as never)).toEqual({ ok: false, error: DIRECTOR_CHANGE_REFUSED });
  });

  it('logging a call', async () => {
    expect(await logContact('lead1', 'no_answer' as never)).toEqual({ ok: false, error: DIRECTOR_CHANGE_REFUSED });
  });

  it('logging a call that moves the lead', async () => {
    expect(await logContact('lead1', 'no_answer' as never, null, null, null, { moveToStageId: 'st2' })).toEqual({ ok: false, error: DIRECTOR_CHANGE_REFUSED });
  });

  it('changing the stage', async () => {
    expect(await updateClient({ id: 'lead1', stageId: 'st2' })).toEqual({ ok: false, error: DIRECTOR_CHANGE_REFUSED });
  });

  it('saving a quotation', async () => {
    state.first.studioQuote = null;
    expect(await saveQuoteLines('q1', [])).toEqual({ ok: false, error: DIRECTOR_CHANGE_REFUSED });
  });

  it('sending a quotation again', async () => {
    expect(await sendAgain('q1')).toEqual({ ok: false, error: DIRECTOR_CHANGE_REFUSED });
  });
});

describe('a salesperson refused keeps the message they had', () => {
  beforeEach(() => {
    state.member = SALES;
  });

  it('editing a lead that is not theirs', async () => {
    state.first.studioClient = LEAD;
    expect(await editLeadDetails({ clientId: 'lead1', name: 'Asha B' } as never)).toEqual({ ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' });
  });

  it('logging a call, and changing the stage, on a lead that is not theirs', async () => {
    expect(await logContact('lead1', 'no_answer' as never)).toEqual({ ok: false, error: 'That client is not yours.' });
    expect(await updateClient({ id: 'lead1', stageId: 'st2' })).toEqual({ ok: false, error: 'That client is not yours.' });
  });

  it('saving and sending a quotation (a sales rep reads quotations)', async () => {
    expect(await saveQuoteLines('q1', [])).toEqual({ ok: false, error: READ_ONLY_QUOTE });
    expect(await sendAgain('q1')).toEqual({ ok: false, error: 'You can read this quotation; sending it is for whoever builds quotations.' });
  });
});
