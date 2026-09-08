import 'server-only';

/**
 * The portfolio drafting agent.
 *
 * A studio owner is good at interiors and usually not at writing about them.
 * Left alone they either write four lines of nothing or paste a brochure, and
 * both cost them customers. This drafts the profile from what they have already
 * told us, so their job becomes editing rather than staring at a blank box.
 *
 * ## What keeps it honest
 *
 * 1. **It only ever sees facts from our own database.** No search, no browsing,
 *    nothing the studio has not told us.
 * 2. **Every draft is machine-checked before a human sees it** — see
 *    `portfolio-draft.ts`. Any number that is not traceable to the source facts
 *    fails the draft. Prompting alone is not a control.
 * 3. **Nothing it writes is ever published by this module.** The studio reads
 *    it, edits it, and approves it. The agent drafts; a person publishes.
 * 4. **It degrades to nothing.** With no API key the product works exactly as
 *    before and the studio writes their own copy. This is a convenience, not a
 *    dependency.
 *
 * Called directly over HTTPS rather than through the SDK — one request, one
 * shape, and one less package to keep patched.
 */

import { prisma } from '@/lib/prisma';
import { hasAnthropic, anthropicModel } from '@/lib/env';
import { paiseToLakhs, fromDb } from '@/lib/money';
import { PROPERTY_LABELS, SCOPE_LABELS, STYLE_LABELS, PUNE_LOCALITIES } from '@/modules/brief/types';
import {
  parseDraft,
  verifyDraft,
  type PortfolioDraft,
  type PortfolioFacts,
  type VerificationIssue,
} from './portfolio-draft';

// Re-exported so callers have one import for the whole feature; the pure
// implementation lives next door so it can be tested without an API key.
export { parseDraft, verifyDraft, draftIsClean } from './portfolio-draft';
export type { PortfolioDraft, PortfolioFacts, VerificationIssue } from './portfolio-draft';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 90_000;
const MAX_TOKENS = 2000;

export type DraftResult =
  | { ok: true; draft: PortfolioDraft; facts: PortfolioFacts; issues: VerificationIssue[] }
  | { ok: false; error: string };

/** Gather everything the agent is allowed to know. Nothing else reaches it. */
export async function collectFacts(studioId: string): Promise<PortfolioFacts | null> {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    include: { portfolio: { orderBy: [{ completedOn: 'desc' }, { createdAt: 'desc' }] } },
  });
  if (!studio) return null;

  return {
    tradeName: studio.tradeName,
    about: studio.about,
    localities: studio.localities,
    yearsActive: studio.yearsActive,
    teamSize: studio.teamSize,
    minLakhs: studio.minProjectPaise ? paiseToLakhs(fromDb(studio.minProjectPaise)) : null,
    maxLakhs: studio.maxProjectPaise ? paiseToLakhs(fromDb(studio.maxProjectPaise)) : null,
    projects: studio.portfolio.map((p) => ({
      title: p.title,
      locality: p.locality,
      propertyType: p.propertyType,
      scope: p.scope,
      styleTags: p.styleTags,
      valueLakhs: p.valuePaise ? paiseToLakhs(fromDb(p.valuePaise)) : null,
      durationDays: p.durationDays,
      completedOn: p.completedOn ? p.completedOn.toISOString().slice(0, 10) : null,
      isRender: p.isRender,
    })),
  };
}

/**
 * The system prompt.
 *
 * Written as constraints rather than encouragement. "Be honest" is not an
 * instruction a model can check itself against; "every number must appear in
 * the facts below" is.
 */
function systemPrompt(): string {
  return [
    'You write profile copy for interior design studios on a curated marketplace in Pune, India.',
    '',
    'A customer reads this before deciding whether to meet the studio about a project worth several lakh rupees. Your copy has to help them decide correctly — including deciding NOT to meet this studio when it is a poor fit. A reader who meets the wrong studio because of your copy has been badly served.',
    '',
    'ABSOLUTE RULES:',
    '1. Use ONLY the facts given to you. You have no other knowledge of this studio.',
    '2. Every number you write must appear in the facts. Do not compute averages, totals, or approximations. Do not write "over 50 projects" from a list of six. If a number is not in the facts, do not use a number.',
    '3. Never state or imply a delivery time, warranty, price guarantee, award, certification, or client name that is not in the facts.',
    '4. If a project is marked isRender: true, never describe it as a photograph, a finished home, or something you can visit.',
    '5. Where the facts are thin, write less. Short and true beats long and padded. Do not fill space.',
    '',
    'VOICE:',
    '- Plain, specific, unhurried. Concrete nouns over adjectives.',
    '- No marketing language: no "elevate", "bespoke", "curated", "dream home", "transform your space", "journey", "passion".',
    '- No exclamation marks. British spelling.',
    '- Write about what they do and how they work, not how the customer will feel.',
    '',
    'The "notFor" field is required and is the most valuable part. Name the customer this studio genuinely is not right for, based on the facts — a budget below their floor, a style absent from their work, a scope they have not done. Do not soften it into a compliment. A studio that suits everyone suits no one, and readers trust the rest of the page more when this one is candid.',
    '',
    'Reply with JSON only, no markdown fence, matching exactly:',
    '{"headline": string (max 90 chars), "introduction": string (2-3 paragraphs), "projectStories": [{"title": string (copied exactly from the facts), "story": string (max 90 words)}], "notFor": string}',
    '',
    'projectStories must contain one entry per project, in the same order as given.',
  ].join('\n');
}

/** The facts, as readable text. A model reads prose more reliably than IDs. */
export function factsAsPrompt(facts: PortfolioFacts): string {
  const locality = (slug: string | null) =>
    slug ? (PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? slug) : null;

  const lines: string[] = [
    `Studio: ${facts.tradeName}`,
    facts.yearsActive ? `Years active: ${facts.yearsActive}` : 'Years active: not given',
    facts.teamSize ? `Team size: ${facts.teamSize}` : 'Team size: not given',
    facts.localities.length
      ? `Areas they work in: ${facts.localities.map(locality).filter(Boolean).join(', ')}`
      : 'Areas: not given',
    facts.minLakhs && facts.maxLakhs
      ? `Project sizes they take: ₹${facts.minLakhs} lakh to ₹${facts.maxLakhs} lakh`
      : 'Project size range: not given',
    '',
    'In their own words:',
    facts.about ? facts.about : '(they have not written anything yet)',
    '',
    `Completed projects (${facts.projects.length}):`,
  ];

  facts.projects.forEach((p, i) => {
    const bits = [
      `${i + 1}. "${p.title}"`,
      locality(p.locality),
      p.propertyType ? PROPERTY_LABELS[p.propertyType as keyof typeof PROPERTY_LABELS] : null,
      p.scope ? SCOPE_LABELS[p.scope as keyof typeof SCOPE_LABELS] : null,
      p.styleTags.map((t) => STYLE_LABELS[t as keyof typeof STYLE_LABELS]).filter(Boolean).join(', ') || null,
      p.valueLakhs ? `₹${p.valueLakhs} lakh` : null,
      p.durationDays ? `${p.durationDays} days` : null,
      p.completedOn ? `completed ${p.completedOn}` : null,
      // Stated plainly in the facts, not only in the rules, because the model
      // reads the facts more carefully than the preamble.
      p.isRender ? 'IMAGES ARE RENDERS, NOT PHOTOGRAPHS' : null,
    ].filter(Boolean);
    lines.push(bits.join(' · '));
  });

  return lines.join('\n');
}

export async function draftPortfolio(studioId: string): Promise<DraftResult> {
  if (!hasAnthropic()) {
    return {
      ok: false,
      error: 'No ANTHROPIC_API_KEY is set, so drafting is off. The studio writes its own copy.',
    };
  }

  const facts = await collectFacts(studioId);
  if (!facts) return { ok: false, error: 'No such studio.' };
  if (facts.projects.length === 0) {
    return { ok: false, error: 'Add at least one project first — there is nothing to write about.' };
  }

  let raw: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
        messages: [{ role: 'user', content: factsAsPrompt(facts) }],
      }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Never surface the raw body — it can echo the request, and the request
      // carries the studio's data.
      return { ok: false, error: `The drafting service returned ${response.status}.${
        response.status === 401 ? ' The API key looks wrong.' : ''
      }${body && response.status === 400 ? ' The request was rejected.' : ''}` };
    }

    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    raw = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, error: aborted ? 'Drafting timed out.' : 'Could not reach the drafting service.' };
  }

  const draft = parseDraft(raw);
  if (!draft) return { ok: false, error: 'The draft came back in a shape we could not read.' };

  // Verify BEFORE returning. A draft that fails still comes back — an ops
  // reviewer seeing "this invented a number" is more useful than a generic
  // failure, and it is how we find out the prompt has drifted.
  return { ok: true, draft, facts, issues: verifyDraft(draft, facts) };
}
