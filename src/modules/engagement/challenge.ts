import 'server-only';

/**
 * "Spot the mistake" (v79 design): one real Pune site photo a week, set by
 * ops, with the mistake marked as a circle on the photo. A tap inside it is
 * right; the explanation teaches what to check in their own home. Answering
 * counts once, right or wrong.
 */

import { prisma } from '@/lib/prisma';
import { signedSitePhotoUrls, storeSitePhoto } from '@/modules/storage/site-photos';
import { requireRole } from '@/modules/auth/session';

export interface ChallengeView {
  id: string;
  weekLabel: string;
  photo: string;
  /** Set once they have answered: whether they were right, and what it was. */
  answered: { correct: boolean; answer: string; explain: string; x: number; y: number; radius: number } | null;
  found: number;
}

/** Monday of this week, IST, at midnight UTC — the key a week's challenge is stored under. */
export function mondayOf(now: Date): Date {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  const day = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day));
}

/** Inside the marked circle; all values are fractions of the photo's width and height. */
export function isHit(c: { x: number; y: number; radius: number }, x: number, y: number): boolean {
  if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return false;
  return Math.hypot(x - c.x, y - c.y) <= c.radius;
}

export async function currentChallenge(userId: string | null, now = new Date()): Promise<ChallengeView | null> {
  const c = await prisma.weeklyChallenge.findFirst({
    where: { weekOf: { lte: mondayOf(now) } },
    orderBy: { weekOf: 'desc' },
  });
  if (!c) return null;
  const [urls, mine, found] = await Promise.all([
    signedSitePhotoUrls([c.photoPath]),
    userId ? prisma.challengeAnswer.findUnique({ where: { challengeId_userId: { challengeId: c.id, userId } } }) : null,
    prisma.challengeAnswer.count({ where: { challengeId: c.id, correct: true } }),
  ]);
  return {
    id: c.id,
    weekLabel: c.weekOf.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    photo: urls[0] ?? '',
    answered: mine ? { correct: mine.correct, answer: c.answer, explain: c.explain, x: c.x, y: c.y, radius: c.radius } : null,
    found,
  };
}

export type SetResult = { ok: true } | { ok: false; error: string };

/** Ops sets a week's challenge: the photo, where the mistake is, and what it teaches. */
export async function setChallenge(input: { weekOf: string; photo: File | null; x: number; y: number; radius: number; answer: string; explain: string }): Promise<SetResult> {
  const user = await requireRole('OPS');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekOf)) return { ok: false, error: 'The Monday it runs, please.' };
  if (!input.photo || input.photo.size === 0) return { ok: false, error: 'A site photo, please.' };
  if (![input.x, input.y, input.radius].every((v) => Number.isFinite(v) && v > 0 && v < 1)) return { ok: false, error: 'Tap where the mistake is.' };
  const answer = input.answer.trim().slice(0, 120);
  const explain = input.explain.trim().slice(0, 600);
  if (answer.length < 5 || explain.length < 20) return { ok: false, error: 'Say what the mistake is, and what to check at home.' };
  const stored = await storeSitePhoto('challenges', input.photo);
  if (!stored.ok) return stored;
  const weekOf = mondayOf(new Date(`${input.weekOf}T06:00:00Z`));
  await prisma.weeklyChallenge.upsert({
    where: { weekOf },
    create: { weekOf, photoPath: stored.path, x: input.x, y: input.y, radius: input.radius, answer, explain, createdById: user.id },
    update: { photoPath: stored.path, x: input.x, y: input.y, radius: input.radius, answer, explain },
  });
  return { ok: true };
}
