'use server';

/**
 * Writing the journey down, behind the screens.
 *
 * These are called after the customer already has what they asked for. The
 * quote is on screen, the star is already filled in — `sessionStorage` did
 * that, synchronously, and remains the source of truth for what is rendered.
 * This is the durable second copy, and it is written afterwards on purpose.
 *
 * Nothing here returns anything the UI branches on, and nothing here throws.
 * A recording failure is our problem and must never become the customer's:
 * the worst case is that we lose a row, which is exactly where the product
 * was before these existed.
 */

import {
  recordFirstQuote,
  recordDecision,
} from '@/modules/quotation/journey-repository';
import type { FirstQuote } from '@/modules/quotation/first-quote';
import type { FloorPlan } from '@/modules/quotation/project-store';

export async function saveQuoteAction(input: {
  studioSlug: string;
  quote: FirstQuote;
  plan: FloorPlan;
}): Promise<void> {
  await recordFirstQuote(input);
}

export async function saveDecisionAction(input: {
  comparedSlugs: string[];
  starredCodes: string[];
}): Promise<void> {
  await recordDecision(input);
}
