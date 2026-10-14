'use server';

/**
 * GEIO's one action: a question (and maybe a photo) in, a checked answer out.
 * The checks, the facts and the handover live in `modules/app/geio-ask.ts`,
 * shared with the phone app's `POST /api/app/v1/geio`.
 *
 * A signed-in customer is answered about their own home; signed out (or on a
 * build with no database) the screen is the labelled sample, answered about
 * the example flat. Rate-limited by IP here, since the page may be signed out.
 */

import { headers } from 'next/headers';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { askGeioFor } from '@/modules/app/geio-ask';
import type { GeioResult } from '@/modules/app/geio-input';

export async function askGeioAction(input: {
  question: unknown;
  history: unknown;
  image?: unknown;
  lang: unknown;
  name: unknown;
}): Promise<GeioResult> {
  const h = await headers();
  const key = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const user = hasDatabase() ? await getCurrentUser().catch(() => null) : null;
  return askGeioFor(input, user, key);
}
