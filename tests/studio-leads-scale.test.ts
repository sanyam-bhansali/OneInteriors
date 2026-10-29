import { describe, expect, it } from 'vitest';
import { parseRange, rangeBounds, rangeLabel, rangeToString, istDayStart } from '@/modules/studio-sales/ist-range';
import { cursorOf, describeFilters, leadFiltersToQuery, leadsHref, parseCursor, parseLeadFilters, parseSort } from '@/modules/studio-sales/lead-filters';
import { keysetWhere, leadWhere, orderByFor, scopedLeadWhere, type ScopeLike } from '@/modules/studio-sales/lead-where';
import { bulkActionsFor, bulkFence, chunks, mayBulk, readLimit, splitEvenly, splitSentence } from '@/modules/studio-sales/bulk-rules';
import { mayAssignTaskTo, mayChangeTask, readTask, seesAllTasks, tasksVisibleTo } from '@/modules/studio-sales/task-rules';
import { buildCalendarItems, calendarWindow, followupAt, itemsByDay, shiftDay, timeLabel, windowTitle } from '@/modules/studio-sales/calendar-rules';
import { conversion, newLeadKpis, nowKpis, personColumns, rangeKpis } from '@/modules/studio-sales/dashboard-rules';
import { buildToday, type TodayLead } from '@/modules/studio-sales/today-rules';
import { can, leadsVisibleTo, poolVisibleTo, type StudioRoleName } from '@/modules/studio/roles';
import { mayOpen } from '@/modules/studio/surfaces';
import { cleanFilters, describe as describeView } from '@/modules/studio-practice/view-filters';
import { csvChunks, parseCsv, toCsv } from '@/modules/studio-practice/csv';

/** Leads at scale (12 Oct 2026): docs/studio-os/LEADS-SCALE-BUILT.md. */

const NOW = new Date('2026-10-12T04:30:00Z'); // Mon 12 Oct, 10:00 IST
const member = (role: StudioRoleName, id = `m-${role.toLowerCase()}`) => ({ id, studioId: 's1', role, status: 'ACTIVE' as const });
const scopeOf = (role: StudioRoleName, id?: string): ScopeLike => {
  const m = member(role, id);
  return { studioId: 's1', member: { id: m.id }, leads: leadsVisibleTo(m), pool: poolVisibleTo(m), seesAll: role !== 'SALES' };
};
const LIVE = { deletedAt: null, isDemo: false } as const;

// ── India days ───────────────────────────────────────────────────

describe('date ranges in India days', () => {
  it('reads presets and custom spans, and drops nonsense', () => {
    expect(parseRange('today')).toBe('today');
    expect(parseRange('2026-10-01..2026-10-12')).toEqual({ from: '2026-10-01', to: '2026-10-12' });
    expect(parseRange('2026-10-12..2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-12' });
    expect(parseRange('2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    for (const bad of ['', 'yesteryear', '2026-02-30', '2026-10-01..x', undefined, 7]) expect(parseRange(bad)).toBeNull();
    expect(rangeToString({ from: '2026-10-01', to: '2026-10-12' })).toBe('2026-10-01..2026-10-12');
  });

  it('today runs IST midnight to midnight', () => {
    const b = rangeBounds('today', NOW) as { gte: Date; lte: Date };
    expect(b.gte.toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(b.lte.toISOString()).toBe('2026-10-12T18:29:59.999Z');
  });

  it('a late-night instant UTC is already tomorrow in India', () => {
    const lateUtc = new Date('2026-10-12T20:00:00Z'); // 01:30 IST on the 13th
    expect((rangeBounds('today', lateUtc) as { gte: Date }).gte.toISOString()).toBe('2026-10-12T18:30:00.000Z');
  });

  it('7 days includes today; the week is Monday to Sunday; the month is the calendar month', () => {
    expect((rangeBounds('7d', NOW) as { gte: Date }).gte.toISOString()).toBe(istDayStart('2026-10-06').toISOString());
    const week = rangeBounds('week', NOW) as { gte: Date; lte: Date };
    expect(week.gte.toISOString()).toBe(istDayStart('2026-10-12').toISOString());
    expect(week.lte.toISOString()).toBe('2026-10-18T18:29:59.999Z');
    const month = rangeBounds('month', NOW) as { gte: Date; lte: Date };
    expect(month.gte.toISOString()).toBe(istDayStart('2026-10-01').toISOString());
    expect(month.lte.toISOString()).toBe('2026-10-31T18:29:59.999Z');
    expect(rangeBounds('any', NOW)).toEqual({ gte: new Date(0) });
    expect(rangeLabel({ from: '2026-10-01', to: '2026-10-12' })).toBe('1 Oct – 12 Oct');
  });
});

// ── Filters in the URL ───────────────────────────────────────────

describe('lead filters in the URL', () => {
  it('round-trip in a fixed order, dropping what they do not know', () => {
    const f = parseLeadFilters(new URLSearchParams('due=missed&source=FACEBOOK&owner=pool&never=1&added=7d&evil=1&kind=nope&lost=BUDGET&q=  Mehta '));
    expect(f).toEqual({ q: 'Mehta', source: ['FACEBOOK'], owner: 'pool', due: ['missed'], never: true, lost: 'BUDGET', added: '7d' });
    expect(leadFiltersToQuery(f)).toBe('q=Mehta&source=FACEBOOK&owner=pool&due=missed&never=1&lost=BUDGET&added=7d');
    expect(parseLeadFilters({ source: 'own:abc', stage: 'st1', booked: 'any', quiet: '1' })).toEqual({ source: ['own:abc'], stage: ['st1'], booked: 'any', quiet: true });
    expect(parseLeadFilters(new URLSearchParams('stage=a,b&stage=c&due=overdue,week&tag=hot&tag=NRI&kpi=needs'))).toEqual({ stage: ['a', 'b', 'c'], due: ['overdue', 'week'], tags: ['hot', 'NRI'], kpi: 'needs' });
    expect(parseLeadFilters({ source: 'NOT_A_SOURCE', stage: 'bad id!', owner: "x'; drop" })).toEqual({});
    expect(leadsHref({ due: ['today'] }, { view: 'list' })).toBe('/studio/clients?due=today&view=list');
  });

  it('due today and missed are India days, on open leads only', () => {
    const today = leadWhere({ due: ['today'] }, NOW) as { AND: unknown[] };
    expect(today.AND).toContainEqual({ stage: { kind: { in: ['OPEN', 'WON'] } } });
    expect(today.AND).toContainEqual({ nextActionOn: { gte: new Date('2026-10-11T18:30:00.000Z'), lte: new Date('2026-10-12T18:29:59.999Z') } });
    expect((leadWhere({ due: ['missed'] }, NOW) as { AND: unknown[] }).AND).toContainEqual({ nextActionOn: { lt: new Date('2026-10-11T18:30:00.000Z') } });
    expect((leadWhere({ due: ['none'] }, NOW) as { AND: unknown[] }).AND).toContainEqual({ nextActionOn: null });
  });

  it('never and quiet do not overlap: never is null, quiet is spoken-to 7+ days ago', () => {
    expect((leadWhere({ never: true }, NOW) as { AND: unknown[] }).AND).toContainEqual({ lastContactedAt: null });
    expect((leadWhere({ quiet: true }, NOW) as { AND: unknown[] }).AND).toContainEqual({ lastContactedAt: { lt: new Date(NOW.getTime() - 7 * 86_400_000) } });
  });

  it('one of ours is that source with no own name; an own name is its id', () => {
    expect((leadWhere({ source: ['INSTAGRAM'] }, NOW) as { AND: unknown[] }).AND).toContainEqual({ OR: [{ source: 'INSTAGRAM', leadSourceId: null }] });
    expect((leadWhere({ source: ['own:ls1', 'FACEBOOK'] }, NOW) as { AND: unknown[] }).AND).toContainEqual({ OR: [{ leadSourceId: 'ls1' }, { source: 'FACEBOOK', leadSourceId: null }] });
  });

  it('search matches name or society, and the phone from three digits', () => {
    const w = leadWhere({ q: '98765' }, NOW) as { AND: { OR: unknown[] }[] };
    expect(w.AND[0]!.OR).toContainEqual({ phone: { contains: '98765' } });
    const n = leadWhere({ q: 'ab' }, NOW) as { AND: { OR: unknown[] }[] };
    expect(n.AND[0]!.OR).toHaveLength(3);
  });

  it('quotation, sales final and booking ranges reach through the quotes', () => {
    const w = leadWhere({ quoted: 'today', final: '7d', booked: 'any' }, NOW) as { AND: unknown[] };
    expect(JSON.stringify(w)).toContain('revisions');
    expect(JSON.stringify(w)).toContain('salesFinalAt');
    expect(w.AND).toContainEqual({ bookedAt: { gte: new Date(0) } });
  });
});

describe('every query sits inside the person’s scope', () => {
  it('owner and PM: the whole studio, with the filters', () => {
    const w = scopedLeadWhere(scopeOf('OWNER'), { owner: 'm-sales' }, NOW, LIVE) as { AND: unknown[] };
    expect(w.AND[0]).toEqual({ studioId: 's1' });
    expect(w.AND[1]).toEqual({ studioId: 's1', ...LIVE });
    expect(JSON.stringify(w.AND[2])).toContain('"assignedToId":"m-sales"');
  });

  it('a salesperson: their own leads, whatever the URL asks for', () => {
    for (const owner of [undefined, 'me', 'm-ravi', 'anyone']) {
      const w = scopedLeadWhere(scopeOf('SALES', 'm-asha'), { owner, due: ['today'] }, NOW, LIVE) as { AND: unknown[] };
      expect(w.AND[0]).toEqual({ studioId: 's1', assignedToId: 'm-asha' });
      expect(JSON.stringify(w)).not.toContain('m-ravi');
    }
  });

  it('a salesperson asking for the pool gets unassigned leads only — never a colleague’s', () => {
    const w = scopedLeadWhere(scopeOf('SALES', 'm-asha'), { owner: 'pool' }, NOW, LIVE) as { AND: unknown[] };
    /* Sales roles and teams (owner, 22 Oct 2026): a salesperson with no sales role claims from the studio pool, never a head's team pool. */
    expect(w.AND[0]).toEqual({ studioId: 's1', assignedToId: null, poolTeamId: null });
  });

  it('roles: sales reads its own and claims from the pool; the pool is not in its lead scope', () => {
    const sales = member('SALES', 'm-asha');
    expect(leadsVisibleTo(sales)).toEqual({ studioId: 's1', assignedToId: 'm-asha' });
    expect(poolVisibleTo(sales)).toEqual({ studioId: 's1', assignedToId: null, poolTeamId: null });
    expect(can(sales, 'lead.claim')).toBe(true);
    expect(can(sales, 'lead.read', { assigned: false })).toBe(false);
    expect(can(sales, 'lead.assign')).toBe(false);
    expect(poolVisibleTo(member('SUPERVISOR'))).toEqual({ studioId: 's1', id: { in: [] } });
    expect(poolVisibleTo(member('ACCOUNTS'))).toEqual({ studioId: 's1', id: { in: [] } });
  });
});

describe('pages by keyset', () => {
  it('sorts with a tiebreak, nulls where people expect them', () => {
    expect(orderByFor('newest')).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(orderByFor('followup')[0]).toEqual({ nextActionOn: { sort: 'asc', nulls: 'last' } });
    expect(orderByFor('contacted')[0]).toEqual({ lastContactedAt: { sort: 'asc', nulls: 'first' } });
    expect(parseSort('name')).toBe('name');
    expect(parseSort('drop table')).toBe('newest');
  });

  it('the cursor is the last row’s sort value and id, and garbage is no cursor', () => {
    const row = { id: 'c9', name: 'Zed', createdAt: new Date('2026-10-01T00:00:00Z'), nextActionOn: null, lastContactedAt: new Date('2026-10-02T00:00:00Z') };
    expect(parseCursor(cursorOf('newest', row))).toEqual({ v: '2026-10-01T00:00:00.000Z', id: 'c9' });
    expect(parseCursor(cursorOf('followup', row))).toEqual({ v: null, id: 'c9' });
    for (const bad of ['{', '{"id":"x y"}', '{"v":3,"id":"a"}', 'x'.repeat(500), 42]) expect(parseCursor(bad)).toBeNull();
  });

  it('continues after the cursor in each sort', () => {
    const at = '2026-10-01T00:00:00.000Z';
    expect(keysetWhere('newest', { v: at, id: 'c9' })).toEqual({ OR: [{ createdAt: { lt: new Date(at) } }, { createdAt: new Date(at), id: { lt: 'c9' } }] });
    expect(keysetWhere('oldest', { v: at, id: 'c9' })).toEqual({ OR: [{ createdAt: { gt: new Date(at) } }, { createdAt: new Date(at), id: { gt: 'c9' } }] });
    expect(keysetWhere('followup', { v: at, id: 'c9' })).toEqual({ OR: [{ nextActionOn: { gt: new Date(at) } }, { nextActionOn: new Date(at), id: { gt: 'c9' } }, { nextActionOn: null }] });
    expect(keysetWhere('followup', { v: null, id: 'c9' })).toEqual({ nextActionOn: null, id: { gt: 'c9' } });
    expect(keysetWhere('contacted', { v: null, id: 'c9' })).toEqual({ OR: [{ lastContactedAt: null, id: { gt: 'c9' } }, { lastContactedAt: { not: null } }] });
    expect(keysetWhere('name', { v: 'Mehta', id: 'c9' })).toEqual({ OR: [{ name: { gt: 'Mehta' } }, { name: 'Mehta', id: { gt: 'c9' } }] });
  });

  it('describes filters as chips', () => {
    const chips = describeFilters({ source: ['FACEBOOK'], due: ['missed'], owner: 'm1', added: 'today' }, { member: () => 'Asha' }).map((c) => c.label);
    expect(chips).toEqual(['Facebook', "Asha's", 'Missed follow-up', 'Added: Today']);
  });
});

// ── Bulk ─────────────────────────────────────────────────────────

describe('split evenly', () => {
  it('deals in turns: 10 among three is 4, 3, 3', () => {
    const split = splitEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ['a', 'b', 'c']);
    expect(split.get('a')).toEqual([1, 4, 7, 10]);
    expect(split.get('b')).toEqual([2, 5, 8]);
    expect(split.get('c')).toEqual([3, 6, 9]);
  });

  it('26,000 among four salespeople is 6,500 each, nobody twice', () => {
    const ids = Array.from({ length: 26_000 }, (_, i) => i);
    const split = splitEvenly(ids, ['a', 'b', 'c', 'd', 'a']);
    expect([...split.keys()]).toEqual(['a', 'b', 'c', 'd']);
    expect([...split.values()].map((v) => v.length)).toEqual([6500, 6500, 6500, 6500]);
    expect(new Set([...split.values()].flat()).size).toBe(26_000);
  });

  it('nobody to deal to deals nothing; chunks are a thousand', () => {
    expect(splitEvenly([1, 2], []).size).toBe(0);
    expect(chunks(Array.from({ length: 2500 }, (_, i) => i)).map((c) => c.length)).toEqual([1000, 1000, 500]);
    expect(splitSentence([{ name: 'Asha', n: 4 }, { name: 'Ravi', n: 0 }])).toBe('Done. 4 to Asha; each has been told.');
  });

  it('who may do what in bulk', () => {
    expect(bulkActionsFor(member('OWNER'))).toEqual(['claim', 'assign', 'split', 'move', 'followup', 'bin']);
    expect(bulkActionsFor(member('PM'))).toEqual(['claim', 'assign', 'split', 'move', 'followup', 'bin']);
    expect(bulkActionsFor(member('SALES'))).toEqual(['claim', 'move', 'followup']);
    expect(bulkActionsFor(member('SUPERVISOR'))).toEqual([]);
    expect(mayBulk(member('SALES'), 'bin')).toBe(false);
    expect(mayBulk({ role: 'SALES', status: 'SUSPENDED' }, 'claim')).toBe(false);
  });

  it('claim reaches only the pool; a salesperson’s other actions only their own', () => {
    expect(bulkFence('claim', true)).toBe('pool');
    expect(bulkFence('claim', false)).toBe('pool');
    expect(bulkFence('move', false)).toBe('mine');
    expect(bulkFence('assign', true)).toBe('filters');
    expect(readLimit(500)).toBe(500);
    expect(readLimit(0)).toBeNull();
    expect(readLimit('500')).toBeNull();
    expect(readLimit(10 ** 9)).toBe(30_000);
  });
});

// ── Tasks ────────────────────────────────────────────────────────

describe('tasks', () => {
  it('owner and PM see the studio’s; a salesperson theirs', () => {
    expect(tasksVisibleTo(member('OWNER'))).toEqual({ studioId: 's1' });
    expect(tasksVisibleTo(member('PM'))).toEqual({ studioId: 's1' });
    expect(tasksVisibleTo(member('SALES', 'm-asha'))).toEqual({ studioId: 's1', assignedToId: 'm-asha' });
    // Everyone else at the studio: their own tasks (27 Oct 2026: "today I am doing this").
    expect(tasksVisibleTo(member('SUPERVISOR'))).toEqual({ studioId: 's1', assignedToId: 'm-supervisor' });
    expect(seesAllTasks(member('SALES'))).toBe(false);
  });

  it('a salesperson changes and writes only their own', () => {
    const asha = member('SALES', 'm-asha');
    expect(mayChangeTask(asha, { studioId: 's1', assignedToId: 'm-asha' })).toBe(true);
    expect(mayChangeTask(asha, { studioId: 's1', assignedToId: 'm-ravi' })).toBe(false);
    expect(mayChangeTask(asha, { studioId: 's2', assignedToId: 'm-asha' })).toBe(false);
    expect(mayAssignTaskTo(asha, 'm-asha')).toBe(true);
    expect(mayAssignTaskTo(asha, 'm-ravi')).toBe(false);
    expect(mayChangeTask(member('PM'), { studioId: 's1', assignedToId: 'm-ravi' })).toBe(true);
    expect(mayChangeTask(member('PM'), { studioId: 's2', assignedToId: 'm-ravi' })).toBe(false);
  });

  it('a task needs words and a day; no time means 10 am India', () => {
    expect(readTask({ title: ' Send   kitchen ', day: '2026-10-13', time: '' })).toEqual({ ok: true, title: 'Send kitchen', dueAt: new Date('2026-10-13T04:30:00.000Z') });
    expect(readTask({ title: 'Call', day: '2026-10-13', time: '17:30' })).toMatchObject({ ok: true, dueAt: new Date('2026-10-13T12:00:00.000Z') });
    expect(readTask({ title: 'x', day: '2026-10-13', time: '' }).ok).toBe(false);
    expect(readTask({ title: 'Call', day: '13/10/2026', time: '' }).ok).toBe(false);
    expect(readTask({ title: 'Call', day: '2026-10-13', time: '25:00' }).ok).toBe(false);
    expect(readTask({ title: 'y'.repeat(141), day: '2026-10-13', time: '' }).ok).toBe(false);
  });
});

// ── Calendar ─────────────────────────────────────────────────────

describe('the calendar', () => {
  it('a week is Monday to Sunday; a month is drawn in whole weeks', () => {
    const w = calendarWindow('week', '2026-10-15');
    expect(w.days).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    const m = calendarWindow('month', '2026-10-15');
    expect(m.from).toBe('2026-09-28');
    expect(m.to).toBe('2026-11-01');
    expect(m.days.length % 7).toBe(0);
    expect(calendarWindow('day', '2026-10-15').start.toISOString()).toBe('2026-10-14T18:30:00.000Z');
    expect(shiftDay('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDay('week', '2026-10-15', -1)).toBe('2026-10-08');
    expect(windowTitle(calendarWindow('month', '2026-10-15'))).toBe('October 2026');
  });

  it('a follow-up saved as a bare day goes at 10 am India; one with a time stays', () => {
    expect(followupAt(new Date('2026-10-13T00:00:00.000Z'))).toEqual({ at: new Date('2026-10-13T04:30:00.000Z'), defaultTime: true });
    expect(followupAt(new Date('2026-10-12T18:30:00.000Z'))).toEqual({ at: new Date('2026-10-13T04:30:00.000Z'), defaultTime: true });
    expect(followupAt(new Date('2026-10-13T09:00:00.000Z')).defaultTime).toBe(false);
    expect(timeLabel(new Date('2026-10-13T04:30:00.000Z'))).toBe('10:00 am');
    expect(timeLabel(new Date('2026-10-13T12:00:00.000Z'))).toBe('5:30 pm');
  });

  it('builds follow-ups, meetings and tasks in time order, overdue marked, done tasks not', () => {
    const items = buildCalendarItems(
      {
        followups: [{ id: 'l1', name: 'Mehta', nextAction: 'Call back', nextActionOn: new Date('2026-10-12T00:00:00.000Z'), ownerName: 'Asha' }],
        meetings: [{ id: 'l2', name: 'Shah', meetingAt: new Date('2026-10-12T06:30:00.000Z'), meetingNote: 'Office', ownerName: null }],
        tasks: [
          { id: 't1', title: 'Send plan', dueAt: new Date('2026-10-12T03:00:00.000Z'), doneAt: null, leadId: 'l1', leadName: 'Mehta', ownerName: 'Asha' },
          { id: 't2', title: 'Done one', dueAt: new Date('2026-10-12T02:00:00.000Z'), doneAt: new Date(), leadId: null, leadName: null, ownerName: null },
        ],
      },
      NOW,
    );
    expect(items.map((i) => i.key)).toEqual(['task:t2', 'task:t1', 'followup:l1', 'meeting:l2']);
    expect(items.find((i) => i.key === 'task:t1')).toMatchObject({ overdue: true, href: '/studio/clients/l1' });
    expect(items.find((i) => i.key === 'task:t2')).toMatchObject({ overdue: false, done: true, href: null });
    expect(items.find((i) => i.key === 'followup:l1')).toMatchObject({ time: '10:00 am', overdue: false, defaultTime: true, day: '2026-10-12' });
    const byDay = itemsByDay(items, ['2026-10-12', '2026-10-13']);
    expect(byDay.get('2026-10-12')).toHaveLength(4);
    expect(byDay.get('2026-10-13')).toEqual([]);
  });

  it('keeps only what falls in the window', () => {
    const w = calendarWindow('day', '2026-10-13');
    const items = buildCalendarItems({ followups: [{ id: 'l1', name: 'A', nextAction: null, nextActionOn: new Date('2026-10-12T00:00:00.000Z'), ownerName: null }] }, NOW, w);
    expect(items).toEqual([]);
  });
});

// ── Dashboard ────────────────────────────────────────────────────

describe('the dashboard’s numbers', () => {
  it('each number is a set of list filters', () => {
    const now = Object.fromEntries(nowKpis().map((k) => [k.key, k.filters]));
    expect(now).toMatchObject({ total: {}, pool: { owner: 'pool', kind: 'open' }, dueToday: { due: ['today'] }, missed: { due: ['missed'] }, never: { never: true }, quiet: { quiet: true }, meetToday: { meeting: 'today' }, meetWeek: { meeting: 'week' } });
    expect(newLeadKpis().map((k) => k.filters.added)).toEqual(['today', '7d', 'month']);
    expect(rangeKpis('30d').map((k) => Object.values(k.filters)[0])).toEqual(['30d', '30d', '30d', '30d', '30d']);
    expect(personColumns('7d').map((c) => c.key)).toEqual(['assigned', 'contactedToday', 'dueToday', 'missed', 'quoted', 'booked']);
  });

  it('a salesperson sees the pool number too (owner, 12 Oct 2026)', () => {
    expect(nowKpis().find((k) => k.key === 'pool')?.seesAllOnly).toBeUndefined();
  });

  it('conversion: no verdict on nothing, never rounds to 0 or 100 when it is not', () => {
    expect(conversion(0, 0)).toBeNull();
    expect(conversion(1, 400)).toBe(1);
    expect(conversion(399, 400)).toBe(99);
    expect(conversion(12, 100)).toBe(12);
    expect(conversion(5, 5)).toBe(100);
  });
});

// ── Today ────────────────────────────────────────────────────────

const lead = (over: Partial<TodayLead>): TodayLead => ({
  id: 'c',
  name: 'Lead',
  phone: '9876543210',
  assignedToId: 'm-asha',
  assignedToName: 'Asha',
  stageKind: 'OPEN',
  nextAction: null,
  nextActionOn: null,
  lastContactedAt: new Date('2026-10-10T06:00:00Z'),
  meetingAt: null,
  meetingNote: null,
  hasFloorPlan: true,
  quoteCount: 1,
  isDemo: false,
  booked: false,
  ...over,
});

describe('Today at scale', () => {
  it('"and N more" comes from the SQL count, with a link to the list', () => {
    const s = buildToday({ leads: [lead({ id: 'a', nextActionOn: NOW })], quotes: [], bookings: [], now: NOW, seesAll: true, totals: { calls: 812 } });
    const calls = s.find((x) => x.id === 'calls')!;
    expect(calls.rows).toHaveLength(1);
    expect(calls.more).toBe(811);
    expect(calls.seeAll).toBe('/studio/clients?view=list&due=due&sort=followup');
  });

  it('lists tasks due today and late, with Done', () => {
    const s = buildToday({
      leads: [],
      quotes: [],
      bookings: [],
      tasks: [
        { id: 't1', title: 'Send plan', dueAt: new Date('2026-10-10T05:00:00Z'), leadId: 'l1', leadName: 'Mehta', assignedToName: 'Asha' },
        { id: 't2', title: 'Tomorrow', dueAt: new Date('2026-10-13T05:00:00Z'), leadId: null, leadName: null, assignedToName: null },
      ],
      now: NOW,
      seesAll: false,
    });
    const tasks = s.find((x) => x.id === 'tasks')!;
    expect(tasks.rows.map((r) => r.title)).toEqual(['Send plan']);
    expect(tasks.rows[0]).toMatchObject({ late: true, action: { kind: 'task', taskId: 't1', label: 'Done' } });
  });

  it('a salesperson’s calls are their own; the pool shows only to claim, without opening the lead', () => {
    const s = buildToday({
      leads: [lead({ id: 'mine', nextActionOn: NOW }), lead({ id: 'pool1', name: 'Pooled', assignedToId: null, nextActionOn: NOW })],
      quotes: [],
      bookings: [],
      now: NOW,
      seesAll: false,
      showPool: true,
      totals: { pool: 40 },
    });
    expect(s.find((x) => x.id === 'calls')!.rows.map((r) => r.leadId)).toEqual(['mine']);
    const pool = s.find((x) => x.id === 'pool')!;
    expect(pool.rows[0]).toMatchObject({ leadId: null, title: 'Pooled', action: { kind: 'claim', leadId: 'pool1' } });
    expect(pool.more).toBe(39);
    expect(s.find((x) => x.id === 'never-called')).toBeUndefined();
  });

  it('without showPool a salesperson has no pool section', () => {
    const s = buildToday({ leads: [lead({ assignedToId: null })], quotes: [], bookings: [], now: NOW, seesAll: false });
    expect(s.find((x) => x.id === 'pool')).toBeUndefined();
  });
});

// ── Screens, views, import ───────────────────────────────────────

describe('screens a salesperson opens (leads at scale)', () => {
  it('the dashboard, the calendar and the pool; not One Interiors visits', () => {
    const s = { role: 'SALES' as const, status: 'ACTIVE' as const };
    for (const p of ['/studio/dashboard', '/studio/calendar', '/studio/clients/pool']) expect(mayOpen(s, p), p).toBe(true);
    expect(mayOpen(s, '/studio/calendar/appointments')).toBe(false);
    expect(mayOpen({ role: 'SUPERVISOR', status: 'ACTIVE' }, '/studio/dashboard')).toBe(false);
    expect(mayOpen({ role: 'PM', status: 'ACTIVE' }, '/studio/dashboard')).toBe(true);
  });
});

describe('saved views hold the URL filters', () => {
  it('cleans the query by parsing it again; keeps a non-default sort', () => {
    expect(cleanFilters({ query: 'due=missed&junk=1&sort=followup', view: 'list', groupBy: 'tower', other: 1 })).toEqual({ query: 'due=missed&sort=followup', view: 'list', groupBy: 'tower' });
    expect(cleanFilters({ view: 'grid' })).toEqual({});
    expect(cleanFilters('nope')).toEqual({});
  });

  it('turns an old "who" into the same filter', () => {
    expect(cleanFilters({ who: 'pool' })).toEqual({ query: 'owner=pool' });
    expect(cleanFilters({ who: 'quiet' })).toEqual({ query: 'quiet=1' });
    expect(cleanFilters({ who: 'm-asha' })).toEqual({ query: 'owner=m-asha' });
    expect(describeView({ query: 'owner=m-asha&due=today' }, () => 'Asha')).toBe("Asha's · Due today");
    expect(describeView({})).toBe('Everything');
  });
});

describe('a big import goes in pieces', () => {
  it('each piece carries the header, quoting survives, nothing is lost', () => {
    const rows = [['Name', 'Phone', 'Note'], ...Array.from({ length: 2501 }, (_, i) => [`Mrs "K" ${i}`, `98765${String(i).padStart(5, '0')}`, 'a, b\nc'])];
    const pieces = csvChunks(rows, 1000);
    expect(pieces).toHaveLength(3);
    const back = pieces.flatMap((p) => {
      const r = parseCsv(p);
      expect(r[0]).toEqual(['Name', 'Phone', 'Note']);
      return r.slice(1);
    });
    expect(back).toEqual(rows.slice(1));
    expect(parseCsv(toCsv([['a', 'b,c']]))).toEqual([['a', 'b,c']]);
  });

  it('cuts a piece smaller when it is too long to send', () => {
    const rows = [['Name'], ...Array.from({ length: 100 }, (_, i) => [`${'x'.repeat(100)}${i}`])];
    const pieces = csvChunks(rows, 1000, 3000);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.length <= 3000)).toBe(true);
    expect(pieces.flatMap((p) => parseCsv(p).slice(1))).toEqual(rows.slice(1));
  });
});
