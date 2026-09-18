'use server';

import { findClients, type FoundClient } from '@/modules/studio-practice/clients';

/**
 * Find somebody, from anywhere in the studio.
 *
 * The question this answers is the one a studio owner asks fifty times a
 * week and currently cannot: "Kothari rang — where are we with her?" Without
 * this the only way to answer is to scan a board of two hundred cards, which
 * is why people keep the real answer in WhatsApp instead.
 *
 * Deliberately not a page. A search that navigates away loses whatever you
 * were doing, and the answer is four facts — who has her, what column she is
 * in, her number — which fit in a panel.
 */
export async function searchAction(query: string): Promise<FoundClient[]> {
  if (typeof query !== 'string') return [];
  return findClients(query);
}
