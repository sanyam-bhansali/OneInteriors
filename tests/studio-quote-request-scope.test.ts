import { describe, expect, it, vi } from 'vitest';

/* Quotation requests (owner, 22 Oct 2026; docs/studio-os/QUOTE-REQUESTS.md):
   a builder quotes the leads handed to them, whatever their lead reach, and
   nothing else widens. leadScopeFor and mayOnLead are pure apart from the
   member; the database is never reached here. */
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/studio/access', () => ({ currentMember: vi.fn(async () => null) }));

import { leadScopeFor, mayOnLead } from '@/modules/studio/lead-scope';
import { buildSalesContext } from '@/modules/studio/sales-access';
import { messageFor } from '@/modules/notify/messages';

const rep = (permissions: Record<string, unknown>) => ({
  id: 'm-khushi',
  studioId: 's1',
  userId: 'u-khushi',
  role: 'SALES' as const,
  status: 'ACTIVE' as const,
  sales: buildSalesContext({ id: 'm-khushi', reportsToId: 'm-swarupa' }, { id: 'r', name: 'Sales rep', permissions }, [
    { id: 'm-swarupa', reportsToId: null },
    { id: 'm-khushi', reportsToId: 'm-swarupa' },
  ]),
});

const BUILDS = { 'leads.view': 'own', 'leads.edit': 'own', 'quotes.write': 'own', 'quotes.build': true };
const SWARUPAS_LEAD = { assignedToId: 'm-swarupa', poolTeamId: null };

describe('a builder and the leads handed to them', () => {
  it('a builder who sees only their own leads gets the requested-leads clause; leads itself is not widened', () => {
    const scope = leadScopeFor(rep(BUILDS))!;
    expect(scope.requested).toEqual({
      studioId: 's1',
      deletedAt: null,
      quoteRequests: { some: { assignedToId: 'm-khushi', status: { in: ['OPEN', 'IN_PROGRESS'] } } },
    });
    expect(scope.leads).toEqual({ studioId: 's1', assignedToId: 'm-khushi' });
    expect(scope.quoteLeads).toEqual({ AND: [{ OR: [scope.leads, scope.requested] }] });
    /* Wrapped in AND, so a caller's own OR (a search) cannot replace it. */
    expect(Object.keys(scope.quotes)).toEqual(['AND']);
    expect(Object.keys(scope.quotesWritable)).toEqual(['AND']);
  });

  it('quote.write on a requested lead, and only quote.write', () => {
    const scope = leadScopeFor(rep(BUILDS))!;
    expect(mayOnLead(scope, 'quote.write', SWARUPAS_LEAD)).toBe(false);
    expect(mayOnLead(scope, 'quote.write', { ...SWARUPAS_LEAD, requestedOfMe: true })).toBe(true);
    for (const action of ['lead.read', 'lead.edit', 'lead.call', 'lead.assign', 'quote.salesFinal'] as const) {
      expect(mayOnLead(scope, action, { ...SWARUPAS_LEAD, requestedOfMe: true }), action).toBe(false);
    }
  });

  it('someone who does not build gets no clause, and a requested flag means nothing for them', () => {
    const scope = leadScopeFor(rep({ 'leads.view': 'own', 'quotes.write': 'own' }))!;
    expect(scope.requested).toBeNull();
    expect(scope.quoteLeads).toBe(scope.leads);
    expect(mayOnLead(scope, 'quote.write', { ...SWARUPAS_LEAD, requestedOfMe: true })).toBe(false);
  });

  it('the owner sees everything already: no clause', () => {
    const scope = leadScopeFor({ id: 'm-o', studioId: 's1', userId: 'u-o', role: 'OWNER', status: 'ACTIVE' })!;
    expect(scope.requested).toBeNull();
    expect(scope.quotes).toEqual({ studioId: 's1' });
  });
});

describe('the notifications (studio staff only)', () => {
  it('a request handed out in turn, or by a head', () => {
    const turn = messageFor({ kind: 'quote-request', clientId: 'c1', name: 'Mehta, Baner', by: 'Asha', how: 'TURN', why: 'FLOOR_PLAN' });
    expect(turn.url).toBe('/studio/quotations/requests');
    expect(turn.title).toBe('A quotation to build: Mehta, Baner');
    expect(turn.body).toBe('A floor plan was added by Asha. Your turn: it is in Quotations, To build.');
    const moved = messageFor({ kind: 'quote-request', clientId: 'c1', name: 'Mehta', by: 'Swarupa', how: 'REASSIGNED', why: 'REQUESTED' });
    expect(moved.template).toBe('quote.request-reassigned');
    expect(moved.body).toMatch(/^Swarupa gave you the quotation for Mehta/);
  });

  it('the salesperson told when it was sent', () => {
    const done = messageFor({ kind: 'quote-request-done', clientId: 'c1', name: 'Mehta', by: 'Khushi', number: 'Q-2026-014' });
    expect(done.url).toBe('/studio/clients/c1');
    expect(done.body).toBe('Khushi sent quotation Q-2026-014 you asked for.');
  });
});
