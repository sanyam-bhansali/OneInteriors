import { describe, expect, it } from 'vitest';
import {
  canTakeLeads,
  checkOverride,
  checkRouting,
  describeRouting,
  effectiveRule,
  eligibleFor,
  needsTurn,
  readConnectionRouting,
  readRouting,
  routeLead,
  routedLine,
  MAX_TURN_MEMBERS,
  type RoutingMember,
  type StudioRouting,
} from '@/modules/studio-sales/lead-routing';

/**
 * "New leads go to" (owner, 22 Oct 2026; studio-sales/lead-routing.ts):
 * who gets a lead that arrives by itself. Every mode, every way a person can
 * fail to be eligible, the door's override, and the turn arithmetic.
 */

const owner: RoutingMember = { id: 'm-owner', role: 'OWNER', status: 'ACTIVE', name: 'Owner' };
const pm: RoutingMember = { id: 'm-pm', role: 'PM', status: 'ACTIVE', name: 'Priya PM' };
const asha: RoutingMember = { id: 'm-asha', role: 'SALES', status: 'ACTIVE', name: 'Asha' };
const ravi: RoutingMember = { id: 'm-ravi', role: 'SALES', status: 'ACTIVE', name: 'Ravi' };
const meena: RoutingMember = { id: 'm-meena', role: 'SALES', status: 'ACTIVE', name: 'Meena' };
const suspended: RoutingMember = { id: 'm-gone', role: 'SALES', status: 'SUSPENDED', name: 'Suspended Sam' };
const invited: RoutingMember = { id: 'm-new', role: 'SALES', status: 'INVITED', name: 'Invited Ira' };
const supervisor: RoutingMember = { id: 'm-site', role: 'SUPERVISOR', status: 'ACTIVE', name: 'Site Sunil' };
const accounts: RoutingMember = { id: 'm-acc', role: 'ACCOUNTS', status: 'ACTIVE', name: 'Accounts Anil' };
const designer: RoutingMember = { id: 'm-des', role: 'DESIGNER', status: 'ACTIVE', name: 'Designer Dia' };
const TEAM = [owner, pm, asha, ravi, meena, suspended, invited, supervisor, accounts, designer];

const studio = (r: Partial<StudioRouting>): StudioRouting => ({ mode: 'POOL', personId: null, turnIds: [], ...r });

describe('who can be given a lead', () => {
  it.each([
    [owner, true, true],
    [owner, false, true],
    [pm, true, true],
    /* A PM is a Max role: on Pro they can do nothing (roles.ts). */
    [pm, false, false],
    [asha, true, true],
    [asha, false, true],
    [suspended, true, false],
    [invited, true, false],
    [supervisor, true, false],
    [accounts, true, false],
    [designer, true, false],
  ] as const)('%o on Max=%s → %s', (m, full, yes) => {
    expect(canTakeLeads(m, full)).toBe(yes);
  });
});

describe('reading what is stored', () => {
  it('repairs a bad mode, blank ids and duplicates', () => {
    expect(readRouting(null)).toEqual({ mode: 'POOL', personId: null, turnIds: [] });
    expect(readRouting({ leadRouteMode: 'ROUND_ROBIN', leadRouteMemberId: '', leadRouteTurnIds: 'x' })).toEqual({ mode: 'POOL', personId: null, turnIds: [] });
    expect(readRouting({ leadRouteMode: 'TURNS', leadRouteMemberId: null, leadRouteTurnIds: ['a', 'b', 'a', '', 7] })).toEqual({ mode: 'TURNS', personId: null, turnIds: ['a', 'b'] });
    const many = Array.from({ length: 30 }, (_, i) => `m${i}`);
    expect(readRouting({ leadRouteMode: 'TURNS', leadRouteTurnIds: many }).turnIds).toHaveLength(MAX_TURN_MEMBERS);
  });

  it('a door with no override, or none at all', () => {
    expect(readConnectionRouting(null)).toBeNull();
    expect(readConnectionRouting({ routeMode: null, routeMemberId: null, label: 'Website' })).toEqual({ mode: null, personId: null, label: 'Website' });
    expect(readConnectionRouting({ routeMode: 'nonsense', label: 3 })).toEqual({ mode: null, personId: null, label: '' });
  });
});

describe('the rule that applies', () => {
  const turns = studio({ mode: 'TURNS', turnIds: [asha.id, ravi.id] });

  it('the studio’s, when the door has no override', () => {
    expect(effectiveRule(turns, null)).toEqual({ mode: 'TURNS', personId: null, turnIds: [asha.id, ravi.id], from: 'studio', label: null });
    expect(effectiveRule(turns, { mode: null, personId: 'x', label: 'Website' }).from).toBe('studio');
  });

  it('the door’s: pool, a person, or turns from the studio’s list', () => {
    expect(effectiveRule(turns, { mode: 'POOL', personId: null, label: '99acres' })).toMatchObject({ mode: 'POOL', from: 'connection', label: '99acres' });
    expect(effectiveRule(turns, { mode: 'PERSON', personId: meena.id, label: 'Meta' })).toMatchObject({ mode: 'PERSON', personId: meena.id, from: 'connection' });
    expect(effectiveRule(studio({ mode: 'PERSON', personId: asha.id, turnIds: [ravi.id, meena.id] }), { mode: 'TURNS', personId: 'ignored', label: 'Google' })).toMatchObject({
      mode: 'TURNS',
      personId: null,
      turnIds: [ravi.id, meena.id],
    });
  });
});

describe('who gets the lead', () => {
  it('POOL: nobody, and no timeline line', () => {
    const d = routeLead(effectiveRule(studio({}), null), TEAM, true);
    expect(d).toEqual({ kind: 'pool', why: 'POOL', from: 'studio', label: null });
    expect(routedLine(d)).toBeNull();
    expect(needsTurn(effectiveRule(studio({}), null), TEAM, true)).toBe(false);
  });

  it('PERSON: that person, with the ASSIGNED line', () => {
    const d = routeLead(effectiveRule(studio({ mode: 'PERSON', personId: asha.id }), null), TEAM, true);
    expect(d).toEqual({ kind: 'person', memberId: asha.id, name: 'Asha', mode: 'PERSON', from: 'studio', label: null });
    expect(routedLine(d)).toEqual({ kind: 'ASSIGNED', summary: 'Given to Asha (new leads go to Asha)' });
  });

  it.each([
    ['suspended', suspended.id],
    ['invited, never signed in', invited.id],
    ['a supervisor', supervisor.id],
    ['accounts', accounts.id],
    ['a designer', designer.id],
    ['gone from the team', 'm-left'],
  ])('PERSON who is %s: the pool, with a note saying why', (_why, id) => {
    const d = routeLead(effectiveRule(studio({ mode: 'PERSON', personId: id }), null), TEAM, true);
    expect(d).toEqual({ kind: 'pool', why: 'UNAVAILABLE', from: 'studio', label: null });
    expect(routedLine(d, 'Suspended Sam')).toEqual({ kind: 'NOTE', summary: 'Left in the pool: new leads go to Suspended Sam, and nobody chosen can take leads right now.' });
  });

  it('PERSON with nobody chosen: the pool', () => {
    expect(routeLead(effectiveRule(studio({ mode: 'PERSON' }), null), TEAM, true)).toMatchObject({ kind: 'pool', why: 'UNAVAILABLE' });
  });

  it('a PM on Pro is skipped; on Max they are given it', () => {
    const rule = effectiveRule(studio({ mode: 'PERSON', personId: pm.id }), null);
    expect(routeLead(rule, TEAM, false)).toMatchObject({ kind: 'pool', why: 'UNAVAILABLE' });
    expect(routeLead(rule, TEAM, true)).toMatchObject({ kind: 'person', memberId: pm.id });
  });

  it('TURNS goes round in the owner’s order, one turn per lead', () => {
    const rule = effectiveRule(studio({ mode: 'TURNS', turnIds: [ravi.id, asha.id, meena.id] }), null);
    expect(needsTurn(rule, TEAM, true)).toBe(true);
    const who = [1, 2, 3, 4, 5, 6, 7].map((t) => {
      const d = routeLead(rule, TEAM, true, t);
      return d.kind === 'person' ? d.name : null;
    });
    expect(who).toEqual(['Ravi', 'Asha', 'Meena', 'Ravi', 'Asha', 'Meena', 'Ravi']);
    expect(routedLine(routeLead(rule, TEAM, true, 1))).toEqual({ kind: 'ASSIGNED', summary: 'Given to Ravi (new leads take turns)' });
  });

  it('TURNS: two leads landing together get different turns, so different people', () => {
    const rule = effectiveRule(studio({ mode: 'TURNS', turnIds: [asha.id, ravi.id] }), null);
    const a = routeLead(rule, TEAM, true, 41);
    const b = routeLead(rule, TEAM, true, 42);
    expect(a.kind === 'person' && b.kind === 'person' && a.memberId !== b.memberId).toBe(true);
  });

  it('TURNS skips somebody suspended without the others losing their order', () => {
    const rule = effectiveRule(studio({ mode: 'TURNS', turnIds: [asha.id, suspended.id, ravi.id, supervisor.id] }), null);
    expect(eligibleFor(rule, TEAM, true).map((m) => m.id)).toEqual([asha.id, ravi.id]);
    const who = [1, 2, 3, 4].map((t) => {
      const d = routeLead(rule, TEAM, true, t);
      return d.kind === 'person' ? d.name : null;
    });
    expect(who).toEqual(['Asha', 'Ravi', 'Asha', 'Ravi']);
  });

  it('TURNS with nobody able: the pool, and no turn is used up', () => {
    const rule = effectiveRule(studio({ mode: 'TURNS', turnIds: [suspended.id, invited.id] }), null);
    expect(needsTurn(rule, TEAM, true)).toBe(false);
    expect(routeLead(rule, TEAM, true, 5)).toMatchObject({ kind: 'pool', why: 'UNAVAILABLE' });
    expect(needsTurn(effectiveRule(studio({ mode: 'TURNS', turnIds: [] }), null), TEAM, true)).toBe(false);
  });

  it('TURNS without a usable turn is the first turn, never a throw', () => {
    const rule = effectiveRule(studio({ mode: 'TURNS', turnIds: [asha.id, ravi.id] }), null);
    for (const t of [null, 0, -3, 1.5, Number.NaN]) expect(routeLead(rule, TEAM, true, t)).toMatchObject({ kind: 'person', memberId: asha.id });
  });

  it('a door’s override names the door in the line', () => {
    const base = studio({ mode: 'TURNS', turnIds: [asha.id, ravi.id] });
    const meta = routeLead(effectiveRule(base, { mode: 'PERSON', personId: meena.id, label: 'Hauspire Facebook Page' }), TEAM, true);
    expect(routedLine(meta)).toEqual({ kind: 'ASSIGNED', summary: 'Given to Meena (leads from Hauspire Facebook Page go to Meena)' });
    const portal = routeLead(effectiveRule(studio({ mode: 'PERSON', personId: asha.id }), { mode: 'POOL', personId: null, label: '99acres' }), TEAM, true);
    expect(portal).toEqual({ kind: 'pool', why: 'POOL', from: 'connection', label: '99acres' });
    expect(routedLine(portal)).toBeNull();
    const turnsDoor = routeLead(effectiveRule(base, { mode: 'TURNS', personId: null, label: 'Google' }), TEAM, true, 2);
    expect(routedLine(turnsDoor)).toEqual({ kind: 'ASSIGNED', summary: 'Given to Ravi (leads from Google take turns)' });
    const gone = routeLead(effectiveRule(base, { mode: 'PERSON', personId: suspended.id, label: 'Website' }), TEAM, true);
    expect(routedLine(gone, 'Suspended Sam')?.summary).toBe('Left in the pool: leads from Website go to Suspended Sam, and nobody chosen can take leads right now.');
  });
});

describe('what the settings screen says and accepts', () => {
  it('describes each mode', () => {
    expect(describeRouting(studio({}), TEAM, true)).toMatch(/pool/);
    expect(describeRouting(studio({ mode: 'PERSON', personId: asha.id }), TEAM, true)).toBe('Every new lead goes to Asha.');
    expect(describeRouting(studio({ mode: 'PERSON', personId: suspended.id }), TEAM, true)).toMatch(/cannot take leads right now/);
    expect(describeRouting(studio({ mode: 'TURNS', turnIds: [asha.id, ravi.id] }), TEAM, true)).toBe('New leads go to Asha, Ravi in turn.');
    expect(describeRouting(studio({ mode: 'TURNS', turnIds: [suspended.id] }), TEAM, true)).toMatch(/Nobody in the turn list/);
  });

  it('checks a studio rule', () => {
    expect(checkRouting({ mode: 'POOL', personId: asha.id, turnIds: [asha.id] }, TEAM, true)).toEqual({ ok: true, routing: { mode: 'POOL', personId: null, turnIds: [] } });
    expect(checkRouting({ mode: 'PERSON', personId: asha.id }, TEAM, true)).toEqual({ ok: true, routing: { mode: 'PERSON', personId: asha.id, turnIds: [] } });
    expect(checkRouting({ mode: 'PERSON', personId: suspended.id }, TEAM, true).ok).toBe(false);
    expect(checkRouting({ mode: 'PERSON', personId: 'm-other-studio' }, TEAM, true).ok).toBe(false);
    expect(checkRouting({ mode: 'PERSON', personId: pm.id }, TEAM, false).ok).toBe(false);
    expect(checkRouting({ mode: 'TURNS', turnIds: [asha.id, ravi.id, asha.id] }, TEAM, true)).toEqual({ ok: true, routing: { mode: 'TURNS', personId: null, turnIds: [asha.id, ravi.id] } });
    expect(checkRouting({ mode: 'TURNS', turnIds: [asha.id] }, TEAM, true)).toMatchObject({ ok: false, error: expect.stringMatching(/at least two/) });
    expect(checkRouting({ mode: 'TURNS', turnIds: [asha.id, designer.id] }, TEAM, true).ok).toBe(false);
    expect(checkRouting({ mode: 'TURNS', turnIds: 'x' }, TEAM, true).ok).toBe(false);
    expect(checkRouting({ mode: 'EVERYONE' }, TEAM, true).ok).toBe(false);
  });

  it('checks a door’s override', () => {
    expect(checkOverride({ mode: '' }, TEAM, true)).toEqual({ ok: true, mode: null, personId: null });
    expect(checkOverride({ mode: null }, TEAM, true)).toEqual({ ok: true, mode: null, personId: null });
    expect(checkOverride({ mode: 'POOL', personId: asha.id }, TEAM, true)).toEqual({ ok: true, mode: 'POOL', personId: null });
    expect(checkOverride({ mode: 'TURNS' }, TEAM, true)).toEqual({ ok: true, mode: 'TURNS', personId: null });
    expect(checkOverride({ mode: 'PERSON', personId: meena.id }, TEAM, true)).toEqual({ ok: true, mode: 'PERSON', personId: meena.id });
    expect(checkOverride({ mode: 'PERSON', personId: accounts.id }, TEAM, true).ok).toBe(false);
    expect(checkOverride({ mode: 'PERSON' }, TEAM, true).ok).toBe(false);
    expect(checkOverride({ mode: 'BOGUS' }, TEAM, true).ok).toBe(false);
  });
});
