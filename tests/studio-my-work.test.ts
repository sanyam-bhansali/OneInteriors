import { describe, expect, it } from 'vitest';
import {
  bucketOf,
  buildMyWork,
  doneByOthers,
  dueTomorrow,
  isEmptyWork,
  isMineDesignStep,
  isMineExecStep,
  isMineSnag,
  leadSources,
  projectSources,
  shortList,
  weekOf,
  workDigest,
  type Me,
  type ProjectFacts,
  type WorkSource,
} from '@/modules/studio/my-work-rules';
import { EMAILED_TO_STUDIO, messageFor } from '@/modules/notify/messages';
import { plainText, templateParams, TEMPLATE_ENV } from '@/modules/messaging/messages';

/** My work (owner, team meeting 15 Oct 2026): Today, Next 3 days, Missed. */

const TODAY = '2026-10-15';

const src = (key: string, due: string, extra: Partial<WorkSource> = {}): WorkSource => ({
  key,
  kind: 'step',
  title: `Step ${key}`,
  place: 'Mehta · Baner',
  due,
  href: `/studio/projects/p1?tab=plan#step-${key}`,
  ...extra,
});

const me = (role: Me['role'], extra: Partial<Me> = {}): Me => ({ role, memberId: 'm-me', recordsPayments: role === 'OWNER' || role === 'ACCOUNTS', ...extra });

const project = (over: Partial<ProjectFacts> = {}): ProjectFacts => ({
  id: 'p1',
  place: 'Mehta · Kumar Primrose · 3 BHK',
  client: 'Mehta',
  designerId: 'm-des',
  phase: 'EXECUTION',
  provisionalOn: null,
  designSteps: [],
  execSteps: [],
  decisions: [],
  snags: [],
  payments: [],
  site: null,
  ...over,
});

describe('which list a day falls in', () => {
  it('before today is missed, today is today, the next three days are soon, then the next month, later is left out', () => {
    expect(bucketOf('2026-10-14', TODAY)).toBe('missed');
    expect(bucketOf('2026-10-15', TODAY)).toBe('today');
    expect(bucketOf('2026-10-16', TODAY)).toBe('soon');
    expect(bucketOf('2026-10-18', TODAY)).toBe('soon');
    expect(bucketOf('2026-10-19', TODAY)).toBe('month');
    expect(bucketOf('2026-11-14', TODAY)).toBe('month');
    expect(bucketOf('2026-11-15', TODAY)).toBeNull();
    expect(bucketOf('not a day', TODAY)).toBeNull();
  });
});

describe('the three lists', () => {
  const w = buildMyWork(
    [
      src('a', '2026-10-01'),
      src('b', '2026-10-12', { kind: 'snag' }),
      src('c', TODAY, { kind: 'payment' }),
      src('d', TODAY, { kind: 'site' }),
      src('e', '2026-10-16'),
      src('f', '2026-10-18', { kind: 'meeting', time: '11 am' }),
      src('g', '2026-10-25'),
      src('a', '2026-10-01'), // the same key twice is one item
    ],
    TODAY,
  );

  it('Missed is oldest first, with how late', () => {
    expect(w.missed.map((i) => i.key)).toEqual(['a', 'b']);
    expect(w.missed[0]!.when).toBe('14 days late');
    expect(w.missed[0]!.lateDays).toBe(14);
    expect(w.missed[1]!.when).toBe('3 days late');
  });

  it('Today is grouped by kind (site updates before payments)', () => {
    expect(w.todayGroups.map((g) => g.title)).toEqual(['Site updates', 'Payments']);
  });

  it('Next 3 days is grouped by day, tomorrow named, with the time', () => {
    expect(w.soonGroups.map((g) => g.title)).toEqual(['Tomorrow, Fri 16 Oct', 'Sun 18 Oct']);
    expect(w.soonGroups[1]!.items[0]!.when).toBe('Sun 18 Oct, 11 am');
  });

  it('Next month is grouped by week, from its Monday', () => {
    expect(w.monthGroups.map((g) => g.title)).toEqual(['Week of Mon 19 Oct']);
    expect(w.monthGroups[0]!.items.map((i) => i.key)).toEqual(['g']);
    expect(weekOf('2026-10-25')).toBe('2026-10-19');
    expect(weekOf('2026-10-19')).toBe('2026-10-19');
  });

  it('counts each section, leaving out what is further away', () => {
    expect(buildMyWork([src('far', '2026-12-30')], TODAY).counts.month).toBe(0);
    expect(w.counts).toEqual({ today: 2, soon: 2, month: 1, missed: 2 });
    expect(isEmptyWork(w)).toBe(false);
  });

  it('keeps the header counts true when the reads did not fetch everything', () => {
    const big = buildMyWork([src('x', '2026-10-01')], TODAY, { hidden: { missed: 120 } });
    expect(big.counts.missed).toBe(121);
    expect(big.more.missed).toBe(120);
  });

  it('shows at most the limit per section', () => {
    const many = buildMyWork(
      Array.from({ length: 50 }, (_, i) => src(`k${i}`, '2026-10-10')),
      TODAY,
      { limit: 40 },
    );
    expect(many.missed).toHaveLength(40);
    expect(many.more.missed).toBe(10);
  });

  it('is empty when there is nothing', () => {
    expect(isEmptyWork(buildMyWork([], TODAY))).toBe(true);
  });

  it('lists a step waiting on a payment apart: never in Missed or Today (DESIGN-PROCESS-PLAN.md Decision 5)', () => {
    const w2 = buildMyWork([src('late', '2026-10-01', { kind: 'design', waitingOn: 'Design advance' }), src('due', TODAY, { kind: 'design' })], TODAY);
    expect(w2.missed).toEqual([]);
    expect(w2.counts).toEqual({ today: 1, soon: 0, month: 0, missed: 0 });
    expect(w2.waiting.map((x) => [x.key, x.payment])).toEqual([['late', 'Design advance']]);
  });

  it('puts design before site in Today (owner and design team, 24 Oct 2026)', () => {
    const w3 = buildMyWork([src('s', TODAY, { kind: 'site' }), src('d', TODAY, { kind: 'design' })], TODAY);
    expect(w3.todayGroups.map((g) => g.id)).toEqual(['design', 'site']);
  });
});

describe('whose it is, by role', () => {
  it('design steps: the designer their own and the client’s; PM, accounts their own; the owner all', () => {
    expect(isMineDesignStep(me('DESIGNER'), 'DESIGNER', true)).toBe(true);
    expect(isMineDesignStep(me('DESIGNER'), null, true)).toBe(true);
    expect(isMineDesignStep(me('DESIGNER'), 'CLIENT', true)).toBe(true);
    expect(isMineDesignStep(me('DESIGNER'), 'DESIGNER', false)).toBe(false);
    expect(isMineDesignStep(me('DESIGNER'), 'ACCOUNTS', true)).toBe(false);
    expect(isMineDesignStep(me('PM'), 'PM', false)).toBe(true);
    expect(isMineDesignStep(me('PM'), 'DESIGNER', false)).toBe(false);
    expect(isMineDesignStep(me('ACCOUNTS'), 'ACCOUNTS', false)).toBe(true);
    expect(isMineDesignStep(me('OWNER'), 'SALES', false)).toBe(true);
    expect(isMineDesignStep(me('SUPERVISOR'), 'PM', false)).toBe(false);
  });

  it('execution steps: owner, PM, supervisor, and the designer on their project; never accounts or sales', () => {
    expect(isMineExecStep(me('SUPERVISOR'), false)).toBe(true);
    expect(isMineExecStep(me('DESIGNER'), true)).toBe(true);
    expect(isMineExecStep(me('DESIGNER'), false)).toBe(false);
    expect(isMineExecStep(me('ACCOUNTS'), false)).toBe(false);
    expect(isMineExecStep(me('SALES'), false)).toBe(false);
  });

  it('snags: the one it is given to, else the office; a supervisor only unassigned ones on their site', () => {
    expect(isMineSnag(me('SUPERVISOR'), 'm-me', false)).toBe(true);
    expect(isMineSnag(me('SUPERVISOR'), 'm-other', false)).toBe(false);
    expect(isMineSnag(me('SUPERVISOR'), null, false)).toBe(true);
    expect(isMineSnag(me('ACCOUNTS'), null, false)).toBe(false);
    expect(isMineSnag(me('PM'), 'm-other', false)).toBe(true);
  });
});

describe('one project’s items', () => {
  const p = project({
    designSteps: [
      { id: 'd1', label: 'Mood board', plannedOn: TODAY, responsible: 'DESIGNER', lockedBy: null },
      { id: 'd2', label: '3D renders', plannedOn: '2026-10-17', responsible: 'DESIGNER', lockedBy: 'Design advance' },
      { id: 'd3', label: 'Collect token', plannedOn: '2026-10-10', responsible: 'ACCOUNTS', lockedBy: null },
      { id: 'd4', label: 'No day yet', plannedOn: null, responsible: 'DESIGNER', lockedBy: null },
    ],
    execSteps: [{ id: 's1', label: 'Electrical conduits', plannedOn: '2026-10-13', stage: 'Civil' }],
    decisions: [{ id: 'dec1', title: 'Shutter finish', dueOn: '2026-10-16' }],
    snags: [
      { id: 'n1', title: 'Hinge loose', room: 'Kitchen', state: 'accepted', fixBy: '2026-10-14', raisedOn: '2026-10-10', assigneeId: 'm-me', warranty: false },
      { id: 'n2', title: 'Scratch', room: null, state: 'raised', fixBy: null, raisedOn: TODAY, assigneeId: null, warranty: false },
      { id: 'n3', title: 'Waiting on client', room: null, state: 'fixed', fixBy: '2026-10-12', raisedOn: '2026-10-09', assigneeId: null, warranty: false },
    ],
    payments: [{ index: 2, label: 'Before production', dueOn: TODAY, openPaise: 2_50_000_00, amountLabel: '₹2,50,000' }],
    site: { postedToday: false, todayIsWorkingDay: true, missedDays: ['2026-10-14', '2026-10-13'] },
  });

  it('the designer on it: their design steps, site steps, the client’s decisions, snags; no payments, no site posts', () => {
    const keys = projectSources(p, me('DESIGNER', { memberId: 'm-des' }), TODAY).map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['design:d1', 'design:d2', 'step:s1', 'decision:dec1', 'snag:n1', 'snag:n2']));
    expect(keys).not.toContain('design:d3');
    expect(keys).not.toContain('design:d4');
    expect(keys).not.toContain('snag:n3');
    expect(keys.some((k) => k.startsWith('payment:') || k.startsWith('site'))).toBe(false);
  });

  it('a designer who is not THE designer gets none of the design steps', () => {
    const keys = projectSources(p, me('DESIGNER', { memberId: 'm-other' }), TODAY).map((s) => s.key);
    expect(keys.filter((k) => k.startsWith('design:'))).toEqual([]);
  });

  it('accounts: payments and their own design step, nothing of the site', () => {
    const out = projectSources(p, me('ACCOUNTS'), TODAY);
    expect(out.map((s) => s.key).sort()).toEqual(['design:d3', 'payment:p1:2']);
    expect(out.find((s) => s.kind === 'payment')).toMatchObject({ title: 'Before production: ₹2,50,000', href: '/studio/projects/p1?tab=payments#pay-2' });
  });

  it('the supervisor: site steps, today’s update (in site mode) and the missed days from the oldest', () => {
    const out = projectSources(p, me('SUPERVISOR'), TODAY, { siteHref: '/studio/site' });
    const site = out.filter((s) => s.kind === 'site');
    expect(site).toHaveLength(2);
    expect(site.find((s) => s.key === 'site-missed:p1')).toMatchObject({ due: '2026-10-13', title: 'No site update on 2 working days', href: '/studio/site' });
    expect(site.find((s) => s.key === 'site:p1')).toMatchObject({ due: TODAY });
    expect(out.some((s) => s.kind === 'decision' || s.kind === 'payment')).toBe(false);
  });

  it('links each item to the exact place', () => {
    const out = projectSources(p, me('OWNER'), TODAY);
    const by = (k: string) => out.find((s) => s.key === k)!.href;
    expect(by('design:d1')).toBe('/studio/projects/p1?tab=design#step-d1');
    expect(by('step:s1')).toBe('/studio/projects/p1?tab=plan#step-s1');
    expect(by('snag:n1')).toBe('/studio/projects/p1?tab=snags#snag-n1');
    expect(by('decision:dec1')).toBe('/studio/projects/p1#decision-dec1');
    expect(by('site:p1')).toBe('/studio/projects/p1?tab=log');
  });

  it('a snag is due on its fix-by day; a raised one the day after it was raised', () => {
    const out = projectSources(p, me('OWNER'), TODAY);
    expect(out.find((s) => s.key === 'snag:n1')!.due).toBe('2026-10-14');
    expect(out.find((s) => s.key === 'snag:n2')!.due).toBe('2026-10-16');
  });

  it('says a locked design step opens with its payment', () => {
    expect(projectSources(p, me('OWNER'), TODAY).find((s) => s.key === 'design:d2')!.detail).toContain('opens when the Design advance is recorded');
  });

  it('a closure two days after the provisional handover, for the office', () => {
    const c = project({ phase: 'CLOSURE', provisionalOn: '2026-10-10' });
    expect(projectSources(c, me('PM'), TODAY).find((s) => s.kind === 'closure')).toMatchObject({ due: '2026-10-12', href: '/studio/projects/p1?tab=closure' });
    expect(projectSources(c, me('SUPERVISOR'), TODAY).some((s) => s.kind === 'closure')).toBe(false);
  });

  it('nothing posted is needed when today is not a working day', () => {
    const off = project({ site: { postedToday: false, todayIsWorkingDay: false, missedDays: [] } });
    expect(projectSources(off, me('PM'), TODAY)).toEqual([]);
  });
});

describe('leads', () => {
  it('follow-ups, tasks and meetings, each opening the lead', () => {
    const out = leadSources({
      followUps: [{ id: 'l1', name: 'Asha', nextAction: 'Send revised kitchen', due: '2026-10-13' }],
      tasks: [{ id: 't1', title: 'Call builder', due: TODAY, time: '3 pm', leadId: null, leadName: null }],
      meetings: [{ id: 'l2', name: 'Ravi', due: '2026-10-16', time: '11 am', note: null }],
    });
    expect(out).toEqual([
      expect.objectContaining({ key: 'follow:l1', kind: 'follow-up', title: 'Send revised kitchen', place: 'Asha', href: '/studio/clients/l1' }),
      expect.objectContaining({ key: 'task:t1', kind: 'task', place: 'No lead', href: '/studio/calendar?view=day', time: '3 pm' }),
      expect.objectContaining({ key: 'meeting:l2', kind: 'meeting', title: 'Meeting', href: '/studio/clients/l2' }),
    ]);
  });
});

describe('reminders', () => {
  const sources = [src('a', '2026-10-10'), src('b', TODAY), src('c', '2026-10-16', { kind: 'payment', title: 'Final payment' }), src('d', '2026-10-16')];
  const w = buildMyWork(sources, TODAY);

  it('the morning digest lists Today and Missed and counts what is coming', () => {
    const d = workDigest(w, 'Ravi', 'Hauspire')!;
    expect(d.title).toBe('Today: 1 to do, 1 missed');
    expect(d.body).toContain('Good morning Ravi. Your work at Hauspire.');
    expect(d.body).toContain('Today (1)\n- Step b · Mehta · Baner');
    expect(d.body).toContain('Missed (1)\n- Step a · Mehta · Baner · 5 days late');
    expect(d.body).toContain('Next 3 days: 2 things coming up.');
  });

  it('nobody gets a digest with nothing today and nothing missed', () => {
    expect(workDigest(buildMyWork([src('x', '2026-10-17')], TODAY), 'Ravi', 'Hauspire')).toBeNull();
  });

  it('due tomorrow picks tomorrow only, steps before payments', () => {
    expect(dueTomorrow(sources, TODAY).map((s) => s.key)).toEqual(['d', 'c']);
    expect(shortList(dueTomorrow(sources, TODAY), 1)).toBe('Step d (Mehta · Baner); and 1 more');
  });

  it('done by someone else: only steps that are this member’s, never their own ticks', () => {
    const base = { place: 'Mehta', projectId: 'p1', designerId: 'm-des', doneByName: 'Sunil' };
    const steps = [
      { ...base, stepId: '1', label: 'Tiling', design: false, responsible: null, doneById: 'u-sup' },
      { ...base, stepId: '2', label: 'Mood board', design: true, responsible: 'DESIGNER', doneById: 'u-pm' },
      { ...base, stepId: '3', label: 'Own tick', design: false, responsible: null, doneById: 'u-me' },
      { ...base, stepId: '4', label: 'Token', design: true, responsible: 'ACCOUNTS', doneById: 'u-acc' },
    ];
    const des = doneByOthers(steps, { ...me('DESIGNER', { memberId: 'm-des' }), userId: 'u-me' });
    expect(des.map((s) => s.stepId)).toEqual(['1', '2']);
    const pm = doneByOthers(steps, { ...me('PM'), userId: 'u-me' });
    expect(pm.map((s) => s.stepId)).toEqual(['1']);
  });

  it('says it in the app, to the studio’s home, and never by the studio email list', () => {
    const m = messageFor({ kind: 'my-work', today: 3, missed: 2, soon: 4, first: 'Tiling (Mehta)' });
    expect(m).toMatchObject({ template: 'studio.my_work', title: 'Today: 3 to do, 2 missed', url: '/studio/home' });
    expect(m.body).toBe('First: Tiling (Mehta). 4 more in the next 3 days. Your list is on your home.');
    expect(messageFor({ kind: 'work-due-tomorrow', count: 1, list: 'Tiling (Mehta)' })).toMatchObject({ template: 'studio.work_due_tomorrow', title: 'Due tomorrow: 1 thing' });
    expect(messageFor({ kind: 'work-done', count: 2, list: 'Tiling by Sunil (Mehta)' })).toMatchObject({ template: 'studio.work_done', title: '2 steps done today on your projects' });
    for (const k of ['my-work', 'work-due-tomorrow', 'work-done'] as const) expect(EMAILED_TO_STUDIO).not.toContain(k);
  });

  it('the studio MessageSender has its own template for someone with no email', () => {
    const msg = { kind: 'my-work' as const, name: 'Sunil', today: 2, missed: 1, link: 'https://x/studio/home' };
    expect(TEMPLATE_ENV['my-work']).toBe('WHATSAPP_STUDIO_MY_WORK_TEMPLATE');
    expect(templateParams(msg)).toEqual(['Sunil', '2', '1', 'https://x/studio/home']);
    expect(plainText(msg)).toBe('Sunil, today you have 2 things to do and 1 missed. https://x/studio/home');
  });
});
