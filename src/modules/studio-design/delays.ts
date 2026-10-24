import 'server-only';

/**
 * The Delays list (owner and Hauspire's design team, 24 Oct 2026;
 * docs/studio-os/DESIGN-PROCESS-PLAN.md Decision 6): every late design step,
 * whose delay it was and why, as filed when it was ticked late, moved, or
 * waited on a payment. Somebody who sees every designer's work (owner, PM,
 * design head: `design.workload`) checks each reason; a designer sees the
 * delays on their own projects. Reads and one write (checked), scoped by
 * the member's studio.
 */

import { prisma } from '@/lib/prisma';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { dayFromDb, istDay } from '@/modules/project/working-days';
import { homeLabel } from '@/modules/studio/workspace-view';
import { daysBetween } from '@/modules/project/working-days';
import { reasonLabel } from './rules';

export interface DelayRow {
  id: string;
  projectId: string;
  stepId: string;
  home: string;
  step: string;
  from: string;
  to: string;
  days: number;
  side: 'CLIENT' | 'STUDIO';
  reason: string;
  note: string | null;
  by: string;
  on: string;
  checked: { on: string; by: string } | null;
}

export interface DelaysView {
  rows: DelayRow[];
  /** May tick "checked": owner, PM, design head. */
  canCheck: boolean;
  unchecked: number;
}

const LOOKBACK_DAYS = 120;

export async function delaysList(now = new Date()): Promise<DelaysView | null> {
  const member = await currentMember();
  if (!member) return null;
  const everyone = can(member, 'design.workload');
  if (!everyone && member.role !== 'DESIGNER') return null;
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const rows = await prisma.homeStepDelay.findMany({
    where: {
      at: { gte: since },
      project: { introduction: { studioId: member.studioId }, cancelledAt: null, ...(everyone ? {} : { designerId: member.id }) },
    },
    orderBy: { at: 'desc' },
    take: 300,
    select: {
      id: true,
      projectId: true,
      stepId: true,
      fromDate: true,
      toDate: true,
      side: true,
      reason: true,
      note: true,
      byId: true,
      at: true,
      checkedAt: true,
      checkedById: true,
      step: { select: { label: true } },
      project: { select: { introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true } } } } } },
    },
  });
  const userIds = [...new Set(rows.flatMap((r) => [r.byId, r.checkedById].filter((x): x is string => Boolean(x))))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const name = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name?.trim() || 'Someone') : 'Someone');
  const out: DelayRow[] = rows.map((r) => {
    const from = dayFromDb(r.fromDate);
    const to = dayFromDb(r.toDate);
    return {
      id: r.id,
      projectId: r.projectId,
      stepId: r.stepId,
      home: homeLabel(r.project.introduction.brief),
      step: r.step.label,
      from,
      to,
      days: Math.max(0, daysBetween(from, to)),
      side: r.side,
      reason: reasonLabel(r.reason),
      note: r.note,
      by: name(r.byId),
      on: istDay(r.at),
      checked: r.checkedAt ? { on: istDay(r.checkedAt), by: name(r.checkedById) } : null,
    };
  });
  return { rows: out, canCheck: everyone && !member.viewOnly, unchecked: out.filter((r) => !r.checked).length };
}

/** Marks a delay's reason as checked (owner, PM, design head). Once. */
export async function checkDelay(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member || !can(member, 'design.workload')) return { ok: false, error: 'Only the owner, a project manager or the design head checks delays.' };
  const { count } = await prisma.homeStepDelay.updateMany({
    where: { id: String(id ?? ''), checkedAt: null, project: { introduction: { studioId: member.studioId } } },
    data: { checkedAt: new Date(), checkedById: member.userId },
  });
  return count === 1 ? { ok: true } : { ok: false, error: 'That delay is checked already, or not one of yours.' };
}
