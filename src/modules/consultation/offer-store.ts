import 'server-only';

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { offerState, type OfferState } from './offer';

/**
 * The offer as it stands: free calls taken so far are the calls requested or booked and
 * not cancelled. Never throws — without a database the offer reads as
 * untouched, which is what it is before launch.
 */
export async function currentOffer(): Promise<OfferState> {
  if (!hasDatabase()) return offerState(0);
  try {
    const taken = await prisma.consultation.count({ where: { status: { in: ['requested', 'scheduled', 'completed'] } } });
    return offerState(taken);
  } catch (error) {
    console.error('[offer] count unavailable', error instanceof Error ? error.name : 'unknown');
    return offerState(0);
  }
}
