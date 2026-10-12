import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLeadFilters, staleReviewQuery } from '@/modules/studio-sales/lead-filters';
import { kpiRules, clockAt, leadWhere } from '@/modules/studio-sales/lead-where';
import { boardColumnPlan, claimableView, seesFullLead, type LeadView } from '@/modules/studio-sales/lead-view';

/** The leads review fixes (12 Oct 2026): each test names the bug it pins. */

const ist = (day: string, hm: string) => new Date(Date.parse(`${day}T${hm}:00Z`) - 330 * 60_000);
const NOW = ist('2026-10-12', '10:00');

describe('Today is due today only (it was counting the whole overdue backlog)', () => {
  const r = kpiRules(clockAt(NOW));
  it('a call due yesterday is Needs action, not Today; one due this evening is Today', () => {
    const t = JSON.stringify(r.today);
    expect(t).toContain('"gte":"2026-10-11T18:30:00.000Z"');
    expect(JSON.stringify(r.needs)).toContain('"lt":"2026-10-12T04:30:00.000Z"');
  });
  it('the kpi=today list filter is the same rule the button counts', () => {
    expect((leadWhere({ kpi: 'today' }, NOW) as { AND: unknown[] }).AND).toContainEqual(r.today);
  });
});

describe('the stale review works on the leads the banner counted', () => {
  it('keeps the page filters, drops the KPI card, adds Cold 7d+ and the longest-silent sort', () => {
    const q = staleReviewQuery('owner=m1&source=FACEBOOK&kpi=today&tag=hot');
    const p = new URLSearchParams(q);
    expect(parseLeadFilters(p)).toEqual({ owner: 'm1', source: ['FACEBOOK'], tags: ['hot'], stale: true });
    expect(p.get('sort')).toBe('contacted');
  });
  it('with no filters it is the whole of the person\'s stale leads', () => {
    expect(staleReviewQuery('')).toBe('stale=1&sort=contacted');
  });
});

const lead = (over: Partial<LeadView> = {}): LeadView => ({
  id: 'l1',
  name: 'Asha',
  phone: '9876543210',
  society: 'Palm Grove',
  locality: 'Baner',
  city: 'Pune',
  config: '2 BHK',
  budgetPaise: 1_500_000_00,
  source: 'FACEBOOK' as LeadView['source'],
  sourceName: null,
  stageId: 's1',
  stageName: 'New',
  stageColour: 'green',
  stageKind: 'OPEN',
  assignedToId: null,
  assignedToName: null,
  createdAt: NOW,
  updatedAt: NOW,
  lastActivityAt: null,
  lastContactedAt: null,
  nextAction: 'Call about the kitchen',
  nextActionOn: NOW,
  tags: ['hot'],
  latestNote: 'Husband wants walnut',
  noteCount: 3,
  fields: { possession: 'Dec' },
  isDemo: false,
  flags: { stale: false, closed: false },
  ...over,
});

describe('a salesperson sees a pool lead without its phone, notes or fields until claimed', () => {
  const sales = { seesAll: false, member: { id: 'me' } };
  const owner = { seesAll: true, member: { id: 'boss' } };
  it('owner and PM see every lead whole; a salesperson only their own', () => {
    expect(seesFullLead(owner, { assignedToId: null })).toBe(true);
    expect(seesFullLead(sales, { assignedToId: 'me' })).toBe(true);
    expect(seesFullLead(sales, { assignedToId: null })).toBe(false);
    expect(seesFullLead(sales, { assignedToId: 'colleague' })).toBe(false);
  });
  it('the claimable view keeps what a claim needs and nothing private', () => {
    const v = claimableView(lead());
    expect(v).toMatchObject({ name: 'Asha', society: 'Palm Grove', stageName: 'New', tags: ['hot'] });
    expect(v.phone).toBeNull();
    expect(v.latestNote).toBeNull();
    expect(v.noteCount).toBe(0);
    expect(v.nextAction).toBeNull();
    expect(v.fields).toEqual({});
  });
});

describe('the board: the stage filter picks columns; won, finished and lost wait until opened', () => {
  const stages = [
    { id: 'new', kind: 'OPEN' },
    { id: 'quoted', kind: 'OPEN' },
    { id: 'won', kind: 'WON' },
    { id: 'done', kind: 'DONE' },
    { id: 'lost', kind: 'LOST' },
  ];
  it('no filter: every column, open ones loaded, closed ones lazy', () => {
    const p = boardColumnPlan(stages);
    expect(p.shown.map((s) => s.id)).toEqual(['new', 'quoted', 'won', 'done', 'lost']);
    expect(p.eager).toEqual(['new', 'quoted']);
    expect(p.lazy).toEqual(['won', 'done', 'lost']);
  });
  it('a stage filter shows only those columns, in pipeline order', () => {
    const p = boardColumnPlan(stages, ['lost', 'quoted']);
    expect(p.shown.map((s) => s.id)).toEqual(['quoted', 'lost']);
    expect(p.eager).toEqual(['quoted']);
    expect(p.lazy).toEqual(['lost']);
  });
  it('a filter naming no column of this studio shows the whole board', () => {
    expect(boardColumnPlan(stages, ['gone']).shown).toHaveLength(5);
  });
});

describe('source guards', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('lead-filters.ts (imported by the browser) carries no Prisma value', () => {
    const src = read('src/modules/studio-sales/lead-filters.ts');
    expect(src).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+'@prisma\/client'/m);
    expect(src).not.toMatch(/^import\s+'server-only'/m);
  });
  it('the where-builders are server only', () => {
    expect(read('src/modules/studio-sales/lead-where.ts')).toMatch(/^import 'server-only';/);
  });
  it('a claim records only the rows its own UPDATE took (no "claimed by" on a colleague\'s win)', () => {
    const src = read('src/modules/studio-sales/bulk.ts');
    expect(src).toMatch(/RETURNING id/);
    expect(src).toMatch(/taken\.map\(\(clientId\)/);
  });
  it('a bulk follow-up leaves a timeline line per lead', () => {
    const body = read('src/modules/studio-sales/bulk.ts').split('export async function bulkFollowUp')[1]!.split('export async function')[0]!;
    expect(body).toMatch(/recordMany\(/);
  });
  it('the Needs action card shows the distinct-lead count the list filters by', () => {
    expect(read('src/app/studio/clients/LeadsControls.tsx')).toMatch(/const needs = kpis\.needs;/);
  });
  it('a salesperson\'s tag suggestions are fenced to their own leads and the pool', () => {
    const body = read('src/modules/studio-sales/lead-extras.ts').split('export async function studioTags')[1]!.split('export async function')[0]!;
    expect(body).toMatch(/assignedToId" = \$\{scope\.member\.id\}/);
  });
});
