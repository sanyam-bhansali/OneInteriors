import { describe, expect, it } from 'vitest';
import {
  autoRequestSkip,
  buildersNow,
  buildsNow,
  checkBuilderIds,
  checkReassign,
  describeBuilders,
  isActiveRequest,
  mayBeBuilder,
  nextInTurn,
  nextStatus,
  readBuilderIds,
  refusalFor,
  requestLine,
  requestedMessage,
  staleNote,
  turnOrder,
  turnsFrom,
  waitingFor,
  withFile,
  MAX_BUILDERS,
  MAX_REQUEST_FILES,
  type BuilderMember,
  type QuoteRequestEvent,
  type QuoteRequestStatusName,
} from '@/modules/studio-quote/quote-request-rules';

/* Hauspire, 22 Oct 2026: the owner, Swarupa (Sales head, builds), Khushi
   (Sales rep given "Builds quotations"), Asha (Sales rep, does not build),
   a PM, and a designer. In the order they joined. */
const BUILD = { 'leads.view': 'own', 'quotes.write': 'own', 'quotes.build': true };
const NO_BUILD = { 'leads.view': 'own', 'quotes.write': 'own' };
const team = (over: Partial<Record<string, Partial<BuilderMember>>> = {}): BuilderMember[] =>
  [
    { id: 'owner', name: 'Sanyam', role: 'OWNER', status: 'ACTIVE', salesPermissions: null },
    { id: 'swarupa', name: 'Swarupa', role: 'SALES', status: 'ACTIVE', salesPermissions: BUILD },
    { id: 'khushi', name: 'Khushi', role: 'SALES', status: 'ACTIVE', salesPermissions: BUILD },
    { id: 'asha', name: 'Asha', role: 'SALES', status: 'ACTIVE', salesPermissions: NO_BUILD },
    { id: 'pm', name: 'Priya', role: 'PM', status: 'ACTIVE', salesPermissions: null },
    { id: 'des', name: 'Dev', role: 'DESIGNER', status: 'ACTIVE', salesPermissions: null },
  ].map((m) => ({ ...m, ...(over[m.id] ?? {}) }));

const ids = (seats: { id: string }[]) => seats.map((s) => s.id);

describe('who may build quotations', () => {
  it('a salesperson whose role has quotes.build, listed or not', () => {
    const [, swarupa] = team();
    expect(mayBeBuilder(swarupa!, false)).toBe(true);
    expect(mayBeBuilder(swarupa!, true)).toBe(true);
  });

  it('a plain owner only when the studio lists them', () => {
    const [owner] = team();
    expect(mayBeBuilder(owner!, false)).toBe(false);
    expect(mayBeBuilder(owner!, true)).toBe(true);
  });

  it('never a PM, a designer, or a salesperson without the permission (listed or not)', () => {
    const t = team();
    for (const id of ['pm', 'des', 'asha']) {
      const m = t.find((x) => x.id === id)!;
      expect(mayBeBuilder(m, false), id).toBe(false);
      expect(mayBeBuilder(m, true), id).toBe(false);
    }
  });

  it('a salesperson with no sales role (Phase 1) does not build', () => {
    expect(mayBeBuilder({ id: 'x', name: 'X', role: 'SALES', status: 'ACTIVE', salesPermissions: null }, true)).toBe(false);
  });

  it('an unreadable permission value never grants', () => {
    expect(mayBeBuilder({ id: 'x', name: 'X', role: 'SALES', status: 'ACTIVE', salesPermissions: { 'quotes.build': 'yes' } }, false)).toBe(false);
    expect(mayBeBuilder({ id: 'x', name: 'X', role: 'SALES', status: 'ACTIVE', salesPermissions: '{"quotes.build":true}' }, false)).toBe(false);
  });

  it('only active people get turns now', () => {
    for (const status of ['INVITED', 'SUSPENDED']) {
      const m = team({ khushi: { status } }).find((x) => x.id === 'khushi')!;
      expect(mayBeBuilder(m, false)).toBe(true);
      expect(buildsNow(m, false), status).toBe(false);
    }
  });
});

describe('readBuilderIds', () => {
  it('repairs what is stored', () => {
    expect(readBuilderIds(null)).toEqual([]);
    expect(readBuilderIds('khushi')).toEqual([]);
    expect(readBuilderIds(['khushi', 'khushi', '', 7, 'swarupa', 'x'.repeat(65)])).toEqual(['khushi', 'swarupa']);
    expect(readBuilderIds(Array.from({ length: 30 }, (_, i) => `m${i}`))).toHaveLength(MAX_BUILDERS);
  });
});

describe('the turn order', () => {
  it('default: every salesperson whose role builds, in the order they joined; no owner', () => {
    expect(ids(turnOrder(team(), []))).toEqual(['swarupa', 'khushi']);
    expect(ids(buildersNow(team(), []))).toEqual(['swarupa', 'khushi']);
  });

  it('default: someone away keeps their seat but is not eligible', () => {
    const order = turnOrder(team({ swarupa: { status: 'SUSPENDED' } }), []);
    expect(order.map((s) => [s.id, s.eligible])).toEqual([
      ['swarupa', false],
      ['khushi', true],
    ]);
  });

  it("a list: the list's order, the owner allowed, people who cannot build or left the team dropped", () => {
    const order = turnOrder(team(), ['khushi', 'gone', 'asha', 'owner', 'swarupa', 'pm']);
    expect(ids(order)).toEqual(['khushi', 'owner', 'swarupa']);
    expect(order.every((s) => s.eligible)).toBe(true);
  });

  it('a list whose people all lost the permission: nobody', () => {
    expect(turnOrder(team({ khushi: { salesPermissions: NO_BUILD } }), ['khushi'])).toEqual([]);
  });

  it('nobody builds yet: an empty order', () => {
    const t = team({ swarupa: { salesPermissions: NO_BUILD }, khushi: { salesPermissions: NO_BUILD } });
    expect(turnOrder(t, [])).toEqual([]);
    expect(nextInTurn(turnOrder(t, []), null)).toBeNull();
  });
});

describe('whose turn it is', () => {
  const order = turnOrder(team(), ['khushi', 'swarupa']);

  it('Khushi, Swarupa, Khushi, Swarupa… from a fresh studio', () => {
    expect(turnsFrom(order, null, 5).picks).toEqual(['khushi', 'swarupa', 'khushi', 'swarupa', 'khushi']);
  });

  it('carries on from the cursor', () => {
    expect(nextInTurn(order, 'khushi')?.id).toBe('swarupa');
    expect(nextInTurn(order, 'swarupa')?.id).toBe('khushi');
  });

  it('a cursor not in the order (never set, or that person left the list) starts from the top', () => {
    expect(nextInTurn(order, null)?.id).toBe('khushi');
    expect(nextInTurn(order, 'asha')?.id).toBe('khushi');
  });

  it('skips someone away without the others losing their place, and gives them turns again when back', () => {
    const three = turnOrder(team({ asha: { salesPermissions: BUILD } }), ['khushi', 'swarupa', 'asha']);
    expect(turnsFrom(three, null, 3).picks).toEqual(['khushi', 'swarupa', 'asha']);
    const away = turnOrder(team({ asha: { salesPermissions: BUILD }, swarupa: { status: 'SUSPENDED' } }), ['khushi', 'swarupa', 'asha']);
    const day = turnsFrom(away, 'khushi', 3);
    expect(day.picks).toEqual(['asha', 'khushi', 'asha']);
    /* Swarupa back: her seat is after Khushi again. */
    expect(turnsFrom(three, 'khushi', 3).picks).toEqual(['swarupa', 'asha', 'khushi']);
  });

  it('one builder gets every request', () => {
    const one = turnOrder(team({ swarupa: { status: 'SUSPENDED' } }), []);
    expect(turnsFrom(one, null, 3).picks).toEqual(['khushi', 'khushi', 'khushi']);
    expect(nextInTurn(one, 'khushi')?.id).toBe('khushi');
  });

  it('fair over a run: n requests between k builders differ by at most one', () => {
    const four = turnOrder(
      team({ asha: { salesPermissions: BUILD } }).concat({ id: 'meera', name: 'Meera', role: 'SALES', status: 'ACTIVE', salesPermissions: BUILD }),
      [],
    );
    for (const n of [1, 5, 13, 40]) {
      const counts = new Map<string, number>();
      for (const id of turnsFrom(four, null, n).picks) counts.set(id, (counts.get(id) ?? 0) + 1);
      const values = [...counts.values()];
      expect(Math.max(...values) - Math.min(...values), String(n)).toBeLessThanOrEqual(1);
    }
  });

  it('a reassignment does not move the cursor, so the turns stay where they were', () => {
    /* Khushi got #1 in turn; a head moved it to Swarupa. The cursor still says Khushi: #2 is Swarupa's turn. */
    expect(nextInTurn(order, 'khushi')?.id).toBe('swarupa');
  });

  it('nobody active: null (the request waits, unassigned)', () => {
    const none = turnOrder(team({ swarupa: { status: 'SUSPENDED' }, khushi: { status: 'INVITED' } }), []);
    expect(nextInTurn(none, null)).toBeNull();
    expect(turnsFrom(none, 'khushi', 3)).toEqual({ picks: [], lastId: 'khushi' });
  });
});

describe('states', () => {
  const events: QuoteRequestEvent[] = ['start', 'done', 'cancel', 'reassign', 'extend'];
  const table: Record<QuoteRequestStatusName, Record<QuoteRequestEvent, QuoteRequestStatusName | null>> = {
    OPEN: { start: 'IN_PROGRESS', done: 'DONE', cancel: 'CANCELLED', reassign: 'OPEN', extend: 'OPEN' },
    IN_PROGRESS: { start: 'IN_PROGRESS', done: 'DONE', cancel: 'CANCELLED', reassign: 'OPEN', extend: 'IN_PROGRESS' },
    DONE: { start: null, done: null, cancel: null, reassign: null, extend: null },
    CANCELLED: { start: null, done: null, cancel: null, reassign: null, extend: null },
  };

  it('every status × event, as the table says', () => {
    for (const from of Object.keys(table) as QuoteRequestStatusName[]) {
      for (const e of events) expect(nextStatus(from, e), `${from} ${e}`).toBe(table[from][e]);
    }
  });

  it('only OPEN and IN_PROGRESS are active', () => {
    expect(isActiveRequest('OPEN')).toBe(true);
    expect(isActiveRequest('IN_PROGRESS')).toBe(true);
    expect(isActiveRequest('DONE')).toBe(false);
    expect(isActiveRequest('CANCELLED')).toBe(false);
  });

  it('refusals say why, and nothing is refused on an active request', () => {
    for (const e of events) {
      expect(refusalFor('OPEN', e)).toBeNull();
      expect(refusalFor('IN_PROGRESS', e)).toBeNull();
      expect(refusalFor('DONE', e)).toBe('This request is done already.');
      expect(refusalFor('CANCELLED', e)).toBe('This request was cancelled.');
    }
  });
});

describe('reassigning', () => {
  const builders = buildersNow(team(), []);

  it('to another builder', () => {
    expect(checkReassign({ status: 'IN_PROGRESS', currentId: 'khushi', targetId: 'swarupa' }, builders)).toEqual({ ok: true, memberId: 'swarupa', name: 'Swarupa' });
    expect(checkReassign({ status: 'OPEN', currentId: null, targetId: 'khushi' }, builders)).toEqual({ ok: true, memberId: 'khushi', name: 'Khushi' });
  });

  it('not to someone who does not build, not to nobody, not to the same person', () => {
    expect(checkReassign({ status: 'OPEN', currentId: 'khushi', targetId: 'asha' }, builders)).toEqual({ ok: false, error: 'Pick someone who builds quotations.' });
    expect(checkReassign({ status: 'OPEN', currentId: 'khushi', targetId: 'owner' }, builders).ok).toBe(false);
    expect(checkReassign({ status: 'OPEN', currentId: 'khushi', targetId: 42 }, builders).ok).toBe(false);
    expect(checkReassign({ status: 'OPEN', currentId: 'khushi', targetId: 'khushi' }, builders)).toEqual({ ok: false, error: 'Khushi has it already.' });
  });

  it('not a finished request', () => {
    expect(checkReassign({ status: 'DONE', currentId: 'khushi', targetId: 'swarupa' }, builders)).toEqual({ ok: false, error: 'This request is done already.' });
    expect(checkReassign({ status: 'CANCELLED', currentId: 'khushi', targetId: 'swarupa' }, builders).ok).toBe(false);
  });

  it('not to someone away', () => {
    const seats = turnOrder(team({ swarupa: { status: 'SUSPENDED' } }), []);
    expect(checkReassign({ status: 'OPEN', currentId: 'khushi', targetId: 'swarupa' }, seats).ok).toBe(false);
  });
});

describe('"Who builds quotations"', () => {
  it('empty is allowed: everyone whose role builds', () => {
    expect(checkBuilderIds([], team())).toEqual({ ok: true, ids: [] });
  });

  it('keeps the order, drops repeats, allows the owner', () => {
    expect(checkBuilderIds(['khushi', 'owner', 'khushi', 'swarupa'], team())).toEqual({ ok: true, ids: ['khushi', 'owner', 'swarupa'] });
  });

  it('refuses someone who cannot build, is away, or is not on the team', () => {
    expect(checkBuilderIds(['asha'], team())).toEqual({ ok: false, error: 'Asha cannot build quotations: give their sales role "Builds quotations" first.' });
    expect(checkBuilderIds(['pm'], team()).ok).toBe(false);
    expect(checkBuilderIds(['khushi'], team({ khushi: { status: 'SUSPENDED' } }))).toEqual({ ok: false, error: 'Khushi is not active, so cannot take turns.' });
    expect(checkBuilderIds(['someone-else'], team())).toEqual({ ok: false, error: 'Someone on the list is not on your team.' });
  });

  it('refuses nonsense and too many', () => {
    expect(checkBuilderIds('khushi', team()).ok).toBe(false);
    const many = Array.from({ length: MAX_BUILDERS + 1 }, (_, i) => ({ id: `m${i}`, name: `M${i}`, role: 'SALES', status: 'ACTIVE', salesPermissions: BUILD }));
    expect(checkBuilderIds(many.map((m) => m.id), many).ok).toBe(false);
  });

  it('says what the rule does', () => {
    expect(describeBuilders(team(), [])).toBe('Quotation requests go to Swarupa and Khushi in turn.');
    expect(describeBuilders(team(), ['khushi', 'owner', 'swarupa'])).toBe('Quotation requests go to Khushi, Sanyam and Swarupa in turn.');
    expect(describeBuilders(team({ swarupa: { status: 'SUSPENDED' } }), [])).toBe('Every quotation request goes to Khushi.');
    expect(describeBuilders(team({ swarupa: { salesPermissions: NO_BUILD }, khushi: { salesPermissions: NO_BUILD } }), [])).toMatch(/^Nobody builds quotations yet/);
    expect(describeBuilders(team({ khushi: { status: 'SUSPENDED' } }), ['khushi'])).toMatch(/^Nobody on your list/);
  });
});

describe('a second floor plan joins the open request', () => {
  it('kept once, newest last, capped', () => {
    expect(withFile([], 'a')).toEqual(['a']);
    expect(withFile(['a'], 'a')).toEqual(['a']);
    expect(withFile(['a'], 'b')).toEqual(['a', 'b']);
    expect(withFile(['a'], null)).toEqual(['a']);
    const full = Array.from({ length: MAX_REQUEST_FILES }, (_, i) => `f${i}`);
    expect(withFile(full, 'new')).toEqual([...full.slice(1), 'new']);
  });
});

describe('when a floor plan makes a request by itself', () => {
  it('a fresh lead: yes', () => {
    expect(autoRequestSkip({ fromOneInteriors: false, booked: false, sentQuotes: 0 })).toBeNull();
  });
  it('not for a One Interiors client, a booked one, or one already sent a quotation', () => {
    expect(autoRequestSkip({ fromOneInteriors: true, booked: false, sentQuotes: 0 })).toMatch(/One Interiors/);
    expect(autoRequestSkip({ fromOneInteriors: false, booked: true, sentQuotes: 0 })).toMatch(/booked/);
    expect(autoRequestSkip({ fromOneInteriors: false, booked: false, sentQuotes: 1 })).toMatch(/Request quotation/);
  });
});

describe('lost and binned leads', () => {
  it('cancel with the reason', () => {
    expect(staleNote({ deletedAt: new Date(), stageKind: 'OPEN' })).toBe('The lead was put in the bin.');
    expect(staleNote({ deletedAt: null, stageKind: 'LOST' })).toBe('The lead was lost.');
    expect(staleNote({ deletedAt: new Date(), stageKind: 'LOST' })).toBe('The lead was put in the bin.');
  });
  it('an open or won lead keeps its request', () => {
    expect(staleNote({ deletedAt: null, stageKind: 'OPEN' })).toBeNull();
    expect(staleNote({ deletedAt: null, stageKind: 'WON' })).toBeNull();
    expect(staleNote({ deletedAt: null, stageKind: null })).toBeNull();
  });
});

describe('words', () => {
  it('the lead page line', () => {
    expect(requestLine({ status: 'IN_PROGRESS', assignedName: 'Khushi', mine: false })).toBe('Quotation being built by Khushi.');
    expect(requestLine({ status: 'OPEN', assignedName: 'Khushi', mine: false })).toBe('Quotation being built by Khushi (not opened yet).');
    expect(requestLine({ status: 'OPEN', assignedName: 'Khushi', mine: true })).toMatch(/^You are to build/);
    expect(requestLine({ status: 'IN_PROGRESS', assignedName: 'Khushi', mine: true })).toBe('You are building this quotation.');
    expect(requestLine({ status: 'OPEN', assignedName: null, mine: false })).toMatch(/Nobody builds quotations yet/);
    expect(requestLine({ status: 'DONE', assignedName: 'Swarupa', mine: false })).toBe('Quotation built and sent by Swarupa.');
    expect(requestLine({ status: 'CANCELLED', assignedName: 'Khushi', mine: false, cancelNote: 'The lead was lost.' })).toBe('Quotation request cancelled: The lead was lost.');
    expect(requestLine({ status: 'CANCELLED', assignedName: null, mine: false })).toBe('Quotation request cancelled.');
  });

  it('waiting since', () => {
    const now = new Date('2026-10-22T12:00:00Z');
    const ago = (ms: number) => new Date(now.getTime() - ms);
    expect(waitingFor(ago(30_000), now)).toBe('just now');
    expect(waitingFor(ago(25 * 60_000), now)).toBe('25 min');
    expect(waitingFor(ago(3 * 3_600_000), now)).toBe('3 h');
    expect(waitingFor(ago(30 * 3_600_000), now)).toBe('1 day');
    expect(waitingFor(ago(3 * 86_400_000), now)).toBe('3 days');
    expect(waitingFor(new Date(now.getTime() + 60_000), now)).toBe('just now');
  });

  it('what "Request quotation" answers', () => {
    expect(requestedMessage({ created: true, assignedName: 'Khushi', mine: false })).toBe('Requested. Khushi builds it (their turn) and has been told.');
    expect(requestedMessage({ created: false, assignedName: 'Khushi', mine: false })).toBe('Khushi is building this one already.');
    expect(requestedMessage({ created: true, assignedName: 'Swarupa', mine: true })).toMatch(/came to you/);
    expect(requestedMessage({ created: false, assignedName: 'Swarupa', mine: true })).toBe('You are building this one already.');
    expect(requestedMessage({ created: true, assignedName: null, mine: false })).toMatch(/Nobody builds quotations yet/);
    expect(requestedMessage({ created: false, assignedName: null, mine: false })).toMatch(/open already/);
  });
});
