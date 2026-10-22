import { afterAll, describe, expect, it } from 'vitest';

/**
 * Sales roles and teams against the LOCAL throwaway test database only
 * (PGlite on 127.0.0.1:54329; docs/studio-os/SALES-ROLES.md). Skipped in the
 * normal suite. Needs migration 20261022110000_sales_roles_teams applied to
 * that database first. Run on its own, never beside another DB script:
 *
 *   SALES_ROLES_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run tests/sales-roles-db.integration.test.ts
 *
 * In the seeded Hauspire studio (st-akara) it adds two heads, a rep under
 * head A, leads (each person's, head A's team pool, head B's team pool, the
 * studio pool), then reads each person exactly as a request would
 * (access.ts `memberFor` → lead-scope.ts `leadScopeFor`) and checks what
 * Postgres returns for their lead scope, pool and write fences. Everything it
 * made is deleted at the end.
 */

const RUN = process.env.SALES_ROLES_TEST_DB === '1';
const URL_OK = (process.env.DATABASE_URL ?? '').includes('127.0.0.1:54329');
if (RUN && !URL_OK) throw new Error('Test database only: DATABASE_URL must point at 127.0.0.1:54329.');

const STUDIO = 'st-akara';
const TAG = `srt${Date.now().toString(36)}`;
const phone = (n: number) => `+9197${String(Date.now()).slice(-6)}${String(n).padStart(2, '0')}`;
const made = { users: [] as string[], members: [] as string[], leads: [] as string[] };
const people: Record<string, { memberId: string; userId: string }> = {};
const leads: Record<string, string> = {};

afterAll(async () => {
  if (!RUN) return;
  const { prisma } = await import('@/lib/prisma');
  await prisma.studioClient.deleteMany({ where: { studioId: STUDIO, id: { in: made.leads } } });
  await prisma.studioMember.updateMany({ where: { studioId: STUDIO, id: { in: made.members } }, data: { reportsToId: null } });
  await prisma.studioMember.deleteMany({ where: { studioId: STUDIO, id: { in: made.members } } });
  await prisma.user.deleteMany({ where: { id: { in: made.users } } });
});

describe.skipIf(!RUN)('sales roles and teams (test database)', () => {
  it('sets up two teams and their leads', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { ensureBuiltInSalesRoles } = await import('@/modules/studio/sales-team-store');
    await ensureBuiltInSalesRoles(STUDIO);
    const roles = await prisma.studioSalesRole.findMany({ where: { studioId: STUDIO, system: { in: ['HEAD', 'REP'] } }, select: { id: true, system: true } });
    const roleId = (s: string) => roles.find((r) => r.system === s)!.id;
    const stage = await prisma.studioStage.findFirst({ where: { studioId: STUDIO }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
    expect(stage).not.toBeNull();

    const add = async (key: string, n: number, system: string, reportsTo: string | null) => {
      const user = await prisma.user.create({ data: { phone: phone(n), name: `${TAG} ${key}`, role: 'STUDIO' }, select: { id: true } });
      made.users.push(user.id);
      const m = await prisma.studioMember.create({
        data: { studioId: STUDIO, userId: user.id, role: 'SALES', status: 'ACTIVE', salesRoleId: roleId(system), reportsToId: reportsTo ? people[reportsTo]!.memberId : null },
        select: { id: true },
      });
      made.members.push(m.id);
      people[key] = { memberId: m.id, userId: user.id };
    };
    await add('headA', 1, 'HEAD', null);
    await add('headB', 2, 'HEAD', null);
    await add('repA', 3, 'REP', 'headA');

    const lead = async (key: string, assignedTo: string | null, poolOf: string | null) => {
      const row = await prisma.studioClient.create({
        data: { studioId: STUDIO, stageId: stage!.id, name: `${TAG} ${key}`, source: 'OTHER', assignedToId: assignedTo ? people[assignedTo]!.memberId : null, poolTeamId: poolOf ? people[poolOf]!.memberId : null },
        select: { id: true },
      });
      made.leads.push(row.id);
      leads[key] = row.id;
    };
    await lead('repA', 'repA', null);
    await lead('headB', 'headB', null);
    await lead('poolA', null, 'headA');
    await lead('poolB', null, 'headB');
    await lead('studioPool', null, null);
  });

  const seen = async (who: string) => {
    const { prisma } = await import('@/lib/prisma');
    const { memberFor } = await import('@/modules/studio/access');
    const { leadScopeFor, fenceFor } = await import('@/modules/studio/lead-scope');
    const member = await memberFor(people[who]!.userId);
    const scope = member ? leadScopeFor(member) : null;
    expect(scope).not.toBeNull();
    const mine = { studioId: STUDIO, id: { in: made.leads } };
    const keys = (rows: { id: string }[]) => Object.entries(leads).filter(([, id]) => rows.some((r) => r.id === id)).map(([k]) => k).sort();
    return {
      view: keys(await prisma.studioClient.findMany({ where: { AND: [scope!.leads, mine] }, select: { id: true } })),
      pool: keys(await prisma.studioClient.findMany({ where: { AND: [scope!.pool, mine] }, select: { id: true } })),
      edit: keys(await prisma.studioClient.findMany({ where: { AND: [fenceFor(scope!, 'lead.edit'), mine] }, select: { id: true } })),
      assign: keys(await prisma.studioClient.findMany({ where: { AND: [fenceFor(scope!, 'lead.assign'), mine] }, select: { id: true } })),
    };
  };

  it('head A sees their rep’s lead and their team pool, never head B’s team', async () => {
    const a = await seen('headA');
    expect(a.view).toEqual(['poolA', 'repA']);
    expect(a.edit).toEqual(['poolA', 'repA']);
    expect(a.assign).toEqual(['poolA', 'repA']);
    expect(a.pool).toEqual(['poolA', 'studioPool']);
  });

  it('head B sees only their own team', async () => {
    const b = await seen('headB');
    expect(b.view).toEqual(['headB', 'poolB']);
    expect(b.pool).toEqual(['poolB', 'studioPool']);
  });

  it('a rep under head A: their own lead; claims from head A’s pool, not the studio pool; assigns nothing', async () => {
    const r = await seen('repA');
    expect(r.view).toEqual(['repA']);
    expect(r.pool).toEqual(['poolA']);
    expect(r.assign).toEqual([]);
  });
});
