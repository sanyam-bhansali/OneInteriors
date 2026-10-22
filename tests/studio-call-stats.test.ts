import { describe, expect, it } from 'vitest';
import {
  CALL_RANGE_DEFAULT,
  CONNECT_OUTCOMES,
  MAX_RANGE_DAYS,
  NOT_DIAL_OUTCOMES,
  NOT_ON_TEAM,
  buildCallStats,
  callKind,
  callRange,
  callRangeQuery,
  firstConnect,
  firstDial,
  isConnect,
  isDial,
  median,
  medianOfCounts,
  pct,
  stepPlan,
  stepRows,
  waitLabel,
  type CallLine,
  type CallStatsInput,
  type StepStage,
} from '@/modules/studio-sales/call-stats';
import { CALL_OUTCOMES } from '@/modules/studio-practice/event-copy';

/**
 * Calling numbers (improvement 7, owner 22 Oct 2026): what counts as a dial
 * and a connect, the India-day range, the medians, the funnel's steps from
 * the studio's own columns, and the assembly of the loader's grouped rows.
 */

// 22 Oct 2026, 11:00 IST.
const NOW = new Date('2026-10-22T05:30:00Z');
const at = (iso: string) => new Date(iso);

describe('what a call counts as', () => {
  it('connects are the outcomes where they picked up', () => {
    for (const o of ['spoke', 'busy', 'not_interested']) expect(callKind(o), o).toBe('connect');
  });

  it('missed calls: no answer, line busy, switched off, voicemail, wrong number', () => {
    for (const o of ['no_answer', 'line_busy', 'switched_off', 'voicemail', 'wrong_number']) expect(callKind(o), o).toBe('missed');
  });

  it('meeting, a site visit or a message is contact, not a dial', () => {
    for (const o of ['met', 'site_visit', 'messaged']) {
      expect(callKind(o), o).toBe('not_a_dial');
      expect(isDial(o)).toBe(false);
    }
  });

  it('a line with no outcome is the old "Spoke to them": a dial and a connect', () => {
    expect(callKind(undefined)).toBe('connect');
    expect(isDial(undefined) && isConnect(undefined)).toBe(true);
  });

  it('an imported call we could not map (null) is a dial, not a connect', () => {
    expect(callKind(null)).toBe('missed');
    expect(isDial(null)).toBe(true);
    expect(isConnect(null)).toBe(false);
  });

  it('an outcome nobody has heard of is a missed dial, never a connect', () => {
    expect(callKind('picked_up_maybe')).toBe('missed');
  });

  it('every outcome the call sheet offers is classified, and the two lists do not overlap', () => {
    for (const o of CALL_OUTCOMES) expect(['connect', 'missed', 'not_a_dial']).toContain(callKind(o.id));
    for (const o of CONNECT_OUTCOMES) expect(NOT_DIAL_OUTCOMES).not.toContain(o);
    for (const o of [...CONNECT_OUTCOMES, ...NOT_DIAL_OUTCOMES]) expect(CALL_OUTCOMES.map((x) => x.id as string)).toContain(o);
  });
});

describe('the range, in India days', () => {
  it('defaults to the last 7 days, today included', () => {
    const r = callRange({}, NOW);
    expect(r.token).toBe(CALL_RANGE_DEFAULT);
    expect(r.fromDay).toBe('2026-10-16');
    expect(r.toDay).toBe('2026-10-22');
    expect(r.days).toHaveLength(7);
    expect(r.label).toBe('Last 7 days');
  });

  it('today runs IST midnight to midnight', () => {
    const r = callRange({ range: 'today' }, NOW);
    expect(r.from.toISOString()).toBe('2026-10-21T18:30:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-22T18:29:59.999Z');
    expect(r.days).toEqual(['2026-10-22']);
  });

  it('just after midnight IST it is already the new day', () => {
    const r = callRange({ range: 'today' }, at('2026-10-22T18:45:00Z'));
    expect(r.fromDay).toBe('2026-10-23');
  });

  it('30 days is thirty bars', () => {
    const r = callRange({ range: '30d' }, NOW);
    expect(r.days).toHaveLength(30);
    expect(r.days[0]).toBe('2026-09-23');
  });

  it('presets the list knows but this page does not offer fall back to 7 days', () => {
    expect(callRange({ range: 'month' }, NOW).token).toBe('7d');
    expect(callRange({ range: 'any' }, NOW).token).toBe('7d');
    expect(callRange({ range: 'nonsense' }, NOW).token).toBe('7d');
  });

  it('custom dates from the form, either order', () => {
    const r = callRange({ from: '2026-10-12', to: '2026-10-01' }, NOW);
    expect(r.token).toEqual({ from: '2026-10-01', to: '2026-10-12' });
    expect(r.days).toHaveLength(12);
    expect(callRangeQuery(r)).toBe('from=2026-10-01&to=2026-10-12');
  });

  it('a custom range in the range param works too, and one day alone is that day', () => {
    expect(callRange({ range: '2026-10-01..2026-10-03' }, NOW).days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(callRange({ from: '2026-10-05' }, NOW).days).toEqual(['2026-10-05']);
  });

  it('a range ending in the future ends today; one starting in the future is today', () => {
    expect(callRange({ from: '2026-10-20', to: '2026-11-30' }, NOW).toDay).toBe('2026-10-22');
    const r = callRange({ from: '2026-12-01', to: '2026-12-05' }, NOW);
    expect(r.days).toEqual(['2026-10-22']);
  });

  it('a range over a year keeps its last days', () => {
    const r = callRange({ from: '2024-01-01', to: '2026-10-22' }, NOW);
    expect(r.days).toHaveLength(MAX_RANGE_DAYS);
    expect(r.toDay).toBe('2026-10-22');
  });

  it('broken dates are ignored', () => {
    expect(callRange({ from: '2026-13-40', to: 'x' }, NOW).token).toBe('7d');
    expect(callRangeQuery(callRange({ range: '30d' }, NOW))).toBe('range=30d');
  });
});

describe('arithmetic', () => {
  it('pct is whole per cent, and null with nothing to divide by', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(0, 5)).toBe(0);
    expect(pct(3, 0)).toBeNull();
  });

  it('median: odd, even, empty, unsorted', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(median([7])).toBe(7);
  });

  it('the median of a histogram is the median of the list it stands for', () => {
    const counts = [
      { value: 0, n: 3 },
      { value: 2, n: 1 },
      { value: 1, n: 2 },
    ];
    expect(medianOfCounts(counts)).toBe(median([0, 0, 0, 1, 1, 2]));
    expect(medianOfCounts([{ value: 4, n: 1 }])).toBe(4);
    expect(medianOfCounts([{ value: 1, n: 1 }, { value: 3, n: 1 }])).toBe(2);
    expect(medianOfCounts([])).toBeNull();
    expect(medianOfCounts([{ value: 9, n: 0 }])).toBeNull();
  });

  it('waits read as people say them', () => {
    expect(waitLabel(null)).toBe('—');
    expect(waitLabel(0.2)).toBe('Under a minute');
    expect(waitLabel(25)).toBe('25 min');
    expect(waitLabel(120)).toBe('2 h');
    expect(waitLabel(190)).toBe('3 h 10 min');
    expect(waitLabel(60 * 52)).toBe('2 days 4 h');
    expect(waitLabel(60 * 24 * 16 + 30)).toBe('16 days');
    expect(waitLabel(-5)).toBe('Under a minute');
  });
});

describe('per lead (the reference the SQL mirrors)', () => {
  const line = (memberId: string | null, outcome: string | null | undefined, iso: string): CallLine => ({ memberId, outcome, at: at(iso) });

  it('tries before the first pick-up count missed dials only, credited to whoever got through', () => {
    const calls = [
      line('a', 'no_answer', '2026-10-20T05:00:00Z'),
      line('a', 'messaged', '2026-10-20T06:00:00Z'),
      line('b', 'switched_off', '2026-10-20T07:00:00Z'),
      line('b', 'spoke', '2026-10-21T05:00:00Z'),
      line('a', 'no_answer', '2026-10-22T05:00:00Z'),
    ];
    expect(firstConnect(calls)).toEqual({ memberId: 'b', at: at('2026-10-21T05:00:00Z'), triesBefore: 2 });
  });

  it('order given does not matter; the first ring getting through is 0 tries', () => {
    const calls = [line('a', 'no_answer', '2026-10-22T05:00:00Z'), line('a', 'busy', '2026-10-20T05:00:00Z')];
    expect(firstConnect(calls)?.triesBefore).toBe(0);
  });

  it('never reached is null', () => {
    expect(firstConnect([line('a', 'no_answer', '2026-10-20T05:00:00Z'), line('a', null, '2026-10-21T05:00:00Z')])).toBeNull();
    expect(firstConnect([])).toBeNull();
  });

  it('time to first call: the first dial, not a message, never negative', () => {
    const arrived = at('2026-10-20T15:30:00Z'); // 9 pm IST
    const calls = [line('a', 'messaged', '2026-10-20T16:00:00Z'), line('b', 'no_answer', '2026-10-21T04:30:00Z')];
    expect(firstDial(arrived, calls)).toEqual({ memberId: 'b', minutes: 13 * 60 });
    expect(firstDial(at('2026-10-22T00:00:00Z'), [line('a', 'spoke', '2026-10-21T00:00:00Z')])?.minutes).toBe(0);
    expect(firstDial(arrived, [line('a', 'met', '2026-10-21T00:00:00Z')])).toBeNull();
  });
});

const HAUSPIRE: StepStage[] = [
  { id: 'new', name: 'New', kind: 'OPEN', sortOrder: 0, isIntake: true },
  { id: 'c1', name: 'Calling 1', kind: 'OPEN', sortOrder: 1, isCallStep: true },
  { id: 'c2', name: 'Calling 2', kind: 'OPEN', sortOrder: 2, isCallStep: true },
  { id: 'c3', name: 'Calling 3', kind: 'OPEN', sortOrder: 3, isCallStep: true },
  { id: 'c4', name: 'Calling 4', kind: 'OPEN', sortOrder: 4, isCallStep: true },
  { id: 'eff', name: 'Effective Lead', kind: 'OPEN', sortOrder: 5 },
  { id: 'quote', name: 'Quotation Shared', kind: 'OPEN', sortOrder: 6 },
  { id: 'junk', name: 'Junk', kind: 'LOST', sortOrder: 7 },
  { id: 'won', name: 'Converted', kind: 'WON', sortOrder: 8 },
  { id: 'lost', name: 'Lost', kind: 'LOST', sortOrder: 9 },
];

describe('the steps, from the studio’s own columns', () => {
  it('Hauspire: New → Calling 1–4 (one step) → Effective Lead → Quotation Shared → Converted, lost columns aside', () => {
    const plan = stepPlan(HAUSPIRE);
    expect(plan.groups.map((g) => g.label)).toEqual(['New', 'Calling 1 – Calling 4', 'Effective Lead', 'Quotation Shared', 'Converted']);
    expect(plan.rankOf).toEqual({ new: 0, c1: 1, c2: 1, c3: 1, c4: 1, eff: 2, quote: 3, won: 4 });
    expect(plan.rankOf.junk).toBeUndefined();
    expect(plan.arrivalRank).toBe(0);
    expect(plan.wonRank).toBe(4);
  });

  it('the funnel ends at Converted: Future Requirement after it is parking, not a step', () => {
    const plan = stepPlan([...HAUSPIRE, { id: 'future', name: 'Future Requirement', kind: 'OPEN', sortOrder: 10 }]);
    expect(plan.groups.map((g) => g.label).at(-1)).toBe('Converted');
    expect(plan.rankOf.future).toBeUndefined();
  });

  it('board order is sortOrder, not the order given', () => {
    const plan = stepPlan([...HAUSPIRE].reverse());
    expect(plan.groups[0]!.label).toBe('New');
  });

  it('one calling step keeps its own name; calling steps split by another column are two steps', () => {
    expect(stepPlan(HAUSPIRE.filter((s) => !['c2', 'c3', 'c4'].includes(s.id))).groups[1]!.label).toBe('Calling 1');
    const split = stepPlan([
      { id: 'n', name: 'New', kind: 'OPEN', sortOrder: 0 },
      { id: 'a', name: 'Calling 1', kind: 'OPEN', sortOrder: 1, isCallStep: true },
      { id: 'm', name: 'Meeting', kind: 'OPEN', sortOrder: 2 },
      { id: 'b', name: 'Calling 2', kind: 'OPEN', sortOrder: 3, isCallStep: true },
    ]);
    expect(split.groups.map((g) => g.label)).toEqual(['New', 'Calling 1', 'Meeting', 'Calling 2']);
    expect(split.wonRank).toBeNull();
  });

  it('the intake column is where leads arrive, even when it is not first', () => {
    const plan = stepPlan([
      { id: 'x', name: 'Referral desk', kind: 'OPEN', sortOrder: 0 },
      { id: 'n', name: 'New', kind: 'OPEN', sortOrder: 1, isIntake: true },
      { id: 'w', name: 'Signed', kind: 'WON', sortOrder: 2 },
      { id: 'd', name: 'Handed over', kind: 'DONE', sortOrder: 3 },
    ]);
    expect(plan.arrivalRank).toBe(1);
    expect(plan.wonRank).toBe(2);
  });

  it('an empty board has no steps', () => {
    expect(stepPlan([])).toEqual({ groups: [], arrivalRank: 0, wonRank: null, rankOf: {} });
  });

  it('rows: one per adjacent pair, zeroes where nothing entered, never more moved on than entered', () => {
    const plan = stepPlan(HAUSPIRE);
    const s = stepRows(plan, [
      { rank: 0, entered: 200, movedOn: 150, reachedWon: 4 },
      { rank: 1, entered: 300, movedOn: 30, reachedWon: 3 },
      { rank: 3, entered: 10, movedOn: 12, reachedWon: 2 },
    ]);
    expect(s.rows).toEqual([
      { from: 'New', to: 'Calling 1 – Calling 4', entered: 200, movedOn: 150, rate: 75 },
      { from: 'Calling 1 – Calling 4', to: 'Effective Lead', entered: 300, movedOn: 30, rate: 10 },
      { from: 'Effective Lead', to: 'Quotation Shared', entered: 0, movedOn: 0, rate: null },
      { from: 'Quotation Shared', to: 'Converted', entered: 10, movedOn: 10, rate: 100 },
    ]);
    expect(s.allTheWay).toEqual({ arrived: 200, won: 4, rate: 2, wonLabel: 'Converted' });
  });

  it('no won column, no "all the way" line', () => {
    const plan = stepPlan(HAUSPIRE.filter((x) => x.kind !== 'WON'));
    expect(stepRows(plan, []).allTheWay).toBeNull();
  });
});

describe('putting it together', () => {
  const range = callRange({ range: '7d' }, NOW);
  const base = (over: Partial<CallStatsInput> = {}): CallStatsInput => ({
    range,
    members: [
      { id: 'asha', name: 'Asha', showAlways: true },
      { id: 'ravi', name: 'Ravi', showAlways: true },
      { id: 'quiet', name: 'Quiet one', showAlways: true },
      { id: 'owner', name: 'Owner' },
    ],
    outcomes: [],
    reach: [],
    tries: [],
    firstCalls: [],
    plan: stepPlan(HAUSPIRE),
    steps: [],
    ...over,
  });

  it('dials, connects and the rate per person; messages and meetings are not dials', () => {
    const s = buildCallStats(
      base({
        outcomes: [
          { memberId: 'asha', day: '2026-10-21', outcome: 'no_answer', n: 30 },
          { memberId: 'asha', day: '2026-10-21', outcome: 'spoke', n: 10 },
          { memberId: 'asha', day: '2026-10-22', outcome: 'messaged', n: 9 },
          { memberId: 'ravi', day: '2026-10-22', outcome: 'busy', n: 5 },
          { memberId: 'ravi', day: '2026-10-22', outcome: 'wrong_number', n: 5 },
        ],
      }),
    );
    const asha = s.people.find((p) => p.memberId === 'asha')!;
    expect(asha).toMatchObject({ dials: 40, connects: 10, connectRate: 25 });
    expect(s.people.find((p) => p.memberId === 'ravi')).toMatchObject({ dials: 10, connects: 5, connectRate: 50 });
    expect(s.total).toMatchObject({ memberId: 'total', dials: 50, connects: 15, connectRate: 30 });
  });

  it('a salesperson with no calls is listed with zeroes; the owner only when they rang', () => {
    const s = buildCallStats(base({ outcomes: [{ memberId: 'asha', day: '2026-10-22', outcome: 'spoke', n: 1 }] }));
    expect(s.people.map((p) => p.name)).toEqual(['Asha', 'Quiet one', 'Ravi']);
    const quiet = s.people.find((p) => p.memberId === 'quiet')!;
    expect(quiet).toMatchObject({ dials: 0, connectRate: null, medianTries: null, medianMinutesToFirstCall: null });
  });

  it('busiest first; calls by somebody no longer on the team sit under one name, last among equals', () => {
    const s = buildCallStats(
      base({
        members: [{ id: 'asha', name: 'Asha' }],
        outcomes: [
          { memberId: null, day: '2026-10-20', outcome: null, n: 3 },
          { memberId: 'gone', day: '2026-10-20', outcome: 'no_answer', n: 3 },
          { memberId: 'asha', day: '2026-10-20', outcome: 'spoke', n: 3 },
        ],
      }),
    );
    expect(s.people.map((p) => p.name)).toEqual(['Asha', NOT_ON_TEAM, NOT_ON_TEAM]);
    expect(s.people[2]!.memberId).toBeNull();
    expect(s.total.dials).toBe(9);
    expect(s.total.connects).toBe(3);
  });

  it('dials per day: every day in the range, oldest first, zeroes included; days outside are ignored', () => {
    const s = buildCallStats(
      base({
        outcomes: [
          { memberId: 'asha', day: '2026-10-16', outcome: 'no_answer', n: 4 },
          { memberId: 'ravi', day: '2026-10-16', outcome: 'spoke', n: 1 },
          { memberId: 'asha', day: '2026-10-22', outcome: 'voicemail', n: 2 },
          { memberId: 'asha', day: '2026-10-01', outcome: 'spoke', n: 99 },
        ],
      }),
    );
    expect(s.daily).toHaveLength(7);
    expect(s.daily[0]).toEqual({ day: '2026-10-16', dials: 5, connects: 1 });
    expect(s.daily[3]).toEqual({ day: '2026-10-19', dials: 0, connects: 0 });
    expect(s.daily[6]).toEqual({ day: '2026-10-22', dials: 2, connects: 0 });
    expect(s.total.dials).toBe(7);
  });

  it('leads reached: per person from the SQL, and the studio total is its own distinct count', () => {
    const s = buildCallStats(
      base({
        reach: [
          { memberId: 'asha', dialled: 30, reached: 8 },
          { memberId: 'ravi', dialled: 20, reached: 6 },
          { memberId: 'total', dialled: 45, reached: 12 },
        ],
      }),
    );
    expect(s.people.find((p) => p.memberId === 'asha')).toMatchObject({ dialled: 30, reached: 8 });
    expect(s.total).toMatchObject({ dialled: 45, reached: 12 });
  });

  it('tries before getting through: a median per person and for everyone, from the histograms', () => {
    const s = buildCallStats(
      base({
        tries: [
          { memberId: 'asha', triesBefore: 0, n: 3 },
          { memberId: 'asha', triesBefore: 4, n: 1 },
          { memberId: 'ravi', triesBefore: 2, n: 2 },
        ],
      }),
    );
    expect(s.people.find((p) => p.memberId === 'asha')).toMatchObject({ firstConnects: 4, medianTries: 0 });
    expect(s.people.find((p) => p.memberId === 'ravi')).toMatchObject({ firstConnects: 2, medianTries: 2 });
    // Everyone: 0,0,0,2,2,4 → (0 + 2) / 2.
    expect(s.total).toMatchObject({ firstConnects: 6, medianTries: 1 });
  });

  it('time to first call: per first dialler, the total from SQL, and leads not rung yet', () => {
    const s = buildCallStats(
      base({
        firstCalls: [
          { memberId: 'asha', called: 10, medianMinutes: 45 },
          { memberId: 'ravi', called: 0, medianMinutes: null },
          { memberId: 'total', called: 10, medianMinutes: 45, notCalled: 7 },
        ],
      }),
    );
    expect(s.people.find((p) => p.memberId === 'asha')).toMatchObject({ firstCalls: 10, medianMinutesToFirstCall: 45 });
    expect(s.people.find((p) => p.memberId === 'ravi')).toMatchObject({ firstCalls: 0, medianMinutesToFirstCall: null });
    expect(s.total).toMatchObject({ firstCalls: 10, medianMinutesToFirstCall: 45 });
    expect(s.notCalled).toBe(7);
  });

  it('nothing at all: zeroes and nulls, never NaN', () => {
    const s = buildCallStats(base({ members: [] }));
    expect(s.people).toEqual([]);
    expect(s.total).toMatchObject({ dials: 0, connects: 0, connectRate: null, medianTries: null, medianMinutesToFirstCall: null });
    expect(s.notCalled).toBe(0);
    expect(s.steps.rows).toHaveLength(4);
    expect(s.steps.rows.every((r) => r.rate === null)).toBe(true);
  });
});
