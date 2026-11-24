import 'server-only';

/**
 * "Start from a previous quotation" (owner, 17 Nov 2026). What is copied is
 * decided in `from-previous-rules.ts` (pure, tested); this file reads and
 * writes inside the signed-in person's studio. The quotation copied FROM may
 * be any of the studio's (owner, 19 Nov 2026: reps "should see all
 * quotation" as templates; `templateSourceWhere`); the one written TO stays
 * inside their own scope (`qs.write`), and opening a quotation is unchanged. The new quotation itself is made by `createQuote`, for the
 * NEW client, with every check that runs there (lead, role, rates gate,
 * branding); this only fills it.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { computeTotals } from './pricing';
import { readPhases } from '@/modules/studio/payment-phases';
import { refusalFor } from '@/modules/studio/roles';
import { quoteScope } from './quotes';
import { myProducts } from './store';
import { copiedLines, fillRefusal, previousQuotesWhere, templateSourceWhere, rateChanges, templateLines, templateTerms, type CopiedLine, type RateChange } from './from-previous-rules';

export interface PreviousQuote {
  id: string;
  number: string;
  clientName: string;
  society: string | null;
  config: string | null;
  stage: 'SALES' | 'DESIGN';
  totalPaise: number;
  lineCount: number;
  updatedAt: string;
}

const NOT_YOURS = 'That quotation is not one you can copy.';

/** The quotations this person may copy from, newest first, matching the search. */
export async function previousQuotes(search: string): Promise<PreviousQuote[]> {
  const qs = await quoteScope();
  if (!qs?.lead) return [];
  try {
    const rows = await prisma.studioQuote.findMany({
      where: previousQuotesWhere(templateSourceWhere(qs), qs.studioId, String(search ?? '')),
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: {
        id: true,
        number: true,
        clientName: true,
        society: true,
        config: true,
        stage: true,
        feeBps: true,
        discountBps: true,
        onSpotPaise: true,
        bookingAdvancePaise: true,
        gstBps: true,
        phases: true,
        updatedAt: true,
        lines: { select: { code: true, unit: true, ratePaise: true, widthMm: true, heightMm: true, qtyMilli: true, amountPaise: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      clientName: r.clientName,
      society: r.society,
      config: r.config,
      stage: r.stage,
      totalPaise: computeTotals(
        r.lines.map((l) => ({ code: l.code, unit: l.unit, ratePaise: fromDb(l.ratePaise), widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: fromDb(l.amountPaise) })),
        { feeBps: r.feeBps, discountBps: r.discountBps, onSpotPaise: fromDb(r.onSpotPaise), bookingAdvancePaise: fromDb(r.bookingAdvancePaise), gstBps: r.gstBps, phases: readPhases(r.phases) },
      ).totalPaise,
      lineCount: r.lines.length,
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('[studio-quote] previousQuotes failed', error);
    return [];
  }
}

export type PreviousQuoteCopy =
  | {
      ok: true;
      id: string;
      number: string;
      config: string | null;
      category: 'ESSENTIAL' | 'PREMIUM' | 'LUXURY' | null;
      kitchenRunMm: number | null;
      bathrooms: number | null;
      onSpotPaise: number;
      onSpotLabel: string | null;
      lines: CopiedLine[];
      /** Products whose product master rate has changed since; the copy keeps the old rate. */
      changed: RateChange[];
    }
  | { ok: false; error: string };

/** One quotation's lines and terms, to show before it is used (and to fill the First quote page). */
export async function previousQuoteToCopy(id: string): Promise<PreviousQuoteCopy> {
  const qs = await quoteScope();
  if (!qs?.lead) return { ok: false, error: NOT_YOURS };
  const source = await prisma.studioQuote.findFirst({
    where: { AND: [templateSourceWhere(qs), { studioId: qs.studioId, id: String(id ?? '').slice(0, 64) }] },
    select: {
      id: true,
      number: true,
      config: true,
      category: true,
      kitchenRunMm: true,
      bathrooms: true,
      onSpotPaise: true,
      onSpotLabel: true,
      lines: { select: { room: true, product: true, code: true, unit: true, details: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true, note: true, sortOrder: true } },
    },
  });
  if (!source) return { ok: false, error: NOT_YOURS };
  const lines = copiedLines(source.lines);
  const products = await myProducts();
  return {
    ok: true,
    id: source.id,
    number: source.number,
    config: source.config,
    category: source.category,
    kitchenRunMm: source.kitchenRunMm,
    bathrooms: source.bathrooms,
    onSpotPaise: fromDb(source.onSpotPaise),
    onSpotLabel: source.onSpotLabel,
    lines,
    changed: rateChanges(lines, products),
  };
}

/**
 * Fill a quotation just made by `createQuote` from a previous one: its terms,
 * and its lines when `withLines` (the First quote page sends its own lines,
 * edited on screen, and takes only the terms). The source must be one this
 * person can read; the target one they can write, a draft never sent, with no
 * revisions (and no lines, when lines are copied).
 */
export async function fillFromPrevious(targetId: string, sourceId: string, withLines: boolean): Promise<{ ok: true; lines: number } | { ok: false; error: string }> {
  const qs = await quoteScope();
  if (!qs?.lead) return { ok: false, error: NOT_YOURS };
  const studioId = qs.studioId;
  const [source, target] = await Promise.all([
    prisma.studioQuote.findFirst({
      where: { AND: [templateSourceWhere(qs), { studioId, id: String(sourceId ?? '').slice(0, 64) }] },
      select: {
        feeBps: true,
        discountBps: true,
        onSpotPaise: true,
        onSpotLabel: true,
        bookingAdvancePaise: true,
        gstBps: true,
        phases: true,
        welcomeNote: true,
        terms: true,
        kitchenRunMm: true,
        bathrooms: true,
        category: true,
        lines: { select: { room: true, product: true, code: true, unit: true, details: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true, note: true, sortOrder: true } },
      },
    }),
    prisma.studioQuote.findFirst({
      where: { AND: [qs.write, { studioId, id: String(targetId ?? '').slice(0, 64) }] },
      select: { id: true, status: true, issuedOn: true, category: true, _count: { select: { lines: true, revisions: true } } },
    }),
  ]);
  /* A director writes no quotation (owner, 24 Nov 2026), so the target is never theirs: say why. */
  if (!source || !target || target.id === sourceId) return { ok: false, error: refusalFor(qs.lead, NOT_YOURS) };
  const refusal = fillRefusal({ status: target.status, issuedOn: target.issuedOn, lineCount: target._count.lines, revisionCount: target._count.revisions }, withLines);
  if (refusal) return { ok: false, error: refusal };

  const terms = templateTerms(source);
  const lines = withLines ? templateLines(source.lines) : [];
  try {
    await prisma.$transaction([
      prisma.studioQuote.update({
        where: { id: target.id },
        data: {
          feeBps: terms.feeBps,
          discountBps: terms.discountBps,
          onSpotPaise: terms.onSpotPaise,
          onSpotLabel: terms.onSpotLabel,
          bookingAdvancePaise: terms.bookingAdvancePaise,
          gstBps: terms.gstBps,
          ...(terms.phases !== undefined ? { phases: terms.phases } : {}),
          welcomeNote: terms.welcomeNote,
          terms: terms.terms,
          /* The flat the lines were sized for; the First quote page sets its own. */
          ...(withLines ? { kitchenRunMm: terms.kitchenRunMm, bathrooms: terms.bathrooms } : {}),
          /* Essential, Premium or Luxe: the one picked for the new quotation stays; the First quote page asks none, so the old one's comes. */
          ...(target.category === null && source.category ? { category: source.category } : {}),
        },
      }),
      ...(lines.length > 0 ? [prisma.studioQuoteLine.createMany({ data: lines.map((l) => ({ ...l, quoteId: target.id })) })] : []),
    ]);
    return { ok: true, lines: lines.length };
  } catch (error) {
    console.error('[studio-quote] fillFromPrevious failed', error);
    return { ok: false, error: 'The quotation was started, but copying the previous one did not save.' };
  }
}
