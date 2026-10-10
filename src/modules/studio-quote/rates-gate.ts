import 'server-only';

/**
 * Whether a studio may write quotations yet.
 *
 * ## The rule (owner, 10 Oct 2026)
 *
 * A quotation is only as good as the rates under it, and a studio typing
 * thirty-seven rates from memory at nine in the evening is how a builder
 * produces numbers nobody stands behind. So the rates come from the studio's
 * own past quotations instead:
 *
 *   1. The studio sends its quotations (onboarding, Your rates). They are
 *      stored, not read.
 *   2. The owner reads them in their own Claude app (`/read-quotations`,
 *      docs/READ-QUOTATIONS.md), which writes a product-master draft; ops
 *      checks it on /ops/[slug] and approves — which fills the studio's
 *      product master and stamps `ratesFilledAt` (product-drafts.ts).
 *   3. The studio is told, checks the figures, changes any it disagrees
 *      with, and confirms.
 *
 * Until step 3 the builder is shut. After it, never again: a later archive
 * re-read and approved updates the rates and tells the studio, but does not
 * take away a tool they are using.
 */

import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio/tenancy';

export type RatesGate =
  /** Nothing approved yet — their quotations are with us. */
  | 'WITH_US'
  /** Approved and filled in; waiting for the studio to check and confirm. */
  | 'TO_CHECK'
  /** Confirmed. The builder is open. */
  | 'OPEN';

export async function ratesGateFor(studioId: string): Promise<RatesGate> {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { ratesConfirmedAt: true, ratesFilledAt: true },
  });
  if (studio?.ratesConfirmedAt) return 'OPEN';
  return studio?.ratesFilledAt ? 'TO_CHECK' : 'WITH_US';
}

/** For the signed-in studio. A read failure shuts the builder rather than opening it. */
export async function myRatesGate(): Promise<RatesGate> {
  const studioId = await myStudioId();
  if (!studioId) return 'WITH_US';
  try {
    return await ratesGateFor(studioId);
  } catch (error) {
    console.error('[rates-gate] read failed', error);
    return 'WITH_US';
  }
}

/**
 * The studio says the filled rates are right.
 *
 * Only once something has been filled — confirming an empty product master
 * would open the builder on nothing, which is the state this exists to stop.
 * Clears the "your rates are ready" announcement in the same breath.
 */
export async function confirmMyRates(): Promise<{ ok: true } | { ok: false; error: string }> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const gate = await ratesGateFor(studioId);
  if (gate === 'OPEN') return { ok: true };
  if (gate === 'WITH_US') {
    return { ok: false, error: 'Your rates are not filled in yet. We will tell you the moment they are.' };
  }

  const members = await prisma.studioMember.findMany({ where: { studioId }, select: { userId: true } });

  await prisma.$transaction([
    prisma.studio.update({ where: { id: studioId }, data: { ratesConfirmedAt: new Date() } }),
    prisma.notification.updateMany({
      where: { userId: { in: members.map((m) => m.userId) }, template: 'rates.filled', readAt: null },
      data: { readAt: new Date() },
    }),
  ]);

  return { ok: true };
}

export const RATES_GATE_COPY: Record<Exclude<RatesGate, 'OPEN'>, { title: string; body: string }> = {
  WITH_US: {
    title: 'Your rates are being read from your quotations',
    body: 'We are reading the quotations you sent and filling your product master from your own numbers. The builder opens once you have checked them — we will tell you here the moment they are ready.',
  },
  TO_CHECK: {
    title: 'Your rates are filled — check them first',
    body: 'We have filled your product master from your own quotations. Look through the figures, change any that are not right, and confirm. The builder opens as soon as you do.',
  },
};
