import 'server-only';

/**
 * The lead page's AxLeads pieces (12 Oct 2026): tags, editing and deleting
 * an internal note, and ticking the follow-up done. Each reads the lead
 * inside the person's scope (studio/lead-scope.ts) and checks `lead.edit`
 * (a salesperson: their own leads only).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { leadInScope, mayOnLead, myLeadScope, actingMember } from '@/modules/studio/lead-scope';
import { record } from '@/modules/studio-practice/events';
import { addTags, removeTag } from './tag-rules';
import { rawSeenOrPool } from './lead-sql';

export type Done = { ok: true; message?: string } | { ok: false; error: string };

async function workable(leadId: unknown) {
  const scope = await myLeadScope();
  if (!scope || typeof leadId !== 'string') return null;
  const lead = await leadInScope(scope, leadId);
  if (!lead || !mayOnLead(scope, 'lead.edit', lead)) return null;
  return { scope, lead };
}

/** Add tags (cleaned, no duplicates in any case, at most 20). */
export async function addLeadTags(leadId: unknown, raw: unknown): Promise<Done> {
  const w = await workable(leadId);
  if (!w) return { ok: false, error: 'That lead is not yours to change.' };
  const add = (Array.isArray(raw) ? raw : [raw]).filter((t): t is string => typeof t === 'string').slice(0, 20);
  try {
    const row = await prisma.studioClient.findFirst({ where: { id: w.lead.id, studioId: w.scope.studioId }, select: { tags: true } });
    const next = addTags(row?.tags ?? [], add);
    if (next.refused) return { ok: false, error: next.refused };
    await prisma.studioClient.updateMany({ where: { id: w.lead.id, studioId: w.scope.studioId, deletedAt: null }, data: { tags: next.tags } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

export async function removeLeadTag(leadId: unknown, tag: unknown): Promise<Done> {
  const w = await workable(leadId);
  if (!w || typeof tag !== 'string') return { ok: false, error: 'That lead is not yours to change.' };
  try {
    const row = await prisma.studioClient.findFirst({ where: { id: w.lead.id, studioId: w.scope.studioId }, select: { tags: true } });
    await prisma.studioClient.updateMany({ where: { id: w.lead.id, studioId: w.scope.studioId, deletedAt: null }, data: { tags: removeTag(row?.tags ?? [], tag) } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

/** The studio's tags, most used first (the Tag box's suggestions). */
export async function studioTags(): Promise<string[]> {
  const scope = await myLeadScope();
  if (!scope) return [];
  /* A salesperson's suggestions come from the leads they may see — their
     own (their team's, with a sales role that reaches it), and the pools
     they may claim from — never anyone else's (lead-sql.ts). */
  const fence = rawSeenOrPool(scope);
  try {
    const rows = await prisma.$queryRaw<{ value: string }[]>(
      Prisma.sql`SELECT tg AS value FROM studio_clients c CROSS JOIN LATERAL unnest(c.tags) AS tg
      WHERE c."studioId" = ${scope.studioId} AND c."deletedAt" IS NULL ${fence}
      GROUP BY tg ORDER BY COUNT(*) DESC LIMIT 100`,
    );
    return rows.map((r) => r.value);
  } catch {
    return [];
  }
}

/** A note on this lead that this person may change: their own, or any for owner and PM. */
async function ownNote(leadId: unknown, noteId: unknown) {
  const w = await workable(leadId);
  if (!w || typeof noteId !== 'string' || noteId.length > 64) return null;
  const note = await prisma.studioClientEvent.findFirst({ where: { id: noteId, studioId: w.scope.studioId, clientId: w.lead.id, kind: 'NOTE' }, select: { id: true, byId: true } });
  if (!note || (!w.scope.seesAll && note.byId !== w.scope.member.id)) return null;
  return { ...w, note };
}

export async function editLeadNote(leadId: unknown, noteId: unknown, text: unknown): Promise<Done> {
  const n = await ownNote(leadId, noteId);
  if (!n) return { ok: false, error: 'That note is not yours to change.' };
  const words = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
  if (!words) return { ok: false, error: 'Write the note first.' };
  await prisma.studioClientEvent.updateMany({ where: { id: n.note.id, studioId: n.scope.studioId }, data: { summary: words, meta: { edited: new Date().toISOString() } } });
  return { ok: true, message: 'Note updated.' };
}

export async function deleteLeadNote(leadId: unknown, noteId: unknown): Promise<Done> {
  const n = await ownNote(leadId, noteId);
  if (!n) return { ok: false, error: 'That note is not yours to change.' };
  await prisma.studioClientEvent.deleteMany({ where: { id: n.note.id, studioId: n.scope.studioId, kind: 'NOTE' } });
  return { ok: true, message: 'Note deleted.' };
}

/** Tick the next call done (AxLeads' Follow-up checkbox): cleared, with a timeline line. */
export async function followUpDone(leadId: unknown): Promise<Done> {
  const w = await workable(leadId);
  if (!w) return { ok: false, error: 'That lead is not yours to change.' };
  const row = await prisma.studioClient.findFirst({ where: { id: w.lead.id, studioId: w.scope.studioId }, select: { nextAction: true, nextActionOn: true } });
  if (!row?.nextActionOn) return { ok: false, error: 'There is no follow-up to tick.' };
  await prisma.studioClient.updateMany({ where: { id: w.lead.id, studioId: w.scope.studioId, deletedAt: null }, data: { nextAction: null, nextActionOn: null } });
  await record({ studioId: w.scope.studioId, clientId: w.lead.id, kind: 'EDITED', summary: `Follow-up done — ${row.nextAction ?? 'Follow up'}`, by: await actingMember() });
  return { ok: true, message: 'Done. Schedule the next call when you know it.' };
}

/** The lead's tags, if this person may see the lead. */
export async function leadTags(leadId: string): Promise<string[]> {
  const scope = await myLeadScope();
  if (!scope) return [];
  const lead = await leadInScope(scope, leadId);
  if (!lead) return [];
  const row = await prisma.studioClient.findFirst({ where: { id: lead.id, studioId: scope.studioId }, select: { tags: true } });
  return row?.tags ?? [];
}
