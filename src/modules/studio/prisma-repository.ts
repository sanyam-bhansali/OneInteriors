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
  async list(query: StudioQuery = {}): Promise<Studio[]> {
    const where: Prisma.StudioWhereInput = {};
    if (query.city) where.city = query.city;
    if (query.activeOnly) where.status = 'ACTIVE';
    if (query.locality) where.localities = { has: query.locality };

    const rows = await prisma.studio.findMany({
      where,
      include: INCLUDE,
      orderBy: { tradeName: 'asc' },
    });

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

  async allSlugs(): Promise<string[]> {
    const rows = await prisma.studio.findMany({ select: { slug: true } });
    return rows.map((r) => r.slug);
  }
}
