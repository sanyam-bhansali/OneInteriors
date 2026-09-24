/**
 * Waitlist ingest.
 *
 * The pre-launch page at oneinteriors.in is a separate deployment. It posts
 * here rather than writing to Postgres itself, and that is deliberate: a
 * Supabase service_role key would let a marketing landing page read every
 * user, brief and quote in this project. A bearer token scoped to one route
 * lets it do exactly one thing — add a name to the waitlist.
 *
 * Everything in here is defensive about its input. The caller is on the
 * public internet and holds a token that, if it ever leaks, should still not
 * be able to do anything worse than add rows to this one table.
 */

import { prisma } from '@/lib/prisma';
import { normalisePhone } from '@/modules/studio/phone';

/** Mirrors the four cards on the waitlist page. Anything else is dropped. */
const STYLES = ['Warm Minimalist', 'Modern Classic', 'Industrial Loft', 'Traditional Indian'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export interface WaitlistInput {
  name?: unknown;
  contact?: unknown;
  style?: unknown;
  city?: unknown;
  via?: unknown;
  policyVersion?: unknown;
}

export type IngestResult =
  | { ok: true; created: boolean }
  | { ok: false; fields: string[] };

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * The share-link tag, e.g. `baner-greens`.
 *
 * Whitelisted rather than blacklisted. It was already cleaned in the browser,
 * which is worth nothing — anyone can POST to this route directly — and it
 * ends up rendered on an ops page and in exported CSVs.
 */
function cleanTag(v: unknown): string | null {
  const s = str(v, 48).toLowerCase().replace(/[^a-z0-9 _-]/g, '');
  return s || null;
}

export async function ingestWaitlistSignup(
  input: WaitlistInput,
  policyVersion: string,
): Promise<IngestResult> {
  const fields: string[] = [];

  const name = str(input.name, 120);
  if (name.length < 2) fields.push('name');

  // One field on the page takes either. Which one it is decides which unique
  // column carries it, so a person is one row however they came back.
  const contact = str(input.contact, 160);
  const phone = normalisePhone(contact);
  const email = EMAIL.test(contact) ? contact.toLowerCase() : null;
  if (!phone && !email) fields.push('contact');

  const styleRaw = str(input.style, 40);
  const style = STYLES.includes(styleRaw) ? styleRaw : null;
  if (styleRaw && !style) fields.push('style');

  if (fields.length) return { ok: false, fields };

  const data = {
    name,
    style,
    city: str(input.city, 60) || 'Pune',
    via: cleanTag(input.via),
    source: 'waitlist-landing',
    notifyConsent: true,
    policyVersion,
  };

  /**
   * Upsert on whichever identifier they gave. `createdAt` is never in the
   * update branch, so a returning signup keeps the date they FIRST joined
   * while name, style and via take the newest values.
   */
  const where = phone ? { phone } : { email: email! };
  const before = await prisma.waitlistSignup.findUnique({ where, select: { id: true } });

  await prisma.waitlistSignup.upsert({
    where,
    create: { ...data, phone, email },
    update: data,
  });

  return { ok: true, created: !before };
}

export interface WaitlistSummary {
  total: number;
  last24h: number;
  last7d: number;
  bySource: { via: string; count: number; latest: Date }[];
}

/** Everything the ops page shows, in two queries rather than one per row. */
export async function waitlistSummary(): Promise<WaitlistSummary> {
  const now = Date.now();
  const day = new Date(now - 24 * 60 * 60 * 1000);
  const week = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [total, last24h, last7d, grouped] = await Promise.all([
    prisma.waitlistSignup.count(),
    prisma.waitlistSignup.count({ where: { createdAt: { gte: day } } }),
    prisma.waitlistSignup.count({ where: { createdAt: { gte: week } } }),
    prisma.waitlistSignup.groupBy({
      by: ['via'],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  const bySource = grouped
    .map((g) => ({
      via: g.via ?? '(direct)',
      count: g._count._all,
      latest: g._max.createdAt ?? new Date(0),
    }))
    .sort((a, b) => b.count - a.count);

  return { total, last24h, last7d, bySource };
}

export async function recentSignups(limit = 100) {
  return prisma.waitlistSignup.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
  });
}
