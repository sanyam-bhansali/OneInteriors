'use server';

/**
 * The written read on a match.
 *
 * A server action rather than a client fetch, for the ordinary reason: the
 * Anthropic key is not `NEXT_PUBLIC_` and must never reach a browser bundle.
 * The client sends the brief and the studio id; the server holds the key.
 *
 * Deliberately one studio per call. Six matches are six independent requests
 * that can land as they finish, so the page fills in rather than waiting on
 * the slowest one — and a single failure costs one row's summary rather than
 * all of them.
 *
 * ## Three things this endpoint has to survive
 *
 * It is public, unauthenticated, and it spends money on every call. That is an
 * unusual combination in this codebase and it needs saying out loud:
 *
 * 1. **The brief is rebuilt, never trusted.** It arrives from the browser and
 *    is interpolated into a prompt. See `sanitiseBrief`.
 * 2. **The score is recomputed here.** A breakdown posted from the client is a
 *    prompt the client wrote.
 * 3. **Calls are rate limited.** Without it, one loop is an unbounded bill.
 */

import { headers } from 'next/headers';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { rankOnServer } from '@/modules/matching/rank-server';
import { explainMatch, type Explanation } from '@/modules/matching/explain';
import { sanitiseBrief } from '@/modules/matching/sanitise';
import type { Brief } from '@/modules/brief/types';
import { asLang } from '@/modules/i18n/site';

/**
 * A caller may ask for this many reads in a window.
 *
 * Twelve is two full match pages. Somebody comparing studios reloads and goes
 * back; somebody scripting it does not stop at twelve.
 */
const MAX_PER_WINDOW = 12;
const WINDOW_MS = 60_000;

/**
 * In memory, per instance.
 *
 * Honest about what this is: on serverless each instance keeps its own
 * counter, so a determined caller spread across instances gets more than
 * twelve. It is not a security boundary — it is the difference between a
 * stray loop costing a few rupees and costing a few thousand, which is the
 * failure actually worth preventing at this stage. A shared counter belongs in
 * Postgres or Redis alongside the OTP limiter, and should land before this is
 * advertised anywhere.
 */
const seen = new Map<string, number[]>();

function withinLimit(key: string): boolean {
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    seen.set(key, recent);
    return false;
  }

  recent.push(now);
  seen.set(key, recent);

  // Cheap eviction so the map cannot grow without bound on a long-lived
  // instance.
  if (seen.size > 5_000) {
    for (const [k, times] of seen) {
      if (times.every((t) => now - t >= WINDOW_MS)) seen.delete(k);
    }
  }

  return true;
}

async function callerKey(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

export async function explainAction(brief: Brief, studioId: string, language?: unknown): Promise<Explanation> {
  if (typeof studioId !== 'string' || studioId.length > 64) {
    return { text: '', source: 'rules' };
  }
  // From the browser, so whitelisted like everything else: 'hi', 'mr' or English.
  const lang = asLang(typeof language === 'string' ? language : null);

  // Rebuilt from a whitelist before it touches a prompt.
  const safe = sanitiseBrief(brief);
  if (safe.propertyType === null) return { text: '', source: 'rules' };

  const studios = await cachedRoster();
  const studio = studios.find((s) => s.id === studioId);
  if (!studio) return { text: '', source: 'rules' };

  // Recomputed here rather than trusting a score posted from the browser —
  // on the same rates the card was scored on, or the two would disagree.
  // The model reads the English facts and is told which language to write
  // in; the rules sentence is built from the same match in that language.
  const [ranked, localised] = await Promise.all([
    rankOnServer(safe, studios, 99),
    lang === 'en' ? null : rankOnServer(safe, studios, 99, { lang }),
  ]);
  const match = ranked.find((m) => m.studioId === studioId);

  if (!match) return { text: '', source: 'rules' };
  const localMatch = localised?.find((m) => m.studioId === studioId) ?? match;

  // Over the limit still returns something useful — the deterministic
  // sentence — rather than an error the row would have to render.
  if (!(await withinLimit(await callerKey()))) {
    return { text: '', source: 'rules' };
  }

  return explainMatch(safe, studio, match, lang, localMatch);
}
