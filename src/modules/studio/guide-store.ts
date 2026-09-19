import 'server-only';

/**
 * The studio's real data, as the walkthrough's scoreboard.
 *
 * Every step in `guide.ts` is derived from a fact in here, which is why there
 * is no "mark as complete" anywhere in the product: a step is done when the
 * thing is done, and a studio who did it through the ordinary form without
 * ever opening the guide finds it already ticked.
 *
 * ## One query, not seven
 *
 * These counts sit above two screens a studio opens all day, so they are seven
 * `count`s issued in parallel rather than seven page loads' worth of full
 * reads. Nothing here selects a row.
 *
 * ## Failure is silent and optimistic-free
 *
 * With no database, or on any error, every count is zero — so the guide shows
 * as untouched rather than falsely complete. Wrong in the direction that
 * offers help rather than the one that withholds it.
 */

import { LIVE } from '@/modules/studio-practice/demo-lead';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import {
  parseGuideState,
  EMPTY_GUIDE_STATE,
  type GuideId,
  type GuideState,
  type StudioFacts,
} from './guide';

const NO_FACTS: StudioFacts = {
  clientCount: 0,
  clientsWithFollowUp: 0,
  clientsMovedOn: 0,
  hasBranding: false,
  pricedProducts: 0,
  quoteCount: 0,
  quotesWithLines: 0,
};

/** The member row this guide belongs to, resolved from the session. */
async function currentMember(): Promise<{ id: string; studioId: string; state: GuideState } | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const row = await prisma.studioMember.findUnique({
      where: { userId: user.id },
      select: { id: true, studioId: true, guideState: true },
    });
    if (!row) return null;
    return { id: row.id, studioId: row.studioId, state: parseGuideState(row.guideState) };
  } catch {
    return null;
  }
}

export async function guideContext(): Promise<{ state: GuideState; facts: StudioFacts }> {
  if (!hasDatabase()) return { state: EMPTY_GUIDE_STATE, facts: NO_FACTS };

  const member = await currentMember();
  if (!member) return { state: EMPTY_GUIDE_STATE, facts: NO_FACTS };

  try {
    const studioId = member.studioId;

    const [
      clientCount,
      clientsWithFollowUp,
      clientsMovedOn,
      branding,
      pricedProducts,
      quoteCount,
      quotesWithLines,
    ] = await Promise.all([
      /* `LIVE` carries `isDemo: false` as well as `deletedAt: null`. The
         sample lead on an empty board is a real row, so without it the first
         step of this guide would tick before the studio had done anything —
         which is the exact failure this file's header calls out. */
      prisma.studioClient.count({ where: { studioId, ...LIVE } }),
      prisma.studioClient.count({
        where: { studioId, ...LIVE, nextActionOn: { not: null } },
      }),
      /* "Moved on" means out of the intake column — the only definition that
         survives a studio renaming its own stages, which they are encouraged
         to do on the third step of this very guide. */
      prisma.studioClient.count({
        where: { studioId, ...LIVE, stage: { isIntake: false } },
      }),
      prisma.studioBranding.findUnique({
        where: { studioId },
        select: { legalName: true },
      }),
      prisma.studioProduct.count({ where: { studioId, isActive: true, ratePaise: { gt: 0 } } }),
      prisma.studioQuote.count({ where: { studioId } }),
      /* A quote with no lines is a quote nobody has written yet. Counting the
         empty shell as "you have built one" would tick the last step the
         instant somebody pressed New and then walked away. */
      prisma.studioQuote.count({ where: { studioId, lines: { some: {} } } }),
    ]);

    return {
      state: member.state,
      facts: {
        clientCount,
        clientsWithFollowUp,
        clientsMovedOn,
        hasBranding: Boolean(branding?.legalName),
        pricedProducts,
        quoteCount,
        quotesWithLines,
      },
    };
  } catch {
    return { state: member.state, facts: NO_FACTS };
  }
}

/**
 * Skip, or bring it back.
 *
 * Dismissing hides the panel and completes nothing — the steps stay honestly
 * undone and the header keeps a "Show me again". Somebody who skipped on a
 * busy Monday should be able to find it on Thursday.
 */
export async function setDismissed(guide: GuideId, dismissed: boolean): Promise<void> {
  try {
    const member = await currentMember();
    if (!member) return;

    const next = dismissed
      ? Array.from(new Set([...member.state.dismissed, guide]))
      : member.state.dismissed.filter((g) => g !== guide);

    await prisma.studioMember.update({
      where: { id: member.id },
      data: {
        guideState: {
          dismissed: next,
          seen: Array.from(new Set([...member.state.seen, guide])),
        },
      },
    });
  } catch {
    // A tour that cannot save its own state must not fail the screen it sits
    // on. Worst case it reappears next time, which is the safe direction.
  }
}
