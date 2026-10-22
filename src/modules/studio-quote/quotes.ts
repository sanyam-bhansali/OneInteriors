import 'server-only';

/**
 * A studio's own quotations.
 *
 * Same rule as `store.ts`, and it matters more here: **every query is scoped by
 * the studio id from the session, and nothing in this file takes one as an
 * argument.** These rows carry a named client, their phone number, their
 * address and what they are about to spend — for projects that in most cases
 * have nothing to do with us. We hold that as a processor, not an owner.
 *
 * The money is all in `pricing.ts`, which is pure and tested.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { myBranding } from './store';
import {
  computeTotals,
  feeBpsOf,
  GST_BPS,
  keptFeeBps,
  lineAmount,
  type QuoteLineInput,
  type QuoteTerms,
  type QuoteTotals,
  type QuoteUnitName,
  type WorkCodeName,
} from './pricing';
import { planQuotation, readRules, type CatalogueProduct, type HomeConfig } from './configure';
import { ratesGateFor } from './rates-gate';
import { notify } from '@/modules/notify/service';
import { planUseFrom } from '@/modules/brief/mapping';
import type { PlanRoomSize } from '@/modules/brief/types';
import { readPhases, type PaymentPhase } from '@/modules/studio/payment-phases';
import type { ComparableLine } from './revision';
import { actingMember, leadForQuote, mayOnLead, myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import { completeRequestForQuote, linkDraftToRequest } from './quote-request-store';
import { can } from '@/modules/studio/roles';
import { record as recordLeadEvent } from '@/modules/studio-practice/events';
import { issueRevision } from '@/modules/studio-sales/revisions';
import { quoteWriteRefusal } from './write-rules';
import { cleanNote } from './line-note';

export type QuoteStatusName = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'DECLINED';
export type QuoteStageName = 'SALES' | 'DESIGN';

/** Hauspire's two versions of a quotation: what wins the client, and what is built. */
export const STAGE_LABELS: Record<QuoteStageName, string> = {
  SALES: 'Sales Final',
  DESIGN: 'Design Final',
};

export const STATUS_LABELS: Record<QuoteStatusName, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Sent',
  ACCEPTED: 'Won',
  DECLINED: 'Lost',
};

export interface QuoteLineRow {
  id: string;
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details: string | null;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  ratePaise: Paise;
  amountPaise: Paise;
  /** A note for the client, printed under the line's details (15 Oct 2026). */
  note: string | null;
  sortOrder: number;
}

export interface QuoteRow {
  id: string;
  number: string;
  stage: QuoteStageName;
  status: QuoteStatusName;
  clientName: string;
  /** The lead it is for (Studio OS Phase 1), when it has one. */
  clientId: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  society: string | null;
  locality: string | null;
  config: string | null;
  carpetSqft: number | null;
  kitchenRunMm: number | null;
  bathrooms: number | null;
  /** The lines as the client first received them. Empty until issued. */
  issuedLines: ComparableLine[];
  fromMarketplace: boolean;
  feeBps: number;
  discountBps: number;
  onSpotPaise: Paise;
  bookingAdvancePaise: Paise;
  gstBps: number;
  /** The flat discount's name; null prints as "Additional discount". */
  onSpotLabel: string | null;
  /** The date on the document: the one set, else the day it was made. */
  quoteDate: Date;
  /** The payment schedule this quotation uses; null = the standard stages. */
  phases: PaymentPhase[] | null;
  /** The Sales Final this Design Final was made from. */
  basedOnId: string | null;
  /** The client's floor plan rooms, when their brief came with a read plan. */
  planRooms: PlanRoomSize[];
  welcomeNote: string | null;
  terms: string | null;
  issuedOn: Date | null;
  updatedAt: Date;
  lines: QuoteLineRow[];
}

export interface QuoteSummary {
  id: string;
  number: string;
  status: QuoteStatusName;
  stage: QuoteStageName;
  clientName: string;
  clientPhone: string | null;
  clientId: string | null;
  society: string | null;
  config: string | null;
  fromMarketplace: boolean;
  totalPaise: Paise;
  lineCount: number;
  updatedAt: Date;
}

/** The list. Newest activity first — a quotation you touched today is the one
 *  you are still thinking about. `search` matches client, number, phone or
 *  society, any part, any case. */
export async function myQuotes(search?: string): Promise<QuoteSummary[]> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return [];

  const q = search?.trim().slice(0, 80);
  const digits = q?.replace(/\D/g, '') ?? '';
  try {
    const rows = await prisma.studioQuote.findMany({
      where: {
        ...qs?.where,
        studioId,
        ...(q
          ? {
              OR: [
                { clientName: { contains: q, mode: 'insensitive' as const } },
                { number: { contains: q, mode: 'insensitive' as const } },
                { society: { contains: q, mode: 'insensitive' as const } },
                ...(digits.length >= 4 ? [{ clientPhone: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { lines: true },
      take: 500,
    });

    return rows.map((row) => {
      const totals = computeTotals(row.lines.map(toLineInput), {
        feeBps: row.feeBps,
        discountBps: row.discountBps,
        onSpotPaise: fromDb(row.onSpotPaise),
        bookingAdvancePaise: fromDb(row.bookingAdvancePaise),
        gstBps: row.gstBps,
        phases: readPhases(row.phases),
      });

      return {
        id: row.id,
        number: row.number,
        status: row.status as QuoteStatusName,
        stage: row.stage as QuoteStageName,
        clientName: row.clientName,
        clientPhone: row.clientPhone,
        clientId: row.clientId,
        society: row.society,
        config: row.config,
        fromMarketplace: row.briefId !== null || row.introductionId !== null,
        totalPaise: totals.totalPaise,
        lineCount: row.lines.length,
        updatedAt: row.updatedAt,
      };
    });
  } catch (error) {
    console.error('[studio-quote] myQuotes failed', error);
    return [];
  }
}

function toLineInput(l: {
  code: string;
  unit: string;
  ratePaise: bigint;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  amountPaise: bigint;
}): QuoteLineInput {
  return {
    code: l.code as WorkCodeName,
    unit: l.unit as QuoteUnitName,
    ratePaise: fromDb(l.ratePaise),
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    qtyMilli: l.qtyMilli,
    amountPaise: fromDb(l.amountPaise),
  };
}

export async function getQuote(id: string): Promise<QuoteRow | null> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return null;
  return loadQuote(id, studioId, qs?.where ?? {});
}

/**
 * The comparison for design sign-off (project lifecycle, owner 13 Oct 2026):
 * for a caller that has ALREADY checked the member's right on the project
 * these quotations belong to (`design.close`), so a designer, who writes no
 * quotations, can sign off. Studio-scoped like every read here.
 */
export async function quotesToCompareInStudio(currentId: string, studioId: string): Promise<QuoteComparison | null> {
  const current = await loadQuote(currentId, studioId, {});
  if (!current?.basedOnId) return null;
  const base = await loadQuote(current.basedOnId, studioId, {});
  return base ? { base, current } : null;
}

async function loadQuote(id: string, studioId: string, scope: Prisma.StudioQuoteWhereInput): Promise<QuoteRow | null> {
  try {
    // Scoped by studioId as well as id. A quotation id in a URL is not proof
    // of anything, and this is a client's name and phone number.
    const row = await prisma.studioQuote.findFirst({
      where: { ...scope, id, studioId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, studio: { select: { paymentPhases: true } } },
    });
    const planRooms = row ? await planRoomsOfBrief(row.briefId, row.clientId, studioId, row.id) : [];
    if (!row) return null;

    return {
      id: row.id,
      number: row.number,
      stage: row.stage as QuoteStageName,
      status: row.status as QuoteStatusName,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      clientEmail: row.clientEmail,
      society: row.society,
      locality: row.locality,
      config: row.config,
      carpetSqft: row.carpetSqft,
      kitchenRunMm: row.kitchenRunMm,
      bathrooms: row.bathrooms,
      issuedLines: readIssued(row.issuedLines),
      fromMarketplace: row.briefId !== null || row.introductionId !== null,
      feeBps: row.feeBps,
      discountBps: row.discountBps,
      onSpotPaise: fromDb(row.onSpotPaise),
      bookingAdvancePaise: fromDb(row.bookingAdvancePaise),
      gstBps: row.gstBps,
      onSpotLabel: row.onSpotLabel,
      quoteDate: row.quoteDate ?? row.createdAt,
      phases: quotePhases(row.phases, row.studio.paymentPhases),
      basedOnId: row.basedOnId,
      clientId: row.clientId,
      planRooms,
      welcomeNote: row.welcomeNote,
      terms: row.terms,
      issuedOn: row.issuedOn,
      updatedAt: row.updatedAt,
      lines: row.lines.map((l) => ({
        id: l.id,
        room: l.room,
        product: l.product,
        code: l.code as WorkCodeName,
        unit: l.unit as QuoteUnitName,
        details: l.details,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        qtyMilli: l.qtyMilli,
        ratePaise: fromDb(l.ratePaise),
        amountPaise: fromDb(l.amountPaise),
        note: l.note,
        sortOrder: l.sortOrder,
      })),
    };
  } catch (error) {
    console.error('[studio-quote] getQuote failed', error);
    return null;
  }
}

export function totalsFor(quote: QuoteRow): QuoteTotals {
  return computeTotals(quote.lines, termsOf(quote));
}

/** The terms a quotation row is priced on — one place, so every screen agrees. */
export function termsOf(quote: Pick<QuoteRow, 'feeBps' | 'discountBps' | 'onSpotPaise' | 'bookingAdvancePaise' | 'gstBps' | 'phases'>): QuoteTerms {
  return {
    feeBps: quote.feeBps,
    discountBps: quote.discountBps,
    onSpotPaise: quote.onSpotPaise,
    bookingAdvancePaise: quote.bookingAdvancePaise,
    gstBps: quote.gstBps,
    phases: quote.phases,
  };
}

/**
 * The schedule a quotation is paid on: its own snapshot, else the studio's
 * current one, else none (the standard stages). The same rule the
 * customer's copy uses (`portal/choose.ts`), so the two never differ.
 */
export function quotePhases(own: unknown, studio: unknown): PaymentPhase[] | null {
  return readPhases(own) ?? readPhases(studio);
}

export type QuoteResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The next quotation number for this studio.
 *
 * Per studio, per year, computed rather than sequenced — two studios must never
 * share a counter, and a studio's numbering is something clients see and
 * accountants reconcile against. Editable afterwards, because most studios
 * already have a numbering scheme and ours should not fight it.
 */
async function nextNumber(studioId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;

  /* Copies carry a suffix ("2026-002-D" for a Design Final), which sorts
     after the plain numbers and does not parse as one: taking the last row
     read "002-D" as NaN, restarted at 001 and clashed with the unique
     number, so every new quotation failed once a copy existed. Read every
     number this year and take the highest leading count. */
  const rows = await prisma.studioQuote.findMany({
    where: { studioId, number: { startsWith: prefix } },
    select: { number: true },
  });
  return nextQuoteNumber(year, rows.map((r) => r.number));
}

/** The next "YYYY-NNN" after the highest count among `numbers`, suffixes ignored. Pure, for tests. */
export function nextQuoteNumber(year: number, numbers: string[]): string {
  const prefix = `${year}-`;
  const top = numbers.reduce((max, n) => {
    const m = /^(\d+)/.exec(n.startsWith(prefix) ? n.slice(prefix.length) : '');
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${prefix}${String(top + 1).padStart(3, '0')}`;
}

export interface NewQuoteInput {
  clientName: string;
  clientPhone?: string;
  society?: string;
  config?: string;
  carpetSqft?: number;
  /**
   * A client One Interiors introduced: the quotation is their final quote,
   * which the customer reads and signs in the app (v79 "Choose & sign").
   * Callers must have checked the client is this studio's.
   */
  link?: { clientId: string; introductionId: string; briefId: string | null };
  /**
   * The studio's own lead this quotation is for (Studio OS Phase 1): set
   * from the lead page or picked on the new-quotation screen. Checked
   * against the signed-in person's leads here. A salesperson must give one:
   * a quotation with no lead is not theirs to see.
   */
  clientId?: string;
}

/**
 * Whose quotations the signed-in person may touch (Studio OS Phase 1):
 * owner and PM, the studio's; a salesperson, only those of leads assigned
 * to them. `where` goes into every quotation query here, beside `studioId`.
 */
async function quoteScope(): Promise<{ studioId: string; where: Prisma.StudioQuoteWhereInput; write: Prisma.StudioQuoteWhereInput; lead: LeadScope } | null> {
  const lead = await myLeadScope();
  if (!lead || !can(lead.member, 'quote.write', { assigned: true })) return null;
  /* Sales roles (owner, 22 Oct 2026): `where` is what they may read, `write`
     what they may change (their `quote.write` reach); every write below
     uses `write`. */
  return { studioId: lead.studioId, where: lead.quotes, write: lead.quotesWritable, lead };
}

/** Whether the signed-in person may write quotations at all (for the pages). */
export async function mayQuote(): Promise<{ seesAll: boolean } | null> {
  const qs = await quoteScope();
  return qs ? { seesAll: qs.lead.seesAll } : null;
}

export async function createQuote(input: NewQuoteInput): Promise<QuoteResult> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!qs || !studioId) return { ok: false, error: 'No studio on this account.' };

  /* The lead, checked: a salesperson's own, or any of the studio's for owner and PM. */
  const leadId = input.link?.clientId ?? input.clientId ?? null;
  /* Quotation requests (owner, 22 Oct 2026): a builder may quote a lead handed to them, whatever their lead reach. */
  const lead = leadId ? await leadForQuote(qs.lead, leadId) : null;
  if (leadId && !lead) return { ok: false, error: 'That lead is not one of yours.' };
  /* Sales roles: seeing the lead is not enough; writing its quotation is `quote.write` on it. */
  if (lead && !mayOnLead(qs.lead, 'quote.write', lead)) return { ok: false, error: 'Your role does not include quotations for that lead.' };
  if (!lead && !qs.lead.seesAll) return { ok: false, error: 'Pick the lead this quotation is for.' };

  /* Shut until the studio has confirmed the rates filled from its own
     quotations — see rates-gate.ts. Enforced here as well as on the page,
     because an action is a route by another name. */
  const gate = await ratesGateFor(studioId);
  if (gate !== 'OPEN') {
    return {
      ok: false,
      error:
        gate === 'TO_CHECK'
          ? 'Check and confirm your rates on Product master first — the builder opens as soon as you do.'
          : 'Your rates are still being filled from your quotations. We will tell you when they are ready.',
    };
  }

  const clientName = input.clientName.trim();
  if (clientName.length < 2) return { ok: false, error: 'Who is it for?' };

  /**
   * Branding is required, not optional.
   *
   * A quotation with no registered name on it is a document a client cannot
   * act on and a studio cannot stand behind, so this refuses rather than
   * letting somebody build forty lines and discover it at the print screen.
   *
   * It is almost never reached now. `myBranding()` seeds the row from the
   * registration step, so a studio who has finished onboarding has one
   * whether or not they have ever opened Settings — which is what this used
   * to send them to, for a form asking them to retype facts we already held.
   * What is left here is the genuine case: a studio quoting before they have
   * registered.
   */
  const branding = await myBranding();
  if (!branding) {
    return {
      ok: false,
      error:
        'Finish your registration first — a quotation has to carry the name we checked you against.',
    };
  }

  try {
    const quote = await prisma.studioQuote.create({
      data: {
        studioId,
        number: await nextNumber(studioId),
        clientName,
        clientPhone: input.clientPhone?.trim() || null,
        society: input.society?.trim() || null,
        config: input.config?.trim() || null,
        carpetSqft: input.carpetSqft ?? null,
        ...(input.link
          ? { clientId: input.link.clientId, introductionId: input.link.introductionId, briefId: input.link.briefId }
          : lead
            ? { clientId: lead.id }
            : {}),
        // Snapshotted at creation. Changing the defaults in Settings later must
        // never rewrite a quotation already sent to a client. The fee is 7%
        // for every studio (owner, 12 Oct 2026), whatever an older setting says;
        // the studio only decides whether it starts on (14 Oct 2026).
        feeBps: feeBpsOf(branding.feeBps > 0),
        discountBps: branding.discountBps,
        bookingAdvancePaise: toDb(branding.bookingAdvancePaise),
        gstBps: branding.gstBps,
        ...(await studioPhases(studioId)),
        welcomeNote: branding.welcomeNote,
        terms: branding.terms,
      },
      select: { id: true, number: true },
    });

    /* The lead's timeline says a quotation was written, and the board's
       "₹ quoted" reads the quotations linked to it. */
    if (lead) {
      await recordLeadEvent({
        studioId,
        clientId: lead.id,
        kind: 'QUOTED',
        summary: `Quotation ${quote.number} started`,
        meta: { quoteId: quote.id },
      });
      /* The lead's open quotation request (docs/studio-os/QUOTE-REQUESTS.md) builds on this draft when it has none. */
      await linkDraftToRequest(studioId, lead.id, quote.id);
    }

    return { ok: true, id: quote.id };
  } catch (error) {
    console.error('[studio-quote] createQuote failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/** The studio's schedule, snapshotted onto a new quotation when it has one. */
async function studioPhases(studioId: string): Promise<{ phases?: Prisma.InputJsonValue }> {
  const row = await prisma.studio.findUnique({ where: { id: studioId }, select: { paymentPhases: true } });
  const phases = readPhases(row?.paymentPhases);
  return phases ? { phases: phases as unknown as Prisma.InputJsonValue } : {};
}

export interface QuoteTermsInput {
  feeBps: number;
  discountBps: number;
  gstOn: boolean;
  onSpotPaise: Paise;
  onSpotLabel: string | null;
  bookingAdvancePaise: Paise;
  /** YYYY-MM-DD, or null for the day it was made. */
  quoteDate: string | null;
}

/**
 * This quotation's own terms — fee, discount, GST, a named flat discount,
 * the advance and its date. Settings holds the defaults a new quotation
 * starts from; this is the deal on this one.
 */
export async function saveQuoteTerms(quoteId: string, input: QuoteTermsInput): Promise<ActionResult> {
  const writable = await writableQuote(quoteId);
  if (!writable.ok) return writable;

  const pct = (bps: number) => Number.isInteger(bps) && bps >= 0 && bps <= 5000;
  /* The fee is 7% or off — any other figure from a browser is read as "on". */
  if (!Number.isInteger(input.feeBps) || input.feeBps < 0) return { ok: false, error: 'The professional fee is 7%, on or off.' };
  if (!pct(input.discountBps)) return { ok: false, error: 'A discount between 0% and 50%, please.' };
  if (!Number.isInteger(input.onSpotPaise) || input.onSpotPaise < 0 || input.onSpotPaise >= 1e11) {
    return { ok: false, error: 'That discount is not an amount.' };
  }
  if (!Number.isInteger(input.bookingAdvancePaise) || input.bookingAdvancePaise < 0 || input.bookingAdvancePaise >= 1e11) {
    return { ok: false, error: 'That advance is not an amount.' };
  }
  let quoteDate: Date | null = null;
  if (input.quoteDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.quoteDate)) return { ok: false, error: 'That date is not a date.' };
    quoteDate = new Date(`${input.quoteDate}T00:00:00Z`);
    if (Number.isNaN(quoteDate.getTime())) return { ok: false, error: 'That date is not a date.' };
  }

  try {
    await prisma.studioQuote.update({
      where: { id: quoteId },
      data: {
        /* On or off only: the quotation keeps its own fee while it stays on
           (one made at 10% before the fee was fixed stays 10%); 7% only
           when a fee is turned on from off. */
        feeBps: keptFeeBps(writable.feeBps, input.feeBps > 0),
        discountBps: input.discountBps,
        gstBps: input.gstOn ? GST_BPS : 0,
        onSpotPaise: toDb(input.onSpotPaise),
        onSpotLabel: input.onSpotPaise > 0 ? input.onSpotLabel?.trim().slice(0, 60) || null : null,
        bookingAdvancePaise: toDb(input.bookingAdvancePaise),
        quoteDate,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] saveQuoteTerms failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export interface QuoteClientInput {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  society: string;
  locality: string;
  config: string;
  carpetSqft: number | null;
}

/**
 * Who the quotation is for, corrected after it was started — a misspelt
 * name, the flat number, the society. What prints on the document.
 */
export async function saveQuoteClient(quoteId: string, input: QuoteClientInput): Promise<ActionResult> {
  if (!(await ownedQuote(quoteId))) return { ok: false, error: 'That quotation is not yours.' };
  const name = input.clientName.trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: 'Who is it for?' };
  const email = input.clientEmail.trim().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email does not look right.' };
  const carpet = input.carpetSqft;
  if (carpet != null && (!Number.isInteger(carpet) || carpet <= 0 || carpet > 100_000)) {
    return { ok: false, error: 'Carpet area is a whole number of sq ft.' };
  }
  const opt = (v: string, n: number) => v.trim().slice(0, n) || null;
  try {
    await prisma.studioQuote.update({
      where: { id: quoteId },
      data: {
        clientName: name,
        clientPhone: opt(input.clientPhone, 20),
        clientEmail: email || null,
        society: opt(input.society, 120),
        locality: opt(input.locality, 80),
        config: opt(input.config, 20),
        carpetSqft: carpet,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] saveQuoteClient failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export type CopyKind = { kind: 'template'; clientName: string } | { kind: 'design-final' };

/**
 * A new quotation from an existing one.
 *
 * - **Template**: every line and term, for a different client. A fresh
 *   number, no client details, not linked to any introduction — the same
 *   kitchen for the next flat in the same society.
 * - **Design Final**: the same client and links, stage DESIGN, numbered
 *   after its Sales Final ("2026-004-D") and pointing back at it, so the two
 *   can be compared line by line. The Sales Final is left exactly as sent.
 */
export async function copyQuote(quoteId: string, copy: CopyKind): Promise<QuoteResult> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  const source = await prisma.studioQuote.findFirst({
    where: { ...qs?.write, id: quoteId, studioId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!source) return { ok: false, error: 'That quotation is not yours.' };
  /* A template copy has no lead, and a salesperson sees only their leads'
     quotations: start a new one from the lead instead. */
  if (copy.kind === 'template' && qs?.lead.seesAll === false) {
    return { ok: false, error: 'Start a new quotation from the lead it is for.' };
  }

  const template = copy.kind === 'template';
  const clientName = template ? copy.clientName.trim().slice(0, 120) : source.clientName;
  if (clientName.length < 2) return { ok: false, error: 'Who is the new quotation for?' };
  if (!template && source.stage === 'DESIGN') return { ok: false, error: 'This is already the Design Final.' };

  let number = template ? await nextNumber(studioId) : `${source.number}-D`;
  if (!template) {
    // A second Design Final of the same quotation gets -D2, -D3…
    for (let n = 2; await prisma.studioQuote.findFirst({ where: { studioId, number }, select: { id: true } }); n += 1) {
      number = `${source.number}-D${n}`;
    }
  }

  try {
    const created = await prisma.studioQuote.create({
      data: {
        studioId,
        number,
        stage: template ? 'SALES' : 'DESIGN',
        status: 'DRAFT',
        clientName,
        ...(template
          ? {}
          : {
              clientPhone: source.clientPhone,
              clientEmail: source.clientEmail,
              society: source.society,
              locality: source.locality,
              clientId: source.clientId,
              briefId: source.briefId,
              introductionId: source.introductionId,
              basedOnId: source.id,
            }),
        config: source.config,
        carpetSqft: source.carpetSqft,
        kitchenRunMm: source.kitchenRunMm,
        bathrooms: source.bathrooms,
        feeBps: source.feeBps,
        discountBps: source.discountBps,
        onSpotPaise: source.onSpotPaise,
        onSpotLabel: source.onSpotLabel,
        bookingAdvancePaise: source.bookingAdvancePaise,
        gstBps: source.gstBps,
        phases: (source.phases ?? undefined) as Prisma.InputJsonValue | undefined,
        welcomeNote: source.welcomeNote,
        terms: source.terms,
        lines: {
          create: source.lines.map((l) => ({
            room: l.room,
            product: l.product,
            code: l.code,
            unit: l.unit,
            details: l.details,
            widthMm: l.widthMm,
            heightMm: l.heightMm,
            qtyMilli: l.qtyMilli,
            ratePaise: l.ratePaise,
            amountPaise: l.amountPaise,
            note: l.note,
            sortOrder: l.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    return { ok: true, id: created.id };
  } catch (error) {
    console.error('[studio-quote] copyQuote failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * Delete a draft. Only a draft, and only one that is not a customer's final
 * quote: once sent, a quotation is a record of what a client was told, and a
 * final quote is what the customer reads in the app.
 */
export async function deleteQuote(quoteId: string): Promise<ActionResult> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  const q = await prisma.studioQuote.findFirst({
    where: { ...qs?.write, id: quoteId, studioId },
    select: { status: true, issuedOn: true, introductionId: true },
  });
  if (!q) return { ok: false, error: 'That quotation is not yours.' };
  if (q.status !== 'DRAFT' || q.issuedOn) return { ok: false, error: 'Only a draft that was never sent can be deleted.' };
  if (q.introductionId) return { ok: false, error: 'This is a One Interiors client\'s final quote — mark it lost instead.' };
  try {
    await prisma.studioQuote.deleteMany({ where: { id: quoteId, studioId } });
    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] deleteQuote failed', error);
    return { ok: false, error: 'That did not delete.' };
  }
}

/** Two quotations side by side: the base (usually the Sales Final) and this one. */
export interface QuoteComparison {
  base: QuoteRow;
  current: QuoteRow;
}

export async function quotesToCompare(currentId: string, baseId?: string): Promise<QuoteComparison | null> {
  const current = await getQuote(currentId);
  if (!current) return null;
  const id = baseId ?? current.basedOnId;
  if (!id) return null;
  const base = await getQuote(id);
  return base ? { base, current } : null;
}

/**
 * The client's read floor plan: their brief's; for the studio's own lead,
 * the plan this quotation was built from or read against
 * (`StudioQuotePlan`, floor plan → first quotation, 12 Oct 2026); else the
 * newest read floor plan on the lead.
 */
async function planReadingOf(q: { briefId: string | null; clientId?: string | null; studioId?: string; quoteId?: string }): Promise<unknown> {
  if (q.quoteId && q.studioId && q.clientId) {
    const link = await prisma.studioQuotePlan.findFirst({ where: { quoteId: q.quoteId, studioId: q.studioId }, select: { fileId: true } }).catch(() => null);
    if (link) {
      const f = await prisma.studioClientFile
        .findFirst({ where: { id: link.fileId, studioId: q.studioId, clientId: q.clientId }, select: { reading: true } })
        .catch(() => null);
      if (f?.reading) return f.reading;
    }
  }
  if (q.briefId) {
    const b = await prisma.brief.findUnique({ where: { id: q.briefId }, select: { floorPlanReading: true } }).catch(() => null);
    if (b?.floorPlanReading) return b.floorPlanReading;
  }
  if (q.clientId && q.studioId) {
    const f = await prisma.studioClientFile
      .findFirst({
        where: { studioId: q.studioId, clientId: q.clientId, kind: 'FLOOR_PLAN', reading: { not: Prisma.AnyNull } },
        orderBy: { createdAt: 'desc' },
        select: { reading: true },
      })
      .catch(() => null);
    return f?.reading ?? null;
  }
  return null;
}

/** The rooms from the client's read floor plan; empty without one. */
async function planRoomsOfBrief(briefId: string | null, clientId?: string | null, studioId?: string, quoteId?: string): Promise<PlanRoomSize[]> {
  return planUseFrom(await planReadingOf({ briefId, clientId, studioId, quoteId }))?.rooms ?? [];
}

async function planRunOfBrief(briefId: string | null, clientId?: string | null, studioId?: string, quoteId?: string): Promise<number | null> {
  return planUseFrom(await planReadingOf({ briefId, clientId, studioId, quoteId }))?.kitchenRunMm ?? null;
}

/** Ownership check, reused by every write below. */
async function ownedQuote(quoteId: string): Promise<string | null> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return null;

  const row = await prisma.studioQuote.findFirst({
    where: { ...qs?.write, id: quoteId, studioId },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Ownership, and that the quotation may still be changed: no live
 * (non-cancelled) project runs on it (`write-rules.ts`). Every write to
 * lines, terms or the standard build goes through this.
 */
async function writableQuote(quoteId: string): Promise<{ ok: true; id: string; feeBps: number; status: string } | { ok: false; error: string }> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return { ok: false, error: 'That quotation is not yours.' };
  const row = await prisma.studioQuote.findFirst({
    where: { ...qs?.write, id: quoteId, studioId },
    select: { id: true, feeBps: true, status: true },
  });
  if (!row) return { ok: false, error: 'That quotation is not yours.' };
  const live = await prisma.homeProject.findFirst({ where: { signedQuoteId: row.id, cancelledAt: null }, select: { id: true } });
  const refusal = quoteWriteRefusal({ liveProject: live !== null });
  if (refusal) return { ok: false, error: refusal };
  return { ok: true, id: row.id, feeBps: row.feeBps, status: row.status };
}

export async function setQuoteStatus(
  quoteId: string,
  status: QuoteStatusName,
): Promise<ActionResult> {
  if (!(await ownedQuote(quoteId))) return { ok: false, error: 'That quotation is not yours.' };

  /* A project runs on this quotation (signed in the app, or started for the
     studio's own client): its plan and payment stages were built from it, so
     it stays Won. */
  if (await prisma.homeProject.findFirst({ where: { signedQuoteId: quoteId }, select: { id: true } })) {
    return { ok: false, error: 'A project has started from this quotation, so it stays won.' };
  }

  try {
    /* Stamped ONCE, and `issuedOn === null` is the test.
       The condition was `status === 'ISSUED'` alone, which meant pressing
       Reopen on a won or lost quotation sent it back to ISSUED and overwrote
       the date the client first received it — the date any dispute turns on,
       and the exact thing the comment here promised was stable. */
    const current = await prisma.studioQuote.findUnique({
      where: { id: quoteId },
      select: { issuedOn: true, issuedLines: true },
    });

    const firstIssue = status === 'ISSUED' && current?.issuedOn == null;

    /**
     * The copy the client receives, frozen on the way out.
     *
     * Taken on the FIRST issue only, guarded by `issuedLines` as well as
     * `issuedOn`. Re-sending a revised quotation must not overwrite it — the
     * whole value of the snapshot is that it is the version somebody is
     * holding while asking what changed, and a snapshot that updates itself
     * answers "nothing" every time.
     */
    const snapshot =
      firstIssue && current?.issuedLines == null
        ? await prisma.studioQuoteLine.findMany({
            where: { quoteId },
            orderBy: { sortOrder: 'asc' },
            select: { room: true, product: true, amountPaise: true },
          })
        : null;

    await prisma.studioQuote.update({
      where: { id: quoteId },
      data: {
        status,
        ...(firstIssue ? { issuedOn: new Date() } : {}),
        ...(snapshot
          ? {
              issuedLines: snapshot.map((l) => ({
                room: l.room,
                product: l.product,
                // Plain number, not BigInt: Json cannot hold one, and this is
                // read back by `readIssued` which expects exactly this shape.
                amountPaise: fromDb(l.amountPaise),
              })),
            }
          : {}),
      },
    });
    /* Sent to a customer One Interiors introduced: tell them it is in the app.
       Every time it goes out, so a revised quotation is announced too. */
    if (status === 'ISSUED') {
      const qs = await quoteScope();
      const studioId = qs?.studioId ?? null;
      if (studioId) {
        /* Each send is a frozen, numbered revision (Studio OS Phase 1).
           Sending exactly what was sent last time does not make a new one,
           so Reopen on a won quotation does not add an R. */
        await issueRevision({ quoteId, studioId });
        /* Sent: the lead's quotation request is done (docs/studio-os/QUOTE-REQUESTS.md). */
        await completeRequestForQuote(studioId, quoteId, await actingMember());
        void tellCustomer(quoteId, studioId);
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

async function tellCustomer(quoteId: string, studioId: string): Promise<void> {
  try {
    const q = await prisma.studioQuote.findFirst({
      where: { id: quoteId, studioId },
      select: { number: true, introductionId: true, studio: { select: { tradeName: true } } },
    });
    if (!q?.introductionId) return;
    const intro = await prisma.introduction.findUnique({
      where: { id: q.introductionId },
      select: { withdrawnAt: true, brief: { select: { userId: true } } },
    });
    if (!intro || intro.withdrawnAt || !intro.brief.userId) return;
    await notify(intro.brief.userId, { kind: 'quote-sent', quoteId, studio: q.studio.tradeName, number: q.number });
  } catch (error) {
    console.error('[studio-quote] customer notify failed', error instanceof Error ? error.name : 'unknown');
  }
}

// ── The whole quotation at once ────────────────────────────────

/**
 * Reading the frozen issued copy back.
 *
 * Defensive rather than trusting, because this column is Json: it was written
 * by an older version of this file at some point in the past, and the shape a
 * Json column holds is whatever was true the day it was written. A snapshot
 * that cannot be read produces an empty comparison — "we cannot show what
 * changed" — rather than a page that will not load.
 */
function readIssued(value: unknown): ComparableLine[] {
  if (!Array.isArray(value)) return [];

  const lines: ComparableLine[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.room !== 'string' || typeof row.product !== 'string') continue;
    if (typeof row.amountPaise !== 'number' || !Number.isFinite(row.amountPaise)) continue;
    lines.push({ room: row.room, product: row.product, amountPaise: row.amountPaise });
  }
  return lines;
}

/** One line as the builder hands it back. `id` is absent on a new line. */
export interface SaveLineInput {
  id?: string;
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  details?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  qtyMilli?: number | null;
  ratePaise: Paise;
  /** The agreed figure, overriding the arithmetic. Null returns the line to rate × quantity. */
  agreedPaise?: Paise | null;
  /** A note for the client, printed under the line on the PDFs. Blank clears it. */
  note?: string | null;
}

/** A line that survives the trip back from a browser. */
function cleanLine(raw: SaveLineInput): SaveLineInput | null {
  const room = String(raw.room ?? '').trim();
  const product = String(raw.product ?? '').trim();
  if (room.length === 0 || product.length === 0) return null;

  const code: WorkCodeName = raw.code === 'ONSITE' ? 'ONSITE' : 'MODULAR';
  const unit: QuoteUnitName =
    raw.unit === 'SQFT' || raw.unit === 'RFT' || raw.unit === 'UNIT' ? raw.unit : 'AREA';

  const whole = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const n = Math.round(value);
    /* Refused, not clamped. A negative width is a typo and a hundred-metre
       wardrobe is a slipped decimal point; both should come back as a line
       somebody looks at again rather than a number that prints. */
    return n > 0 && n < 100_000_000 ? n : null;
  };

  const money = (value: unknown): Paise => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    const n = Math.round(value);
    return n >= 0 ? n : 0;
  };

  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : undefined,
    room: room.slice(0, 80),
    product: product.slice(0, 200),
    code,
    unit,
    details: typeof raw.details === 'string' ? raw.details.slice(0, 2_000) : null,
    widthMm: whole(raw.widthMm),
    heightMm: whole(raw.heightMm),
    qtyMilli: whole(raw.qtyMilli),
    ratePaise: money(raw.ratePaise),
    agreedPaise: raw.agreedPaise == null ? null : money(raw.agreedPaise),
    note: cleanNote(raw.note),
  };
}

/**
 * Save the whole quotation in one go.
 *
 * ## Why this replaced a save per line
 *
 * The builder used to write each row on its own the moment it changed. Nothing
 * was ever unsaved, which sounds like the safe choice and was the wrong one:
 * pricing a job is forty lines of arithmetic where each number depends on the
 * last, and forty round trips means the total on screen lags behind the
 * figures being discussed. A designer needs to see what a change costs while
 * the client is still asking.
 *
 * So the builder holds the lines, recalculates as they type, and this writes
 * the result — one transaction, one `updatedAt`, one entry in the client's
 * sense of what happened.
 *
 * ## Diffed rather than deleted and recreated
 *
 * The obvious build deletes every line and inserts the new set. It is shorter,
 * and it throws away the ids — which the issued comparison does not need, but
 * anything later that references a line would. Matching on id keeps a line the
 * same line across an edit, which is what it is.
 */
export async function saveQuoteLines(
  quoteId: string,
  rawLines: SaveLineInput[],
): Promise<ActionResult> {
  const writable = await writableQuote(quoteId);
  if (!writable.ok) return writable;

  if (rawLines.length > 500) {
    return { ok: false, error: 'That is more lines than a quotation can hold.' };
  }

  const lines = rawLines.map(cleanLine).filter((l): l is SaveLineInput => l !== null);

  try {
    const existing = await prisma.studioQuoteLine.findMany({
      where: { quoteId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((l) => l.id));

    /* Ids the browser sent that are not on this quotation are dropped to
       new lines rather than trusted. An id in a payload is not proof of
       anything, and writing to one would be writing to another studio's
       quotation. */
    const kept = new Set<string>();

    const writes = lines.map((line, index) => {
      const amountPaise = toDb(
        lineAmount({
          unit: line.unit,
          code: line.code,
          ratePaise: line.ratePaise,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          qtyMilli: line.qtyMilli,
          amountPaise: line.agreedPaise ?? undefined,
        }),
      );

      const data = {
        room: line.room,
        product: line.product,
        code: line.code,
        unit: line.unit,
        details: line.details ?? null,
        widthMm: line.widthMm ?? null,
        heightMm: line.heightMm ?? null,
        qtyMilli: line.qtyMilli ?? null,
        ratePaise: toDb(line.ratePaise),
        amountPaise,
        note: line.note ?? null,
        /* Position in the array IS the order. The builder lets lines be moved,
           and a sort key derived from anything else would fight it. */
        sortOrder: (index + 1) * 10,
      };

      if (line.id && existingIds.has(line.id)) {
        kept.add(line.id);
        return prisma.studioQuoteLine.update({ where: { id: line.id }, data });
      }
      return prisma.studioQuoteLine.create({ data: { ...data, quoteId } });
    });

    const gone = [...existingIds].filter((id) => !kept.has(id));

    await prisma.$transaction([
      ...(gone.length > 0
        ? [prisma.studioQuoteLine.deleteMany({ where: { id: { in: gone }, quoteId } })]
        : []),
      ...writes,
      prisma.studioQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } }),
    ]);

    return { ok: true };
  } catch (error) {
    console.error('[studio-quote] saveQuoteLines failed', error);
    return { ok: false, error: 'That did not save. Nothing was changed.' };
  }
}

export interface ApplyConfigInput {
  quoteId: string;
  home: HomeConfig;
}

export type ApplyResult =
  | { ok: true; added: number; notes: string[] }
  | { ok: false; error: string };

/**
 * Build the standard quotation for this flat, from this studio's catalogue.
 *
 * ## It replaces, and it says so before it does
 *
 * Applying a configuration over existing lines discards them. That is the
 * behaviour anybody wants — "I picked 2 BHK and it is a 3" is the common case
 * — but it is destructive, so the builder asks first when there is anything to
 * lose. Doing it silently here, and confirming in the UI, keeps the
 * destructive step in one place instead of two.
 *
 * ## The configuration is kept
 *
 * Kitchen run and bathroom count are written onto the quotation, not just used
 * and forgotten. A studio who rebuilds after correcting one rate should not be
 * asked to measure the kitchen again.
 */
export async function applyConfiguration(input: ApplyConfigInput): Promise<ApplyResult> {
  const qs = await quoteScope();
  const studioId = qs?.studioId ?? null;
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  const writable = await writableQuote(input.quoteId);
  if (!writable.ok) return writable;

  /* The plan comes from the client's brief, never from the browser. */
  const { planRooms: _ignored, ...raw } = input.home;
  const ceilingRate = raw.falseCeilingRatePaise;
  const home: HomeConfig = {
    ...raw,
    kingMaster: raw.kingMaster !== false,
    falseCeiling: raw.falseCeiling === true,
    falseCeilingRatePaise:
      typeof ceilingRate === 'number' && Number.isInteger(ceilingRate) && ceilingRate > 0 && ceilingRate < 1e8 ? ceilingRate : null,
  };
  if (home.usePlan) {
    const q = await prisma.studioQuote.findFirst({ where: { id: input.quoteId, studioId }, select: { briefId: true, clientId: true } });
    const rooms = await planRoomsOfBrief(q?.briefId ?? null, q?.clientId, studioId, input.quoteId);
    if (rooms.length > 0) {
      (home as HomeConfig).planRooms = rooms;
      if (home.kitchenRunMm == null) home.kitchenRunMm = (await planRunOfBrief(q?.briefId ?? null, q?.clientId, studioId, input.quoteId)) ?? null;
    }
  }
  input = { ...input, home };

  try {
    const products = await prisma.studioProduct.findMany({
      where: { studioId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const catalogue: CatalogueProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code as WorkCodeName,
      unit: p.unit as QuoteUnitName,
      details: p.details,
      ratePaise: fromDb(p.ratePaise),
      rooms: p.rooms,
      defaultWidthMm: p.defaultWidthMm,
      defaultHeightMm: p.defaultHeightMm,
      defaultQty: p.defaultQty,
      inStandardBuild: p.inStandardBuild,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      rules: readRules(p.rules),
    }));

    const { lines, notes } = planQuotation(input.home, catalogue);

    await prisma.$transaction([
      prisma.studioQuoteLine.deleteMany({ where: { quoteId: input.quoteId } }),
      ...lines.map((line, index) =>
        prisma.studioQuoteLine.create({
          data: {
            quoteId: input.quoteId,
            room: line.room,
            product: line.product,
            code: line.code,
            unit: line.unit,
            details: line.details,
            widthMm: line.widthMm,
            heightMm: line.heightMm,
            qtyMilli: line.qtyMilli,
            ratePaise: toDb(line.ratePaise),
            amountPaise: toDb(
              lineAmount({
                unit: line.unit,
                code: line.code,
                ratePaise: line.ratePaise,
                widthMm: line.widthMm,
                heightMm: line.heightMm,
                qtyMilli: line.qtyMilli,
              }),
            ),
            sortOrder: (index + 1) * 10,
          },
        }),
      ),
      prisma.studioQuote.update({
        where: { id: input.quoteId },
        data: {
          config: input.home.config,
          kitchenRunMm: input.home.kitchenRunMm,
          bathrooms: input.home.bathrooms,
          updatedAt: new Date(),
        },
      }),
    ]);

    return { ok: true, added: lines.length, notes };
  } catch (error) {
    console.error('[studio-quote] applyConfiguration failed', error);
    return { ok: false, error: 'That did not build. Nothing was changed.' };
  }
}

/** Start again from nothing, keeping the client and the terms. */
export async function clearQuoteLines(quoteId: string): Promise<ActionResult> {
  const writable = await writableQuote(quoteId);
  if (!writable.ok) return writable;

  try {
    await prisma.$transaction([
      prisma.studioQuoteLine.deleteMany({ where: { quoteId } }),
      prisma.studioQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/** The studio's payment schedule, for a quotation not made yet (the First quote page's preview). */
export async function myStudioPhases(): Promise<PaymentPhase[] | null> {
  const qs = await quoteScope();
  if (!qs) return null;
  try {
    const row = await prisma.studio.findUnique({ where: { id: qs.studioId }, select: { paymentPhases: true } });
    return readPhases(row?.paymentPhases);
  } catch {
    return null;
  }
}
