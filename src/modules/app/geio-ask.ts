import 'server-only';

/**
 * One GEIO question, end to end, for both clients: the website's server
 * action and the phone app's `POST /api/app/v1/geio`. Checks the input, the
 * rate limit and the plan (a signed customer on Basic gets `plan`), picks
 * the facts for whoever is asking, asks the model, and tells ops when the
 * answer hands over to the expert.
 */

import { after } from 'next/server';
import type { AuthUser } from '@/modules/auth/session';
import { askGeio } from './geio';
import { geioContextFor, handOverToExpert } from './customer-home';
import { expertFirstName, geioHistory, geioImage, geioLang, geioName, geioQuestion, withinLimit, type GeioResult } from './geio-input';

export async function askGeioFor(
  input: { question: unknown; history: unknown; image?: unknown; lang: unknown; name: unknown },
  /** Null in the website's signed-out sample: the example project, and no handover to ops. */
  user: AuthUser | null,
  rateKey: string,
): Promise<GeioResult> {
  const image = geioImage(input.image);
  const question = geioQuestion(input.question, image);
  if (!question) return { ok: false, reason: 'empty' };
  if (!withinLimit(rateKey)) return { ok: false, reason: 'busy' };

  const expert = expertFirstName();
  const name = geioName(input.name);
  const context = await geioContextFor(user?.id ?? null, expert).catch((error: unknown) => {
    console.error('[geio] facts failed', error instanceof Error ? error.name : 'unknown');
    return null;
  });
  // Never fall back to the sample flat for a real customer: no facts, no answer.
  if (!context) return { ok: false, reason: 'unavailable' };
  // Signed with a studio on Basic: GEIO is part of Assured (portal/plans.ts).
  if (context.locked) return { ok: false, reason: 'plan' };
  const { facts } = context;

  const reply = await askGeio({ question, history: geioHistory(input.history), image, lang: geioLang(input.lang), name, expert, facts });
  if (!reply) return { ok: false, reason: 'unavailable' };
  if (user && reply.handover) {
    const note = reply.handover;
    // After the answer is sent: the customer should not wait on ops' email.
    after(() => handOverToExpert(user, note));
  }
  return { ok: true, reply };
}
