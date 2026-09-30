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

import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { normalisePhone } from '@/modules/studio/phone';
import { societyMatchKey, canonicalSociety } from '@/modules/brief/society';
import {
  cleanCode,
  cleanExtras,
  makeCode,
  positionOf,
  publicStats,
  unlocksFor,
  type PublicStats,
  type QueueRow,
  type Unlocks,
} from './queue';
import { sendWaitlistWelcome } from './welcome';

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
  /** The referral code of the link that brought them (?r=CODE). */
  ref?: unknown;
  /** The consent tick on the form. Required — no tick, no row. */
  consent?: unknown;
}

export type IngestResult =
  | { ok: true; created: boolean; code: string }
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

  if (input.consent !== true) fields.push('consent');

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
  const before = await prisma.waitlistSignup.findUnique({
    where,
    select: { id: true, referralCode: true, referredByCode: true },
  });

  // A referral counts once, from someone else's real code, and only on the
  // way in — coming back through a second link does not move the credit.
  const ref = cleanCode(input.ref);
  const referrer =
    ref && ref !== before?.referralCode && !before?.referredByCode
      ? await prisma.waitlistSignup.findUnique({ where: { referralCode: ref }, select: { id: true } })
      : null;

  const code = before?.referralCode ?? (await freshCode());
  const row = await prisma.waitlistSignup.upsert({
    where,
    create: { ...data, phone, email, referralCode: code, referredByCode: referrer ? ref : null },
    update: { ...data, referralCode: code, ...(referrer ? { referredByCode: ref } : {}) },
    select: { id: true, name: true, phone: true, email: true, referralCode: true, welcomedAt: true },
  });

  // The welcome goes once, to the channel they gave. Never fails the signup.
  if (!row.welcomedAt) {
    const status = await waitlistStatus(code).catch(() => null);
    const sent = await sendWaitlistWelcome({
      name: row.name,
      phone: row.phone,
      email: row.email,
      code,
      position: status?.position ?? null,
    }).catch(() => null);
    if (sent?.delivered) {
      await prisma.waitlistSignup.update({
        where: { id: row.id },
        data: { welcomedAt: new Date(), welcomeChannel: sent.channel },
      });
    }
  }

  return { ok: true, created: !before, code };
}

/** A code nobody has yet. Seven characters from 32 is 34 billion; a clash is a retry. */
async function freshCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = makeCode(randomBytes(7));
    const taken = await prisma.waitlistSignup.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error('Could not find a free referral code');
}

// ── The queue, as each person sees it ────────────────────────

export interface WaitlistStatus {
  code: string;
  firstName: string;
  position: number;
  joined: number;
  referrals: number;
  answered: boolean;
  society: string | null;
  societyCount: number;
  unlocks: Unlocks;
  stats: PublicStats;
}

/**
 * Everyone's place, computed on read. At the gate's size (two thousand) one
 * query of four columns is cheaper than keeping positions in step on write.
 */
export async function waitlistStatus(code: string): Promise<WaitlistStatus | null> {
  const clean = cleanCode(code);
  if (!clean) return null;
  const rows = await prisma.waitlistSignup.findMany({
    orderBy: { createdAt: 'asc' },
    select: { name: true, referralCode: true, referredByCode: true, extrasAt: true, society: true },
  });
  const referrals = new Map<string, number>();
  for (const r of rows) if (r.referredByCode) referrals.set(r.referredByCode, (referrals.get(r.referredByCode) ?? 0) + 1);
  const queue: QueueRow[] = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.referralCode)
    .map(({ r, i }) => ({ code: r.referralCode!, joined: i + 1, referrals: referrals.get(r.referralCode!) ?? 0, answered: Boolean(r.extrasAt) }));
  const meIndex = rows.findIndex((r) => r.referralCode === clean);
  if (meIndex < 0) return null;
  const me = rows[meIndex]!;
  const key = societyMatchKey(me.society);
  const societyCount = key ? rows.filter((r) => societyMatchKey(r.society) === key).length : 0;
  const mine = queue.find((q) => q.code === clean)!;
  return {
    code: clean,
    firstName: me.name.split(/\s+/)[0] ?? me.name,
    position: positionOf(clean, queue)!,
    joined: mine.joined,
    referrals: mine.referrals,
    answered: mine.answered,
    society: me.society,
    societyCount,
    unlocks: unlocksFor(mine.joined, mine.referrals, societyCount),
    stats: publicStats(rows.length),
  };
}

/** The optional answers — "skip 20 places". The places are given once. */
export async function saveWaitlistExtras(
  code: string,
  input: { possession?: unknown; bhk?: unknown; society?: unknown; style?: unknown },
): Promise<WaitlistStatus | null> {
  const clean = cleanCode(code);
  if (!clean) return null;
  const row = await prisma.waitlistSignup.findUnique({ where: { referralCode: clean }, select: { id: true, extrasAt: true } });
  if (!row) return null;
  const extras = cleanExtras(input);
  const styleRaw = str(input.style, 40);
  const answeredSomething = Boolean(extras.possession || extras.bhk || extras.society);
  await prisma.waitlistSignup.update({
    where: { id: row.id },
    data: {
      ...(extras.possession ? { possession: extras.possession } : {}),
      ...(extras.bhk ? { bhk: extras.bhk } : {}),
      ...(extras.society ? { society: canonicalSociety(extras.society) } : {}),
      ...(STYLES.includes(styleRaw) ? { style: styleRaw } : {}),
      ...(answeredSomething && !row.extrasAt ? { extrasAt: new Date() } : {}),
    },
  });
  return waitlistStatus(clean);
}

/** For the page: the count (from a hundred) and the free calls left. */
export async function waitlistPublicStats(): Promise<PublicStats> {
  return publicStats(await prisma.waitlistSignup.count());
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
