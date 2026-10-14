import 'server-only';

/**
 * Proposed products: the queue on /studio/products (rules: proposal-rules.ts).
 *
 * Who may do what:
 * - **Propose**: anybody who quotes (`quotingStudioId`: owner, PM, sales).
 * - **See the queue, approve, reject**: whoever may change the product master
 *   (`myStudioId`: an active owner or project manager), the same people
 *   `addProduct` lets in. Approving goes through `addProduct`, so a proposal
 *   becomes a product exactly as a typed one does.
 *
 * Every query is scoped by the session's studio id.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, toDb, type Paise } from '@/lib/money';
import { quotingStudioId, actingMember } from '@/modules/studio/lead-scope';
import { addProduct, myStudioId } from './store';
import { categoryOfRoom, cleanProposal, mayReview, sameProductName } from './proposal-rules';
import type { QuoteUnitName, WorkCodeName } from './pricing';

export interface ProposalRow {
  id: string;
  name: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  ratePaise: Paise;
  details: string | null;
  room: string | null;
  proposedBy: string | null;
  createdAt: Date;
}

export type ProposalResult = { ok: true; message: string } | { ok: false; error: string };

/** A salesperson's proposal, into the queue. */
export async function proposeProduct(raw: unknown, quoteId?: string | null): Promise<ProposalResult> {
  const studioId = await quotingStudioId();
  if (!studioId) return { ok: false, error: 'Your role in the studio does not include that.' };
  const clean = cleanProposal(raw);
  if (!clean.ok) return clean;
  const p = clean.value;

  try {
    const [products, pending] = await Promise.all([
      prisma.studioProduct.findMany({ where: { studioId }, select: { name: true } }),
      prisma.studioProductProposal.findMany({ where: { studioId, state: 'PENDING' }, select: { name: true } }),
    ]);
    if (products.some((x) => sameProductName(x.name, p.name))) {
      return { ok: false, error: `“${p.name}” is already in the product master — pick it from the list.` };
    }
    if (pending.some((x) => sameProductName(x.name, p.name))) {
      return { ok: true, message: `“${p.name}” is already waiting for approval. It is on this quotation.` };
    }
    const who = await actingMember();
    await prisma.studioProductProposal.create({
      data: {
        studioId,
        name: p.name,
        code: p.code,
        unit: p.unit,
        ratePaise: toDb(p.ratePaise),
        details: p.details,
        room: p.room,
        quoteId: typeof quoteId === 'string' && quoteId.length <= 64 ? quoteId : null,
        proposedById: who?.id ?? null,
        proposedBy: who?.name ?? null,
      },
    });
    return { ok: true, message: `Proposed “${p.name}” for approval and added it to this quote.` };
  } catch (error) {
    console.error('[studio-quote] proposeProduct failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/** The pending queue, for the owner and project manager. Empty for anybody else. */
export async function pendingProposals(): Promise<ProposalRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];
  try {
    const rows = await prisma.studioProductProposal.findMany({
      where: { studioId, state: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code as WorkCodeName,
      unit: r.unit as QuoteUnitName,
      ratePaise: fromDb(r.ratePaise),
      details: r.details,
      room: r.room,
      proposedBy: r.proposedBy,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('[studio-quote] pendingProposals failed', error);
    return [];
  }
}

/** Approve: the proposal becomes a product (through `addProduct`), then is marked approved. */
export async function approveProposal(id: string): Promise<ProposalResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'Only the owner or a project manager can approve a product.' };
  const row = await prisma.studioProductProposal.findFirst({ where: { id: String(id ?? ''), studioId } });
  if (!row) return { ok: false, error: 'That proposal is not there any more.' };
  if (!mayReview(row.state)) return { ok: false, error: 'That proposal has already been decided.' };

  const added = await addProduct({
    name: row.name,
    code: row.code as WorkCodeName,
    unit: row.unit as QuoteUnitName,
    ratePaise: fromDb(row.ratePaise),
    rooms: [categoryOfRoom(row.room)],
    details: row.details ?? undefined,
  });
  /* Already in the master (somebody added it by hand meanwhile): the
     proposal is answered all the same. */
  if (!added.ok && !/already have a product/i.test(added.error)) return added;

  const who = await actingMember();
  await prisma.studioProductProposal.updateMany({
    where: { id: row.id, studioId, state: 'PENDING' },
    data: { state: 'APPROVED', reviewedAt: new Date(), reviewedById: who?.id ?? null },
  });
  return { ok: true, message: added.ok ? `“${row.name}” is in the product master now.` : `“${row.name}” was already in the product master.` };
}

export async function rejectProposal(id: string): Promise<ProposalResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'Only the owner or a project manager can reject a product.' };
  const who = await actingMember();
  const { count } = await prisma.studioProductProposal.updateMany({
    where: { id: String(id ?? ''), studioId, state: 'PENDING' },
    data: { state: 'REJECTED', reviewedAt: new Date(), reviewedById: who?.id ?? null },
  });
  return count > 0 ? { ok: true, message: 'Rejected. It stays on the quotations it was used on.' } : { ok: false, error: 'That proposal has already been decided.' };
}
