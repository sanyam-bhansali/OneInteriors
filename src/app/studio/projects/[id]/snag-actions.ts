'use server';

import { revalidatePath } from 'next/cache';
import { acceptSnag, disputeSnag, raiseHandoverSnags } from '@/modules/project/snag-flow';

/**
 * The office Snags tab (studio workspace Phase 4). Each checked in
 * project/snag-flow.ts: `snag.accept` on the snag's project (owner, or a PM
 * assigned to it; ops), a fix-by date that is not in the past, an assignee
 * from this project's team, a dispute reason the customer will read.
 */

type Result = { ok: true; message?: string } | { ok: false; error: string };

const refresh = (projectId: string) => revalidatePath(`/studio/projects/${String(projectId).slice(0, 64)}`);

export async function acceptSnagAction(projectId: string, snagId: string, input: { fixBy: string; assigneeId: string; internalNote: string }): Promise<Result> {
  const r = await acceptSnag(String(snagId).slice(0, 64), {
    fixBy: String(input?.fixBy ?? ''),
    assigneeId: String(input?.assigneeId ?? ''),
    internalNote: String(input?.internalNote ?? ''),
  });
  if (!r.ok) return r;
  refresh(projectId);
  return { ok: true };
}

export async function disputeSnagAction(projectId: string, snagId: string, reason: string): Promise<Result> {
  const r = await disputeSnag(String(snagId).slice(0, 64), String(reason ?? ''));
  if (!r.ok) return r;
  refresh(projectId);
  return { ok: true };
}

export async function addSnagsAction(projectId: string, items: { title: string; room: string }[]): Promise<Result> {
  const id = String(projectId).slice(0, 64);
  const rows = Array.isArray(items) ? items.slice(0, 60).map((i) => ({ title: String(i?.title ?? ''), room: String(i?.room ?? '') })) : [];
  const r = await raiseHandoverSnags(id, rows);
  if (!r.ok) return r;
  refresh(id);
  return { ok: true, message: `${r.ids.length} snag${r.ids.length === 1 ? '' : 's'} added.` };
}
