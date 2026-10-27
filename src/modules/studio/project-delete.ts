import 'server-only';

/**
 * Delete a project, and restore one (owner, 27 Oct 2026: "I need an option
 * to delete project"). The owner and the design head (`mayDeleteProjects`).
 *
 * Deleting never erases. A project's payments and history are records
 * (append-only tables, the client's own documents), so a deleted project is
 * a cancelled one, exactly as a refunded booking leaves it
 * (studio-sales/booking.ts `refundBooking`): gone from every studio list and
 * from the client's app, the client's invite revoked, the sales final free
 * again (it is unique on projects) and the lead back to where it stood
 * before booking. Money recorded on it stays in its history; a refund is the
 * lead's Refund booking. The owner types the client's name to confirm.
 *
 * Restore puts it back: listed again, the quotation re-linked and the lead
 * booked again when nothing has taken their place since, and the client's
 * invite made again with a new code (nothing is sent: the project page shows
 * the link to share).
 */

import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from './access';
import { recordEvent } from '@/modules/project/events';
import { homeLabel } from './workspace-view';
import { freshCode } from '@/modules/project/own-project';

export type DeleteResult = { ok: true; message: string } | { ok: false; error: string };

export interface DeletedProject {
  id: string;
  client: string;
  home: string;
  deletedOn: Date;
  reason: string | null;
  /** A refunded booking is cancelled too, but money went back: not restored from here. */
  restorable: boolean;
}

/** The owner, or the design head (owner, 27 Oct 2026), who sees every project. */
export function mayDeleteProjects(m: Pick<StudioMemberRef, 'role' | 'designHead' | 'status'> | null | undefined): boolean {
  return Boolean(m && m.status === 'ACTIVE' && (m.role === 'OWNER' || (m.role === 'DESIGNER' && m.designHead === true)));
}

async function owner(): Promise<StudioMemberRef | { error: string }> {
  const m = await currentMember();
  if (!m || m.status !== 'ACTIVE') return { error: 'Sign in to your studio first.' };
  if (m.viewOnly) return { error: 'Viewing as someone is read only.' };
  if (!mayDeleteProjects(m)) return { error: 'Only the studio owner or the design head deletes or restores a project.' };
  return m;
}

const clientOf = (b: { contactName: string | null; user: { name: string | null } | null }) => b.contactName?.trim() || b.user?.name?.trim() || 'Your customer';

/** "Ankita" matches "ankita" and "Ankita Shah" matches "ankita shah": the name as the project shows it, any case and spacing. */
export function nameMatches(typed: unknown, client: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  return typeof typed === 'string' && norm(typed).length > 0 && norm(typed) === norm(client);
}

export async function deleteProject(projectId: unknown, typedName: unknown, rawReason: unknown, now = new Date()): Promise<DeleteResult> {
  const m = await owner();
  if ('error' in m) return { ok: false, error: m.error };
  const id = String(projectId ?? '').slice(0, 64);
  const p = await prisma.homeProject.findFirst({
    where: { id, introduction: { studioId: m.studioId } },
    select: {
      id: true,
      cancelledAt: true,
      signedQuoteId: true,
      introductionId: true,
      introduction: { select: { brief: { select: { contactName: true, user: { select: { name: true } } } } } },
    },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  if (p.cancelledAt) return { ok: false, error: 'That project is deleted already.' };
  const client = clientOf(p.introduction.brief);
  if (!nameMatches(typedName, client)) return { ok: false, error: `Type the client’s name, ${client}, to confirm.` };
  const reason = typeof rawReason === 'string' ? rawReason.trim().replace(/\s+/g, ' ').slice(0, 200) || null : null;

  const lead = await prisma.studioClient.findFirst({
    where: { studioId: m.studioId, bookedIntroductionId: p.introductionId },
    select: { id: true, stageId: true, bookedAt: true, preBookingStageId: true },
  });
  const back = lead?.preBookingStageId ? await prisma.studioStage.findFirst({ where: { id: lead.preBookingStageId, studioId: m.studioId }, select: { id: true } }) : null;

  await prisma.$transaction(async (tx) => {
    const by = m.role === 'OWNER' ? 'the owner' : 'the design head';
    await tx.homeProject.update({ where: { id: p.id }, data: { cancelledAt: now, cancelReason: `Deleted by ${by}${reason ? `: ${reason}` : ''}`, signedQuoteId: null } });
    await recordEvent(tx, {
      projectId: p.id,
      type: 'project.deleted',
      actor: { type: 'STUDIO', id: m.userId },
      refId: p.signedQuoteId,
      payload: {
        reason,
        quoteId: p.signedQuoteId,
        leadId: lead?.id ?? null,
        leadStageId: lead?.stageId ?? null,
        leadBookedAt: lead?.bookedAt ? lead.bookedAt.toISOString() : null,
        leadPreBookingStageId: lead?.preBookingStageId ?? null,
      },
    });
    await tx.homeProjectInvite.updateMany({ where: { projectId: p.id, revokedAt: null }, data: { revokedAt: now } });
    if (p.signedQuoteId) await tx.studioQuote.updateMany({ where: { id: p.signedQuoteId, studioId: m.studioId }, data: { status: 'ISSUED' } });
    if (lead) {
      await tx.studioClient.update({
        where: { id: lead.id },
        data: { bookedIntroductionId: null, bookedAt: null, preBookingStageId: null, ...(back ? { stageId: back.id } : {}) },
      });
    }
    await tx.auditLog.create({ data: { actorId: m.userId, action: 'studio.project.delete', entityType: 'HomeProject', entityId: p.id, after: { reason, quoteId: p.signedQuoteId, leadId: lead?.id ?? null } } });
  });
  return { ok: true, message: `Deleted. ${client}’s project is gone from your lists and their app. Restore it from Deleted projects (on Projects, or Design for the design head).` };
}

type DeletedPayload = { quoteId?: string | null; leadId?: string | null; leadStageId?: string | null; leadBookedAt?: string | null; leadPreBookingStageId?: string | null; reason?: string | null };

/** The project's newest delete, when it was deleted (not refunded) and not restored since. */
async function lastDelete(projectId: string) {
  const ev = await prisma.homeProjectEvent.findFirst({
    where: { projectId, type: { in: ['project.deleted', 'project.restored', 'project.cancelled'] } },
    orderBy: { at: 'desc' },
    select: { type: true, payload: true },
  });
  return ev?.type === 'project.deleted' ? ((ev.payload ?? {}) as DeletedPayload) : null;
}

export async function deletedProjects(): Promise<DeletedProject[] | null> {
  const m = await owner();
  if ('error' in m) return null;
  const rows = await prisma.homeProject.findMany({
    where: { introduction: { studioId: m.studioId }, cancelledAt: { not: null } },
    orderBy: { cancelledAt: 'desc' },
    take: 100,
    select: {
      id: true,
      cancelledAt: true,
      cancelReason: true,
      introduction: { select: { brief: { select: { contactName: true, society: true, locality: true, propertyType: true, user: { select: { name: true } } } } } },
    },
  });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      client: clientOf(r.introduction.brief),
      home: homeLabel(r.introduction.brief),
      deletedOn: r.cancelledAt!,
      reason: r.cancelReason,
      restorable: (await lastDelete(r.id)) !== null,
    })),
  );
}

export async function restoreProject(projectId: unknown, now = new Date()): Promise<DeleteResult> {
  const m = await owner();
  if ('error' in m) return { ok: false, error: m.error };
  const id = String(projectId ?? '').slice(0, 64);
  const p = await prisma.homeProject.findFirst({
    where: { id, introduction: { studioId: m.studioId } },
    select: { id: true, cancelledAt: true, introductionId: true },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  if (!p.cancelledAt) return { ok: false, error: 'That project is not deleted.' };
  const del = await lastDelete(p.id);
  if (!del) return { ok: false, error: 'That project was cancelled with a refund, not deleted: it is not restored from here.' };

  /* The quotation comes back only when no other project has taken it since. */
  const quote = del.quoteId ? await prisma.studioQuote.findFirst({ where: { id: del.quoteId, studioId: m.studioId }, select: { id: true } }) : null;
  const quoteFree = quote ? (await prisma.homeProject.count({ where: { signedQuoteId: quote.id } })) === 0 : false;
  const lead = del.leadId ? await prisma.studioClient.findFirst({ where: { id: del.leadId, studioId: m.studioId, deletedAt: null }, select: { id: true, bookedIntroductionId: true } }) : null;
  const leadFree = lead !== null && lead.bookedIntroductionId === null;
  /* The client's invite was revoked on delete: a new code for the same person, sent by nobody (the project page shows the link). */
  const lastInvite = await prisma.homeProjectInvite.findFirst({
    where: { projectId: p.id },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, phone: true, name: true, email: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.homeProject.update({ where: { id: p.id }, data: { cancelledAt: null, cancelReason: null, ...(quoteFree ? { signedQuoteId: quote!.id } : {}) } });
    if (quoteFree) await tx.studioQuote.update({ where: { id: quote!.id }, data: { status: 'ACCEPTED' } });
    if (leadFree) {
      await tx.studioClient.update({
        where: { id: lead!.id },
        data: {
          bookedIntroductionId: p.introductionId,
          bookedAt: del.leadBookedAt ? new Date(del.leadBookedAt) : now,
          preBookingStageId: del.leadPreBookingStageId ?? null,
          ...(del.leadStageId ? { stageId: del.leadStageId } : {}),
        },
      });
    }
    if (lastInvite) {
      await tx.homeProjectInvite.create({ data: { projectId: p.id, code: freshCode(), userId: lastInvite.userId, phone: lastInvite.phone, name: lastInvite.name, email: lastInvite.email, createdById: m.id } });
    }
    await recordEvent(tx, { projectId: p.id, type: 'project.restored', actor: { type: 'STUDIO', id: m.userId }, refId: quoteFree ? quote!.id : null, payload: { quoteRelinked: quoteFree, leadRebooked: leadFree } });
    await tx.auditLog.create({ data: { actorId: m.userId, action: 'studio.project.restore', entityType: 'HomeProject', entityId: p.id, after: { quoteRelinked: quoteFree, leadRebooked: leadFree } } });
  });
  const notes = [quote && !quoteFree ? 'its quotation is on another project now, so it is not linked back' : null, lead && !leadFree ? 'its lead is booked on another project, so it stays there' : null].filter(Boolean);
  return { ok: true, message: `Restored.${notes.length ? ` Note: ${notes.join('; ')}.` : ''} ${lastInvite ? 'The client has a new app link on the project page; the old one stays dead.' : ''}`.trimEnd() };
}
