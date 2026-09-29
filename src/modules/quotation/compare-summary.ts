import 'server-only';

/**
 * "Explain the differences" — a written summary of a comparison, checked.
 *
 * Claude receives only the compared numbers (`compareFacts`) and writes where
 * the cost changes, the material ranges and the price per material in plain
 * words. Before anything is shown, every ₹ figure and percentage in it is
 * checked against the data (`figuresCheck`); one it cannot place and the
 * rule-based summary is shown instead. Labelled as written by AI either way
 * it is — the source travels with the text.
 *
 * Never throws and never blocks: every failure returns the rules summary.
 */

import { anthropicModel, hasAnthropic } from '@/lib/env';
import type { Comparison } from './first-quote';
import {
  allowedFigures,
  compareFacts,
  deterministicSummary,
  figuresCheck,
  type CompareSummary,
  type Entry,
} from './compare-insights';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 600;

export interface ComparisonExplanation {
  /** The written paragraph, or the rules summary as one paragraph. */
  text: string;
  source: 'model' | 'rules';
  /** The rule-based summary, always — the page shows its questions either way. */
  rules: CompareSummary;
}

function systemPrompt(): string {
  return [
    'You explain, to a homeowner in Pune, how interior-design quotes from different studios differ. All the quotes are priced on the same line items and sizes, so every difference is either the studio\'s rate or the material it specified.',
    '',
    'RULES:',
    '1. Use ONLY the figures given. Never compute, estimate or round a new figure; quote them exactly as written (for example "₹6.16 L").',
    '2. Say where the cost changes most (which rooms), how the materials differ, and what each studio charges for the same kind of material.',
    '3. Never recommend a studio and never say one is better value. Say what differs; the homeowner decides.',
    '4. Four to six sentences, plain English, no headings, no lists, no markdown.',
    '5. No marketing words (premium, bespoke, stunning, dream, world-class, perfect).',
  ].join('\n');
}

const BANNED = /\b(premium|bespoke|exceptional|perfect|trusted|world[- ]class|stunning|dream|hassle|best value|recommend)\b/i;

function usable(text: string): boolean {
  if (text.length < 120 || text.length > 1400) return false;
  if (BANNED.test(text)) return false;
  if (/[*#_`]/.test(text)) return false;
  return true;
}

export async function explainComparison(entries: Entry[], comparison: Comparison): Promise<ComparisonExplanation> {
  const rules = deterministicSummary(entries, comparison);
  const fallback: ComparisonExplanation = {
    text: [rules.headline, ...rules.points].join(' '),
    source: 'rules',
    rules,
  };
  if (!hasAnthropic() || entries.length < 2) return fallback;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!.trim(),
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: MAX_TOKENS,
        system: systemPrompt(),
        messages: [{ role: 'user', content: compareFacts(entries) }],
      }),
    });
    if (!response.ok) return fallback;
    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    if (!usable(text)) return fallback;
    // The guardrail that matters: every figure must come from the data.
    const check = figuresCheck(text, allowedFigures(entries));
    if (!check.ok) {
      console.error('[compare] summary named figures not in the data', check.stray.length);
      return fallback;
    }
    return { text, source: 'model', rules };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
