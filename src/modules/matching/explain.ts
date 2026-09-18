import 'server-only';

/**
 * Why this studio, in the customer's terms.
 *
 * ## What this is, and what it is very deliberately not
 *
 * A short written read on one match: what the studio is good at, where it sits
 * against this particular brief, and the one thing worth checking. Two or
 * three sentences, on every row, always.
 *
 * It is **not** allowed to invent a fact. The model is handed a block of
 * figures we already hold — score, factor breakdown, localities they have
 * finished in, delivered project values, variance, checks cleared — and told
 * to write from those and nothing else. Everything it can say is therefore
 * something the customer could go and verify on the studio's own page, which
 * is the whole standard this product holds itself to.
 *
 * ## Why there is a fallback, and why it is not a lesser thing
 *
 * `matchSummary()` in `score.ts` already composes a defensible sentence out of
 * the same breakdown. When there is no API key, when the call times out, or
 * when the model returns something that fails the checks below, that sentence
 * is what the customer sees — and the label changes with it. A screen that
 * says "AI summary" over a template is the kind of unearned claim this
 * codebase spends a lot of comments arguing against.
 *
 * So `source` travels with the text, and the component prints it.
 */

import { hasAnthropic, anthropicModel } from '@/lib/env';
import { matchSummary, type MatchResult } from './score';
import { paiseToLakhs } from '@/lib/money';
import type { Brief } from '@/modules/brief/types';
import type { Studio } from '@/modules/studio/types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 300;
const TIMEOUT_MS = 9000;

export interface Explanation {
  text: string;
  /** `model` when Claude wrote it, `rules` when the deterministic one did. */
  source: 'model' | 'rules';
}

/**
 * The prompt's whole job is to stop it being a brochure.
 *
 * Every constraint here exists because the obvious failure is enthusiasm: a
 * model handed a studio and a customer will write an advertisement unless it
 * is told, repeatedly, that it is writing an assessment.
 */
function systemPrompt(): string {
  return [
    'You write one short assessment of how well an interior design studio fits a specific customer brief, for the customer to read.',
    '',
    'Rules, all of them absolute:',
    '- Use ONLY the figures given. Never invent a project, a place, a price, a material or a year.',
    '- Two or three sentences. No lists, no headings, no markdown.',
    '- Plain British English. No marketing adjectives: no "premium", "bespoke", "exceptional", "perfect", "trusted".',
    '- Never tell them to book, contact, hurry or decide. You are not selling.',
    '- Name the single weakest thing about this match in the last sentence. Every match has one; if you cannot find it, say what the score does not yet cover.',
    '- Do not repeat the score as a number. The customer can already see it.',
    '- Never use the studio name more than once.',
    '- If a figure is missing, say it is not known rather than guessing or omitting the subject.',
  ].join('\n');
}

/** Only facts we hold. Nothing here is inferred. */
function factsAsPrompt(brief: Brief, studio: Studio, match: MatchResult): string {
  const localMatches = brief.locality
    ? studio.portfolio.filter((p) => p.locality === brief.locality).length
    : 0;

  const delivered = studio.portfolio
    .map((p) => p.valuePaise)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const cleared = studio.checks.filter((c) => c.result === 'PASS').length;

  const lines = [
    `Customer brief: ${brief.propertyType ?? 'unknown property type'}, ${
      brief.carpetAreaSqft ? `${brief.carpetAreaSqft} sq ft carpet` : 'area not given'
    }, locality ${brief.locality ?? 'not given'}, scope ${brief.scope ?? 'not given'}.`,
    brief.budgetMaxPaise
      ? `Budget up to about ₹${paiseToLakhs(brief.budgetMaxPaise).toFixed(1)} lakh.`
      : 'Budget not given.',
    brief.styleLikes.length > 0
      ? `Leaning towards: ${brief.styleLikes.join(', ')}.`
      : 'No style leaning given.',
    brief.styleDislikes.length > 0 ? `Ruled out: ${brief.styleDislikes.join(', ')}.` : '',
    '',
    `Studio: ${studio.tradeName}, ${studio.yearsActive ?? 'unknown'} years active, team of ${studio.teamSize ?? 'unknown'}.`,
    `Works in: ${studio.localities.join(', ')}.`,
    `Finished projects on record: ${studio.completedProjects}. In this customer's locality: ${localMatches}.`,
    delivered.length > 0
      ? `Delivered project values, in lakh: ${delivered.map((v) => paiseToLakhs(v).toFixed(1)).join(', ')}.`
      : 'No delivered project values on record.',
    studio.avgVarianceDays !== null
      ? `Average overrun against the promised date: ${studio.avgVarianceDays} days.`
      : 'Delivery record not established yet.',
    studio.specComplianceRate !== null
      ? `Built to the quoted specification ${Math.round(studio.specComplianceRate * 100)}% of the time.`
      : '',
    `Verification checks cleared: ${cleared} of ${studio.checks.length}. Upheld disputes: ${studio.upheldDisputes}.`,
    '',
    `Our matching engine scored this ${match.score} out of 100, using ${match.factorsScored} of ${match.factorsTotal} factors.`,
    match.reasoning.length > 0 ? `It gave these reasons: ${match.reasoning.join(' ')}` : '',
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Cheap guards against the two ways this goes wrong in public.
 *
 * Length, because a model that ignores "two or three sentences" has ignored
 * the rest of the prompt too. And the marketing vocabulary, because that is
 * the failure that actually damages the page — a brochure sentence in the
 * middle of a screen whose entire claim is that it does not write brochures.
 */
const BANNED = /\b(premium|bespoke|exceptional|perfect|trusted|world[- ]class|stunning|dream|hassle)\b/i;

function usable(text: string): boolean {
  if (text.length < 60 || text.length > 700) return false;
  if (BANNED.test(text)) return false;
  if (/[*#_`]/.test(text)) return false;
  return true;
}

/**
 * Write the assessment.
 *
 * Never throws and never blocks the page: every failure returns the rules
 * sentence, labelled as one. A match screen that renders slowly because a
 * model is thinking is a worse screen than one whose summary is plainer.
 */
export async function explainMatch(
  brief: Brief,
  studio: Studio,
  match: MatchResult,
): Promise<Explanation> {
  const fallback: Explanation = {
    text:
      matchSummary(brief, studio, match) ??
      `Matched on what you told us about your flat. ${
        studio.completedProjects > 0
          ? `${studio.completedProjects} finished projects are on record.`
          : 'They have no finished projects on record with us yet.'
      }`,
    source: 'rules',
  };

  if (!hasAnthropic()) return fallback;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: MAX_TOKENS,
        system: systemPrompt(),
        messages: [{ role: 'user', content: factsAsPrompt(brief, studio, match) }],
      }),
    });
    clearTimeout(timer);

    if (!response.ok) return fallback;

    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();

    return usable(text) ? { text, source: 'model' } : fallback;
  } catch {
    clearTimeout(timer);
    return fallback;
  }
}
