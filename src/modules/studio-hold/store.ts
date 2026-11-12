import 'server-only';

/**
 * A project on hold, the writes and the studio's view (rules in ./rules.ts).
 * Every query is scoped by the member's access to the project
 * (studio/access.ts `memberOnProject`). Nobody is messaged outside the app.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { memberOnProject } from '@/modules/studio/access';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { shiftStepsWithStage } from '@/modules/project/stage-settle';
import type { RuleStage, StageKind } from '@/modules/project/project-rules';
import { dayFromDb, dayToDb, istDay } from '@/modules/project/working-days';
import { checkHoldAsk, holdDays, holdEndShift, HOLD_REASONS, isHoldReason, mayApproveHold, mayEndHold, openHold, type HoldReason } from './rules';

export type HoldResult = { ok: true; message: string } | { ok: false; error: string };

export interface HoldView {
  projectId: string;
  /** The open hold (asked or on), with who asked; null when running. */
  open: {
    id: string;
    status: 'ASKED' | 'ON';
    reason: string;
    note: string | null;
    askedBy: string;
    askedOn: string;
    startedOn: string | null;
    days: number;
  } | null;
  /** Ended holds, newest first. */
  past: { reason: string; startedOn: string; endedOn: string; days: number }[];
  canAsk: boolean;
  canApprove: boolean;
  canEnd: boolean;
  reasons: { key: HoldReason; label: string }[];
}

const HOLD_SELECT = { id: true, status: true, reason: true, note: true, askedById: true, askedAt: true, startedOn: true, endedOn: true } as const;

export async function holdView(projectId: string, now = new Date()): Promise<HoldView | null> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return null;
  const { member, access } = check;
  const holds = await prisma.homeProjectHold.findMany({ where: { projectId }, orderBy: { askedAt: 'desc' }, select: HOLD_SELECT });
  const today = istDay(now);
  const open = openHold(holds);
  const asker = open ? await prisma.user.findUnique({ where: { id: open.askedById }, select: { name: true } }) : null;
  const write = !member.viewOnly;
  return {
    projectId,
    open: open
      ? {
          id: open.id,
          status: open.status as 'ASKED' | 'ON',
          reason: isHoldReason(open.reason) ? HOLD_REASONS[open.reason] : open.reason,
          note: open.note,
          askedBy: asker?.name?.trim() || 'Someone',
          askedOn: istDay(open.askedAt),
          startedOn: open.startedOn ? dayFromDb(open.startedOn) : null,
          days: open.status === 'ON' ? holdDays(open.startedOn ? dayFromDb(open.startedOn) : null, null, today) : 0,
        }
      : null,
    past: holds
      .filter((h) => h.status === 'ENDED' && h.startedOn && h.endedOn)
      .map((h) => {
        const s = dayFromDb(h.startedOn!);
        const e = dayFromDb(h.endedOn!);
        return { reason: isHoldReason(h.reason) ? HOLD_REASONS[h.reason] : h.reason, startedOn: s, endedOn: e, days: holdDays(s, e, today) };
      }),
    canAsk: write && access.may('design.work'),
    canApprove: write && mayApproveHold(member),
    canEnd: write && open !== null && mayEndHold(member, open),
    reasons: (Object.keys(HOLD_REASONS) as HoldReason[]).filter((key) => key !== 'ADDITIONAL_SCOPE').map((key) => ({ key, label: HOLD_REASONS[key] })),
  };
}

/** A designer (anyone doing design work on the project) asks for a hold. An approver asking puts it on at once. */
export async function askHold(projectId: string, input: { reason: unknown; note: unknown }, now = new Date()): Promise<HoldResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const { member } = check;
  const holds = await prisma.homeProjectHold.findMany({ where: { projectId }, select: { status: true } });
  const ok = checkHoldAsk(input, holds);
  if (!ok.ok) return ok;
  const approver = mayApproveHold(member);
  const actor: ProjectActor = { type: 'STUDIO', id: member.userId };
  await prisma.$transaction(async (tx) => {
    const row = await tx.homeProjectHold.create({
      data: {
        projectId,
        reason: ok.reason,
        note: ok.note,
        askedById: member.userId,
        askedAt: now,
        ...(approver ? { status: 'ON', decidedById: member.userId, decidedAt: now, startedOn: dayToDb(istDay(now)) } : {}),
      },
      select: { id: true },
    });
    await recordEvent(tx, { projectId, type: approver ? 'project.hold_started' : 'project.hold_asked', actor, refId: row.id, payload: { reason: ok.reason }, at: now });
  });
  return { ok: true, message: approver ? 'The project is on hold from today. Nothing counts as late until you take it off.' : 'Asked. The design head or the owner approves it; until then the project runs as usual.' };
}

/** The design head or the owner approves (the hold starts today) or declines. */
export async function decideHold(projectId: string, holdId: string, approve: boolean, now = new Date()): Promise<HoldResult> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return check;
  const { member } = check;
  if (member.viewOnly || !mayApproveHold(member)) return { ok: false, error: 'Only the design head or the owner approves a hold.' };
  const today = istDay(now);
  const { count } = await prisma.homeProjectHold.updateMany({
    where: { id: holdId, projectId, status: 'ASKED' },
    data: approve ? { status: 'ON', decidedById: member.userId, decidedAt: now, startedOn: dayToDb(today) } : { status: 'DECLINED', decidedById: member.userId, decidedAt: now },
  });
  if (count !== 1) return { ok: false, error: 'That hold is not waiting for approval any more. Reload the page.' };
  await recordEvent(prisma, { projectId, type: approve ? 'project.hold_started' : 'project.hold_declined', actor: { type: 'STUDIO', id: member.userId }, refId: holdId, payload: {}, at: now });
  return { ok: true, message: approve ? 'Approved: the project is on hold from today.' : 'Declined: the project runs as usual.' };
}

/** The one who asked withdraws a hold not approved yet. */
export async function withdrawHold(projectId: string, holdId: string, now = new Date()): Promise<HoldResult> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return check;
  const { member } = check;
  const hold = await prisma.homeProjectHold.findFirst({ where: { id: holdId, projectId, status: 'ASKED' }, select: { askedById: true } });
  if (!hold) return { ok: false, error: 'That hold is not waiting any more. Reload the page.' };
  if (member.viewOnly || !mayEndHold(member, hold)) return { ok: false, error: 'Only the one who asked, the design head or the owner can withdraw it.' };
  await prisma.homeProjectHold.updateMany({ where: { id: holdId, status: 'ASKED' }, data: { status: 'WITHDRAWN', decidedById: member.userId, decidedAt: now } });
  await recordEvent(prisma, { projectId, type: 'project.hold_withdrawn', actor: { type: 'STUDIO', id: member.userId }, refId: holdId, payload: {}, at: now });
  return { ok: true, message: 'Withdrawn.' };
}

/**
 * Takes a project off hold: every open step of the stage under way, its end,
 * every later stage and handover move later by the days it was on hold,
 * filed as the client's side (never our delay).
 */
export async function endHold(projectId: string, holdId: string, now = new Date()): Promise<HoldResult> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return check;
  const { member } = check;
  const hold = await prisma.homeProjectHold.findFirst({ where: { id: holdId, projectId, status: 'ON' }, select: { askedById: true, startedOn: true, reason: true } });
  if (!hold) return { ok: false, error: 'This project is not on hold any more. Reload the page.' };
  if (member.viewOnly || !mayEndHold(member, hold)) return { ok: false, error: 'Only the one who asked, the design head or the owner takes it off hold.' };
  const today = istDay(now);
  const days = holdDays(hold.startedOn ? dayFromDb(hold.startedOn) : null, today, today);
  const actor: ProjectActor = { type: 'STUDIO', id: member.userId };
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeProjectHold.updateMany({ where: { id: holdId, status: 'ON' }, data: { status: 'ENDED', endedOn: dayToDb(today), endedById: member.userId, shiftedDays: days } });
    if (count !== 1) return;
    const label = isHoldReason(hold.reason) ? HOLD_REASONS[hold.reason].toLowerCase() : 'client side';
    const steps = await shiftPlanForClient(tx, { projectId, days, note: `On hold ${days} day${days === 1 ? '' : 's'} (${label}).`, byId: member.userId, actor, now, ref: { holdId } });
    await recordEvent(tx, { projectId, type: 'project.hold_ended', actor, refId: holdId, payload: { days, steps }, at: now });
  });
  return {
    ok: true,
    message: days > 0 ? `Off hold after ${days} day${days === 1 ? '' : 's'}. The open steps, the stage under way and handover moved ${days} day${days === 1 ? '' : 's'} later, on the client's side.` : 'Off hold. It was on hold less than a day, so no date moved.',
  };
}

/**
 * Moves the plan later by `days` on the client's side (a hold taken off,
 * additional scope paid): the open steps of the stage under way by exactly
 * the days, its end and every later stage (handover included), filed as
 * CUSTOMER_CHANGE so it never counts as our delay. Inside the caller's
 * transaction. The number of steps moved.
 */
export async function shiftPlanForClient(
  tx: Prisma.TransactionClient,
  input: { projectId: string; days: number; note: string; byId: string; actor: ProjectActor; now: Date; ref: Record<string, string> },
): Promise<number> {
  const { projectId, days, now } = input;
  if (days <= 0) return 0;
  const rows = await tx.homeProjectStage.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, kind: true, name: true, plannedStart: true, plannedEnd: true, actualEnd: true, items: { select: { id: true, plannedOn: true, doneAt: true } } },
  });
  const stages: RuleStage[] = rows.map((s) => ({ id: s.id, kind: s.kind as StageKind, name: s.name, plannedStart: istDay(s.plannedStart), plannedEnd: istDay(s.plannedEnd), actualEnd: s.actualEnd ? istDay(s.actualEnd) : null }));
  const steps = rows.flatMap((s) => s.items.map((i) => ({ id: i.id, stageId: s.id, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null, done: i.doneAt !== null })));
  const shift = holdEndShift(stages, steps, days);
  for (const m of shift.steps) await tx.homeChecklistItem.update({ where: { id: m.id }, data: { plannedOn: dayToDb(m.to) } });
  if (shift.plan) {
    const current = shift.plan.stages[0]!.stageId;
    for (const s of shift.plan.stages) {
      await tx.homeProjectStage.update({ where: { id: s.stageId }, data: { plannedStart: dayToDb(s.plannedStart), plannedEnd: dayToDb(s.plannedEnd) } });
      const was = stages.find((x) => x.id === s.stageId)!;
      // The stage under way's steps moved above, by the exact days; a later stage's steps move with it.
      if (s.stageId !== current) await shiftStepsWithStage(tx, s.stageId, { start: was.plannedStart, end: was.plannedEnd }, { start: s.plannedStart, end: s.plannedEnd });
    }
    let leadId: string | null = null;
    for (const r of shift.plan.rows) {
      const row = await tx.homeProjectDateChange.create({
        data: { projectId, stageId: r.stageId, field: r.field, fromDate: dayToDb(r.from), toDate: dayToDb(r.to), reason: 'CUSTOMER_CHANGE', note: input.note, byId: input.byId, at: now },
        select: { id: true },
      });
      leadId ??= row.id;
    }
    await recordEvent(tx, { projectId, type: 'date.moved', actor: input.actor, refId: leadId, payload: { stageId: current, field: shift.plan.rows[0]!.field, days, rows: shift.plan.rows.length, reason: 'CUSTOMER_CHANGE', customer: true, ...input.ref }, at: now });
  }
  return shift.steps.length;
}

/** The projects of these ids that are on hold now (for lists that count lateness). */
export async function onHoldIds(projectIds: readonly string[]): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  const rows = await prisma.homeProjectHold.findMany({ where: { projectId: { in: [...projectIds] }, status: 'ON' }, select: { projectId: true } });
  return new Set(rows.map((r) => r.projectId));
}
