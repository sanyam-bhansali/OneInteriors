/**
 * Where studio data comes from.
 *
 * This exists so that swapping fixtures for Postgres is a change to ONE file
 * rather than a change to every page. Nothing outside this module should ever
 * import `@/data/studios` again — the pages ask the repository, and the
 * repository decides where the rows live.
 *
 * Sprint 3 (OI-1/OI-2): add `PrismaStudioRepository` below, point
 * `studioRepository` at it when DATABASE_URL is present, and delete the
 * fixtures. Every call site stays exactly as it is.
 *
 * The interface is deliberately narrow. It returns domain `Studio` objects, not
 * ORM rows, so the matching engine and the UI never learn what the storage
 * looks like.
 */

import type { Studio, VerificationTier } from './types';
import { STUDIOS } from '@/data/studios';
import { assessTier } from '@/modules/verification/tiers';

export interface StudioQuery {
  /** Pune only for now, but the field exists so city two is not a refactor. */
  city?: string;
  locality?: string;
  /** Omit to get every status — the ops console needs the suspended ones too. */
  activeOnly?: boolean;
  minTier?: VerificationTier;
}

export interface StudioRepository {
  list(query?: StudioQuery): Promise<Studio[]>;
  bySlug(slug: string): Promise<Studio | null>;
  byId(id: string): Promise<Studio | null>;
  /** Slugs for `generateStaticParams`. */
  allSlugs(): Promise<string[]>;
}

const TIER_ORDER: Record<VerificationTier, number> = {
  UNVERIFIED: 0,
  LISTED: 1,
  VERIFIED: 2,
  PROVEN: 3,
};

function matches(studio: Studio, q: StudioQuery): boolean {
  if (q.city && studio.city !== q.city) return false;
  if (q.locality && !studio.localities.includes(q.locality)) return false;
  if (q.activeOnly && studio.status !== 'ACTIVE') return false;
  if (q.minTier && TIER_ORDER[studio.tier] < TIER_ORDER[q.minTier]) return false;
  return true;
}

/**
 * Fixture-backed implementation.
 *
 * Note it recomputes `tier` from the checks on read rather than trusting the
 * stored value. That is the same rule the ops console enforces, applied at the
 * boundary — so a stale or hand-edited tier can never reach the UI, whatever
 * the storage says. Keep this behaviour in the Prisma implementation.
 */
export class FixtureStudioRepository implements StudioRepository {
  private readonly studios: Studio[];

  constructor(studios: Studio[] = STUDIOS) {
    this.studios = studios.map((s) => ({ ...s, tier: assessTier(s).tier }));
  }

  async list(query: StudioQuery = {}): Promise<Studio[]> {
    return this.studios.filter((s) => matches(s, query));
  }

  async bySlug(slug: string): Promise<Studio | null> {
    return this.studios.find((s) => s.slug === slug) ?? null;
  }

  async byId(id: string): Promise<Studio | null> {
    return this.studios.find((s) => s.id === id) ?? null;
  }

  async allSlugs(): Promise<string[]> {
    return this.studios.map((s) => s.slug);
  }
}

/**
 * The single instance the app uses.
 *
 * When Postgres lands this becomes:
 *
 *   export const studioRepository: StudioRepository =
 *     process.env.DATABASE_URL
 *       ? new PrismaStudioRepository()
 *       : new FixtureStudioRepository();
 *
 * — note the truthiness check, not `??`. See docs/CONTRIBUTING.md §8.
 */
export const studioRepository: StudioRepository = new FixtureStudioRepository();
