import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { quoteReadOnly, type MemberRole } from '@/modules/studio/roles';
import type { SalesContext } from '@/modules/studio/sales-access';

/* Owner, 22 Nov 2026: "sales rep shouldn't be able to edit the quotation … they can't edit at all, they just upload
   the floor plan on the lead and the quotation is created automatically through our Claude API". */
const sales = (permissions: Record<string, unknown>): SalesContext => ({
  memberId: 'm1',
  roleId: 'r1',
  roleName: 'Role',
  permissions: permissions as SalesContext['permissions'],
  subtree: ['m1'],
  ancestors: [],
  reportsToOwner: true,
});
const member = (m: Partial<MemberRole>): MemberRole => ({ role: 'SALES', status: 'ACTIVE', id: 'm1', ...m }) as MemberRole;

describe('who may change a quotation', () => {
  it('a sales rep (no "builds quotations") reads only', () => {
    expect(quoteReadOnly(member({ sales: sales({ 'leads.view': 'own', 'quotes.write': 'own', 'quotes.salesFinal': 'own' }) }))).toBe(true);
    // A salesperson without a sales role (the first rules) is a rep too.
    expect(quoteReadOnly(member({ sales: null }))).toBe(true);
  });

  it('a sales head, an admin or a "Sales rep + quotations" role (quotes.build) still edits', () => {
    expect(quoteReadOnly(member({ sales: sales({ 'leads.view': 'team', 'quotes.write': 'team', 'quotes.build': true }) }))).toBe(false);
  });

  it('the owner, a PM and a designer are not sales reps', () => {
    expect(quoteReadOnly(member({ role: 'OWNER' }))).toBe(false);
    expect(quoteReadOnly(member({ role: 'PM' }))).toBe(false);
    expect(quoteReadOnly(member({ role: 'DESIGNER' }))).toBe(false);
  });
});

describe('wiring', () => {
  const quotes = readFileSync('src/modules/studio-quote/quotes.ts', 'utf8');
  it('their write scope matches no quotation, so every write refuses', () => {
    expect(quotes).toContain("if (quoteReadOnly(lead.member)) return { studioId: lead.studioId, where: lead.quotes, write: NO_QUOTE, lead, readOnly: true };");
    expect(quotes).toContain('if (qs.readOnly && input.fromPlan !== true) return { ok: false, error: READ_ONLY_QUOTE };');
  });

  it('the floor plan still builds their lead its quotation, once, into an empty draft', () => {
    const plan = readFileSync('src/modules/studio-quote/from-plan.ts', 'utf8');
    expect(plan).toContain('fromPlan: true,');
    expect(plan).toContain('applyConfiguration({ quoteId: created.id, home, fromPlan: true })');
    expect(quotes).toContain("status: 'DRAFT', issuedOn: null, lines: { none: {} } }");
    // "Read rooms" rewrites a draft: not theirs.
    expect(plan).toContain('if (quoteReadOnly(scope.member)) return { ok: false, error: refusalFor(scope, NOT_ROLE) };');
  });

  it('their screens: the builder locked with a note, View PDF only, no New quotation or Use as template', () => {
    const page = readFileSync('src/app/studio/quotations/[id]/page.tsx', 'utf8');
    expect(page).toContain('const locked = Boolean(sales?.projectId ?? project.projectId) || viewOnly;');
    expect(page).toContain('data-testid="sales-view-only"');
    const bar = readFileSync('src/app/studio/quotations/[id]/StatusBar.tsx', 'utf8');
    expect(bar).toContain('if (viewOnly) return;');
    const list = readFileSync('src/app/studio/quotations/page.tsx', 'utf8');
    expect(list).toContain("const building = !viewOnly && (sp.new === '1' || empty || template !== null);");
    expect(list).toContain('{viewOnly ? null : (');
  });
});
