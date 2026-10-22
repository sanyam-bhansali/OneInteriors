import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adAttributionFor,
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
  derivePermissions,
  type ImportedRef,
  type SalesRoleRef,
  type StudioMemberRef,
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
    /* The ad is in the attribution columns now (22 Oct 2026), not the notes. */
    expect(l.client.notes).not.toMatch(/test-campaign-1|test-adset-1|test-ad-1|test-meta-form-1|UTM/);
    expect(l.client.ads).toEqual({
      adPlatform: 'instagram',
      /* The fake export's leadgen id is not Meta's digits, so it is not kept as one. */
      leadgenId: null,
      campaignId: 'test-campaign-1',
      campaignName: null,
      adsetId: 'test-adset-1',
      adsetName: null,
      adId: 'test-ad-1',
      adName: null,
      formId: 'test-meta-form-1',
      gclid: null,
      utm: null,
    });
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
    /* Lead 3 had no ad, so the card keeps lead 1's. */
    expect(created(plan, 1).client.ads?.campaignId).toBe('test-campaign-1');
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

  it('ad attribution: Google, WhatsApp ads, nothing, and a real Meta lead (22 Oct 2026)', () => {
    expect(created(plan, 2).client.ads).toMatchObject({ adPlatform: 'google', gclid: 'test-gclid-2', utm: { utm_source: 'google' }, leadgenId: null });
    expect(created(plan, 2).client.notes ?? '').not.toMatch(/gclid|UTM/);
    expect(created(plan, 7).client.ads).toMatchObject({ adPlatform: 'facebook', adId: 'test-ad-7' });
    expect(created(plan, 5).client.ads).toBeNull();
    const meta = adAttributionFor({
      source: 'META_LEAD_AD',
      sourceDetail: { platform: 'fb', raw: { campaign_name: 'Oct kitchens', adset_name: 'PW Pune', ad_name: 'Reel 2' } },
      leadgenId: '1234567890123456',
      gclid: null,
      campaignId: '120200000000000001',
      adsetId: '120200000000000002',
      adId: '120200000000000003',
      formId: '555',
      utm: {},
    });
    expect(meta).toEqual({
      adPlatform: 'facebook',
      leadgenId: '1234567890123456',
      campaignId: '120200000000000001',
      campaignName: 'Oct kitchens',
      adsetId: '120200000000000002',
      adsetName: 'PW Pune',
      adId: '120200000000000003',
      adName: 'Reel 2',
      formId: '555',
      gclid: null,
      utm: null,
    });
    /* A leadgen id on anything but a Meta lead ad is not one. */
    expect(adAttributionFor({ source: 'MANUAL', sourceDetail: null, leadgenId: '1234567890123456', gclid: null, campaignId: null, adsetId: null, adId: null, formId: null, utm: null })).toBeNull();
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
    /* The card had no ad: it takes lead 1's into its columns, and says nothing of it in the merge note. */
    expect(one.fill.ads).toMatchObject({ campaignId: 'test-campaign-1', adPlatform: 'instagram' });
    expect(one.fill.notes ?? '').not.toMatch(/Ad: /);
    const attributed = planImport(fresh(), ctx({ existingByPhone: new Map([['9000000101', { ...existing, attributed: true }]]) }), choices(), { now: NOW });
    const kept = lead(attributed, 1);
    if (kept.action !== 'merge-existing') throw new Error();
    /* A card with its own ad keeps it; the merged lead's is listed in the merge note. */
    expect(kept.fill.ads).toBeUndefined();
    expect(kept.fill.notes).toMatch(/Ad: campaign test-campaign-1 · ad set test-adset-1 · ad test-ad-1 · form test-meta-form-1/);
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

/**
 * The sales team in the roles file (owner, 22 Oct 2026): names, sales roles
 * (a built-in, or a new one copied from another plus permissions), reporting
 * lines and a head's team pool. Invented people only.
 */
describe('the sales team', () => {
  const A = '00000000-0000-4000-8002-000000000002'; // Test Agent A's AxLeads user id
  const B = '00000000-0000-4000-8002-000000000003'; // Test Agent B's
  const BUILT_INS: SalesRoleRef[] = [
    { id: 'role-admin', name: 'Admin', system: 'ADMIN', permissions: { 'leads.view': 'all' } },
    { id: 'role-head', name: 'Sales head', system: 'HEAD', permissions: { 'leads.view': 'team', 'leads.pool': 'team' } },
    { id: 'role-rep', name: 'Sales rep', system: 'REP', permissions: { 'leads.view': 'own', 'leads.edit': 'own', 'leads.pool': 'team' } },
  ];
  /** The worked example in docs/studio-os/AXLEADS-IMPORT.md, on the fake export. */
  const FILE = {
    poolTeam: 'agent.a@axleads.test',
    members: {
      'studio@e2e.test': { salesRole: 'Admin' },
      'agent.a@axleads.test': { name: 'Asha Head', salesRole: 'Sales head' },
      'agent.b@axleads.test': {
        name: 'Khushi Test',
        phone: '9000000012',
        salesRole: 'Sales rep + quotations',
        salesRoleFrom: 'Sales rep',
        addPermissions: ['quotes.build'],
        reportsTo: 'agent.a@axleads.test',
      },
    },
  };
  const bad = (raw: unknown): string | null => {
    const r = parseChoices(raw);
    return r.ok ? null : r.error;
  };
  const one = (m: Record<string, unknown>) => ({ members: { 'a@b.test': m } });

  it('reads the new options', () => {
    const c = choices(FILE);
    expect(c.poolTeam).toBe('agent.a@axleads.test');
    expect(c.members['agent.b@axleads.test']).toMatchObject({
      name: 'Khushi Test',
      salesRole: 'Sales rep + quotations',
      salesRoleFrom: 'Sales rep',
      addPermissions: [{ key: 'quotes.build', reach: null }],
      reportsTo: { key: 'agent.a@axleads.test' },
    });
    expect(choices(one({ reportsTo: '+91 90000 00098' })).members['a@b.test']?.reportsTo).toEqual({ phone: '+919000000098' });
    expect(choices(one({ salesRole: 'R2', salesRoleFrom: 'Sales head', addPermissions: ['leads.view:all'] })).members['a@b.test']?.addPermissions).toEqual([{ key: 'leads.view', reach: 'all' }]);
    expect(choices().poolTeam).toBeNull();
  });

  it('refuses what it cannot read', () => {
    expect(bad(one({ name: 'X' }))).toMatch(/name/);
    expect(bad(one({ salesRole: 'R', salesRoleFrom: 'Sales rep' }))).toMatch(/salesRole/);
    expect(bad(one({ salesRoleFrom: 'Sales rep' }))).toMatch(/needs "salesRole"/);
    expect(bad(one({ salesRole: 'New role', addPermissions: ['quotes.build'] }))).toMatch(/needs "salesRoleFrom"/);
    expect(bad(one({ salesRole: 'New role', salesRoleFrom: 'Sales rep', addPermissions: ['quotes.fly'] }))).toMatch(/not a sales permission/);
    expect(bad(one({ salesRole: 'New role', salesRoleFrom: 'Sales rep', addPermissions: ['quotes.build:team'] }))).toMatch(/takes no reach/);
    expect(bad(one({ salesRole: 'New role', salesRoleFrom: 'Sales rep', addPermissions: ['leads.pool:own'] }))).toMatch(/takes team \/ all/);
    expect(bad(one({ salesRole: 'New role', salesRoleFrom: 'Sales rep', addPermissions: 'quotes.build' }))).toMatch(/list/);
    expect(bad(one({ reportsTo: 'nobody@b.test' }))).toMatch(/neither a key/);
    expect(bad(one({ reportsTo: 'A@B.test' }))).toMatch(/themselves/);
    expect(bad(one({ reportsTo: '12345' }))).toMatch(/neither a key/);
    expect(bad({ poolTeam: 'head@b.test' })).toMatch(/poolTeam/);
    const mixed = {
      members: {
        'a@b.test': { salesRole: 'Mixed', salesRoleFrom: 'Sales rep', addPermissions: ['quotes.build'] },
        'c@b.test': { salesRole: 'mixed', salesRoleFrom: 'Sales head' },
      },
    };
    expect(bad(mixed)).toMatch(/made two different ways/);
    const same = {
      members: {
        'a@b.test': { salesRole: 'Same', salesRoleFrom: 'Sales rep' },
        'c@b.test': { salesRole: 'same', salesRoleFrom: 'sales rep' },
      },
    };
    expect(bad(same)).toBeNull();
  });

  it('a copied role gains permissions and never loses reach', () => {
    expect(derivePermissions({ 'leads.view': 'own' }, [{ key: 'quotes.build', reach: null }])).toEqual({ 'leads.view': 'own', 'quotes.build': true });
    expect(derivePermissions({ 'leads.view': 'team' }, [{ key: 'leads.view', reach: null }])).toEqual({ 'leads.view': 'team' });
    expect(derivePermissions({ 'leads.view': 'own' }, [{ key: 'leads.view', reach: 'all' }])).toEqual({ 'leads.view': 'all' });
    expect(derivePermissions({ 'leads.view': 'all' }, [{ key: 'leads.view', reach: 'own' }])).toEqual({ 'leads.view': 'all' });
  });

  it('the worked example: names, a built-in and a new role, a reporting line, the team pool; the owner gets neither', () => {
    const plan = planImport(fresh(), ctx({ salesRoles: BUILT_INS }), choices(FILE), { now: NOW });
    const st = plan.salesTeam;
    expect(st.problems).toEqual([]);
    expect(st.builtInsMissing).toEqual([]);
    expect(plan.members.find((m) => m.ax.userId === A)).toMatchObject({ kind: 'create', name: 'Asha Head', label: 'Asha Head', role: 'SALES' });
    expect(plan.members.find((m) => m.ax.userId === B)).toMatchObject({ kind: 'create', name: 'Khushi Test', phone: '+919000000012' });
    expect(st.rolesToCreate).toEqual([
      {
        name: 'Sales rep + quotations',
        from: 'Sales rep',
        added: ['quotes.build'],
        permissions: { 'leads.view': 'own', 'leads.edit': 'own', 'leads.pool': 'team', 'quotes.build': true },
      },
    ]);
    expect(st.lines).toEqual([
      {
        axUserId: A,
        who: 'Asha Head',
        member: { kind: 'new', axUserId: A },
        fixedRole: 'SALES',
        salesRole: { name: 'Sales head', isNew: false, change: 'set', was: null },
        reportsTo: null,
      },
      {
        axUserId: B,
        who: 'Khushi Test',
        member: { kind: 'new', axUserId: B },
        fixedRole: 'SALES',
        salesRole: { name: 'Sales rep + quotations', isNew: true, change: 'set', was: null },
        reportsTo: { to: { kind: 'new', axUserId: A }, name: 'Asha Head', change: 'set', was: null },
      },
    ]);
    expect(st.notes).toEqual([expect.stringMatching(/^Test Owner is the owner: owners can do everything/)]);
    expect(st.poolTeam).toEqual({ member: { kind: 'new', axUserId: A }, name: 'Asha Head' });

    // Leads nobody had (2, 7) and the leaver's (6) go to Asha's team pool; Khushi's (4) and Asha's (1) are theirs.
    expect(created(plan, 2).client.poolTeam).toEqual({ kind: 'new', axUserId: A });
    expect(created(plan, 6).client.poolTeam).toEqual({ kind: 'new', axUserId: A });
    expect(created(plan, 7).client.poolTeam).toEqual({ kind: 'new', axUserId: A });
    expect(created(plan, 4).client).toMatchObject({ assignee: { kind: 'new', axUserId: B }, poolTeam: null });
    expect(created(plan, 1).client).toMatchObject({ assignee: { kind: 'new', axUserId: A }, poolTeam: null });
    expect(plan.report.perPool).toEqual({ 'Asha Head’s team pool': 3 });

    const text = formatReport(plan.report, { tenant: 'Test Studio', studio: 'test', dryRun: true });
    expect(text).toMatch(/Asha Head <agent\.a@axleads\.test> \[AGENT\]\s+\+ ADD as SALES/);
    expect(text).toMatch(/\n {8}sales role: Sales head\n {8}team pool: gets the leads nobody had/);
    expect(text).toMatch(/Khushi Test <agent\.b@axleads\.test>[^\n]*\n {8}sales role: Sales rep \+ quotations \(new role\)\n {8}reports to: Asha Head\n/);
    expect(text).toMatch(/Sales role to make: Sales rep \+ quotations — a copy of Sales rep plus quotes\.build/);
    expect(text).toMatch(/Note: Test Owner is the owner/);
    expect(text).toMatch(/New cards nobody has, per pool:\n\s+Asha Head’s team pool\s+3/);
    expect(text).not.toMatch(/✗ The roles file/);
  });

  it('without a poolTeam, pool leads stay in the studio pool; a plain file touches no sales roles', () => {
    const plan = planImport(fresh(), ctx(), choices(), { now: NOW });
    expect(plan.salesTeam).toMatchObject({ uses: false, builtInsMissing: [], rolesToCreate: [], lines: [], poolTeam: null, problems: [] });
    expect(created(plan, 2).client.poolTeam).toBeNull();
    expect(plan.report.perPool).toEqual({ 'Studio pool': 4 });
  });

  it('a studio that predates the built-ins: they are planned first and can be named', () => {
    const plan = planImport(fresh(), ctx({ salesRoles: undefined }), choices(FILE), { now: NOW });
    expect(plan.salesTeam.builtInsMissing).toEqual(['Admin', 'Sales head', 'Sales rep']);
    expect(plan.salesTeam.problems).toEqual([]);
    expect(plan.salesTeam.rolesToCreate[0]?.permissions).toMatchObject({ 'leads.view': 'own', 'quotes.build': true });
    expect(formatReport(plan.report, { tenant: 'T', studio: 's', dryRun: true })).toMatch(/Sales roles this studio does not have yet, made first: Admin, Sales head, Sales rep/);
  });

  it('what cannot be done is a problem, and the reasons are said', () => {
    const problems = (file: unknown, over: Partial<StudioContext> = {}) => planImport(fresh(), ctx({ salesRoles: BUILT_INS, ...over }), choices(file), { now: NOW }).salesTeam.problems;
    const A_KEY = 'agent.a@axleads.test';
    expect(problems({ members: { [A_KEY]: { salesRole: 'Closer' } } })).toEqual([expect.stringMatching(/"Closer" is not a sales role here.*salesRoleFrom/)]);
    expect(problems({ members: { [A_KEY]: { salesRole: 'Closer', salesRoleFrom: 'Boss' } } })).toEqual([expect.stringMatching(/"Boss" \(salesRoleFrom\) is not a sales role here/)]);
    // A leaver cannot be anybody's boss, nor have a pool.
    expect(problems({ members: { [A_KEY]: { reportsTo: 'gone@axleads.test' }, 'gone@axleads.test': {} } })).toEqual([
      expect.stringMatching(/Test Agent A: reportsTo Test Gone, who is not added here \(they left AxLeads\)/),
    ]);
    expect(problems({ poolTeam: 'gone@axleads.test', members: { 'gone@axleads.test': {} } })).toEqual([expect.stringMatching(/poolTeam: Test Gone is not added here/)]);
    // The owner's pool is the studio pool; a designer heads no team.
    expect(problems({ poolTeam: 'studio@e2e.test', members: { 'studio@e2e.test': {} } })).toEqual([expect.stringMatching(/owner's pool is the studio pool/)]);
    expect(problems({ poolTeam: A_KEY, members: { [A_KEY]: { role: 'DESIGNER' } } })).toEqual([expect.stringMatching(/DESIGNER; a team pool belongs to a salesperson/)]);
    // A loop, in file order: the second line is refused.
    const loop = { members: { [A_KEY]: { reportsTo: 'agent.b@axleads.test' }, 'agent.b@axleads.test': { phone: '9000000012', reportsTo: A_KEY } } };
    expect(problems(loop)).toEqual([expect.stringMatching(/Test Agent B: cannot report to Test Agent A: That would make a loop/)]);
    // A boss by phone must be a salesperson of this studio.
    const pm: StudioMemberRef = { id: 'mem-pm', name: 'Test PM', role: 'PM', status: 'ACTIVE', phone: '+919000000098', email: null };
    expect(problems({ members: { [A_KEY]: { reportsTo: '9000000098' } } }, { members: [...ctx().members, pm] })).toEqual([expect.stringMatching(/A salesperson reports to another salesperson/)]);
    expect(problems({ members: { [A_KEY]: { reportsTo: '9000000097' } } })).toEqual([expect.stringMatching(/…0097 is not anyone on this studio's team/)]);
    const plan = planImport(fresh(), ctx({ salesRoles: BUILT_INS }), choices({ members: { [A_KEY]: { salesRole: 'Closer' } } }), { now: NOW });
    expect(formatReport(plan.report, { tenant: 'T', studio: 's', dryRun: true })).toMatch(/✗ The roles file asks for something that cannot be done\. Nothing is written until it is fixed:\n {4}✗ Test Agent A: "Closer"/);
  });

  it('not a salesperson, or not added: the sales options are left out with a note, not refused', () => {
    const file = {
      members: {
        'agent.a@axleads.test': { role: 'DESIGNER', salesRole: 'Sales rep' },
        'agent.b@axleads.test': { salesRole: 'Sales rep' },
        'gone@axleads.test': { reportsTo: 'agent.a@axleads.test' },
      },
    };
    const plan = planImport(fresh(), ctx({ salesRoles: BUILT_INS }), choices(file), { now: NOW });
    expect(plan.salesTeam.problems).toEqual([]);
    expect(plan.salesTeam.lines).toEqual([]);
    expect(plan.salesTeam.notes).toEqual([
      expect.stringMatching(/^Test Agent A is DESIGNER: sales roles and reporting lines are for salespeople/),
      expect.stringMatching(/^Test Agent B: not added here \(no phone\)/),
      expect.stringMatching(/^Test Gone: not added here \(they left AxLeads\)/),
    ]);
  });

  it('a reporting line to someone already on the team, by phone', () => {
    const head: StudioMemberRef = { id: 'mem-lead', name: 'Test Team Lead', role: 'SALES', status: 'ACTIVE', phone: '+919000000098', email: null };
    const plan = planImport(fresh(), ctx({ salesRoles: BUILT_INS, members: [...ctx().members, head] }), choices({ members: { 'agent.a@axleads.test': { reportsTo: '9000000098' } } }), { now: NOW });
    expect(plan.salesTeam.lines[0]?.reportsTo).toEqual({ to: { kind: 'existing', id: 'mem-lead' }, name: 'Test Team Lead', change: 'set', was: null });
  });

  describe('running it again', () => {
    const existing = (over: Partial<StudioMemberRef> = {}): StudioMemberRef[] => [
      ...ctx().members,
      { id: 'mem-a', name: 'Asha Head', role: 'SALES', status: 'INVITED', phone: '+919000000011', email: null, salesRoleId: 'role-head', reportsToId: null },
      { id: 'mem-b', name: 'Khushi Test', role: 'SALES', status: 'INVITED', phone: '+919000000012', email: null, salesRoleId: 'role-repq', reportsToId: 'mem-a', ...over },
    ];
    const roles: SalesRoleRef[] = [...BUILT_INS, { id: 'role-repq', name: 'Sales rep + quotations', system: null, permissions: { 'leads.view': 'own', 'quotes.build': true } }];

    it('changes nothing that is already as the file says, and says so', () => {
      const plan = planImport(fresh(), ctx({ salesRoles: roles, members: existing() }), choices(FILE), { now: NOW });
      const st = plan.salesTeam;
      expect(st.problems).toEqual([]);
      expect(st.rolesToCreate).toEqual([]);
      expect(st.lines.map((l) => [l.who, l.salesRole?.change, l.reportsTo?.change ?? null])).toEqual([
        ['Asha Head', 'same', null],
        ['Khushi Test', 'same', 'same'],
      ]);
      expect(st.notes).toContainEqual(expect.stringMatching(/"Sales rep \+ quotations" is already a role here, so salesRoleFrom \/ addPermissions are not used/));
      expect(formatReport(plan.report, { tenant: 'T', studio: 's', dryRun: true })).toMatch(/sales role: Sales rep \+ quotations \(unchanged\)\n {8}reports to: Asha Head \(unchanged\)/);
    });

    it('changes only what the file names, and reports what it was', () => {
      const plan = planImport(fresh(), ctx({ salesRoles: roles, members: existing({ salesRoleId: 'role-rep', reportsToId: null }) }), choices(FILE), { now: NOW });
      const khushi = plan.salesTeam.lines.find((l) => l.who === 'Khushi Test')!;
      expect(khushi.salesRole).toEqual({ name: 'Sales rep + quotations', isNew: false, change: 'changed', was: 'Sales rep' });
      expect(khushi.reportsTo).toMatchObject({ to: { kind: 'existing', id: 'mem-a' }, change: 'set' });
      expect(formatReport(plan.report, { tenant: 'T', studio: 's', dryRun: true })).toMatch(/sales role: Sales rep \+ quotations \(was Sales rep\)/);
      // A file that names no sales role for Asha leaves hers alone.
      const quiet = planImport(fresh(), ctx({ salesRoles: roles, members: existing() }), choices({ members: { 'agent.a@axleads.test': {} } }), { now: NOW });
      expect(quiet.salesTeam.lines).toEqual([]);
    });

    it('moves an imported card to the team pool only while nobody has it and nobody has touched it', () => {
      const id = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
      const imported = new Map<string, ImportedRef>([
        [id(2), { clientId: 'c2', assignedToId: null, poolTeamId: null, fromImport: true, touched: false }],
        [id(7), { clientId: 'c7', assignedToId: null, poolTeamId: null, fromImport: true, touched: true }],
        [id(6), { clientId: 'c6', assignedToId: null, poolTeamId: 'mem-a', fromImport: true, touched: false }],
        // Merged into a card that was already on the board: not the import's to pool.
        [id(3), { clientId: 'c1', assignedToId: null, poolTeamId: null, fromImport: false, touched: false }],
        // Somebody has it now.
        [id(5), { clientId: 'c5', assignedToId: 'mem-owner', poolTeamId: null, fromImport: true, touched: false }],
      ]);
      const plan = planImport(fresh(), ctx({ salesRoles: roles, members: existing(), imported }), choices(FILE), { now: NOW });
      expect(lead(plan, 2)).toMatchObject({ action: 'already', pool: { kind: 'existing', id: 'mem-a' } });
      expect(lead(plan, 7)).toMatchObject({ action: 'already', pool: null });
      expect(lead(plan, 6)).toMatchObject({ action: 'already', pool: null });
      expect(lead(plan, 3)).toMatchObject({ action: 'already', pool: null });
      expect(lead(plan, 5)).toMatchObject({ action: 'already', pool: null });
      expect(plan.report).toMatchObject({ poolMoves: 1, poolLeftTouched: 1, poolAlready: 1 });
      expect(formatReport(plan.report, { tenant: 'T', studio: 's', dryRun: true })).toMatch(
        /now for Asha Head’s team pool: 1 moved there, 1 left where they are \(worked since the import\), 1 there already/,
      );
    });
  });
});
