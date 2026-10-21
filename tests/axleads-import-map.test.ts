import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatReport,
  mapLostReason,
  mapSource,
  mapStages,
  markerId,
  norm,
  parseChoices,
  parseExport,
  planImport,
  type AxExport,
  type Choices,
  type ExistingClient,
  type LeadPlan,
  type StudioContext,
  type StudioStageRef,
  answeredAny,
} from '@/modules/studio-import-axleads/map';
import { HAUSPIRE_PIPELINE } from '@/modules/studio-practice/pipeline-preset';

/**
 * The AxLeads import's decisions (docs/studio-os/AXLEADS-IMPORT.md), on the
 * FAKE export in tests/fixtures/axleads-export.fake.json — invented names,
 * +9190000… numbers, nobody real.
 */

const RAW = JSON.parse(readFileSync(join(__dirname, 'fixtures/axleads-export.fake.json'), 'utf8')) as unknown;
const fresh = (): AxExport => {
  const p = parseExport(structuredClone(RAW));
  if (!p.ok) throw new Error(p.error);
  return p.data;
};
const NOW = new Date('2026-10-21T06:00:00.000Z');

const STAGES: StudioStageRef[] = HAUSPIRE_PIPELINE.map((s, i) => ({ id: `st-${i}`, name: s.name, kind: s.kind, isIntake: !!s.isIntake, sortOrder: i }));
const stageId = (name: string) => STAGES.find((s) => s.name === name)!.id;

function ctx(over: Partial<StudioContext> = {}): StudioContext {
  return {
    studioId: 'studio-1',
    stages: STAGES,
    fields: [{ key: 'possession', label: 'Possession', type: 'SELECT', options: ['Ready', 'Under construction'] }],
    leadSources: [{ id: 'ls-1', name: 'WhatsApp' }],
    members: [{ id: 'mem-owner', name: 'Hauspire Owner', role: 'OWNER', status: 'ACTIVE', phone: '+919900000001', email: 'someone-else@e2e.test' }],
    usersByPhone: new Map(),
    usersByEmail: new Map(),
    existingByPhone: new Map(),
    imported: new Map(),
    ...over,
  };
}
const choices = (raw?: unknown): Choices => {
  const c = parseChoices(raw);
  if (!c.ok) throw new Error(c.error);
  return c.choices;
};
const lead = (plan: { leads: LeadPlan[] }, n: number) => plan.leads.find((l) => l.axId.endsWith(`-${String(n).padStart(12, '0')}`))!;
const created = (plan: { leads: LeadPlan[] }, n: number) => {
  const l = lead(plan, n);
  if (l.action !== 'create') throw new Error(`lead ${n} is ${l.action}`);
  return l;
};

describe('reading the file', () => {
  it('refuses something that is not an AxLeads export', () => {
    expect(parseExport({ format: 'csv' }).ok).toBe(false);
    expect(parseExport({ ...(RAW as object), version: 2 }).ok).toBe(false);
    expect(parseExport({ ...(RAW as object), leads: [{ id: 'x' }] }).ok).toBe(false);
  });
  it('reads the fake export', () => {
    const ax = fresh();
    expect(ax.leads).toHaveLength(7);
    expect(ax.members).toHaveLength(4);
  });
});

describe('the roles file', () => {
  it('defaults: owner stays owner, agent becomes sales, binned leads go to the bin', () => {
    const c = choices();
    expect(c.roles).toEqual({ OWNER: 'OWNER', AGENT: 'SALES' });
    expect(c.binned).toBe('bin');
  });
  it('checks what it is given', () => {
    expect(parseChoices({ roles: { AGENT: 'BOSS' } }).ok).toBe(false);
    expect(parseChoices({ roles: { MANAGER: 'PM' } }).ok).toBe(false);
    expect(parseChoices({ members: { 'a@b.test': { phone: '12345' } } }).ok).toBe(false);
    expect(parseChoices({ binned: 'maybe' }).ok).toBe(false);
    expect(choices({ roles: { AGENT: 'DESIGNER' }, stages: { 'Junk ': 'Junk' } })).toMatchObject({ roles: { AGENT: 'DESIGNER' }, stages: { junk: 'Junk' } });
  });
});

describe('stages', () => {
  const ax = fresh();
  const rows = mapStages(ax.stages, STAGES);
  const row = (name: string) => rows.find((r) => r.axName === name)!;

  it('match by name, ignoring case and spacing, when the meaning agrees', () => {
    expect(row('Calling 1')).toMatchObject({ stageName: 'Calling 1', how: 'name' });
    expect(row('quotation  shared')).toMatchObject({ stageName: 'Quotation Shared', how: 'name' });
    expect(row('Converted')).toMatchObject({ stageName: 'Converted', kind: 'WON', how: 'name' });
    expect(row('Lost')).toMatchObject({ stageName: 'Lost', kind: 'LOST', how: 'name' });
    expect(norm(' Requirement/Floor  plan pending ')).toBe(norm('Requirement / Floor Plan Pending'));
  });
  it('a lost stage never lands in an open column of the same name', () => {
    const openJunk = STAGES.map((s) => (s.name === 'Junk' ? { ...s, kind: 'OPEN' as const } : s));
    const r = mapStages(ax.stages, openJunk).find((x) => x.axName === 'Junk')!;
    expect(r).toMatchObject({ stageName: 'Lost', kind: 'LOST', how: 'meaning' });
    expect(r.note).toMatch(/open column/);
  });
  it('Junk lands in Hauspire’s Junk column, which is lost-kind (owner, 21 Oct 2026)', () => {
    expect(row('Junk')).toMatchObject({ stageName: 'Junk', kind: 'LOST', how: 'name' });
  });
  it('an unknown stage lands in the intake column and says so', () => {
    expect(row('Mystery Stage')).toMatchObject({ stageName: 'New', how: 'intake' });
    expect(row('Follow up')).toMatchObject({ stageName: 'New', how: 'intake' });
  });
  it('the roles file can name the column', () => {
    const chosen = mapStages(ax.stages, STAGES, choices({ stages: { 'Mystery Stage': 'Effective Lead', Junk: 'junk' } }).stages);
    expect(chosen.find((r) => r.axName === 'Mystery Stage')).toMatchObject({ stageName: 'Effective Lead', how: 'chosen' });
    expect(chosen.find((r) => r.axName === 'Junk')).toMatchObject({ stageName: 'Junk', kind: 'LOST', how: 'chosen' });
  });
});

describe('sources and lost reasons', () => {
  it('maps every AxLeads source', () => {
    const s = (source: string, sourceDetail: Record<string, unknown> | null = {}) => mapSource({ source, sourceDetail, sourceConnectionId: null });
    expect(s('META_LEAD_AD')).toMatchObject({ source: 'FACEBOOK', ownSource: null });
    expect(s('META_LEAD_AD', { platform: 'ig' })).toMatchObject({ source: 'INSTAGRAM' });
    expect(s('GOOGLE_LEAD_FORM').source).toBe('WEBSITE');
    expect(s('HOSTED_FORM').source).toBe('WEBSITE');
    expect(s('WHATSAPP_INBOUND')).toMatchObject({ source: 'OTHER', ownSource: 'WhatsApp' });
    expect(s('WHATSAPP_ADS')).toMatchObject({ source: 'OTHER', ownSource: 'WhatsApp ads' });
    expect(s('REFERRAL').source).toBe('REFERRAL');
    expect(s('MANUAL')).toMatchObject({ source: 'OTHER', ownSource: null });
  });
  it('reads a free-text lost reason, defaulting to Other', () => {
    expect(mapLostReason('Budget too low')).toBe('BUDGET');
    expect(mapLostReason('Went with another designer')).toBe('WENT_ELSEWHERE');
    expect(mapLostReason('Not reachable')).toBe('NO_RESPONSE');
    expect(mapLostReason('Wrong number')).toBe('WRONG_NUMBER');
    expect(mapLostReason('Possession next year')).toBe('POSTPONED');
    expect(mapLostReason('Junk')).toBe('NOT_SERIOUS');
    expect(mapLostReason('Just exploring')).toBe('NOT_SERIOUS');
    expect(mapLostReason('moved abroad')).toBe('OTHER');
    expect(mapLostReason(null)).toBe('OTHER');
  });
});

describe('people', () => {
  it('matches by phone, adds who has a phone, refuses customers, never adds leavers', () => {
    const plan = planImport(fresh(), ctx(), choices(), { now: NOW });
    const by = (name: string) => plan.members.find((m) => m.ax.displayName === name)!;
    expect(by('Test Owner')).toMatchObject({ kind: 'match', memberId: 'mem-owner', by: 'phone' });
    expect(by('Test Agent A')).toMatchObject({ kind: 'create', phone: '+919000000011', role: 'SALES', email: 'agent.a@axleads.test' });
    expect(by('Test Agent B').kind).toBe('no-phone');
    expect(by('Test Gone').kind).toBe('gone');
  });
  it('follows Settings → Team: a customer, ops or another studio’s number is refused', () => {
    const users = new Map([['+919000000011', { id: 'u1', role: 'CUSTOMER' as const, deleted: false, studioId: null }]]);
    const plan = planImport(fresh(), ctx({ usersByPhone: users }), choices(), { now: NOW });
    expect(plan.members.find((m) => m.ax.displayName === 'Test Agent A')).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/customer/) });
    const other = new Map([['+919000000011', { id: 'u1', role: 'STUDIO' as const, deleted: false, studioId: 'another' }]]);
    expect(planImport(fresh(), ctx({ usersByPhone: other }), choices(), { now: NOW }).members[1]).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/another studio/) });
    const ops = new Map([['+919000000011', { id: 'u1', role: 'OPS' as const, deleted: false, studioId: null }]]);
    expect(planImport(fresh(), ctx({ usersByPhone: ops }), choices(), { now: NOW }).members[1]?.kind).toBe('refused');
  });
  it('reuses a studio login with no team, and drops an email that is somebody else’s', () => {
    const plan = planImport(
      fresh(),
      ctx({ usersByPhone: new Map([['+919000000011', { id: 'u7', role: 'STUDIO', deleted: false, studioId: null }]]), usersByEmail: new Map([['agent.a@axleads.test', { id: 'u8', role: 'CUSTOMER', deleted: false, studioId: null }]]) }),
      choices(),
      { now: NOW },
    );
    expect(plan.members[1]).toMatchObject({ kind: 'create', reuseUserId: 'u7', email: null, emailDropped: true });
  });
  it('the roles file gives a phone, a role, or skips someone', () => {
    const plan = planImport(fresh(), ctx(), choices({ roles: { AGENT: 'DESIGNER' }, members: { 'agent.b@axleads.test': { phone: '9000000012', role: 'PM' }, 'agent.a@axleads.test': { skip: true } } }), { now: NOW });
    expect(plan.members.find((m) => m.ax.displayName === 'Test Agent B')).toMatchObject({ kind: 'create', phone: '+919000000012', role: 'PM' });
    expect(plan.members.find((m) => m.ax.displayName === 'Test Agent A')?.kind).toBe('skip');
  });
});

describe('leads', () => {
  const plan = planImport(fresh(), ctx(), choices(), { now: NOW });

  it('a Meta lead keeps its stage, owner, answers, budget, tags and history at the original times', () => {
    const l = created(plan, 1);
    expect(l.client).toMatchObject({
      name: 'Test Lead 1',
      phone: '9000000101',
      email: 'lead1@axleads.test',
      source: 'INSTAGRAM',
      stageId: stageId('Calling 1'),
      config: '2 BHK',
      society: 'Test Society A',
      carpetSqft: 950,
      budgetPaise: 1_200_000_00,
      locality: 'Testnagar',
      tags: ['nri', 'site visit sunday'],
      nextAction: 'Send portfolio',
      assignee: { kind: 'new', axUserId: '00000000-0000-4000-8002-000000000002' },
      lostReason: null,
    });
    expect(l.client.createdAt.toISOString()).toBe('2026-03-01T04:00:00.000Z');
    expect(l.client.nextActionOn?.toISOString()).toBe('2030-01-05T04:30:00.000Z');
    expect(l.client.lastContactedAt?.toISOString()).toBe('2026-03-04T04:00:00.000Z');
    // The studio's own field, and the new ones from the workspace's field list.
    expect(l.client.fields).toEqual({ possession: 'Ready', area_sqft: '950' });
    expect(l.client.notes).toMatch(/score 70 \(hot\)/);
    expect(l.client.notes).toMatch(/campaign test-campaign-1 · ad set test-adset-1 · ad test-ad-1/);
    expect(l.client.notes).toMatch(/when do you want to start: Next month/);
    expect(l.client.notes).toMatch(/Budget ₹8,00,000 – ₹12,00,000/);
    expect(l.client.notes).toMatch(/Open follow-ups: Send portfolio/);

    const kinds = l.events.map((e) => e.kind);
    expect(kinds).toEqual(['CREATED', 'ASSIGNED', 'CONTACTED', 'STAGE_CHANGED', 'NOTE', 'EDITED', 'CONTACTED', 'IMPORTED']);
    const call = l.events.find((e) => e.externalId === 'axleads:00000000-0000-4000-a000-000000000004')!;
    expect(call.summary).toBe('Spoke to them · Wants a quote / estimate, Wants a site visit · 4 min · Wants a quote');
    expect(call.by).toMatchObject({ name: 'Test Agent A', member: { kind: 'new' } });
    expect(l.events.find((e) => e.kind === 'STAGE_CHANGED')).toMatchObject({ summary: 'Moved from New to Calling 1', meta: { toStageId: stageId('Calling 1') } });
    expect(l.events.find((e) => e.kind === 'NOTE')).toMatchObject({ summary: 'Test note: prefers evening calls', by: { member: { kind: 'existing', id: 'mem-owner' } } });
    expect(l.events.find((e) => e.kind === 'CREATED')?.by).toBeNull();
    expect(l.events.at(-1)).toMatchObject({ externalId: markerId(l.axId), kind: 'IMPORTED', createdAt: NOW });
  });

  it('a lost lead stays lost, with the words kept as the note', () => {
    const two = created(plan, 2);
    expect(two.client).toMatchObject({ name: 'Test Lead Two', stageId: stageId('Junk'), lostReason: 'NOT_SERIOUS', lostNote: 'Just exploring', source: 'WEBSITE' });
    expect(two.events.find((e) => e.kind === 'LOST')?.summary).toBe('Marked lost — not serious. Just exploring');
    expect(created(plan, 7).client).toMatchObject({ stageId: stageId('Lost'), lostReason: 'BUDGET', lostNote: 'Budget too low', ownSource: 'WhatsApp ads' });
  });

  it('a won lead stays won and goes to the AxLeads owner’s match', () => {
    expect(created(plan, 5).client).toMatchObject({ stageId: stageId('Converted'), assignee: { kind: 'existing', id: 'mem-owner' }, source: 'REFERRAL', budgetPaise: 2_500_000_00 });
    // No AxLeads line said how it came in; one is written.
    expect(created(plan, 5).events[0]).toMatchObject({ kind: 'CREATED', summary: 'Came in on AxLeads — referral' });
  });

  it('the same number twice in the file is one card with both histories', () => {
    const three = lead(plan, 3);
    expect(three).toMatchObject({ action: 'merge-file', intoAxId: '00000000-0000-4000-9000-000000000001', into: 'Test Lead 1' });
    if (three.action !== 'merge-file') throw new Error();
    // Messages come over with their text; the MESSAGE_IN stub does not come twice.
    expect(three.events.filter((e) => e.kind === 'IMPORTED').map((e) => e.summary)).toEqual([
      'WhatsApp from them: Hi, test message',
      'WhatsApp to them: Thanks, test reply',
      expect.stringMatching(/^Imported from AxLeads and merged into this card/),
    ]);
    expect(created(plan, 1).client.notes).toMatch(/Merged from AxLeads: Test Lead 3/);
    expect(plan.report.eventsSkipped.messageDuplicates).toBe(1);
  });

  it('a binned lead goes into the bin with the clock starting today; a landline is kept in the notes', () => {
    const four = created(plan, 4);
    expect(four.client).toMatchObject({ name: 'lead4', phone: null, stageId: stageId('New'), assignee: null, city: 'Mumbai' });
    expect(four.client.deletedAt).toEqual(NOW);
    expect(four.client.notes).toMatch(/Phone as it was on AxLeads: 020 4000 0000/);
    expect(four.client.notes).toMatch(/Stage on AxLeads: Mystery Stage/);
    expect(four.client.notes).toMatch(/Was with Test Agent B on AxLeads/);
    expect(four.client.notes).toMatch(/Carpet area: about 900 \(did not fit the field\)/);
    expect(four.events.map((e) => e.kind)).toContain('BINNED');
  });

  it('a lead with a leaver goes to the pool, and the AxLeads form is named', () => {
    expect(created(plan, 6).client).toMatchObject({ assignee: null, source: 'WEBSITE', sourceNote: 'AxLeads · website form · Test Website Form', fields: { visit_on: '2026-08-15' } });
  });

  it('binned leads can be left out', () => {
    const p = planImport(fresh(), ctx(), choices({ binned: 'skip' }), { now: NOW });
    expect(lead(p, 4).action).toBe('skip-binned');
    expect(p.report.skippedBinned).toBe(1);
  });

  it('a number already on the board is merged into that card: blanks filled, nothing overwritten', () => {
    const existing: ExistingClient = { id: 'c-old', name: 'Existing Card', assignedToId: null, email: null, locality: 'Oldplace', society: null, config: null, carpetSqft: null, budgetPaise: null, notes: 'Their own note', tags: ['vip'] };
    const p = planImport(fresh(), ctx({ existingByPhone: new Map([['9000000101', existing]]) }), choices(), { now: NOW });
    const one = lead(p, 1);
    const three = lead(p, 3);
    expect(one).toMatchObject({ action: 'merge-existing', clientId: 'c-old', into: 'Existing Card' });
    expect(three).toMatchObject({ action: 'merge-existing', clientId: 'c-old' });
    if (one.action !== 'merge-existing' || three.action !== 'merge-existing') throw new Error();
    expect(one.fill).toMatchObject({ email: 'lead1@axleads.test', config: '2 BHK', budgetPaise: 1_200_000_00, tags: ['vip', 'nri', 'site visit sunday'] });
    expect(one.fill.locality).toBeUndefined();
    expect(one.fill.assignee).toEqual({ kind: 'new', axUserId: '00000000-0000-4000-8002-000000000002' });
    expect(three.fill.assignee).toBeUndefined();
    // The second merge's notes carry the first's.
    expect(three.fill.notes).toMatch(/^Their own note\n\nMerged from AxLeads: Test Lead 1[\s\S]*Merged from AxLeads: Test Lead 3/);
    expect(p.report.mergeExisting).toBe(2);
    expect(p.report.merged.map((m) => m.phone)).toEqual(['0101', '0101']);
  });

  it('a second run skips what was imported, and only hands a pool lead to someone matched since', () => {
    const imported = new Map([
      ['00000000-0000-4000-9000-000000000001', { clientId: 'c1', assignedToId: null }],
      ['00000000-0000-4000-9000-000000000005', { clientId: 'c5', assignedToId: 'mem-owner' }],
    ]);
    const p = planImport(fresh(), ctx({ imported }), choices(), { now: NOW });
    expect(lead(p, 1)).toMatchObject({ action: 'already', clientId: 'c1', backfill: { kind: 'new' } });
    expect(lead(p, 5)).toMatchObject({ action: 'already', backfill: null });
    expect(p.report).toMatchObject({ already: 2, backfill: 1 });
  });

  it('leaves out leads that answered a skipIfAnswered question (job applicants)', () => {
    const c = choices({ skipIfAnswered: ['Why_Should_We_Hire_You?'] });
    expect(c.skipIfAnswered).toEqual(['why_should_we_hire_you?']);
    expect(answeredAny({ customFields: { 'why_should_we_hire_you?': 'I sell well' } }, c.skipIfAnswered)).toBe(true);
    expect(answeredAny({ customFields: { 'why_should_we_hire_you?': '  ' } }, c.skipIfAnswered)).toBe(false);
    expect(answeredAny({ customFields: { bhk: '3' } }, c.skipIfAnswered)).toBe(false);
    expect(answeredAny({ customFields: null }, c.skipIfAnswered)).toBe(false);
    expect(parseChoices({ skipIfAnswered: 'x' }).ok).toBe(false);
  });

  it('counts and the report', () => {
    expect(plan.report).toMatchObject({ leadsInFile: 7, create: 6, mergeFile: 1, mergeExisting: 0, binned: 1, noPhone: 1, phonesNotMobile: 1 });
    expect(plan.report.perStage).toEqual({ 'Calling 1': 1, Junk: 1, Lost: 1, New: 2, Converted: 1 });
    expect(plan.report.perAssignee).toEqual({ 'Test Agent A (new, invited)': 1, 'Pool (nobody)': 4, 'Hauspire Owner': 1 });
    expect(plan.report.eventsSkipped.scoreUpdates).toBe(1);
    expect(plan.fieldsToCreate.map((f) => f.key)).toEqual(['area_sqft', 'visit_on']);
    expect(plan.leadSourcesToCreate).toEqual(['WhatsApp ads']);
    const text = formatReport(plan.report, { tenant: 'Test Studio', studio: 'test', dryRun: true });
    expect(text).toMatch(/DRY RUN/);
    expect(text).toMatch(/Junk \[LOST\]\s+→ Junk\n/);
    expect(text).toMatch(/Test Agent A .* \+ ADD as SALES, INVITED, …0011 — no invite is sent/);
    expect(text).toMatch(/Test Agent B .* no phone on AxLeads/);
    // No full phone number of a lead in the report.
    expect(text).not.toMatch(/9000000101/);
  });

  it('every history line has a unique id, so a second run writes none twice', () => {
    const ids = plan.leads.flatMap((l) => ('events' in l ? l.events.map((e) => e.externalId) : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('axleads:'))).toBe(true);
  });
});
