'use server';

/**
 * The leads list and board's server actions (leads at scale, 12 Oct 2026):
 * bulk actions, claiming from the pool, and the board's "show more". Every
 * one hands untrusted input to a module that reads the person's scope
 * first (studio-sales/bulk.ts, leads-list.ts). Only async functions here.
 */

import { revalidatePath } from 'next/cache';
import { bulkAssign, bulkBin, bulkClaim, bulkFollowUp, bulkMarkLost, bulkMove, bulkSnooze, bulkSplit, type BulkTarget } from '@/modules/studio-sales/bulk';
import { columnPage, leadPage, moreCards, viewPage, type ViewPage } from '@/modules/studio-sales/leads-list';
import { addLeadTags, deleteLeadNote, editLeadNote, followUpDone, removeLeadTag } from '@/modules/studio-sales/lead-extras';
import { updateClient } from '@/modules/studio-practice/clients';
import type { LostReasonName } from '@/modules/studio-practice/vocabulary';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { parseCursor, parseLeadFilters, parseSort } from '@/modules/studio-sales/lead-filters';
import type { ClientRow } from '@/modules/studio-practice/clients';
import type { Done } from '../sales-types';

function target(raw: unknown): BulkTarget {
  if (raw && typeof raw === 'object' && 'ids' in raw && Array.isArray((raw as { ids: unknown }).ids)) {
    return { ids: (raw as { ids: unknown[] }).ids.filter((i): i is string => typeof i === 'string') };
  }
  const q = raw && typeof raw === 'object' && 'query' in raw ? (raw as { query: unknown; limit?: unknown }) : null;
  return { query: typeof q?.query === 'string' ? q.query : '', limit: typeof q?.limit === 'number' ? q.limit : null };
}

function refresh() {
  revalidatePath('/studio/clients');
  revalidatePath('/studio/today');
  revalidatePath('/studio/dashboard');
  revalidatePath('/studio');
}

async function done(p: Promise<{ ok: true; message: string } | { ok: false; error: string }>): Promise<Done> {
  const r = await p;
  if (r.ok) refresh();
  return r;
}

export async function bulkClaimAction(t: unknown): Promise<Done> {
  return done(bulkClaim(target(t)));
}

export async function bulkAssignAction(t: unknown, memberId: string | null): Promise<Done> {
  return done(bulkAssign(target(t), typeof memberId === 'string' && memberId ? memberId : null));
}

export async function bulkSplitAction(t: unknown, memberIds: string[]): Promise<Done> {
  return done(bulkSplit(target(t), Array.isArray(memberIds) ? memberIds : []));
}

export async function bulkMoveAction(t: unknown, stageId: string, lostReason: string | null): Promise<Done> {
  return done(bulkMove(target(t), String(stageId ?? ''), typeof lostReason === 'string' ? lostReason : null));
}

export async function bulkFollowUpAction(t: unknown, day: string, time: string, action: string): Promise<Done> {
  return done(bulkFollowUp(target(t), String(day ?? ''), typeof time === 'string' ? time : '', typeof action === 'string' ? action : ''));
}

export async function bulkBinAction(t: unknown): Promise<Done> {
  const r = await done(bulkBin(target(t)));
  if (r.ok) revalidatePath('/studio/clients/bin');
  return r;
}

/** The board's "Show more": the next 50 cards of one column, with the same filters. */
export async function moreCardsAction(query: string, stageId: string, offset: number): Promise<ClientRow[]> {
  const filters = parseLeadFilters(new URLSearchParams(typeof query === 'string' ? query.slice(0, 2000) : ''));
  return moreCards(filters, String(stageId ?? ''), Number(offset));
}

/** The stale-lead review: snooze 7 days. */
export async function bulkSnoozeAction(t: unknown): Promise<Done> {
  return done(bulkSnooze(target(t)));
}

/** The stale-lead review: mark lost, one reason for the batch. */
export async function bulkMarkLostAction(t: unknown, reason: string): Promise<Done> {
  return done(bulkMarkLost(target(t), String(reason ?? '')));
}

/**
 * The review's list: leads needing attention, 50 at a time, longest-silent
 * first — within the page's own filters (`staleReviewQuery`), so it is the
 * same set the banner counted.
 */
export async function staleLeadsAction(query: string, after: string | null): Promise<{ rows: { id: string; name: string; phone: string | null; lastContactedAt: Date | null; createdAt: Date; assignedToName: string | null; stageName: string }[]; next: string | null; total: number }> {
  const scope = await myLeadScope();
  if (!scope) return { rows: [], next: null, total: 0 };
  const params = new URLSearchParams(typeof query === 'string' ? query.slice(0, 2000) : '');
  /* A salesperson reviews their own leads only: these rows carry phones, so
     a query asking for the pool must not reach it (owner dropped = their own). */
  const asked = parseLeadFilters(params);
  const filters = { ...asked, owner: scope.seesAll ? asked.owner : undefined, kpi: undefined, stale: true };
  const page = await leadPage(scope, filters, 'contacted', parseCursor(after));
  return {
    rows: page.rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, lastContactedAt: r.lastContactedAt, createdAt: r.createdAt, assignedToName: r.assignedToName, stageName: r.stageName })),
    next: page.next,
    total: page.total,
  };
}

// ── The AxLeads look (12 Oct 2026) ─────────────────────────────────────

/** The list's next page (infinite scroll), with the URL's filters and sort. */
export async function viewPageAction(query: string, after: string | null): Promise<ViewPage> {
  const scope = await myLeadScope();
  if (!scope) return { rows: [], next: null };
  const params = new URLSearchParams(typeof query === 'string' ? query.slice(0, 3000) : '');
  return viewPage(scope, parseLeadFilters(params), parseSort(params.get('sort')), parseCursor(after));
}

/** One board column's next cards. */
export async function columnPageAction(query: string, stageId: string, after: string | null): Promise<ViewPage> {
  const scope = await myLeadScope();
  if (!scope || typeof stageId !== 'string' || stageId.length > 64) return { rows: [], next: null };
  const params = new URLSearchParams(typeof query === 'string' ? query.slice(0, 3000) : '');
  return columnPage(scope, parseLeadFilters(params), stageId, parseCursor(after));
}

/** Move a lead to a column (board drop, the list's stage dropdown). A lost column needs the reason. */
export async function moveLeadAction(id: string, stageId: string, lostReason: string | null): Promise<Done> {
  const r = await updateClient({ id: String(id ?? ''), stageId: String(stageId ?? ''), lostReason: (typeof lostReason === 'string' && lostReason ? lostReason : null) as LostReasonName | null });
  if (!r.ok) return r;
  refresh();
  revalidatePath(`/studio/clients/${id}`);
  return { ok: true };
}

async function onLead(id: unknown, p: Promise<{ ok: true; message?: string } | { ok: false; error: string }>): Promise<Done> {
  const r = await p;
  if (r.ok) {
    refresh();
    if (typeof id === 'string') revalidatePath(`/studio/clients/${id}`);
  }
  return r;
}

export async function addTagsAction(id: string, tags: string[]): Promise<Done> {
  return onLead(id, addLeadTags(id, tags));
}
export async function removeTagAction(id: string, tag: string): Promise<Done> {
  return onLead(id, removeLeadTag(id, tag));
}
export async function editNoteAction(id: string, noteId: string, text: string): Promise<Done> {
  return onLead(id, editLeadNote(id, noteId, text));
}
export async function deleteNoteAction(id: string, noteId: string): Promise<Done> {
  return onLead(id, deleteLeadNote(id, noteId));
}
export async function followUpDoneAction(id: string): Promise<Done> {
  return onLead(id, followUpDone(id));
}
