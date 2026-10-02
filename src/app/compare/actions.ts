'use server';

/**
 * Actions for the comparison screen.
 *
 * Only one so far, and it is the important one: minting the link that lets the
 * person who was not on the call read the same page.
 */

import { shareLinkForCurrentBrief, revokeShareLink } from '@/modules/brief/share';
import { resolveSiteUrl } from '@/lib/site';
import { record } from '@/modules/analytics/record';
import { headers } from 'next/headers';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { sanitiseBrief } from '@/modules/matching/sanitise';
import { buildFirstQuote, compareMany, homeShapeFor } from '@/modules/quotation/first-quote';
import { resolveRatesForMany } from '@/modules/quotation/resolve-rates';
import { filedRatesFor } from '@/data/filed-rates';
import { answerQuestion, explainComparison, type ComparisonExplanation, type QuoteAnswer } from '@/modules/quotation/compare-summary';
import { cleanQuestion } from '@/modules/quotation/quote-questions';
import type { Language } from '@/modules/brief/types';

export type ShareLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createShareLinkAction(): Promise<ShareLinkResult> {
  const result = await shareLinkForCurrentBrief();

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === 'no_brief'
          ? 'We could not find your brief on this account.'
          : 'Could not create a link just now. Try again in a moment.',
    };
  }

  await record('share.created');

  // Built server-side from the configured site URL rather than from anything
  // the browser reported. A link assembled out of a request header is a link
  // an attacker can point wherever they like, and this one is meant to be
  // forwarded to somebody's spouse.
  return { ok: true, url: `${resolveSiteUrl()}/shared/${result.token}` };
}

export async function revokeShareLinkAction(): Promise<{ ok: boolean }> {
  return revokeShareLink();
}

// ── "Explain the differences" ──────────────────────────────────

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 6;
const seen = new Map<string, number[]>();

function withinLimit(key: string): boolean {
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  recent.push(now);
  seen.set(key, recent);
  if (seen.size > 5_000) seen.clear();
  return true;
}

/**
 * The written comparison, on demand.
 *
 * The browser sends which studios, the brief and the kitchen run — never
 * the quotes themselves. The quotes are re-priced here on the resolved rates
 * and the studios' names come from the roster, so nothing the browser wrote
 * reaches the prompt and the figures are the ones this server stands behind.
 */
interface CompareInput {
  slugs: unknown;
  brief: unknown;
  kitchenRunMm: unknown;
  measured: unknown;
  language?: unknown;
}

/**
 * The quotes, priced again on the server from the slugs and the sanitised
 * brief — never taken from the browser — so an answer can only speak to real
 * numbers. Rate-limited per address.
 */
async function entriesFor(input: CompareInput, min: number) {
  const slugs = Array.isArray(input.slugs)
    ? [...new Set(input.slugs.filter((s): s is string => typeof s === 'string' && s.length <= 80))].slice(0, 6)
    : [];
  if (slugs.length < min) return null;

  const h = await headers();
  const key = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (!withinLimit(key)) return null;

  const brief = sanitiseBrief(input.brief);
  const shape = homeShapeFor(brief);
  const run =
    typeof input.kitchenRunMm === 'number' && input.kitchenRunMm >= 1500 && input.kitchenRunMm <= 9000
      ? Math.round(input.kitchenRunMm)
      : null;
  const roster = await cachedRoster();
  const rates = await resolveRatesForMany(slugs);
  const entries = slugs
    .map((slug) => roster.find((s) => s.slug === slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      slug: s.slug,
      name: s.tradeName,
      quote: buildFirstQuote(
        {
          ...shape,
          kitchenRunMm: run,
          runSource: run ? (input.measured === 'floor_plan' ? 'floor_plan' : 'customer') : 'standard',
          curatedDiscountPct: s.matchingProfile?.curatedDiscountPct ?? null,
        },
        rates[s.slug]?.rates ?? filedRatesFor(s.slug),
      ),
    }));
  if (entries.length < min) return null;
  // The language from their brief, or the one they switched to on the page.
  const language: Language =
    input.language === 'HI' || input.language === 'MR'
      ? input.language
      : brief.language === 'HI' || brief.language === 'MR'
        ? brief.language
        : 'EN';
  return { entries, language };
}

export async function explainComparisonAction(input: CompareInput): Promise<ComparisonExplanation | null> {
  const got = await entriesFor(input, 2);
  if (!got) return null;
  return explainComparison(got.entries, compareMany(got.entries), got.language);
}

/** "Ask your quote" (queue item 24): one question, answered from these quotes only. */
export async function askQuoteAction(input: CompareInput & { question: unknown }): Promise<QuoteAnswer | null> {
  const question = cleanQuestion(input.question);
  if (!question) return null;
  const got = await entriesFor(input, 1);
  if (!got) return null;
  return answerQuestion(got.entries, question, got.language);
}
