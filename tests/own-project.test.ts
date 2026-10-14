import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * "Start a project" for a studio's OWN client (owner, 11 Oct 2026;
 * docs/studio-workspace/OWN-CLIENTS.md). Who may start one, which quotation
 * qualifies, that the plan is built by the SAME code as signing in the app,
 * that the customer's account is found or made by phone (never a team
 * account), that the invite never goes by WhatsApp, that the customer can
 * then read the project, and that One Interiors' queues and counts leave
 * these projects out. Prisma is mocked.
 */

type Call = { op: string; args: unknown };

const db = vi.hoisted(() => {
  const calls: Call[] = [];
  const state = {
    quote: null as Record<string, unknown> | null,
    started: null as { id: string } | null,
    userByPhone: null as Record<string, unknown> | null,
    userByEmail: null as Record<string, unknown> | null,
    brief: null as { id: string } | null,
    prior: null as { source: string } | null,
  };
  const rec = (op: string, ret: (args: never) => unknown = () => ({})) =>
    vi.fn(async (args: never) => {
      calls.push({ op, args });
      return ret(args);
    });
  const tx = {
    user: {
      create: rec('tx.user.create', () => ({ id: 'u-new', role: 'CUSTOMER', deletedAt: null, name: 'Meera Joshi', email: null })),
      update: rec('tx.user.update'),
    },
    brief: {
      findUnique: rec('tx.brief.findUnique', () => state.brief),
      create: rec('tx.brief.create', () => ({ id: 'b-new' })),
    },
    introduction: {
      findUnique: rec('tx.introduction.findUnique', () => state.prior),
      create: rec('tx.introduction.create', () => ({ id: 'i-own' })),
    },
    studioQuote: { update: rec('tx.studioQuote.update') },
    homeProject: { create: rec('tx.homeProject.create', () => ({ id: 'hp1' })) },
    homeProjectStage: { create: rec('tx.homeProjectStage.create', () => ({ id: 'st' })) },
    homeMaterial: { createMany: rec('tx.homeMaterial.createMany', () => ({ count: 0 })) },
    homeDocument: { createMany: rec('tx.homeDocument.createMany', () => ({ count: 2 })) },
    studioProjectMember: { create: rec('tx.studioProjectMember.create') },
    homeProjectEvent: { create: rec('tx.homeProjectEvent.create', () => ({ id: 'ev' })) },
    homeProjectInvite: { create: rec('tx.homeProjectInvite.create', () => ({ id: 'inv1' })) },
    auditLog: { create: rec('tx.auditLog.create') },
  };
  const client = {
    studioQuote: {
      findFirst: rec('studioQuote.findFirst', () => state.quote),
    },
    homeProject: {
      findFirst: rec('homeProject.findFirst', () => state.started),
      findMany: rec('homeProject.findMany', () => []),
    },
    user: {
      findUnique: rec('user.findUnique', (args: { where: { phone?: string; email?: string } }) =>
        args.where.phone ? state.userByPhone : state.userByEmail,
      ),
    },
    homeProjectInvite: { update: rec('homeProjectInvite.update') },
    introduction: { findMany: rec('introduction.findMany', () => []) },
    brief: { count: rec('brief.count', () => 0), findUnique: rec('brief.findUnique', () => ({ id: 'b-own' })) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { client, calls, tx, state };
});

vi.mock('@/lib/prisma', () => ({ prisma: db.client }));
const currentUser = vi.hoisted(() => ({ value: { id: 'u-ops', role: 'OPS', phone: null, name: 'Ops' } as Record<string, unknown> | null }));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => currentUser.value),
  hasRole: (u: { role: string } | null, r: string) => Boolean(u && (u.role === r || u.role === 'ADMIN')),
}));
vi.mock('@/modules/notify/service', () => ({ notify: vi.fn(async () => undefined), notifyStudio: vi.fn(async () => undefined) }));
vi.mock('@/modules/portal/plan-store', () => ({ tellOpsAssured: vi.fn(async () => undefined) }));
const sendNotice = vi.hoisted(() => vi.fn(async () => ({ delivered: true })));
vi.mock('@/modules/auth/email', () => ({ sendNotice }));
const sms = vi.hoisted(() => ({ configured: false, send: vi.fn(async () => ({ delivered: true })) }));
vi.mock('@/modules/messaging/sms', () => ({
  smsProvider: () => ({ name: 'test', configured: () => sms.configured, send: sms.send }),
}));
/* Customers never get WhatsApp: if anything reached these, the test fails. */
const whatsapp = vi.hoisted(() => ({ sendOtp: vi.fn(), sendTemplate: vi.fn(), hasWhatsApp: vi.fn(() => true) }));
vi.mock('@/modules/auth/whatsapp', () => whatsapp);
/* The plan must come from the signing code itself: wrap it to see it called. */
const signed = vi.hoisted(() => ({ spy: null as null | ReturnType<typeof vi.fn> }));
vi.mock('@/modules/portal/plan-write', async (orig) => {
  const actual = await orig<typeof import('@/modules/portal/plan-write')>();
  signed.spy = vi.fn(actual.createSignedProject);
  return { ...actual, createSignedProject: signed.spy };
});
vi.mock('@/lib/env', async (orig) => ({ ...(await orig<typeof import('@/lib/env')>()), hasDatabase: () => true }));

import { startOwnProject, type StartOwnProjectInput } from '@/modules/project/own-project';
import {
  accountRefusal,
  checkCustomer,
  cleanCode,
  CODE_ALPHABET,
  CUSTOMER_ERRORS,
  inviteCode,
  inviteMessage,
  localitySlug,
  maskedPhone,
  OWN_QUOTE_ERRORS,
  ownQuoteRefusal,
  parseStartOn,
  propertyTypeFrom,
} from '@/modules/project/own-project-rules';
import { deliverInvite } from '@/modules/project/own-project-invite';
import { quoteTotals } from '@/modules/portal/choose';
import { PLAN_KINDS } from '@/modules/portal/tracker';
import { signedQuoteDocKey } from '@/modules/portal/documents';
import { customerProjects } from '@/modules/portal/customer-project';
import { finalQuoteView } from '@/modules/portal/choose';
import { listIntroductions } from '@/modules/studio/introduction-ops';
import { journeyCounts } from '@/modules/analytics/journey-store';
import { INTRODUCED_BY_US, isOwnClient } from '@/modules/studio/introduction-source';
import type { StudioMemberRef } from '@/modules/studio/access';

const NOW = new Date('2026-10-11T06:00:00Z');

const member = (role: StudioMemberRef['role'], status: StudioMemberRef['status'] = 'ACTIVE'): StudioMemberRef => ({
  id: `m-${role.toLowerCase()}`,
  studioId: 's1',
  userId: `u-${role.toLowerCase()}`,
  role,
  status,
});

const line = (id: string, room: string, product: string, code: 'MODULAR' | 'ONSITE', rupees: number) => ({
  id,
  room,
  product,
  details: null,
  unit: 'UNIT',
  code,
  ratePaise: BigInt(rupees * 100),
  amountPaise: BigInt(rupees * 100),
  widthMm: null,
  heightMm: null,
  qtyMilli: 1000,
});

function ownQuote(over: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    number: 'TL-2026-031',
    status: 'ACCEPTED',
    introductionId: null,
    briefId: null,
    clientName: 'Meera Joshi',
    clientPhone: '98220 11223',
    clientEmail: null,
    society: 'Ivy Towers',
    locality: 'Baner',
    config: '2 BHK',
    quoteDate: null,
    issuedOn: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date('2026-09-28T00:00:00Z'),
    feeBps: 0,
    discountBps: 0,
    onSpotPaise: 0n,
    bookingAdvancePaise: 0n,
    gstBps: 1800,
    phases: [
      { label: 'Booking', pct: 10 },
      { label: 'Design sign-off', pct: 40 },
      { label: 'Carpentry done', pct: 40 },
      { label: 'Handover', pct: 10 },
    ],
    studio: { tradeName: 'Teakline Studio', paymentPhases: null, matchingProfile: null },
    client: { name: 'Meera Joshi', phone: '9822011223', email: 'meera@example.com', society: 'Ivy Towers', locality: 'Baner', config: '2 BHK', source: 'REFERRAL', introductionId: null, deletedAt: null },
    lines: [
      line('l1', 'Kitchen', 'Base cabinets', 'MODULAR', 1_85_000),
      line('l2', 'Kitchen', 'Dado tiling', 'ONSITE', 32_000),
      line('l3', 'Bedroom 1', 'Wardrobe', 'MODULAR', 1_40_000),
      line('l4', 'Whole home', 'Painting', 'ONSITE', 61_333),
    ],
    ...over,
  };
}

const input = (over: Partial<StartOwnProjectInput> = {}): StartOwnProjectInput => ({
  quoteId: 'q1',
  startOn: '2026-10-14',
  customer: { name: 'Meera Joshi', phone: '98220 11223', email: 'meera@example.com' },
  ...over,
});

const ops = (op: string) => db.calls.filter((c) => c.op === op);
const writes = () => db.calls.filter((c) => c.op.startsWith('tx.') && /create|update|upsert/.test(c.op));

beforeEach(() => {
  db.calls.length = 0;
  db.state.quote = ownQuote();
  db.state.started = null;
  db.state.userByPhone = null;
  db.state.userByEmail = null;
  db.state.brief = null;
  db.state.prior = null;
  sms.configured = false;
  sms.send.mockClear();
  sendNotice.mockClear();
  signed.spy?.mockClear();
  db.client.$transaction.mockClear();
});

// ── Pure rules ─────────────────────────────────────────────────

describe('which quotation can start a project', () => {
  const base = { status: 'ACCEPTED', introductionId: null, briefId: null, client: null, lineCount: 3, totalPaise: 100, alreadyStarted: false };
  it('takes a won or sent quotation for the studio’s own client', () => {
    expect(ownQuoteRefusal(base)).toBeNull();
    expect(ownQuoteRefusal({ ...base, status: 'ISSUED' })).toBeNull();
    expect(ownQuoteRefusal({ ...base, client: { source: 'WALK_IN', introductionId: null, deletedAt: null } })).toBeNull();
  });
  it('refuses a draft, a lost one, an empty one, and one already started', () => {
    expect(ownQuoteRefusal({ ...base, status: 'DRAFT' })).toBe(OWN_QUOTE_ERRORS.status);
    expect(ownQuoteRefusal({ ...base, status: 'DECLINED' })).toBe(OWN_QUOTE_ERRORS.status);
    expect(ownQuoteRefusal({ ...base, lineCount: 0 })).toBe(OWN_QUOTE_ERRORS.empty);
    expect(ownQuoteRefusal({ ...base, alreadyStarted: true })).toBe(OWN_QUOTE_ERRORS.started);
  });
  it('refuses anything One Interiors introduced: that customer signs in the app', () => {
    expect(ownQuoteRefusal({ ...base, introductionId: 'i1' })).toBe(OWN_QUOTE_ERRORS.introduced);
    expect(ownQuoteRefusal({ ...base, briefId: 'b1' })).toBe(OWN_QUOTE_ERRORS.introduced);
    expect(ownQuoteRefusal({ ...base, client: { source: 'ONE_INTERIORS', introductionId: null, deletedAt: null } })).toBe(OWN_QUOTE_ERRORS.introduced);
    expect(ownQuoteRefusal({ ...base, client: { source: 'OTHER', introductionId: 'i1', deletedAt: null } })).toBe(OWN_QUOTE_ERRORS.introduced);
  });
});

describe('the customer', () => {
  it('normalises the mobile and keeps the email optional', () => {
    expect(checkCustomer({ name: '  Meera   Joshi ', phone: '098220 11223' })).toEqual({ ok: true, value: { name: 'Meera Joshi', phone: '+919822011223', email: null } });
    expect(checkCustomer({ name: 'Meera', phone: '9822011223', email: 'Meera@Example.com ' })).toMatchObject({ ok: true, value: { email: 'meera@example.com' } });
    expect(checkCustomer({ name: 'Meera', phone: '020 2567 8900' }).ok).toBe(false);
    expect(checkCustomer({ name: 'M', phone: '9822011223' }).ok).toBe(false);
    expect(checkCustomer({ name: 'Meera', phone: '9822011223', email: 'not-an-email' }).ok).toBe(false);
  });
  it('links only a customer account: a studio or ops number is refused', () => {
    expect(accountRefusal(null)).toBeNull();
    expect(accountRefusal({ role: 'CUSTOMER', deletedAt: null })).toBeNull();
    for (const role of ['STUDIO', 'OPS', 'ADMIN']) expect(accountRefusal({ role, deletedAt: null })).toBe(CUSTOMER_ERRORS.staff);
    expect(accountRefusal({ role: 'CUSTOMER', deletedAt: new Date() })).toBe(CUSTOMER_ERRORS.erased);
  });
  it('reads the home from the client record', () => {
    expect(propertyTypeFrom('2 BHK')).toBe('BHK_2');
    expect(propertyTypeFrom('3.5bhk')).toBe('BHK_3');
    expect(propertyTypeFrom('5 BHK penthouse')).toBe('BHK_4_PLUS');
    expect(propertyTypeFrom('Villa')).toBe('VILLA');
    expect(propertyTypeFrom('office')).toBeNull();
    expect(localitySlug('Kalyani Nagar')).toBe('kalyani-nagar');
    expect(localitySlug('  ')).toBeNull();
  });
  it('takes a start date from two months back to a year ahead', () => {
    expect(parseStartOn('2026-10-14', NOW)?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(parseStartOn('2026-02-30', NOW)).toBeNull();
    expect(parseStartOn('2025-01-01', NOW)).toBeNull();
    expect(parseStartOn('2028-01-01', NOW)).toBeNull();
  });
});

describe('the invite', () => {
  it('makes short unambiguous codes and reads them back however typed', () => {
    const code = inviteCode((n) => new Uint8Array(n).map((_, i) => i * 37));
    expect(code).toHaveLength(8);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    expect(cleanCode(code.toLowerCase().replace(/(.{4})/, '$1-'))).toBe(code);
    expect(cleanCode('ABCD-EFG0')).toBeNull();
    expect(maskedPhone('+919822011223')).toBe('+91 98xxx xx223');
  });
  it('says it in English, Hindi and Marathi, always with the link', () => {
    const w = { customerFirst: 'Meera', studio: 'Teakline Studio', link: 'https://oneinteriors.in/app/join/ABCDEFGH' };
    for (const lang of ['en', 'hi', 'mr'] as const) {
      const m = inviteMessage(lang, w);
      expect(m).toContain(w.link);
      expect(m).toContain('Teakline Studio');
    }
    expect(inviteMessage('hi', w)).toMatch(/[ऀ-ॿ]/);
    expect(inviteMessage('mr', w)).toMatch(/[ऀ-ॿ]/);
  });
  it('goes by SMS when a provider exists and by email when known; otherwise nothing, and the studio shares it', async () => {
    const d = { phone: '+919822011223', email: 'm@x.in', text: 'hi', emailNotice: { title: 't', body: 'b', url: 'u' } };
    const sendEmail = vi.fn(async () => ({ delivered: true }));
    const off = { name: 'none', configured: () => false, send: vi.fn(async () => ({ delivered: true })) };
    const on = { name: 'x', configured: () => true, send: vi.fn(async () => ({ delivered: true })) };
    expect(await deliverInvite(d, { sms: off, sendEmail })).toEqual(['email']);
    expect(off.send).not.toHaveBeenCalled();
    expect(await deliverInvite(d, { sms: on, sendEmail })).toEqual(['sms', 'email']);
    expect(await deliverInvite({ ...d, email: null }, { sms: off, sendEmail })).toEqual([]);
  });
  it('can never reach WhatsApp: neither module imports it or the studio sender', () => {
    for (const f of ['src/modules/project/own-project.ts', 'src/modules/project/own-project-invite.ts', 'src/modules/project/own-project-rules.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from '@\/modules\/auth\/whatsapp'/);
      expect(src, f).not.toMatch(/from '@\/modules\/messaging\/sender'/);
    }
  });
});

// ── Starting the project ───────────────────────────────────────

describe('startOwnProject: who may', () => {
  it('refuses a supervisor, accounts, and anyone not active — before reading anything', async () => {
    for (const m of [member('SUPERVISOR'), member('ACCOUNTS'), member('OWNER', 'SUSPENDED'), member('PM', 'INVITED')]) {
      const r = await startOwnProject(m, input(), NOW);
      expect(r.ok).toBe(false);
    }
    expect(await startOwnProject(null, input(), NOW)).toMatchObject({ ok: false });
    expect(db.calls).toEqual([]);
  });
});

describe('startOwnProject: the quotation', () => {
  it('is read only within the member’s studio', async () => {
    db.state.quote = null;
    const r = await startOwnProject(member('OWNER'), input(), NOW);
    expect(r).toEqual({ ok: false, error: 'That quotation is not one of yours.' });
    expect(ops('studioQuote.findFirst')[0]!.args).toMatchObject({ where: { id: 'q1', studioId: 's1' } });
  });
  it('must be the studio’s own client’s, accepted, and not started yet', async () => {
    db.state.quote = ownQuote({ introductionId: 'i9' });
    expect(await startOwnProject(member('OWNER'), input(), NOW)).toEqual({ ok: false, error: OWN_QUOTE_ERRORS.introduced });
    db.state.quote = ownQuote({ status: 'DRAFT' });
    expect(await startOwnProject(member('OWNER'), input(), NOW)).toEqual({ ok: false, error: OWN_QUOTE_ERRORS.status });
    db.state.quote = ownQuote();
    db.state.started = { id: 'hp0' };
    expect(await startOwnProject(member('OWNER'), input(), NOW)).toEqual({ ok: false, error: OWN_QUOTE_ERRORS.started });
    expect(db.client.$transaction).not.toHaveBeenCalled();
  });
});

describe('startOwnProject: the plan, by the same code as signing', () => {
  it('builds stages, checklists, payments summing to the contract, materials and the Locker in one transaction', async () => {
    const r = await startOwnProject(member('OWNER'), input(), NOW);
    expect(r).toMatchObject({ ok: true, projectId: 'hp1' });
    expect(db.client.$transaction).toHaveBeenCalledTimes(1);
    expect(signed.spy).toHaveBeenCalledTimes(1);

    const contract = quoteTotals(ownQuote() as never).totalPaise;
    const created = ops('tx.homeProject.create')[0]!.args as { data: Record<string, unknown> & { paymentPhases: { amountPaise: number; label: string }[] } };
    expect(created.data).toMatchObject({ introductionId: 'i-own', signedQuoteId: 'q1', contractPaise: BigInt(contract), assuredRequestedAt: null, totalDays: 100 });
    expect((created.data.startOn as Date).toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(created.data.paymentPhases.reduce((a, s) => a + s.amountPaise, 0)).toBe(contract);
    expect(created.data.paymentPhases.map((s) => s.label)).toEqual(['Booking', 'Design sign-off', 'Carpentry done', 'Handover']);
    // Basic by default: the plan column is left to its default; nothing asks for Assured.
    expect(created.data).not.toHaveProperty('plan');

    expect(ops('tx.studioQuote.update')[0]!.args).toMatchObject({ where: { id: 'q1' }, data: { status: 'ACCEPTED' } });
    const kinds = ops('tx.homeProjectStage.create').map((c) => (c.args as { data: { kind: string } }).data.kind);
    expect(kinds).toEqual([...PLAN_KINDS]);
    const docs = (ops('tx.homeDocument.createMany')[0]!.args as { data: { storageKey: string; byStudio: boolean; uploadedById: string }[] }).data;
    expect(docs.map((d) => d.storageKey)).toEqual([signedQuoteDocKey('q1', 'AGREEMENT'), signedQuoteDocKey('q1', 'QUOTATION')]);
    expect(docs.every((d) => d.byStudio && d.uploadedById === 'u-owner')).toBe(true);
    expect(ops('tx.homeMaterial.createMany')).toHaveLength(1);
  });

  it('records it as the studio’s own client, never as a One Interiors introduction or a win in our funnel', async () => {
    await startOwnProject(member('OWNER'), input(), NOW);
    expect(ops('tx.introduction.create')[0]!.args).toMatchObject({ data: { source: 'STUDIO_OWN_CLIENT', studioId: 's1', briefId: 'b-new', introducedById: 'u-owner' } });
    expect(writes().some((c) => c.op.includes('quoteDecision'))).toBe(false);
    const types = ops('tx.homeProjectEvent.create').map((c) => (c.args as { data: { type: string; actorType: string } }).data);
    expect(types.map((t) => t.type)).toEqual(['plan.created', 'customer.invited']);
    expect(types.every((t) => t.actorType === 'STUDIO')).toBe(true);
  });

  it('puts the PM who started it on the project; an owner needs no row', async () => {
    await startOwnProject(member('PM'), input(), NOW);
    expect(ops('tx.studioProjectMember.create')[0]!.args).toEqual({ data: { homeProjectId: 'hp1', memberId: 'm-pm' } });
    db.calls.length = 0;
    await startOwnProject(member('OWNER'), input(), NOW);
    expect(ops('tx.studioProjectMember.create')).toEqual([]);
  });

  it('marks a sent quotation won by starting it', async () => {
    db.state.quote = ownQuote({ status: 'ISSUED' });
    expect((await startOwnProject(member('OWNER'), input(), NOW)).ok).toBe(true);
    expect(ops('tx.studioQuote.update')[0]!.args).toMatchObject({ data: { status: 'ACCEPTED' } });
  });
});

describe('startOwnProject: the customer’s account', () => {
  it('makes a CUSTOMER account and a minimal brief, kept out of our funnel, when the number is new', async () => {
    const r = await startOwnProject(member('OWNER'), input(), NOW);
    expect(r.ok).toBe(true);
    expect(ops('tx.user.create')[0]!.args).toMatchObject({ data: { phone: '+919822011223', name: 'Meera Joshi', role: 'CUSTOMER', email: 'meera@example.com' } });
    expect((ops('tx.user.create')[0]!.args as { data: Record<string, unknown> }).data).not.toHaveProperty('phoneVerified');
    expect(ops('tx.brief.create')[0]!.args).toMatchObject({
      data: { userId: 'u-new', madeByStudio: true, contactName: 'Meera Joshi', contactPhone: '+919822011223', society: 'Ivy Towers', locality: 'baner', propertyType: 'BHK_2' },
    });
    expect(ops('tx.homeProjectInvite.create')[0]!.args).toMatchObject({ data: { projectId: 'hp1', userId: 'u-new', phone: '+919822011223', createdById: 'm-owner' } });
  });

  it('uses the account and brief a customer already has', async () => {
    db.state.userByPhone = { id: 'u-old', role: 'CUSTOMER', deletedAt: null, name: 'Meera', email: null };
    db.state.brief = { id: 'b-old' };
    expect((await startOwnProject(member('OWNER'), input(), NOW)).ok).toBe(true);
    expect(ops('tx.user.create')).toEqual([]);
    expect(ops('tx.brief.create')).toEqual([]);
    expect(ops('tx.introduction.create')[0]!.args).toMatchObject({ data: { briefId: 'b-old' } });
  });

  it('refuses a number that belongs to a studio member, writing nothing', async () => {
    db.state.userByPhone = { id: 'u-sup', role: 'STUDIO', deletedAt: null, name: 'Ravi', email: null };
    expect(await startOwnProject(member('OWNER'), input(), NOW)).toEqual({ ok: false, error: CUSTOMER_ERRORS.staff });
    expect(db.client.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a customer One Interiors already introduced to this studio', async () => {
    db.state.userByPhone = { id: 'u-old', role: 'CUSTOMER', deletedAt: null, name: 'Meera', email: null };
    db.state.brief = { id: 'b-old' };
    db.state.prior = { source: 'ONE_INTERIORS' };
    expect(await startOwnProject(member('OWNER'), input(), NOW)).toEqual({ ok: false, error: CUSTOMER_ERRORS.introduced });
    expect(ops('tx.homeProject.create')).toEqual([]);
  });

  it('never sets an email another account already uses', async () => {
    db.state.userByEmail = { id: 'u-other' };
    await startOwnProject(member('OWNER'), input(), NOW);
    expect((ops('tx.user.create')[0]!.args as { data: Record<string, unknown> }).data).not.toHaveProperty('email');
  });
});

describe('startOwnProject: the invite', () => {
  it('gives the studio the link and the words in three languages; email goes when known, SMS only with a provider', async () => {
    const r = await startOwnProject(member('OWNER'), input(), NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.invite.link).toMatch(new RegExp(`/app/join/${r.invite.code}$`));
    expect(Object.keys(r.invite.messages).sort()).toEqual(['en', 'hi', 'mr']);
    expect(r.invite.sentVia).toEqual(['email']);
    expect(sms.send).not.toHaveBeenCalled();
    expect(sendNotice).toHaveBeenCalledWith('meera@example.com', expect.objectContaining({ url: r.invite.link }));
    expect(whatsapp.sendOtp).not.toHaveBeenCalled();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('sends the SMS when a provider is configured, and still never WhatsApp', async () => {
    sms.configured = true;
    const r = await startOwnProject(member('OWNER'), input({ customer: { name: 'Meera Joshi', phone: '9822011223' } }), NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.invite.sentVia).toEqual(['sms']);
    expect(sms.send).toHaveBeenCalledWith('+919822011223', expect.stringContaining(r.invite.link));
    expect(whatsapp.sendOtp).not.toHaveBeenCalled();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });
});

// ── The customer reads it; ops does not count it ───────────────

describe('the customer can read the project', () => {
  it('the app and the website find projects by the customer on the brief, which the start linked', async () => {
    db.calls.length = 0;
    await customerProjects('u-new', NOW);
    expect(ops('homeProject.findMany')[0]!.args).toMatchObject({ where: { OR: expect.arrayContaining([{ introduction: { brief: { userId: 'u-new' } } }]) } });
  });

  it('the Locker’s signed quotation opens for an own client, though the quote carries no introduction', async () => {
    currentUser.value = { id: 'u-new', role: 'CUSTOMER', phone: '+919822011223', name: 'Meera Joshi' };
    db.state.started = { id: 'hp1', introductionId: 'i-own' } as never;
    db.state.quote = { ...ownQuote(), studio: { slug: 'teakline', tradeName: 'Teakline Studio', paymentPhases: null, matchingProfile: null }, terms: null, onSpotLabel: null };
    const introFind = vi.fn(async () => ({ brief: { scope: null }, homeProject: { totalDays: 100 } }));
    (db.client.introduction as Record<string, unknown>).findFirst = introFind;
    const v = await finalQuoteView('q1', async () => null);
    expect(v).toMatchObject({ id: 'q1', accepted: true, handoverDays: 100 });
    const quoteWhere = (ops('studioQuote.findFirst').at(-1)!.args as { where: Record<string, unknown> }).where;
    expect(quoteWhere).toEqual({ id: 'q1', status: 'ACCEPTED' });
    const projWhere = (ops('homeProject.findFirst').at(-1)!.args as { where: unknown }).where;
    expect(projWhere).toMatchObject({ signedQuoteId: 'q1', introduction: { briefId: 'b-own', source: 'STUDIO_OWN_CLIENT' } });
    currentUser.value = { id: 'u-ops', role: 'OPS', phone: null, name: 'Ops' };
  });
});

describe('One Interiors’ queues and counts leave own clients out', () => {
  it('ops’ introductions list reads ONE_INTERIORS only', async () => {
    db.calls.length = 0;
    await listIntroductions();
    expect(ops('introduction.findMany')[0]!.args).toMatchObject({ where: { source: 'ONE_INTERIORS' } });
  });

  it('the funnel leaves out briefs a studio made, and counts our introductions only', async () => {
    db.calls.length = 0;
    await journeyCounts(30);
    const wheres = ops('brief.count').map((c) => (c.args as { where: Record<string, unknown> }).where);
    expect(wheres.length).toBeGreaterThan(0);
    expect(wheres.every((w) => w.madeByStudio === false)).toBe(true);
    expect(wheres.some((w) => JSON.stringify(w.introductions ?? '').includes('ONE_INTERIORS'))).toBe(true);
  });

  it('the source helpers say the same thing', () => {
    expect(INTRODUCED_BY_US).toEqual({ source: 'ONE_INTERIORS' });
    expect(isOwnClient('STUDIO_OWN_CLIENT')).toBe(true);
    expect(isOwnClient('ONE_INTERIORS')).toBe(false);
  });

  it('every read that means "we introduced them" filters on the source', () => {
    const must: [string, RegExp][] = [
      ['src/modules/studio/introduction-ops.ts', /INTRODUCED_BY_US/],
      ['src/modules/studio/introduction.ts', /INTRODUCED_BY_US/],
      ['src/modules/studio/dashboard.ts', /INTRODUCED_BY_US/],
      ['src/modules/portal/home.ts', /INTRODUCED_BY_US/],
      ['src/modules/engagement/coins.ts', /INTRODUCED_BY_US/],
      ['src/modules/portal/choose.ts', /source === 'ONE_INTERIORS'/],
    ];
    for (const [f, re] of must) expect(readFileSync(f, 'utf8'), f).toMatch(re);
  });
});
