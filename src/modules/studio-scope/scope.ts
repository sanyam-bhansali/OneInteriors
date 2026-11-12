import 'server-only';

/**
 * Additional scope (owner, 12 Nov 2026): "after design final quotation if
 * anything else is added we should have a button of additional scope which
 * opens a new quotation for the same client where designer can add only
 * those specific item … the payment for additional scope is always
 * immediate … due date should be marked as the date it was built …
 * designer has an option to mark required days … quotation, payment and
 * days required goes for approval … until the payment is done the project
 * is marked as hold".
 *
 * The quotation is built in the normal builder (studio_quotes with
 * `scopeForProjectId`, numbered like 101-A1, no professional fee); sending it
 * makes a change order (project/change-orders.ts `sendAdditionalScope`) the
 * client approves in the app; approval puts the project on hold and the
 * payment takes it off, moving the plan by the hold days plus the days
 * required (client's side).
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { extraTotals, extrasOpen, scopeNumber } from '@/modules/project/change-order-rules';
import { staffOn } from '@/modules/project/flow-access';

export type ScopeResult = { ok: true; id: string; message: string } | { ok: false; error: string };

export interface ScopeQuoteView {
  id: string;
  number: string;
  /** DRAFT until sent; then the change order carries it. */
  draft: boolean;
  lines: number;
  totalPaise: number;
}

export interface ScopeView {
  projectId: string;
  /** Allowed now (the design final is made, the project not closed out), and why not. */
  open: { ok: true } | { ok: false; error: string };
  canWrite: boolean;
  /** Drafts still being built; sent ones show in the extra-work list. */
  drafts: ScopeQuoteView[];
}

export async function scopeView(projectId: string): Promise<ScopeView | null> {
  const staff = await staffOn(projectId, 'payment.read');
  if (!staff.ok) return null;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, designFinalQuoteId: true } });
  if (!project) return null;
  const quotes = await prisma.studioQuote.findMany({
    where: { studioId: staff.studioId, scopeForProjectId: projectId, status: 'DRAFT' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, number: true, discountBps: true, gstBps: true, lines: { select: { code: true, unit: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true } } },
  });
  return {
    projectId,
    open: project.designFinalQuoteId ? extrasOpen(project.phase, project.closedOutAt !== null, true) : { ok: false, error: 'Additional scope opens once the design final quotation is made.' },
    canWrite: staff.may('extras.write'),
    drafts: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      draft: true,
      lines: q.lines.length,
      totalPaise: extraTotals(q.lines.map((l) => ({ ...l, ratePaise: fromDb(l.ratePaise), amountPaise: fromDb(l.amountPaise) })), { discountBps: q.discountBps, gstBps: q.gstBps }).totalPaise,
    })),
  };
}

/** Starts an additional-scope quotation for the project's client: the design final's client and terms, no items, no professional fee. */
export async function startAdditionalScope(projectId: string): Promise<ScopeResult> {
  const staff = await staffOn(projectId, 'extras.write');
  if (!staff.ok) return staff;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, designFinalQuoteId: true } });
  if (!project) return { ok: false, error: 'That project is gone.' };
  if (!project.designFinalQuoteId) return { ok: false, error: 'Additional scope opens once the design final quotation is made.' };
  const open = extrasOpen(project.phase, project.closedOutAt !== null, true);
  if (!open.ok) return open;
  const base = await prisma.studioQuote.findFirst({ where: { id: project.designFinalQuoteId, studioId: staff.studioId } });
  if (!base) return { ok: false, error: 'The design final quotation is not found.' };
  const root = base.number.replace(/-D\d*$/, '');
  const taken = (await prisma.studioQuote.findMany({ where: { studioId: staff.studioId, number: { startsWith: `${root}-A` } }, select: { number: true } })).map((q) => q.number);
  const created = await prisma.studioQuote.create({
    data: {
      studioId: staff.studioId,
      number: scopeNumber(root, taken),
      stage: 'DESIGN',
      status: 'DRAFT',
      clientName: base.clientName,
      clientPhone: base.clientPhone,
      clientEmail: base.clientEmail,
      society: base.society,
      locality: base.locality,
      clientId: base.clientId,
      briefId: base.briefId,
      introductionId: base.introductionId,
      scopeForProjectId: projectId,
      config: base.config,
      category: base.category,
      carpetSqft: base.carpetSqft,
      kitchenRunMm: base.kitchenRunMm,
      bathrooms: base.bathrooms,
      // Priced like extra work: the design final's discount and GST, no professional fee, nothing on the spot.
      feeBps: 0,
      onSpotPaise: BigInt(0),
      bookingAdvancePaise: BigInt(0),
      discountBps: base.discountBps,
      gstBps: base.gstBps,
      welcomeNote: base.welcomeNote,
      terms: base.terms,
    },
    select: { id: true, number: true },
  });
  return { ok: true, id: created.id, message: `Additional scope ${created.number} started. Add only the new items.` };
}
