import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { can, isDirector, quoteReadOnly, quotesVisibleTo, type MemberRole } from '@/modules/studio/roles';
import { mayOpen } from '@/modules/studio/surfaces';
import { doorFor } from '@/modules/studio/pilot';
import { appsFor } from '@/modules/studio/apps';

/*
 * Owner, 24 Nov 2026: "the designer shouldn't have access to the quotation made in sales, but whenever some designer
 * goes to a quotation and then clicks back, they go onto the quotation tab … check for such bugs … After that, we need
 * to make three admin dashboards … Anshu Ashish … Chandraveer Kumar … more focused on projects. Only the quotation and
 * leads tab would be under more tab. Everything else stays the same. And for leads as well as quotation, they only
 * have read only access."
 */
const DIRECTOR: MemberRole = { role: 'OWNER', status: 'ACTIVE', director: true, fullSoftware: true, id: 'd1' };
const OWNER: MemberRole = { role: 'OWNER', status: 'ACTIVE', fullSoftware: true, id: 'o1' };
const DESIGNER: MemberRole = { role: 'DESIGNER', status: 'ACTIVE', fullSoftware: true, id: 'g1' };

describe('a director', () => {
  it('reads leads and quotations and changes none of them', () => {
    for (const a of ['lead.edit', 'lead.call', 'lead.add', 'lead.assign', 'lead.delete', 'lead.import', 'lead.export', 'lead.claim', 'lead.bulk', 'lead.settings', 'quote.write', 'quote.salesFinal', 'quote.build'] as const) {
      expect(can(DIRECTOR, a, { assigned: true }), a).toBe(false);
      expect(can(OWNER, a, { assigned: true }), a).toBe(true);
    }
    expect(can(DIRECTOR, 'lead.read', { assigned: true })).toBe(true);
    expect(can(DIRECTOR, 'lead.analytics')).toBe(true);
    expect(quoteReadOnly(DIRECTOR)).toBe(true);
    expect(quoteReadOnly(OWNER)).toBe(false);
    expect(quotesVisibleTo({ ...DIRECTOR, id: 'd1', studioId: 's1' })).toEqual({ studioId: 's1' });
  });

  it('keeps everything else the owner has: projects, payments, crews, the team, bookings', () => {
    for (const a of ['project.read', 'plan.edit', 'payment.record', 'payment.read', 'crew.pay', 'workorder.money', 'design.assign', 'project.closure', 'team.manage', 'booking.record', 'vendor.rates'] as const) {
      expect(can(DIRECTOR, a, { assigned: true }), a).toBe(true);
    }
    expect(isDirector(DIRECTOR)).toBe(true);
    /* Only ever on an owner. */
    expect(isDirector({ ...DESIGNER, director: true })).toBe(false);
  });

  it('opens the lists, a lead and a quotation, and none of the screens that only write them', () => {
    for (const p of ['/studio/clients', '/studio/clients/abc', '/studio/quotations', '/studio/quotations/q1', '/studio/quotations/q1/print', '/studio/projects', '/studio/payments', '/studio/settings/team']) {
      expect(mayOpen(DIRECTOR, p), p).toBe(true);
    }
    for (const p of ['/studio/quotations/first', '/studio/quotations/builder', '/studio/quotations/requests', '/studio/quotations/terms', '/studio/clients/import', '/studio/clients/bin', '/studio/clients/pool', '/studio/settings/pipeline']) {
      expect(mayOpen(DIRECTOR, p), p).toBe(false);
      expect(mayOpen(OWNER, p), p).toBe(true);
    }
  });

  it('home: projects first, Leads and Quotations last under More', () => {
    const apps = appsFor(DIRECTOR);
    expect(apps[0]!.key).toBe('projects');
    const more = apps.filter((a) => a.more).map((a) => a.key);
    expect(more).toEqual(['clients', 'quotes']);
    expect(apps.slice(-2).map((a) => a.key)).toEqual(['clients', 'quotes']);
    /* The owner's own home is unchanged. */
    expect(appsFor(OWNER).some((a) => a.more)).toBe(false);
    expect(appsFor(DIRECTOR).find((a) => a.key === 'quotes')!.tabs.map((t) => t.label)).not.toContain('Quotation builder');
    const home = readFileSync('src/app/studio/home/page.tsx', 'utf8');
    expect(home).toContain('data-testid="home-more-desk"');
    expect(home).toContain('{director ? <EverySite cards={cards} /> : null}');
  });

  it('is made by a full owner only, and never touches another owner', () => {
    const store = readFileSync('src/modules/studio/team-store.ts', 'utf8');
    expect(store).toContain("if (!lead || lead.role !== 'OWNER' || isDirector(lead)) return { ok: false, error: 'Only the owner makes someone a director.' };");
    expect(store).toContain("NOT: { role: 'OWNER', id: { not: lead.id } }");
    expect(store).toContain("if (role === 'OWNER' && (lead.role !== 'OWNER' || isDirector(lead)))");
    const sql = readFileSync('prisma/migrations/20261124100000_director/migration.sql', 'utf8');
    expect(sql).toContain('ALTER TABLE "studio_members" ADD COLUMN "director" BOOLEAN NOT NULL DEFAULT false;');
  });
});

describe('a director joins with email (owner, 24 Nov 2026)', () => {
  it('is added by email, gets a team invite link, and turns active when they follow it', () => {
    const store = readFileSync('src/modules/studio/team-store.ts', 'utf8');
    expect(store).toContain("if (raw.director === true && typeof raw.email === 'string' && raw.email.trim() !== '') return inviteDirectorByEmail(lead, raw, baseUrl);");
    expect(store).toContain("data: { studioId: lead.studioId, userId, role: 'OWNER', status: 'INVITED', isOwner: true, director: true, invitedById: lead.id, invitedAt: now }");
    expect(store).toContain("purpose: 'team-invite'");
    /* A customer account is never turned into a director by typing its email. */
    expect(store).toContain("if (existing.role === 'CUSTOMER') return { ok: false, error: 'That email already has a One Interiors customer account.");
    const link = readFileSync('src/modules/auth/magic-link.ts', 'utf8');
    expect(link).toContain("await tx.studioMember.updateMany({ where: { userId: user.id, status: 'INVITED' }, data: { status: 'ACTIVE', lastSeenAt: new Date() } });");
    expect(link).toContain("const sent = meta.purpose === 'team-invite'");
    const controls = readFileSync('src/app/studio/settings/team/TeamControls.tsx', 'utf8');
    expect(controls).toContain('data-testid="invite-email"');
  });
});

describe('the door on every navigation', () => {
  it('a designer opens a Design Final but not My Quotations, and Back sends them home', () => {
    expect(mayOpen(DESIGNER, '/studio/quotations/q1')).toBe(true);
    expect(mayOpen(DESIGNER, '/studio/quotations')).toBe(false);
    expect(doorFor(DESIGNER, '/studio/quotations')).toEqual({ kind: 'home', to: '/studio/home' });
  });

  it('is asked in the browser on every path change, and by the pages themselves', () => {
    const layout = readFileSync('src/app/studio/layout.tsx', 'utf8');
    expect(layout).toContain('<DoorGuard member={doorFacts(member)} />');
    const guard = readFileSync('src/app/studio/ui/DoorGuard.tsx', 'utf8');
    expect(guard).toContain("if (door.kind === 'home' && door.to !== path) router.replace(door.to);");
    for (const [file, path] of [
      ['src/app/studio/quotations/page.tsx', '/studio/quotations'],
      ['src/app/studio/quotations/first/page.tsx', '/studio/quotations/first'],
      ['src/app/studio/products/page.tsx', '/studio/products'],
      ['src/app/studio/projects/page.tsx', '/studio/projects'],
      ['src/app/studio/vendors/pay/page.tsx', '/studio/vendors/pay'],
    ] as const) {
      expect(readFileSync(file, 'utf8'), file).toContain(`await requireDoor('${path}');`);
    }
    /* The quotation's own "Quotations" back link is only for whoever opens the list. */
    expect(readFileSync('src/app/studio/quotations/[id]/page.tsx', 'utf8')).toContain("mayOpen(member, '/studio/quotations')");
  });
});

describe('the audit (24 Nov 2026)', () => {
  it('crew money is set by owner and accounts only: a designer sees it and never changes it', () => {
    const flow = readFileSync('src/modules/studio-crews/flow.ts', 'utf8');
    expect(flow).toContain("const r = await lineFor(lineId, 'crew.pay');");
    expect(flow).toContain("money: r.access.may('crew.pay') }");
    expect(flow).not.toContain("orderFor(woId, 'workorder.money')");
    expect(can(DESIGNER, 'crew.pay', { assigned: true })).toBe(false);
  });

  it('read-only people copy, send and propose nothing', () => {
    const quotes = readFileSync('src/modules/studio-quote/quotes.ts', 'utf8');
    expect(quotes).toContain("if (qs?.readOnly) return { ok: false, error: qs.lead && isDirector(qs.lead.member) ? DIRECTOR_READ_ONLY : READ_ONLY_QUOTE };");
    expect(quotes).toContain("copy.kind === 'design-final' && qs?.lead === null ? qs?.where : qs?.write");
    expect(readFileSync('src/modules/studio-sales/revisions.ts', 'utf8')).toContain('if (quoteReadOnly(scope.member)) return');
    expect(readFileSync('src/modules/studio-quote/proposals.ts', 'utf8')).toContain('if (me && quoteReadOnly(me)) return');
    expect(readFileSync('src/modules/studio-quote/from-plan.ts', 'utf8')).toContain("const onlyAuto = mode === 'auto' || quoteReadOnly(scope.member);");
    expect(readFileSync('src/modules/studio-quote/from-previous-rules.ts', 'utf8')).toContain('if (qs.readOnly) return qs.where;');
  });

  it('the payment stages are the owner’s, even through onboarding', () => {
    expect(readFileSync('src/modules/studio/onboarding.ts', 'utf8')).toContain("if (!me || !can(me, 'payments.template'))");
  });
});
