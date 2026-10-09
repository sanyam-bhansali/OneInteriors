'use server';

/**
 * The v79 engagement screens' server side: Home Coins, family, votes,
 * referrals and the society circle, the dream board, milestone shares and
 * the weekly challenge. Every action resolves the signed-in user here.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { referralCodeFor } from '@/modules/brief/repository';
import { societyKey } from '@/modules/floorplan/society-library';
import { challengeWon, openedSiteUpdate, settleCoins, sharedMilestone, signedInSociety, wallet, type Wallet } from '@/modules/engagement/coins';
import { CIRCLE_SIZE } from '@/modules/engagement/coin-rules';
import { familyOf, inviteFamily, joinFamily, removeFamily, voteDecision, type FamilyRow } from '@/modules/engagement/family';
import { signedSitePhotoUrls, storeSitePhoto } from '@/modules/storage/site-photos';
import { currentChallenge, isHit, type ChallengeView } from '@/modules/engagement/challenge';

type Fail = { ok: false; error: string; signIn?: boolean };
const SIGN_IN: Fail = { ok: false, error: 'Sign in to see this.', signIn: true };
const OFF: Fail = { ok: false, error: 'Not available on this test build.' };

async function me() {
  if (!hasDatabase()) return null;
  return getCurrentUser();
}

// ── Coins ──────────────────────────────────────────────────────

export async function walletAction(): Promise<{ ok: true; wallet: Wallet } | Fail> {
  if (!hasDatabase()) return OFF;
  const user = await me();
  if (!user) return SIGN_IN;
  await settleCoins(user.id);
  return { ok: true, wallet: await wallet(user.id) };
}

/** Called when Home or Site shows today's update. */
export async function openedUpdateAction(): Promise<{ earned: number }> {
  const user = await me();
  if (!user) return { earned: 0 };
  return openedSiteUpdate(user.id);
}

export async function sharedMilestoneAction(stageKey: string): Promise<{ earned: number }> {
  const user = await me();
  if (!user || typeof stageKey !== 'string') return { earned: 0 };
  return sharedMilestone(user.id, stageKey);
}

// ── Family ─────────────────────────────────────────────────────

export async function familyAction(projectId: string): Promise<{ ok: true; family: FamilyRow[] } | Fail> {
  const user = await me();
  if (!user) return SIGN_IN;
  const family = await familyOf(user.id, projectId);
  return family ? { ok: true, family } : { ok: false, error: 'Only the owner of the project manages family.' };
}

export async function inviteFamilyAction(projectId: string, input: { name: string; relation: string; phone: string }) {
  const user = await me();
  if (!user) return SIGN_IN;
  const r = await inviteFamily(user.id, projectId, input);
  revalidatePath('/app/family');
  return r;
}

export async function removeFamilyAction(memberId: string) {
  const user = await me();
  if (!user) return SIGN_IN;
  return removeFamily(user.id, memberId);
}

export async function joinFamilyAction(token: string) {
  const user = await me();
  if (!user) return SIGN_IN;
  return joinFamily(token, user.id);
}

export async function voteAction(decisionId: string, index: number, note: string) {
  const user = await me();
  if (!user) return SIGN_IN;
  return voteDecision(user.id, decisionId, index, note);
}

// ── Refer and the society circle ───────────────────────────────

export interface ReferView {
  code: string | null;
  invites: { name: string; signed: boolean }[];
  society: { name: string; signed: number; of: number } | null;
}

export async function referAction(): Promise<{ ok: true; refer: ReferView } | Fail> {
  if (!hasDatabase()) return OFF;
  const user = await me();
  if (!user) return SIGN_IN;
  const code = await referralCodeFor(user.id, user.name);
  const [invites, brief] = await Promise.all([
    code
      ? prisma.brief.findMany({
          where: { referredByCode: code },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: { contactName: true, introductions: { where: { homeProject: { signedAt: { not: null } } }, select: { id: true } } },
        })
      : [],
    prisma.brief.findUnique({ where: { userId: user.id }, select: { society: true } }),
  ]);
  const key = societyKey(brief?.society);
  return {
    ok: true,
    refer: {
      code,
      // First names only: a friend's progress, not their details.
      invites: invites.map((b) => ({ name: (b.contactName ?? 'A friend').split(' ')[0]!, signed: b.introductions.length > 0 })),
      society: key && brief?.society ? { name: brief.society, signed: await signedInSociety(key), of: CIRCLE_SIZE } : null,
    },
  };
}

// ── Dream board ────────────────────────────────────────────────

export interface Pin {
  id: string;
  url: string;
  note: string | null;
}

export async function dreamAction(): Promise<{ ok: true; pins: Pin[] } | Fail> {
  if (!hasDatabase()) return OFF;
  const user = await me();
  if (!user) return SIGN_IN;
  const rows = await prisma.dreamPin.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 60 });
  const urls = await signedSitePhotoUrls(rows.map((r) => r.photoPath));
  return { ok: true, pins: rows.map((r, i) => ({ id: r.id, url: urls[i] ?? '', note: r.note })) };
}

export async function addPinAction(form: FormData): Promise<{ ok: true } | Fail> {
  const user = await me();
  if (!user) return SIGN_IN;
  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a photo.' };
  const count = await prisma.dreamPin.count({ where: { userId: user.id, deletedAt: null } });
  if (count >= 60) return { ok: false, error: 'Your board holds 60 photos. Remove one first.' };
  const stored = await storeSitePhoto(`dream_${user.id}`, file);
  if (!stored.ok) return stored;
  const note = String(form.get('note') ?? '').trim().slice(0, 80) || null;
  await prisma.dreamPin.create({ data: { userId: user.id, photoPath: stored.path, note } });
  return { ok: true };
}

export async function removePinAction(id: string): Promise<{ ok: true } | Fail> {
  const user = await me();
  if (!user) return SIGN_IN;
  await prisma.dreamPin.updateMany({ where: { id, userId: user.id }, data: { deletedAt: new Date() } });
  return { ok: true };
}

// ── Spot the mistake ───────────────────────────────────────────

export async function challengeAction(): Promise<{ ok: true; challenge: ChallengeView | null } | Fail> {
  if (!hasDatabase()) return OFF;
  const user = await me();
  return { ok: true, challenge: await currentChallenge(user?.id ?? null) };
}

/** A tap on the photo, as fractions of its width and height. Right or wrong, it counts once. */
export async function answerChallengeAction(challengeId: string, x: number, y: number) {
  const user = await me();
  if (!user) return SIGN_IN;
  const c = await prisma.weeklyChallenge.findUnique({ where: { id: challengeId }, select: { id: true, x: true, y: true, radius: true } });
  if (!c) return { ok: false as const, error: 'That challenge has closed.' };
  const already = await prisma.challengeAnswer.findUnique({ where: { challengeId_userId: { challengeId, userId: user.id } } });
  const hit = isHit(c, x, y);
  if (!already) await prisma.challengeAnswer.create({ data: { challengeId, userId: user.id, correct: hit } });
  const earned = hit && !already ? ((await challengeWon(user.id, challengeId)) ? 50 : 0) : 0;
  return { ok: true as const, hit, earned };
}
