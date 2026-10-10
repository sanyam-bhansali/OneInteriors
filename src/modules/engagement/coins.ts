import 'server-only';

/**
 * Home Coins in the database (rules in coin-rules.ts).
 *
 * Almost every award is derived from something already recorded — a
 * finished brief, a signed project, a decision chosen before its date, a snag
 * with a photo, a family member who joined, a friend who signed, a society
 * circle — so `settleCoins` can run whenever the wallet or Home loads and
 * pays each thing exactly once (the ledger's unique key). Only three are
 * actions the customer takes in the moment: opening the day's site update,
 * answering the weekly challenge, and sharing a milestone.
 */

import { prisma } from '@/lib/prisma';
import { societyKey } from '@/modules/floorplan/society-library';
import { COINS, CIRCLE_SIZE, MAX_SHARES, expiresOn, istDay, streakAwardRef, streakOf, type CoinKind } from './coin-rules';

async function award(userId: string, kind: CoinKind, ref: string, note?: string): Promise<boolean> {
  try {
    await prisma.coinEntry.create({ data: { userId, kind, ref, coins: COINS[kind].coins, note: note ?? COINS[kind].label } });
    return true;
  } catch {
    return false; // already earned
  }
}

/** Pay everything this customer has earned from what is already recorded. Safe to run on every visit. */
export async function settleCoins(userId: string): Promise<void> {
  const brief = await prisma.brief.findUnique({
    where: { userId },
    select: { id: true, completedAt: true, society: true, referredByCode: true },
  });
  if (!brief) return;
  if (brief.completedAt) await award(userId, 'QUIZ', `brief:${brief.id}`);

  const projects = await prisma.homeProject.findMany({
    where: { introduction: { briefId: brief.id } },
    select: {
      id: true,
      signedAt: true,
      createdAt: true,
      introduction: { select: { studio: { select: { tradeName: true } } } },
      decisions: { where: { chosenById: userId }, select: { id: true, title: true, dueOn: true, chosenAt: true } },
      snags: { where: { raisedById: userId, raisedByStudio: false }, select: { id: true, title: true, photoPaths: true } },
      family: { where: { joinedAt: { not: null }, removedAt: null }, select: { id: true, name: true } },
    },
  });

  for (const p of projects) {
    await award(userId, 'SIGNED', `project:${p.id}`, `Signed with ${p.introduction.studio.tradeName}`);
    for (const d of p.decisions) {
      if (d.chosenAt && d.chosenAt.getTime() <= d.dueOn.getTime()) await award(userId, 'DECISION_ON_TIME', `decision:${d.id}`, d.title);
    }
    for (const s of p.snags) {
      if (s.photoPaths.length > 0) await award(userId, 'SNAG_PHOTO', `snag:${s.id}`, s.title);
    }
    for (const f of p.family) await award(userId, 'FAMILY_JOINED', `family:${f.id}`, `${f.name} joined`);
  }

  // Referrals unlock only when the friend signs; both families earn.
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (me?.referralCode) {
    const friends = await prisma.brief.findMany({
      where: { referredByCode: me.referralCode, introductions: { some: { homeProject: { signedAt: { not: null } } } } },
      select: { id: true, contactName: true },
      take: 100,
    });
    for (const f of friends) await award(userId, 'REFERRAL_SIGNED', `friend:${f.id}`, `${f.contactName ?? 'A friend'} signed`);
  }
  if (brief.referredByCode && projects.some((p) => p.signedAt)) {
    await award(userId, 'REFERRAL_SIGNED', `joined:${brief.id}`, 'You signed through a friend’s invite');
  }

  // Society circle: three flats in one society signed through us.
  const key = societyKey(brief.society);
  if (key && projects.some((p) => p.signedAt)) {
    const signed = await signedInSociety(key);
    if (signed >= CIRCLE_SIZE) await award(userId, 'SOCIETY_CIRCLE', `society:${key}`, `${brief.society} circle`);
  }
}

/** How many briefs in this society have a project signed in the app. */
export async function signedInSociety(key: string): Promise<number> {
  const rows = await prisma.brief.findMany({
    where: { society: { not: null }, introductions: { some: { homeProject: { signedAt: { not: null } } } } },
    select: { society: true },
    take: 2000,
  });
  return rows.filter((r) => societyKey(r.society) === key).length;
}

/** The customer opened the site update: 10 coins a day when there is one today, and the streak bonus. */
export async function openedSiteUpdate(userId: string, now = new Date()): Promise<{ earned: number }> {
  const today = istDay(now);
  const since = new Date(now.getTime() - 36 * 3_600_000);
  const update = await prisma.homeProjectUpdate.findFirst({
    where: { createdAt: { gte: since }, project: { introduction: { brief: { userId } } } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!update || istDay(update.createdAt) !== today) return { earned: 0 };
  let earned = 0;
  if (await award(userId, 'DAILY_UPDATE', `day:${today}`)) earned += COINS.DAILY_UPDATE.coins;
  const days = await dailyDays(userId);
  const ref = streakAwardRef(days, today);
  if (ref && (await award(userId, 'STREAK_7', ref))) earned += COINS.STREAK_7.coins;
  return { earned };
}

async function dailyDays(userId: string): Promise<string[]> {
  const rows = await prisma.coinEntry.findMany({
    where: { userId, kind: 'DAILY_UPDATE' },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { ref: true },
  });
  return rows.map((r) => r.ref.replace(/^day:/, ''));
}

/** A milestone shared: 25 coins, up to five shares in all, once per stage. */
export async function sharedMilestone(userId: string, stageKey: string): Promise<{ earned: number }> {
  const count = await prisma.coinEntry.count({ where: { userId, kind: 'SHARE_MILESTONE' } });
  if (count >= MAX_SHARES) return { earned: 0 };
  return { earned: (await award(userId, 'SHARE_MILESTONE', `stage:${stageKey.slice(0, 40)}`)) ? COINS.SHARE_MILESTONE.coins : 0 };
}

/** Right on the weekly challenge. */
export async function challengeWon(userId: string, challengeId: string): Promise<boolean> {
  return award(userId, 'CHALLENGE', `challenge:${challengeId}`);
}

export interface Wallet {
  balance: number;
  streak: number;
  /** Twelve months after the planned handover, when there is a project. */
  expiresOn: string | null;
  entries: { kind: string; coins: number; note: string; at: string }[];
}

export async function wallet(userId: string, now = new Date()): Promise<Wallet> {
  const [sum, entries, days, project] = await Promise.all([
    prisma.coinEntry.aggregate({ where: { userId }, _sum: { coins: true } }),
    prisma.coinEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 40, select: { kind: true, coins: true, note: true, createdAt: true } }),
    dailyDays(userId),
    prisma.homeProject.findFirst({
      where: { introduction: { brief: { userId } } },
      orderBy: { startOn: 'desc' },
      select: { startOn: true, totalDays: true },
    }),
  ]);
  const handover = project ? new Date(project.startOn.getTime() + project.totalDays * 86_400_000) : null;
  return {
    balance: sum._sum.coins ?? 0,
    streak: streakOf(days, istDay(now)),
    expiresOn: handover ? expiresOn(handover).toISOString() : null,
    entries: entries.map((e) => ({ kind: e.kind, coins: e.coins, note: e.note, at: e.createdAt.toISOString() })),
  };
}
