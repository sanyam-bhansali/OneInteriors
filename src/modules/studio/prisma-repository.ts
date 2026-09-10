/**
 * Postgres-backed studio repository.
 *
 * Maps ORM rows to the domain `Studio` type so nothing downstream — matching
 * engine, pages, ops console — ever learns what the storage looks like.
 *
 * Two rules carried over from the fixture implementation, both deliberate:
 *
 *  1. **Tier is recomputed from checks on read**, never trusted from the
 *     column. A stale or hand-edited tier can then never reach the UI, whatever
 *     the row says. The stored value exists only so we can detect drift.
 *
 *  2. **Money crosses the boundary here and only here.** Prisma returns BigInt
 *     for the paise columns; the domain uses integer `number`. `fromDb` does
 *     the conversion and throws rather than silently losing precision.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { showUnverifiedStudios } from '@/lib/env';
import { assessTier } from '@/modules/verification/tiers';
import type {
  CheckResult,
  CheckType,
  PortfolioProject,
  Studio,
  StudioStatus,
  VerificationCheck,
  VerificationTier,
} from './types';
import type { StudioQuery, StudioRepository } from './repository';
import type { PropertyType, ScopeType, StyleTag } from '@/modules/brief/types';
import { STYLE_TAGS } from '@/modules/brief/types';

const INCLUDE = {
  verifications: true,
  portfolio: { orderBy: { completedOn: 'desc' } },
} satisfies Prisma.StudioInclude;

type StudioRow = Prisma.StudioGetPayload<{ include: typeof INCLUDE }>;

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function toCheck(row: StudioRow['verifications'][number]): VerificationCheck {
  return {
    type: row.type as CheckType,
    result: row.result as CheckResult,
    source: row.source,
    checkedAt: toIso(row.checkedAt),
    detail: row.notes,
  };
}

function toPortfolio(row: StudioRow['portfolio'][number]): PortfolioProject {
  return {
    id: row.id,
    title: row.title,
    locality: row.locality,
    // The schema has PropertyType.OTHER, the domain union does not. Map the
    // unknown to null rather than casting an invalid value into the type.
    propertyType: row.propertyType === 'OTHER' ? null : (row.propertyType as PropertyType | null),
    scope: row.scope as ScopeType | null,
    // Filtered, not cast. `styleTags` is a String[] column with no constraint
    // against the vocabulary, so a stray tag would reach STYLE_LABELS[t] and
    // render the literal "undefined" to a customer — while silently scoring
    // zero style overlap, which ARCHITECTURE.md names as the failure nobody
    // notices. Drop what we do not recognise.
    styleTags: row.styleTags.filter((t): t is StyleTag =>
      (STYLE_TAGS as readonly string[]).includes(t),
    ),
    valuePaise: row.valuePaise === null ? null : fromDb(row.valuePaise),
    durationDays: row.durationDays,
    completedOn: toIso(row.completedOn),
    images: row.images,
    isRender: row.isRender,
  };
}

function toStudio(row: StudioRow): Studio {
  const studio: Studio = {
    id: row.id,
    slug: row.slug,
    legalName: row.legalName,
    tradeName: row.tradeName,
    about: row.about ?? '',
    city: row.city,
    localities: row.localities,
    status: row.status as StudioStatus,
    tier: row.tier as VerificationTier,
    gstin: row.gstin,
    yearsActive: row.yearsActive ?? null,
    teamSize: row.teamSize ?? null,
    minProjectPaise: row.minProjectPaise === null ? null : fromDb(row.minProjectPaise),
    maxProjectPaise: row.maxProjectPaise === null ? null : fromDb(row.maxProjectPaise),
    completedProjects: row.completedProjects,
    avgVarianceDays: row.avgVarianceDays,
    upheldDisputes: row.upheldDisputes,
    specComplianceRate: row.specComplianceRate,
    communicationRating: row.communicationRating,
    autonomyProfile: row.autonomyProfile,
    checks: row.verifications.map(toCheck),
    portfolio: row.portfolio.map(toPortfolio),
  };

  // Rule 1 — the badge is always what the evidence supports.
  return { ...studio, tier: assessTier(studio).tier };
}

const TIER_ORDER: Record<VerificationTier, number> = {
  UNVERIFIED: 0,
  LISTED: 1,
  VERIFIED: 2,
  PROVEN: 3,
};

export class PrismaStudioRepository implements StudioRepository {
  /**
   * The roster.
   *
   * A database failure here returns an EMPTY list rather than throwing.
   * `/quiz`, `/match` and `/studios` all read the roster on every request, so
   * an unreachable database would otherwise 500 a customer in the middle of
   * the funnel — the single worst place to fail, because they cannot tell a
   * broken deployment from a broken product and simply leave.
   *
   * Empty, not fixtures. Falling back to the invented studios would put eight
   * fake businesses in front of a real customer as though we had verified
   * them, which is the one thing this product exists not to do. An empty
   * roster is visibly wrong to us and merely disappointing to them.
   */
  async list(query: StudioQuery = {}): Promise<Studio[]> {
    const where: Prisma.StudioWhereInput = {};
    if (query.city) where.city = query.city;
    if (query.locality) where.localities = { has: query.locality };

    /**
     * The verification gate, and its one development bypass.
     *
     * Applied HERE rather than at each call site on purpose: this is the single
     * place every customer-facing page reaches the roster through, so the gate
     * cannot be forgotten by a new page, and the bypass cannot be turned on in
     * one place and not another.
     *
     * `showUnverifiedStudios()` refuses to return true once the roster is
     * declared real — see its comment. So this drops the filter only while
     * every studio on the site is an admitted placeholder.
     */
    if (query.activeOnly && !showUnverifiedStudios()) {
      where.status = 'ACTIVE';
    }

    let rows;
    try {
      rows = await prisma.studio.findMany({
        where,
        include: INCLUDE,
        orderBy: { tradeName: 'asc' },
      });
    } catch (error) {
      console.error('[studios] Roster unavailable; serving an empty list.', error);
      return [];
    }

    const studios = rows.map(toStudio);

    // minTier filters on the COMPUTED tier, so it cannot be fooled by a stale
    // column. That is why it happens here rather than in the SQL.
    if (!query.minTier) return studios;
    const floor = TIER_ORDER[query.minTier];
    return studios.filter((s) => TIER_ORDER[s.tier] >= floor);
  }

  async bySlug(slug: string): Promise<Studio | null> {
    const row = await prisma.studio.findUnique({ where: { slug }, include: INCLUDE });
    return row ? toStudio(row) : null;
  }

  async byId(id: string): Promise<Studio | null> {
    const row = await prisma.studio.findUnique({ where: { id }, include: INCLUDE });
    return row ? toStudio(row) : null;
  }

  /**
   * Slugs to pre-render.
   *
   * This runs inside `generateStaticParams()`, which Next calls at BUILD time.
   * That makes a deploy depend on the database being reachable *and* the
   * credentials being valid at the moment of the build — and when they are
   * not, the build fails outright rather than the site degrading. A rotated
   * password took a production deploy down exactly this way.
   *
   * So a failure here returns an empty list instead of throwing. `/studios/
   * [slug]` keeps `dynamicParams` on, so nothing is pre-rendered and every
   * profile is served on demand: slower for the first visitor to each page,
   * and the site is up.
   *
   * There is a second reason this is the right shape. Pre-rendering bakes the
   * roster into the build, so a studio approved on Tuesday has no page until
   * the next deploy. Falling back to on-demand rendering fixes that too.
   */
  async allSlugs(): Promise<string[]> {
    try {
      const rows = await prisma.studio.findMany({ select: { slug: true } });
      return rows.map((r) => r.slug);
    } catch (error) {
      console.error(
        '[studios] Could not read slugs for pre-rendering; falling back to on-demand.',
        error,
      );
      return [];
    }
  }
}
