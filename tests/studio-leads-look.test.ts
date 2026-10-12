import { describe, expect, it } from 'vitest';
import { leadFiltersToQuery, parseLeadFilters, SORT_MENU, SORT_LABELS } from '@/modules/studio-sales/lead-filters';
import { clockAt, keysetWhere, kpiRules, leadWhere, orderByFor, scopedLeadWhere, type ScopeLike } from '@/modules/studio-sales/lead-where';
import { bhk, cardFacts, coldDays, coldLabel, columnChoices, columnValue, dayLabel, dueBadge, initials, inr, isNewToday, readColumns, relTime, DEFAULT_COLUMNS, type LeadView } from '@/modules/studio-sales/lead-view';
import { addTags, MAX_TAGS, removeTag, suggestTags } from '@/modules/studio-sales/tag-rules';
import { HAUSPIRE_PIPELINE, planPreset, presetSummary, type ExistingStage } from '@/modules/studio-practice/pipeline-preset';
import { leadsVisibleTo, poolVisibleTo, type StudioRoleName } from '@/modules/studio/roles';

/** The AxLeads look for the Leads tab (owner, 12 Oct 2026): docs/studio-os/LEADS-SCALE-BUILT.md. */

const ist = (day: string, hm: string) => new Date(Date.parse(`${day}T${hm}:00Z`) - 330 * 60_000);
const NOW = ist('2026-10-12', '10:00'); // Monday

describe('the KPI cards, AxLeads rules for our tables', () => {
  const r = kpiRules(clockAt(NOW));

  it('callbacks are open leads with a follow-up; overdue ones are past now', () => {
    expect(r.callbacks).toEqual({ AND: [{ stage: { kind: { in: ['OPEN', 'WON'] } } }, { nextActionOn: { not: null } }] });
    expect(r.overdue).toEqual({ AND: [{ stage: { kind: { in: ['OPEN', 'WON'] } } }, { nextActionOn: { lt: NOW } }] });
  });

  it('tasks are open StudioTasks on open leads; needs action is an overdue call or task', () => {
    expect(r.tasks).toEqual({ AND: [{ stage: { kind: { in: ['OPEN', 'WON'] } } }, { tasks: { some: { doneAt: null } } }] });
    expect(JSON.stringify(r.overdueTasks)).toContain('"dueAt":{"lt"');
    expect(r.needs).toEqual({ AND: [{ stage: { kind: { in: ['OPEN', 'WON'] } } }, { OR: [{ nextActionOn: { lt: NOW } }, { tasks: { some: { doneAt: null, dueAt: { lt: NOW } } } }] }] });
  });

  it('pending is untouched: intake column, nothing scheduled, never called, no task, no line beyond created/assigned', () => {
    expect(r.pending).toEqual({
      AND: [{ stage: { isIntake: true } }, { nextActionOn: null, lastContactedAt: null }, { tasks: { none: {} } }, { events: { none: { kind: { notIn: ['CREATED', 'ASSIGNED'] } } } }],
    });
  });

  it('converted is a won or finished column; new today is IST midnight on', () => {
    expect(r.converted).toEqual({ stage: { kind: { in: ['WON', 'DONE'] } } });
    expect(r.newToday).toEqual({ createdAt: { gte: new Date('2026-10-11T18:30:00.000Z') } });
  });

  it('today = calls due today, tasks due today, or new today and untouched — never the overdue backlog', () => {
    const t = JSON.stringify(r.today);
    const day = '{"gte":"2026-10-11T18:30:00.000Z","lte":"2026-10-12T18:29:59.999Z"}';
    expect(t).toContain(`"nextActionOn":${day}`);
    expect(t).toContain(`"dueAt":${day}`);
    expect(t).toContain('"isIntake":true');
    // Nothing in Today is bounded only from above (that would sweep in every overdue call and task).
    expect(t).not.toMatch(/"(nextActionOn|dueAt)":\{"lte"/);
  });

  it('a card is a filter (?kpi=) the list and board both read, and survives the URL', () => {
    expect(parseLeadFilters(new URLSearchParams('kpi=callbacks'))).toEqual({ kpi: 'callbacks' });
    expect(parseLeadFilters(new URLSearchParams('kpi=evil'))).toEqual({});
    expect(leadFiltersToQuery({ kpi: 'needs' })).toBe('kpi=needs');
    expect((leadWhere({ kpi: 'pending' }, NOW) as { AND: unknown[] }).AND).toContainEqual(r.pending);
  });

  it('a salesperson’s cards count their own leads only (or the pool, when asked)', () => {
    const sales = { id: 'm-asha', studioId: 's1', role: 'SALES' as StudioRoleName, status: 'ACTIVE' as const };
    const scope: ScopeLike = { studioId: 's1', member: { id: 'm-asha' }, leads: leadsVisibleTo(sales), pool: poolVisibleTo(sales), seesAll: false };
    const w = scopedLeadWhere(scope, { kpi: 'callbacks', owner: 'm-ravi' }, NOW, { deletedAt: null, isDemo: false }) as { AND: unknown[] };
    expect(w.AND[0]).toEqual({ studioId: 's1', assignedToId: 'm-asha' });
    expect(JSON.stringify(w)).not.toContain('m-ravi');
  });
});

describe('sorts (AxLeads: Most recent, Oldest first, Last active, Next call)', () => {
  it('offers the four, and Last active pages by the last change', () => {
    expect(SORT_MENU.map((s) => SORT_LABELS[s])).toEqual(['Most recent', 'Oldest first', 'Last active', 'Next call']);
    expect(orderByFor('lastactive')).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
    const at = '2026-10-01T00:00:00.000Z';
    expect(keysetWhere('lastactive', { v: at, id: 'c9' })).toEqual({ OR: [{ updatedAt: { lt: new Date(at) } }, { updatedAt: new Date(at), id: { lt: 'c9' } }] });
  });

  it('tags filter is "any of", and the Due panel buckets are AxLeads’', () => {
    expect((leadWhere({ tags: ['hot', 'NRI'] }, NOW) as { AND: unknown[] }).AND).toContainEqual({ tags: { hasSome: ['hot', 'NRI'] } });
    const due = leadWhere({ due: ['overdue', 'week'] }, NOW) as { AND: unknown[] };
    expect(due.AND).toContainEqual({ OR: [{ nextActionOn: { lt: NOW } }, { nextActionOn: { lte: new Date(Date.parse('2026-10-11T18:30:00.000Z') + 8 * 86_400_000 - 1) } }] });
  });
});

const lead = (over: Partial<LeadView> = {}): LeadView => ({
  id: 'l1',
  name: 'Priya Mehta',
  phone: '9876543210',
  society: 'Kumar Prospera',
  locality: 'Baner',
  city: null,
  config: '2 bhk',
  budgetPaise: 1_500_000_00,
  source: 'INSTAGRAM',
  sourceName: null,
  stageId: 's1',
  stageName: 'New',
  stageColour: 'blue',
  stageKind: 'OPEN',
  assignedToId: null,
  assignedToName: null,
  createdAt: ist('2026-09-20', '10:00'),
  updatedAt: ist('2026-09-21', '10:00'),
  lastActivityAt: ist('2026-09-24', '10:00'),
  lastContactedAt: null,
  nextAction: null,
  nextActionOn: null,
  tags: [],
  latestNote: null,
  noteCount: 0,
  fields: { possession_month: 'Mar 2027', wing: 'B' },
  isDemo: false,
  flags: { stale: true, closed: false },
  ...over,
});

describe('a card and a row read as AxLeads’ do', () => {
  it('the next-call badge: Overdue Nd, Overdue, Today 3:30 PM, Tomorrow, 15 Thu, Oct 30', () => {
    expect(dueBadge(ist('2026-10-09', '15:00'), NOW)).toEqual({ bucket: 'overdue', label: 'Overdue 3d' });
    expect(dueBadge(ist('2026-10-12', '09:00'), NOW)).toEqual({ bucket: 'overdue', label: 'Overdue' });
    expect(dueBadge(ist('2026-10-12', '15:30'), NOW)).toEqual({ bucket: 'today', label: 'Today 3:30 PM' });
    expect(dueBadge(ist('2026-10-13', '15:30'), NOW)).toEqual({ bucket: 'tomorrow', label: 'Tomorrow' });
    expect(dueBadge(ist('2026-10-15', '10:00'), NOW)).toEqual({ bucket: 'week', label: '15 Thu' });
    expect(dueBadge(ist('2026-10-30', '10:00'), NOW)).toEqual({ bucket: 'later', label: 'Oct 30' });
    expect(dueBadge(null, NOW)).toBeNull();
  });

  it('cold: days since anything happened, shown when the SQL called it stale', () => {
    expect(coldDays(lead(), NOW)).toBe(18);
    expect(coldLabel(lead(), NOW)).toBe('18d cold');
    expect(coldLabel(lead({ flags: { stale: false, closed: false } }), NOW)).toBeNull();
    expect(isNewToday(ist('2026-10-12', '00:10'), NOW)).toBe(true);
    expect(isNewToday(ist('2026-10-11', '23:50'), NOW)).toBe(false);
  });

  it('the facts line, the budget in lakhs, BHK, initials', () => {
    expect(cardFacts(lead())).toBe('2BHK · ₹15L');
    expect(inr(12_000_000_00)).toBe('₹1.2Cr');
    expect(inr(8_000_000)).toBe('₹80K');
    expect(inr(null)).toBeNull();
    expect(bhk('3 BHK + study')).toBe('3BHK+STUDY');
    expect(bhk('Villa')).toBe('Villa');
    expect(initials('Priya Mehta')).toBe('PM');
    expect(initials('Sample — Anita Kulkarni')).toBe('AK');
    expect(initials('')).toBeNull();
  });

  it('three swappable columns: Timeline, Notes, Last active by default; custom fields offered; unknown choices fall back', () => {
    const choices = columnChoices([{ key: 'wing', label: 'Wing' }]);
    expect(choices.map((c) => c.label)).toEqual(['Timeline', 'Notes', 'Last active', 'Created', 'City', 'Locality', 'Source', 'Wing']);
    expect(readColumns(null, choices)).toEqual([...DEFAULT_COLUMNS]);
    expect(readColumns(['cf:wing', 'evil', 'created'], choices)).toEqual(['cf:wing', 'notes', 'created']);
    expect(columnValue(lead(), 'timeline', NOW)).toBe('Mar 2027');
    expect(columnValue(lead(), 'cf:wing', NOW)).toBe('B');
    expect(columnValue(lead(), 'source', NOW)).toBe('Instagram');
    expect(columnValue(lead(), 'lastactive', NOW)).toBe('24 Sep');
    expect(relTime(new Date(NOW.getTime() - 3 * 3_600_000), NOW)).toBe('3h ago');
    expect(dayLabel(ist('2026-10-01', '00:30'))).toBe('1 Oct');
  });
});

describe('tags (AxLeads): no duplicates in any case, at most 20', () => {
  it('adds cleaned tags once, keeping the first spelling', () => {
    expect(addTags(['hot'], ['Hot', '  NRI  lead ', ''])).toEqual({ tags: ['hot', 'NRI lead'], refused: null });
    expect(removeTag(['hot', 'NRI'], 'HOT')).toEqual(['NRI']);
  });

  it('refuses the 21st', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(addTags(full, ['one more']).refused).toContain('20');
    expect(addTags(full, ['T0']).refused).toBeNull();
  });

  it('suggests the studio’s tags as you type, starts-with first', () => {
    expect(suggestTags(['Baner', 'urban', 'hot', 'Banaras'], 'ban', ['Banaras'])).toEqual(['Baner', 'urban']);
  });
});

describe('Use the Hauspire pipeline', () => {
  const existing: ExistingStage[] = [
    { id: 'a', name: 'Enquiry', kind: 'OPEN', isIntake: true, sortOrder: 0 },
    { id: 'b', name: 'Quoted', kind: 'OPEN', isIntake: false, sortOrder: 1 },
    { id: 'c', name: 'Booked', kind: 'WON', isIntake: false, sortOrder: 2 },
    { id: 'd', name: 'Handed over', kind: 'DONE', isIntake: false, sortOrder: 3 },
    { id: 'e', name: 'Lost', kind: 'LOST', isIntake: false, sortOrder: 4 },
  ];

  it('renames intake to New and the first won column to Converted, keeps Lost, adds the rest — deletes nothing', () => {
    const plan = planPreset(existing);
    expect(plan.renames).toEqual([
      { id: 'a', from: 'Enquiry', to: 'New' },
      { id: 'c', from: 'Booked', to: 'Converted' },
    ]);
    expect(plan.creates.map((c) => c.name)).toEqual(HAUSPIRE_PIPELINE.map((p) => p.name).filter((n) => !['New', 'Converted', 'Lost'].includes(n)));
    expect(plan.order.slice(0, 2)).toEqual(['a', 'new:Calling 1']);
    // Your own columns it does not know stay, after the preset's.
    expect(plan.order.slice(-2)).toEqual(['b', 'd']);
    expect(plan.order).toContain('e');
    expect(plan.intake).toBe('a');
    expect(presetSummary(plan)).toContain('Nothing is deleted');
  });

  it('applied twice changes nothing but the order', () => {
    const named: ExistingStage[] = HAUSPIRE_PIPELINE.map((p, i) => ({ id: `s${i}`, name: p.name, kind: p.kind, isIntake: !!p.isIntake, sortOrder: 100 - i }));
    const plan = planPreset(named);
    expect(plan.renames).toEqual([]);
    expect(plan.creates).toEqual([]);
    expect(plan.order).toEqual(named.map((s) => s.id));
  });

  it('matches by name in any case', () => {
    const plan = planPreset([{ id: 'x', name: 'quotation shared', kind: 'OPEN', isIntake: true, sortOrder: 0 }]);
    expect(plan.order[HAUSPIRE_PIPELINE.findIndex((p) => p.name === 'Quotation Shared')]).toBe('x');
    // The intake column took a preset name, so "New" is created and becomes the intake.
    expect(plan.intake).toBe('new:New');
  });
});
