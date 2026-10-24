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
import { dedupeKey, recordEventOnce } from '@/modules/project/events';
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
      step: { select: { label: true } },
      project: { select: { introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true } } } } } },
    },
  });
  // A check is a project event (home_step_delays is append-only): the newest per delay.
  const checks = rows.length
    ? await prisma.homeProjectEvent.findMany({ where: { type: 'design.delay_checked', refId: { in: rows.map((r) => r.id) } }, select: { refId: true, actorId: true, at: true } })
    : [];
  const checkOf = new Map(checks.map((c) => [c.refId!, c]));
  const userIds = [...new Set([...rows.map((r) => r.byId), ...checks.map((c) => c.actorId)].filter((x): x is string => Boolean(x)))];
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
      checked: checkOf.has(r.id) ? { on: istDay(checkOf.get(r.id)!.at), by: name(checkOf.get(r.id)!.actorId) } : null,
    };
  });
  return { rows: out, canCheck: everyone && !member.viewOnly, unchecked: out.filter((r) => !r.checked).length };
}

/** Marks a delay's reason as checked (owner, PM, design head). Once. */
export async function checkDelay(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member || !can(member, 'design.workload')) return { ok: false, error: 'Only the owner, a project manager or the design head checks delays.' };
  const delay = await prisma.homeStepDelay.findFirst({ where: { id: String(id ?? ''), project: { introduction: { studioId: member.studioId } } }, select: { id: true, projectId: true } });
  if (!delay) return { ok: false, error: 'That delay is not one of yours.' };
  // Once per delay; the delay row itself is never edited (append-only).
  const written = await recordEventOnce(prisma, {
    projectId: delay.projectId,
    type: 'design.delay_checked',
    actor: { type: 'STUDIO', id: member.userId },
    refId: delay.id,
    payload: {},
    dedupeKey: dedupeKey('delay-checked', delay.id),
  });
  return written ? { ok: true } : { ok: false, error: 'That delay is checked already.' };
}
