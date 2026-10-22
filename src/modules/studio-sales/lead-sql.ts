import 'server-only';

/**
 * A person's lead fences as raw SQL, for the few reads that cannot use a
 * Prisma `where` (GROUP BY over arrays and JSON, the calling numbers). Sales
 * roles and teams (owner, 22 Oct 2026; docs/studio-os/SALES-ROLES.md): these
 * are sales-access.ts `reachWhere` and `poolWhere` written a second time, so
 * keep them the same rule. `c` is the `studio_clients` alias; every caller
 * also says `c."studioId" = ${studioId}`.
 */

import { Prisma } from '@prisma/client';
import type { LeadScope } from '@/modules/studio/lead-scope';

/** The leads they may see: nothing extra for the whole studio, else their own or their team's. */
export function rawLeadFence(scope: Pick<LeadScope, 'seesAll' | 'team' | 'member'>): Prisma.Sql {
  if (scope.seesAll) return Prisma.empty;
  if (scope.team) {
    const team = [...scope.team];
    return Prisma.sql`AND (c."assignedToId" = ANY(${team}::text[]) OR (c."assignedToId" IS NULL AND c."poolTeamId" = ANY(${team}::text[])))`;
  }
  return Prisma.sql`AND c."assignedToId" = ${scope.member.id}`;
}

/** The pools they may claim from. */
export function rawPoolFence(scope: Pick<LeadScope, 'pools'>): Prisma.Sql {
  const p = scope.pools;
  if (p.kind === 'none') return Prisma.sql`AND false`;
  if (p.kind === 'all') return Prisma.sql`AND c."assignedToId" IS NULL`;
  const heads = [...p.heads];
  if (heads.length && p.studio) return Prisma.sql`AND c."assignedToId" IS NULL AND (c."poolTeamId" IS NULL OR c."poolTeamId" = ANY(${heads}::text[]))`;
  if (heads.length) return Prisma.sql`AND c."assignedToId" IS NULL AND c."poolTeamId" = ANY(${heads}::text[])`;
  if (p.studio) return Prisma.sql`AND c."assignedToId" IS NULL AND c."poolTeamId" IS NULL`;
  return Prisma.sql`AND false`;
}

/** What they see OR the pools they may claim from (tag suggestions). */
export function rawSeenOrPool(scope: Pick<LeadScope, 'seesAll' | 'team' | 'member' | 'pools'>): Prisma.Sql {
  if (scope.seesAll) return Prisma.empty;
  const seen = rawLeadFence(scope);
  const pool = rawPoolFence(scope);
  /* Both fragments start with AND; wrap each as a boolean of its own. */
  return Prisma.sql`AND ((true ${seen}) OR (true ${pool}))`;
}
