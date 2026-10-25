import 'server-only';

/**
 * Quotation revisions and the sales final — the reads and writes (Studio OS
 * Phase 1). The rules are pure, in revision-rules.ts and payment-template.ts.
 *
 * Every read here starts from the signed-in person's lead scope
 * (studio/lead-scope.ts): owner and PM, the studio's quotations; a
 * salesperson, only quotations of leads assigned to them.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { computeTotals, type QuoteUnitName, type WorkCodeName } from '@/modules/studio-quote/pricing';
import { readPhases } from '@/modules/studio/payment-phases';
import { actingMember, mayOnLead, myLeadScope } from '@/modules/studio/lead-scope';
import { completeRequestForQuote } from '@/modules/studio-quote/quote-request-store';
import { record } from '@/modules/studio-practice/events';
import {
  needsNewRevision,
  nextRevisionNumber,
  readRevisionLines,
  readRevisionTerms,
  readRevisionTotals,
  revisionLabel,
  salesFinalRefusal,
  salesFinalSummary,
  sameLinesAs,
  type RevisionLine,
  type RevisionTerms,
  type RevisionTotals,
} from './revision-rules';
import { cleanStages, readStages, scheduleAmounts, templateOrDefault, type PaymentStage, type ScheduledStage } from './payment-template';
import { leadFileExists, leadUploadTicket, signedLeadFileLinks } from '@/modules/storage/lead-files';
import { pathBelongsTo } from '@/modules/studio-sales/lead-rules';
import { checkSalesNotes, voiceExtOf } from './revision-rules';

type Db = Prisma.TransactionClient | typeof prisma;

const QUOTE_FOR_REVISION = {
  id: true,
  studioId: true,
  feeBps: true,
  discountBps: true,
  onSpotPaise: true,
  onSpotLabel: true,
  bookingAdvancePaise: true,
  gstBps: true,
  phases: true,
  studio: { select: { paymentPhases: true } },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: { room: true, product: true, code: true, unit: true, details: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true, note: true },
  },
} satisfies Prisma.StudioQuoteSelect;

type QuoteForRevisionFull = Prisma.StudioQuoteGetPayload<{ select: typeof QUOTE_FOR_REVISION }>;
/** The note is optional: a caller selecting lines without it (the booking check) snapshots them without notes. */
type QuoteForRevision = Omit<QuoteForRevisionFull, 'lines'> & {
  lines: (Omit<QuoteForRevisionFull['lines'][number], 'note'> & { note?: string | null })[];
};

/** The quotation as it stands, in the frozen shape. */
export function snapshotOf(q: QuoteForRevision): { lines: RevisionLine[]; terms: RevisionTerms; totals: RevisionTotals } {
  const lines: RevisionLine[] = q.lines.map((l) => ({
    room: l.room,
    product: l.product,
    code: l.code as RevisionLine['code'],
    unit: l.unit as RevisionLine['unit'],
    details: l.details,
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    qtyMilli: l.qtyMilli,
    ratePaise: fromDb(l.ratePaise),
    amountPaise: fromDb(l.amountPaise),
    note: l.note ?? null,
  }));
  const phases = readPhases(q.phases) ?? readPhases(q.studio.paymentPhases);
  const terms: RevisionTerms = {
    feeBps: q.feeBps,
    discountBps: q.discountBps,
    onSpotPaise: fromDb(q.onSpotPaise),
    onSpotLabel: q.onSpotLabel,
    bookingAdvancePaise: fromDb(q.bookingAdvancePaise),
    gstBps: q.gstBps,
    phases,
  };
  const t = computeTotals(
    lines.map((l) => ({ unit: l.unit as QuoteUnitName, code: l.code as WorkCodeName, ratePaise: l.ratePaise, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, amountPaise: l.amountPaise })),
    { feeBps: terms.feeBps, discountBps: terms.discountBps, onSpotPaise: terms.onSpotPaise, bookingAdvancePaise: terms.bookingAdvancePaise, gstBps: terms.gstBps, phases },
  );
  return {
    lines,
    terms,
    totals: { workPaise: t.workPaise, feePaise: t.feePaise, discountPaise: t.discountPaise, onSpotPaise: t.onSpotPaise, gstPaise: t.gstPaise, totalPaise: t.totalPaise },
  };
}

/**
 * The quotation was sent: keep the next frozen revision, unless what went
 * out is exactly the last one. The caller has already checked the quotation
 * is theirs. Never throws: a send that cannot keep its copy still went out.
 */
export async function issueRevision(input: { quoteId: string; studioId: string; db?: Db }): Promise<{ n: number; created: boolean } | null> {
  const db = input.db ?? prisma;
  try {
    const q = await db.studioQuote.findFirst({ where: { id: input.quoteId, studioId: input.studioId }, select: QUOTE_FOR_REVISION });
    if (!q || q.lines.length === 0) return null;
    const snap = snapshotOf(q);
    const last = await db.studioQuoteRevision.findFirst({
      where: { studioId: input.studioId, quoteId: q.id },
      orderBy: { n: 'desc' },
      select: { n: true, lines: true, terms: true },
    });
    if (last && !needsNewRevision({ lines: readRevisionLines(last.lines), terms: readRevisionTerms(last.terms) }, snap)) {
      return { n: last.n, created: false };
    }
    const by = await actingMember();
    const n = nextRevisionNumber(last ? [last.n] : []);
    await db.studioQuoteRevision.create({
      data: {
        studioId: input.studioId,
        quoteId: q.id,
        n,
        lines: snap.lines as unknown as Prisma.InputJsonValue,
        terms: snap.terms as unknown as Prisma.InputJsonValue,
        totalPaise: toDb(snap.totals.totalPaise),
        totals: snap.totals as unknown as Prisma.InputJsonValue,
        sentById: by?.id ?? null,
        sentByName: by?.name ?? null,
      },
    });
    return { n, created: true };
  } catch (error) {
    // A second send racing this one takes the same number; theirs stands.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
    console.error('[revisions] could not keep the revision', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

export interface RevisionView {
  id: string;
  n: number;
  label: string;
  sentAt: Date;
  sentByName: string | null;
  totalPaise: number;
  lineCount: number;
  isSalesFinal: boolean;
}

export interface QuoteSalesView {
  quoteId: string;
  number: string;
  stage: 'SALES' | 'DESIGN';
  status: string;
  clientId: string | null;
  fromOneInteriors: boolean;
  revisions: RevisionView[];
  /** The quotation has changed since its newest revision was sent. */
  changedSinceSent: boolean;
  salesFinal: {
    n: number;
    revisionId: string;
    at: Date | null;
    schedule: PaymentStage[];
    /** In rupees on the sales final's total; null when the total cannot carry it. */
    amounts: ScheduledStage[] | null;
    totalPaise: number;
    /** The quotation's lines today are still what R{n} said. */
    linesUnchanged: boolean;
    /** Sales' notes for the design team, and the voice note's signed link (DESIGN-PROCESS-PLAN.md §4.2). */
    notes: string | null;
    voiceUrl: string | null;
  } | null;
  /** The studio's template, for marking a first sales final. */
  template: PaymentStage[];
  /** A live project runs on this quotation. */
  projectId: string | null;
  /** The signed-in person may mark the sales final. */
  mayMark: boolean;
}

/** Everything the quotation page and the lead page show about sending and the sales final. */
export async function quoteSalesView(quoteId: string): Promise<QuoteSalesView | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  const studioId = scope.studioId;
  try {
    const q = await prisma.studioQuote.findFirst({
      where: { ...scope.quotes, id: quoteId, studioId },
      select: {
        ...QUOTE_FOR_REVISION,
        number: true,
        stage: true,
        status: true,
        clientId: true,
        briefId: true,
        introductionId: true,
        salesFinalRevisionId: true,
        salesFinalSchedule: true,
        salesFinalAt: true,
        salesFinalNotes: true,
        salesFinalVoicePath: true,
        client: { select: { assignedToId: true, poolTeamId: true, source: true, introductionId: true } },
        studio: { select: { paymentPhases: true, paymentTemplate: true } },
        revisions: { orderBy: { n: 'asc' }, select: { id: true, n: true, sentAt: true, sentByName: true, totalPaise: true, lines: true, terms: true } },
      },
    });
    if (!q) return null;
    const snap = snapshotOf(q);
    const latest = q.revisions[q.revisions.length - 1];
    const changedSinceSent = latest
      ? needsNewRevision({ lines: readRevisionLines(latest.lines), terms: readRevisionTerms(latest.terms) }, snap)
      : false;
    const project = await prisma.homeProject.findFirst({
      where: { signedQuoteId: q.id, cancelledAt: null, introduction: { studioId } },
      select: { id: true },
    });
    const finalRow = q.revisions.find((r) => r.id === q.salesFinalRevisionId) ?? null;
    let salesFinal: QuoteSalesView['salesFinal'] = null;
    if (finalRow) {
      const schedule = readStages(q.salesFinalSchedule) ?? templateOrDefault(q.studio.paymentTemplate);
      const total = fromDb(finalRow.totalPaise);
      const amounts = scheduleAmounts(schedule, total);
      salesFinal = {
        n: finalRow.n,
        revisionId: finalRow.id,
        at: q.salesFinalAt,
        schedule,
        amounts: amounts.ok ? amounts.stages : null,
        totalPaise: total,
        linesUnchanged: sameLinesAs(readRevisionLines(finalRow.lines), snap.lines),
        notes: q.salesFinalNotes,
        voiceUrl: q.salesFinalVoicePath ? ((await signedLeadFileLinks([q.salesFinalVoicePath])).get(q.salesFinalVoicePath) ?? null) : null,
      };
    }
    return {
      quoteId: q.id,
      number: q.number,
      stage: q.stage as 'SALES' | 'DESIGN',
      status: q.status,
      clientId: q.clientId,
      fromOneInteriors: q.briefId !== null || q.introductionId !== null || q.client?.source === 'ONE_INTERIORS' || q.client?.introductionId != null,
      revisions: q.revisions.map((r) => ({
        id: r.id,
        n: r.n,
        label: revisionLabel(r.n),
        sentAt: r.sentAt,
        sentByName: r.sentByName,
        totalPaise: fromDb(r.totalPaise),
        lineCount: readRevisionLines(r.lines).length,
        isSalesFinal: r.id === q.salesFinalRevisionId,
      })),
      changedSinceSent,
      salesFinal,
      template: templateOrDefault(q.studio.paymentTemplate),
      projectId: project?.id ?? null,
      mayMark: mayOnLead(scope, 'quote.salesFinal', { assignedToId: q.client?.assignedToId ?? null, poolTeamId: q.client?.poolTeamId ?? null }),
    };
  } catch (error) {
    console.error('[revisions] view failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/** Send the quotation again: the next revision, when something changed. */
export async function sendAgain(quoteId: string): Promise<{ ok: true; n: number; created: boolean } | { ok: false; error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  const q = await prisma.studioQuote.findFirst({
    where: { ...scope.quotes, id: quoteId, studioId },
    select: { id: true, status: true, clientId: true, client: { select: { assignedToId: true, poolTeamId: true } } },
  });
  if (!q) return { ok: false, error: 'That quotation is not yours.' };
  /* Quotation requests (owner, 22 Oct 2026): the builder a request on this lead was handed to sends it too. */
  const requestedOfMe = scope.requested !== null && q.clientId !== null && (await prisma.studioClient.findFirst({ where: { AND: [scope.requested], id: q.clientId }, select: { id: true } })) !== null;
  if (!mayOnLead(scope, 'quote.write', { assignedToId: q.client?.assignedToId ?? null, poolTeamId: q.client?.poolTeamId ?? null, requestedOfMe })) return { ok: false, error: 'That quotation is not yours.' };
  if (q.status !== 'ISSUED') return { ok: false, error: 'Mark it as sent first.' };
  const r = await issueRevision({ quoteId: q.id, studioId });
  if (!r) return { ok: false, error: 'There is nothing on this quotation to send.' };
  await completeRequestForQuote(studioId, q.id, await actingMember());
  return { ok: true, n: r.n, created: r.created };
}

export interface RevisionPair {
  number: string;
  clientName: string;
  a: { n: number; lines: RevisionLine[]; totals: RevisionTotals };
  b: { n: number; lines: RevisionLine[]; totals: RevisionTotals };
}

/** Two revisions of one quotation, for the comparison page. */
export async function revisionPair(quoteId: string, a: number, b: number): Promise<RevisionPair | null> {
  const scope = await myLeadScope();
  if (!scope || !Number.isInteger(a) || !Number.isInteger(b)) return null;
  const studioId = scope.studioId;
  const q = await prisma.studioQuote.findFirst({
    where: { ...scope.quotes, id: quoteId, studioId },
    select: {
      number: true,
      clientName: true,
      revisions: { where: { studioId, n: { in: [a, b] } }, select: { n: true, lines: true, totals: true } },
    },
  });
  const ra = q?.revisions.find((r) => r.n === a);
  const rb = q?.revisions.find((r) => r.n === b);
  if (!q || !ra || !rb) return null;
  return {
    number: q.number,
    clientName: q.clientName,
    a: { n: ra.n, lines: readRevisionLines(ra.lines), totals: readRevisionTotals(ra.totals) },
    b: { n: rb.n, lines: readRevisionLines(rb.lines), totals: readRevisionTotals(rb.totals) },
  };
}

/**
 * Mark revision `n` as the sales final, with the payment stages agreed for
 * this client. Moving it from an earlier revision is the same action; the
 * lead's timeline records both. Refused once the booking is recorded.
 */
/**
 * A one-time place in storage for the sales final's voice note (kept as
 * audio; no speech-to-text yet, owner 25 Oct 2026): whoever may mark this
 * quotation's sales final, in the lead's private files.
 */
export async function salesVoiceTicket(quoteId: string, type: unknown, bytes: unknown): Promise<{ ok: true; path: string; url: string | null } | { ok: false; error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const ext = voiceExtOf(type);
  if (!ext) return { ok: false, error: 'This browser recorded in a format we cannot keep. Type the notes instead.' };
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0 || size > 8 * 1024 * 1024) return { ok: false, error: 'That recording is too long. Keep it under two minutes.' };
  const q = await prisma.studioQuote.findFirst({
    where: { ...scope.quotes, id: String(quoteId ?? '').slice(0, 64), studioId: scope.studioId },
    select: { clientId: true, client: { select: { assignedToId: true, poolTeamId: true } } },
  });
  if (!q?.clientId) return { ok: false, error: 'That quotation is not yours.' };
  if (!mayOnLead(scope, 'quote.salesFinal', { assignedToId: q.client?.assignedToId ?? null, poolTeamId: q.client?.poolTeamId ?? null })) return { ok: false, error: 'Your role in the studio does not include that.' };
  return leadUploadTicket(scope.studioId, q.clientId, ext);
}

export async function markSalesFinal(
  quoteId: string,
  n: number,
  stages: PaymentStage[],
  extra: { notes?: unknown; voicePath?: unknown } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await myLeadScope();
  if (!scope) return { ok: false, error: 'Sign in as your studio first.' };
  const studioId = scope.studioId;
  const q = await prisma.studioQuote.findFirst({
    where: { ...scope.quotes, id: quoteId, studioId },
    select: {
      id: true,
      number: true,
      stage: true,
      clientId: true,
      briefId: true,
      introductionId: true,
      salesFinalRevision: { select: { n: true } },
      salesFinalNotes: true,
      salesFinalVoicePath: true,
      client: { select: { assignedToId: true, poolTeamId: true, source: true, introductionId: true } },
      revisions: { where: { studioId, n }, select: { id: true, n: true, totalPaise: true } },
    },
  });
  if (!q) return { ok: false, error: 'That quotation is not yours.' };
  if (!mayOnLead(scope, 'quote.salesFinal', { assignedToId: q.client?.assignedToId ?? null, poolTeamId: q.client?.poolTeamId ?? null })) {
    return { ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' };
  }
  const revision = q.revisions[0] ?? null;
  const booked = (await prisma.homeProject.findFirst({ where: { signedQuoteId: q.id, cancelledAt: null }, select: { id: true } })) !== null;
  const refusal = salesFinalRefusal({
    revisionFound: revision !== null,
    quoteStage: q.stage as 'SALES' | 'DESIGN',
    fromOneInteriors: q.briefId !== null || q.introductionId !== null || q.client?.source === 'ONE_INTERIORS' || q.client?.introductionId != null,
    booked,
    alreadyMarked: q.salesFinalRevision?.n === n,
  });
  if (refusal || !revision) return { ok: false, error: refusal ?? 'That revision is not on this quotation.' };
  const cleaned = cleanStages(stages);
  if (!cleaned.ok) return cleaned;
  const fits = scheduleAmounts(cleaned.stages, fromDb(revision.totalPaise));
  if (!fits.ok) return { ok: false, error: fits.error };
  /* Notes for the design team, required (DESIGN-PROCESS-PLAN.md §4.2); a voice note kept as audio, optional. */
  const notes = checkSalesNotes(extra.notes, q.salesFinalNotes);
  if (!notes.ok) return notes;
  let voicePath = q.salesFinalVoicePath;
  if (extra.voicePath !== undefined && extra.voicePath !== null && extra.voicePath !== '') {
    if (!q.clientId || !pathBelongsTo(extra.voicePath, studioId, q.clientId)) return { ok: false, error: 'That voice note is not for this client. Record it again.' };
    if (!(await leadFileExists(extra.voicePath))) return { ok: false, error: 'The voice note did not finish uploading. Record it again.' };
    voicePath = extra.voicePath;
  }

  const by = await actingMember();
  const previous = q.salesFinalRevision?.n ?? null;
  await prisma.studioQuote.updateMany({
    where: { id: q.id, studioId },
    data: {
      salesFinalRevisionId: revision.id,
      salesFinalSchedule: cleaned.stages as unknown as Prisma.InputJsonValue,
      salesFinalAt: new Date(),
      salesFinalById: by?.id ?? null,
      salesFinalNotes: notes.notes,
      salesFinalVoicePath: voicePath,
    },
  });
  if (q.clientId && previous !== n) {
    await record({
      studioId,
      clientId: q.clientId,
      kind: 'SALES_FINAL',
      summary: salesFinalSummary(q.number, n, previous),
      meta: { quoteId: q.id, revision: n, previous },
    });
  }
  return { ok: true };
}
