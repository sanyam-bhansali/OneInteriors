import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  METHOD_HEADER,
  VIEW_AS_ENTER_PATH,
  VIEW_AS_MINUTES,
  VIEW_AS_STOP_PATH,
  checkViewTarget,
  hintIsLive,
  hintSecret,
  isStaff,
  requestIsWrite,
  signHint,
  ticketUsable,
  viewAsGate,
  viewStateOf,
  viewUntil,
} from '@/modules/studio/view-as-rules';
import {
  READ_ACTIONS,
  STUDIO_ACTIONS,
  STUDIO_ROLES,
  asSeenBy,
  can,
  isReadAction,
  leadsVisibleTo,
  leadsWhereFor,
  poolVisibleTo,
  projectsVisibleTo,
  quotesVisibleTo,
  type MemberRole,
} from '@/modules/studio/roles';
import { mayOpen } from '@/modules/studio/surfaces';
import { appsFor } from '@/modules/studio/apps';
import { buildSalesContext } from '@/modules/studio/sales-access';

/**
 * Developer access, "Open as…" (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md):
 * staff see a studio as one of its people, read only. Every rule that keeps
 * it read only and keeps it to staff, asserted.
 */

const NOW = new Date('2026-10-22T10:00:00.000Z');
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

describe('who may view, and for how long', () => {
  it('staff only: OPS and ADMIN, never a studio or a customer account', () => {
    expect(isStaff('OPS')).toBe(true);
    expect(isStaff('ADMIN')).toBe(true);
    expect(isStaff('STUDIO')).toBe(false);
    expect(isStaff('CUSTOMER')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it('a view lasts two hours', () => {
    expect(VIEW_AS_MINUTES).toBe(120);
    expect(viewUntil(NOW).getTime() - NOW.getTime()).toBe(120 * 60_000);
  });

  it('a live view is a staff session, a member and an end in the future', () => {
    expect(viewStateOf({ role: 'OPS', memberId: 'm1', until: later(30) }, NOW)).toEqual({ kind: 'live', memberId: 'm1', until: later(30) });
    expect(viewStateOf({ role: 'ADMIN', memberId: 'm1', until: later(120) }, NOW).kind).toBe('live');
  });

  it('no columns is no view', () => {
    expect(viewStateOf({ role: 'OPS', memberId: null, until: null }, NOW)).toEqual({ kind: 'none' });
    expect(viewStateOf({ role: 'STUDIO', memberId: null, until: null }, NOW)).toEqual({ kind: 'none' });
  });

  it('ended, half-set, too far away, or on a non-staff session: never honoured (and cleared)', () => {
    expect(viewStateOf({ role: 'OPS', memberId: 'm1', until: NOW }, NOW).kind).toBe('expired');
    expect(viewStateOf({ role: 'OPS', memberId: 'm1', until: later(-1) }, NOW).kind).toBe('expired');
    expect(viewStateOf({ role: 'OPS', memberId: 'm1', until: null }, NOW).kind).toBe('expired');
    expect(viewStateOf({ role: 'OPS', memberId: null, until: later(10) }, NOW).kind).toBe('expired');
    expect(viewStateOf({ role: 'OPS', memberId: 'm1', until: later(60 * 24) }, NOW).kind).toBe('expired');
    /* A studio or customer account with the columns somehow set gets nothing. */
    expect(viewStateOf({ role: 'STUDIO', memberId: 'm1', until: later(10) }, NOW).kind).toBe('expired');
    expect(viewStateOf({ role: 'CUSTOMER', memberId: 'm1', until: later(10) }, NOW).kind).toBe('expired');
  });

  it('the member must be on the studio the ops page is about', () => {
    expect(checkViewTarget('OPS', { studioId: 's1' }, 's1')).toEqual({ ok: true });
    expect(checkViewTarget('ADMIN', { studioId: 's1' }, 's1')).toEqual({ ok: true });
    expect(checkViewTarget('OPS', { studioId: 's2' }, 's1').ok).toBe(false);
    expect(checkViewTarget('OPS', null, 's1').ok).toBe(false);
    expect(checkViewTarget('OPS', { studioId: '' }, '').ok).toBe(false);
    expect(checkViewTarget('STUDIO', { studioId: 's1' }, 's1').ok).toBe(false);
    expect(checkViewTarget('CUSTOMER', { studioId: 's1' }, 's1').ok).toBe(false);
  });

  it('the ops-to-studio ticket lasts two minutes', () => {
    expect(ticketUsable(NOW, later(1))).toBe(true);
    expect(ticketUsable(NOW, later(2))).toBe(true);
    expect(ticketUsable(NOW, later(2.1))).toBe(false);
    expect(ticketUsable(NOW, later(-1))).toBe(false);
  });
});

describe('what counts as a write', () => {
  it('a server action is a write, whatever its method', () => {
    expect(requestIsWrite({ method: 'GET', nextAction: 'abc123' })).toBe(true);
    expect(requestIsWrite({ method: 'POST', nextAction: 'abc123' })).toBe(true);
  });

  it('anything but GET and HEAD is a write', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) expect(requestIsWrite({ method: m, nextAction: null })).toBe(true);
    for (const m of ['GET', 'HEAD', 'get']) expect(requestIsWrite({ method: m, nextAction: null })).toBe(false);
  });

  it('no method header (the middleware did not run) is a write: closed', () => {
    expect(requestIsWrite({ method: null, nextAction: null })).toBe(true);
    expect(requestIsWrite({ method: '', nextAction: null })).toBe(true);
  });
});

describe('the middleware decision', () => {
  const base = { method: 'POST', path: '/studio/clients', audience: 'all' as const, nextAction: true, viewing: true };

  it('not viewing: never blocks', () => {
    expect(viewAsGate({ ...base, viewing: false })).toBe('allow');
  });

  it('viewing: a server action on a studio page is refused', () => {
    expect(viewAsGate(base)).toBe('block');
    expect(viewAsGate({ ...base, path: '/studio' })).toBe('block');
  });

  it('viewing: writes to the studio API are refused', () => {
    expect(viewAsGate({ ...base, path: '/api/studio/leads/upload', nextAction: false })).toBe('block');
    expect(viewAsGate({ ...base, method: 'DELETE', path: '/api/studio/x', nextAction: false })).toBe('block');
  });

  it('viewing on the studio host: every write is refused, whatever the path', () => {
    expect(viewAsGate({ ...base, audience: 'studio', path: '/', nextAction: true })).toBe('block');
    expect(viewAsGate({ ...base, audience: 'studio', path: '/api/uploads', nextAction: false })).toBe('block');
    expect(viewAsGate({ ...base, audience: 'studio', path: '/sign-in', nextAction: true })).toBe('block');
  });

  it('viewing: reads pass', () => {
    expect(viewAsGate({ ...base, method: 'GET', nextAction: false })).toBe('allow');
    expect(viewAsGate({ ...base, method: 'HEAD', nextAction: false })).toBe('allow');
    expect(viewAsGate({ ...base, audience: 'studio', method: 'GET', path: '/studio/clients/abc', nextAction: false })).toBe('allow');
  });

  it('viewing: a GET carrying Next-Action is still a write', () => {
    expect(viewAsGate({ ...base, method: 'GET', nextAction: true })).toBe('block');
  });

  it('viewing: the Stop route is the one write allowed', () => {
    expect(viewAsGate({ ...base, path: VIEW_AS_STOP_PATH, nextAction: false })).toBe('allow');
    expect(viewAsGate({ ...base, audience: 'studio', path: VIEW_AS_STOP_PATH, nextAction: false })).toBe('allow');
    /* …and nothing that merely starts with it. */
    expect(viewAsGate({ ...base, path: `${VIEW_AS_STOP_PATH}/x`, nextAction: false })).toBe('block');
  });

  it('viewing on one origin: the ops console in another tab is left alone', () => {
    expect(viewAsGate({ ...base, path: '/ops/hauspire', audience: 'all' })).toBe('allow');
  });
});

describe('the companion cookie is a signed hint bound to the session', () => {
  const secret = 'test-secret-not-a-real-one';
  const token = 'session-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  it('verifies for the same session, in date', async () => {
    const hint = await signHint(secret, token, later(60));
    expect(await hintIsLive(secret, token, hint, NOW)).toBe(true);
  });

  it('is refused for another session, after its end, with another secret, or tampered', async () => {
    const hint = await signHint(secret, token, later(60));
    expect(await hintIsLive(secret, 'another-session', hint, NOW)).toBe(false);
    expect(await hintIsLive(secret, token, hint, later(61))).toBe(false);
    expect(await hintIsLive('another-secret', token, hint, NOW)).toBe(false);
    const [ms, sig] = hint.split('.');
    expect(await hintIsLive(secret, token, `${Number(ms) + 3_600_000}.${sig}`, NOW)).toBe(false);
    expect(await hintIsLive(secret, token, `${ms}.${sig!.slice(1)}x`, NOW)).toBe(false);
    expect(await hintIsLive(secret, token, '1', NOW)).toBe(false);
    expect(await hintIsLive(secret, token, '', NOW)).toBe(false);
    expect(await hintIsLive(secret, null, hint, NOW)).toBe(false);
  });

  it('a plain "1" (or any forged value) is never live', async () => {
    expect(await hintIsLive(secret, token, '1', NOW)).toBe(false);
    expect(await hintIsLive(null, token, `${later(60).getTime()}.forged`, NOW)).toBe(false);
  });

  it('uses an existing server secret, never a new one', () => {
    expect(hintSecret({ SUPABASE_SECRET_KEY: ' a ', CRON_SECRET: 'b' })).toBe('a');
    expect(hintSecret({ CRON_SECRET: 'b' })).toBe('b');
    expect(hintSecret({})).toBeNull();
  });
});

// ── can() and the read/write split ─────────────────────────────

const member = (role: MemberRole['role'], extra: Partial<MemberRole> = {}): MemberRole & { id: string; studioId: string } => ({
  id: 'me',
  studioId: 's1',
  role,
  status: 'ACTIVE',
  fullSoftware: true,
  ...extra,
});

const WRITES = STUDIO_ACTIONS.filter((a) => !READ_ACTIONS.has(a));

describe('can(): a viewing member reads and never writes', () => {
  it('the split is explicit: these, and only these, are reads', () => {
    expect([...READ_ACTIONS].sort()).toEqual(
      ['crew.list', 'design.workload', 'lead.analytics', 'lead.pool', 'lead.read', 'payment.read', 'project.read', 'vendor.rates', 'workorder.money', 'workorder.read'].sort(),
    );
    for (const a of READ_ACTIONS) expect(STUDIO_ACTIONS).toContain(a);
  });

  it('downloading the whole lead list is not a read here', () => {
    expect(isReadAction('lead.export')).toBe(false);
  });

  it('every write action is refused for every role, assigned or not, with or without a lead', () => {
    for (const role of STUDIO_ROLES) {
      const viewing = member(role, { viewOnly: true });
      for (const action of WRITES) {
        expect(can(viewing, action), `${role} ${action}`).toBe(false);
        expect(can(viewing, action, { assigned: true }), `${role} ${action} assigned`).toBe(false);
        expect(can(viewing, action, { lead: { assignedToId: 'me', poolTeamId: null } }), `${role} ${action} own lead`).toBe(false);
      }
    }
  });

  it('every write action is refused for a sales role with reach over everything', () => {
    const sales = buildSalesContext({ id: 'me', reportsToId: null }, { id: 'r', name: 'Admin', permissions: { 'leads.view': 'all', 'leads.edit': 'all', 'calls.log': 'all', 'leads.add': true, 'leads.assign': 'all', 'leads.pool': 'all', 'quotes.write': 'all', 'leads.export': true } }, [
      { id: 'me', reportsToId: null },
    ]);
    const viewing = member('SALES', { viewOnly: true, sales });
    const real = member('SALES', { sales });
    for (const action of WRITES) expect(can(viewing, action, { assigned: true }), action).toBe(false);
    expect(can(real, 'lead.edit', { assigned: true })).toBe(true);
    expect(can(viewing, 'lead.read', { assigned: true })).toBe(true);
  });

  it('reads pass exactly as they do for the member themselves', () => {
    for (const role of STUDIO_ROLES) {
      for (const action of READ_ACTIONS) {
        for (const assigned of [true, false]) {
          expect(can(member(role, { viewOnly: true }), action, { assigned }), `${role} ${action} ${assigned}`).toBe(can(member(role), action, { assigned }));
        }
      }
    }
  });

  it('not viewing: nothing changes (the owner still does everything)', () => {
    for (const action of STUDIO_ACTIONS) expect(can(member('OWNER'), action)).toBe(true);
    for (const action of STUDIO_ACTIONS) expect(can(member('OWNER', { viewOnly: false }), action)).toBe(true);
  });

  it('the plan still narrows a viewing member: no full-software reads on Pro', () => {
    expect(can(member('OWNER', { viewOnly: true, fullSoftware: false }), 'project.read')).toBe(false);
    expect(can(member('OWNER', { viewOnly: true, fullSoftware: false }), 'lead.read')).toBe(true);
  });

  it('write fences match nothing; what they see is what the member sees', () => {
    const owner = member('OWNER', { viewOnly: true });
    expect(leadsWhereFor(owner, 'lead.edit')).toEqual({ studioId: 's1', id: { in: [] } });
    expect(leadsWhereFor(owner, 'lead.read')).toEqual({ studioId: 's1' });
    expect(leadsVisibleTo(owner)).toEqual(leadsVisibleTo(member('OWNER')));
    expect(poolVisibleTo(owner)).toEqual(poolVisibleTo(member('OWNER')));
    expect(quotesVisibleTo(owner)).toEqual(quotesVisibleTo(member('OWNER')));
    expect(projectsVisibleTo(owner)).toEqual(projectsVisibleTo(member('OWNER')));
    const rep = member('SALES', { viewOnly: true });
    expect(poolVisibleTo(rep)).toEqual(poolVisibleTo(member('SALES')));
    expect(quotesVisibleTo(rep)).toEqual(quotesVisibleTo(member('SALES')));
    expect(leadsVisibleTo(rep)).toEqual({ studioId: 's1', assignedToId: 'me' });
  });

  it('asSeenBy drops the flag for drawing screens, and only that', () => {
    const v = member('PM', { viewOnly: true });
    expect(asSeenBy(v)).toEqual({ ...v, viewOnly: false });
    const plain = member('PM');
    expect(asSeenBy(plain)).toBe(plain);
  });
});

describe('the screens and apps are the member’s own', () => {
  const PATHS = ['/studio/home', '/studio/today', '/studio/clients', '/studio/clients/pool', '/studio/clients/import', '/studio/settings/team', '/studio/settings/payments', '/studio/vendors', '/studio/site', '/studio/payments', '/studio/design', '/studio/projects'];

  it('mayOpen answers the same for a viewing member', () => {
    for (const role of STUDIO_ROLES) {
      for (const full of [true, false]) {
        for (const path of PATHS) {
          expect(mayOpen(member(role, { viewOnly: true, fullSoftware: full }), path), `${role} ${full} ${path}`).toBe(mayOpen(member(role, { fullSoftware: full }), path));
        }
      }
    }
  });

  it('appsFor shows the same apps', () => {
    for (const role of STUDIO_ROLES) {
      expect(appsFor(member(role, { viewOnly: true })).map((a) => [a.key, a.href])).toEqual(appsFor(member(role)).map((a) => [a.key, a.href]));
    }
  });
});

// ── The wiring, read from source (the server half cannot run without a database) ──

const read = (p: string) => readFileSync(p, 'utf8');

describe('every layer is wired', () => {
  it('the middleware refuses with the pure decision and records the method', () => {
    const src = read('src/middleware.ts');
    expect(src).toContain('viewAsGate(');
    expect(src).toContain('hintIsLive(');
    expect(src).toContain('headers.set(METHOD_HEADER, request.method)');
    expect(src).toContain('status: 403');
    expect(METHOD_HEADER).toBe('x-oi-method');
  });

  it('currentMember and myStudioId resolve the view and refuse on a write request', () => {
    const access = read('src/modules/studio/access.ts');
    expect(access).toMatch(/currentMember\(\)[\s\S]*?viewAsFor\(user\)/);
    expect(access).toMatch(/viewAsFor[\s\S]*?isWriteRequest\(\)\) return null/);
    expect(access).toContain('viewOnly: true');
    expect(access).toMatch(/assertCan[\s\S]*?viewOnly === true && !isReadAction\(action\)/);
    const tenancy = read('src/modules/studio/tenancy.ts');
    expect(tenancy).toMatch(/staffViewFor\(user\)[\s\S]*?isWriteRequest\(\)\)\) return null/);
  });

  it('only the cookie is read for a view, never the phone app’s bearer token', () => {
    const src = read('src/modules/studio/view-as.ts');
    expect(src).toContain('.get(SESSION_COOKIE)');
    expect(src).not.toMatch(/bearerFrom|authorization/i);
  });

  it('start and stop are audited', () => {
    const src = read('src/modules/studio/view-as.ts');
    expect(src).toContain("action: 'staff.view_as.start'");
    expect(src).toContain("action: 'staff.view_as.stop'");
  });

  it('the routes live where the paths say', () => {
    expect(existsSync(`src/app${VIEW_AS_STOP_PATH}/route.ts`)).toBe(true);
    expect(existsSync(`src/app${VIEW_AS_ENTER_PATH}/route.ts`)).toBe(true);
    expect(read(`src/app${VIEW_AS_STOP_PATH}/route.ts`)).toContain('export async function POST');
    expect(read(`src/app${VIEW_AS_ENTER_PATH}/route.ts`)).toContain('export async function GET');
  });

  it('the migration only adds', () => {
    const sql = read('prisma/migrations/20261022120000_staff_view_as/migration.sql');
    expect(sql).toContain('ADD COLUMN "viewAsMemberId"');
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b|\bTRUNCATE\b/i);
  });

  it('the banner is drawn by the studio layout', () => {
    const src = read('src/app/studio/layout.tsx');
    expect(src).toContain('<ViewAsBanner');
    expect(src).toContain('data-view-only');
  });
});

