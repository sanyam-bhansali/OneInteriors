import 'server-only';

/**
 * Decisions for the customer (studio workspace Phase 5, brief §6 and the
 * New decision design, studio/StudioDecision.dc.html).
 *
 * - **New decision** (owner or the PM on the project, `decision.create`):
 *   title, decide-by date, "if she decides late", the quote line it
 *   changes, and two or three options, each with a photo, a line about it,
 *   the price change the customer sees (GST included) and the studio's own
 *   cost change (only the team). Written as `HomeDecision` +
 *   `HomeDecisionOption` rows, and the older `options` JSON without any cost
 *   (decision-rules.ts `legacyOptionsJson`) while older apps read it.
 * - **The customer picks** (the owner of the brief; family vote, the owner's
 *   pick decides). In one transaction, nobody retyping anything:
 *   `pickedOptionId` (+ `chosenIndex`), recorded quote changes (the old pick
 *   reversed, the old line kept — decision-rules.ts `pickChanges`) landing on
 *   the final payment stage, the locker's material entry for that quote line
 *   updated, the outcome filed in the locker, the events. Then the studio
 *   is told.
 * - **Late:** a first pick after the decide-by date is taken, and the
 *   working days it was late move the plan with the decision named on the
 *   date change (reason `CUSTOMER_CHANGE`, `decisionId`), which Phase 3's
 *   project-rules.ts counts as the customer's delay, not the studio's. The
 *   move is worked out by Phase 3's own `planMove`, so there is one rule for
 *   moving dates. A decision still unpicked at its date gets a
 *   `decision.expired` event and the studio is told (`expireDecisions`, the
 *   daily cron).
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { notify, notifyStudio } from '@/modules/notify/service';
import { readSignedStages } from '@/modules/portal/payments';
import { signedSitePhotoUrls, storeSitePhoto } from '@/modules/storage/site-photos';
import { recordEvent, recordEventOnce, dedupeKey, type ProjectActor } from './events';
import { staffOn } from './flow-access';
import { fileDecisionOutcome } from './locker';
import {
  checkNewDecision,
  legacyOptionsJson,
  materialSpec,
  pickAllowed,
  pickChanges,
  priceChange,
  type NewDecisionInput,
} from './decision-rules';
import { handoverStage, planMove, type RuleStage, type StageKind } from './project-rules';
import { addWorkingDays, calendarOf, dayToDb, istDay, workingDaysBetween } from './working-days';

export type DecisionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const dueLabel = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');

// ── The studio asks ───────────────────────────────────────────

/**
 * A new decision with its options. `photos[i]` is option i's photo (or null).
 * The customer is told on their phone (push; never WhatsApp for customers).
 */
export async function createDecision(projectId: string, input: NewDecisionInput, photos: (File | null)[] = [], now = new Date()): Promise<DecisionResult> {
  const staff = await staffOn(projectId, 'decision.create');
  if (!staff.ok) return staff;
  const check = checkNewDecision(input, now);
  if (!check.ok) return check;
  const d = check.value;
  if (d.quoteLineId) {
    const line = await prisma.homeMaterial.findFirst({ where: { projectId, quoteLineId: d.quoteLineId }, select: { id: true } });
    if (!line) return { ok: false, error: 'That quote line is not on this project.' };
  }
  const paths: (string | null)[] = [];
  for (const [i] of d.options.entries()) {
    const file = photos[i];
    if (!file || file.size === 0) {
      paths.push(null);
      continue;
    }
    const stored = await storeSitePhoto(projectId, file);
    if (!stored.ok) return { ok: false, error: `Photo for “${d.options[i]!.label}”: ${stored.error}` };
    paths.push(stored.path);
  }
  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.homeDecision.create({
      data: {
        projectId,
        title: d.title,
        why: d.why,
        dueOn: d.dueOn,
        quoteLineId: d.quoteLineId,
        options: legacyOptionsJson(d.options) as unknown as Prisma.InputJsonValue,
        postedById: staff.userId,
        byStudio: staff.byStudio,
      },
      select: { id: true },
    });
    await tx.homeDecisionOption.createMany({
      data: d.options.map((o, i) => ({
        decisionId: row.id,
        sortOrder: i,
        label: o.label,
        detail: o.detail,
        swatch: o.swatch,
        photoPath: paths[i] ?? null,
        deltaPaise: toDb(o.deltaPaise),
        studioCostDeltaPaise: o.studioCostDeltaPaise === null ? null : toDb(o.studioCostDeltaPaise),
      })),
    });
    await recordEvent(tx, { projectId, type: 'decision.posted', actor: staff.actor, refId: row.id, payload: { options: d.options.length, dueDay: d.dueDay, linked: d.quoteLineId !== null } });
    return row.id;
  });
  if (staff.customerId) void notify(staff.customerId, { kind: 'decision-posted', decisionId: id, title: d.title, dueLabel: dueLabel(d.dueOn) });
  return { ok: true, id };
}

// ── The customer picks ────────────────────────────────────────

const PICK_SELECT = {
  id: true,
  projectId: true,
  title: true,
  dueOn: true,
  quoteLineId: true,
  pickedOptionId: true,
  choices: { orderBy: { sortOrder: 'asc' }, select: { id: true, sortOrder: true, label: true, detail: true, deltaPaise: true } },
  project: {
    select: {
      paymentPhases: true,
      introduction: {
        select: {
          studioId: true,
          brief: { select: { userId: true } },
          studio: { select: { workingDays: true, holidays: { select: { day: true } } } },
        },
      },
    },
  },
} as const;

/** Which option was meant: by id (the app since Phase 5) or by index (older apps). */
function chosen<T extends { id: string; sortOrder: number }>(choices: T[], choice: { optionId?: unknown; index?: unknown }): T | null {
  if (typeof choice.optionId === 'string') return choices.find((c) => c.id === choice.optionId) ?? null;
  if (typeof choice.index === 'number' && Number.isInteger(choice.index)) return choices[choice.index] ?? null;
  return null;
}

/**
 * The owner of the brief picks an option. Everything the pick changes is
 * written here, in one transaction; the studio hears about it.
 */
export async function pickOption(userId: string, decisionId: string, choice: { optionId?: unknown; index?: unknown }, now = new Date()): Promise<DecisionResult> {
  const d = await prisma.homeDecision.findUnique({ where: { id: decisionId }, select: PICK_SELECT });
  if (!d || d.project.introduction.brief.userId !== userId) return { ok: false, error: 'That decision is not on your project.' };
  const next = chosen(d.choices, choice);
  if (!next) return { ok: false, error: 'Pick one of the options.' };
  if (next.id === d.pickedOptionId) return { ok: true, id: d.id };
  const allowed = pickAllowed(d, now);
  if (!allowed.ok) return allowed;
  const previous = d.choices.find((c) => c.id === d.pickedOptionId) ?? null;
  const signed = readSignedStages(d.project.paymentPhases);
  const finalStageIndex = signed ? signed.length - 1 : null;
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  const nextDelta = fromDb(next.deltaPaise);

  const result = await prisma.$transaction(async (tx) => {
    // Only from the state we read: two taps at once cannot both write a change.
    const { count } = await tx.homeDecision.updateMany({
      where: { id: d.id, pickedOptionId: d.pickedOptionId },
      data: { pickedOptionId: next.id, chosenIndex: next.sortOrder, chosenAt: now, chosenById: userId },
    });
    if (count === 0) return { changed: false, lateDays: 0 };
    const rows = pickChanges({
      decisionId: d.id,
      title: d.title,
      quoteLineId: d.quoteLineId,
      finalStageIndex,
      previous: previous ? { id: previous.id, label: previous.label, deltaPaise: fromDb(previous.deltaPaise) } : null,
      next: { id: next.id, label: next.label, deltaPaise: nextDelta },
      at: now,
    });
    for (const r of rows) {
      const change = await tx.homeQuoteChange.create({
        data: {
          projectId: d.projectId,
          decisionId: r.decisionId,
          optionId: r.optionId,
          quoteLineId: r.quoteLineId,
          label: r.label,
          deltaPaise: toDb(r.deltaPaise),
          stageIndex: r.stageIndex,
          byId: userId,
          at: r.at,
        },
        select: { id: true },
      });
      await recordEvent(tx, { projectId: d.projectId, type: 'quote.changed', actor, refId: change.id, payload: { decisionId: d.id, deltaPaise: r.deltaPaise, stageIndex: r.stageIndex } });
    }
    if (d.quoteLineId) {
      await tx.homeMaterial.updateMany({ where: { projectId: d.projectId, quoteLineId: d.quoteLineId }, data: { spec: materialSpec(next) } });
    }
    await fileDecisionOutcome(tx, { projectId: d.projectId, decisionId: d.id, title: d.title, option: next.label, price: priceChange(nextDelta), actor, userId });
    await recordEvent(tx, {
      projectId: d.projectId,
      type: 'decision.picked',
      actor,
      refId: d.id,
      payload: { optionId: next.id, deltaPaise: nextDelta, repick: previous !== null, late: allowed.late },
    });
    const lateDays = allowed.late ? await lateDecisionDelay(tx, d, now, actor) : 0;
    return { changed: true, lateDays };
  });
  if (!result.changed) return { ok: false, error: 'Someone just picked on this decision. Pull down to see it.' };

  void notifyStudio(d.project.introduction.studioId, {
    kind: 'decision-made',
    decisionId: d.id,
    title: d.title,
    choice: next.label,
    extraPaise: Math.max(0, nextDelta),
  });
  return {
    ok: true,
    id: d.id,
    message: result.lateDays > 0 ? `Picked ${result.lateDays} working day${result.lateDays === 1 ? '' : 's'} after the date, so the plan moves by that much.` : undefined,
  };
}

/**
 * A first pick after the decide-by date: the working days it was late move
 * the stage the decision belongs to (the stage holding its quote line's
 * checklist item, else the stage under way) and every stage after it, with
 * the decision named — the customer's delay (project-rules.ts
 * `isCustomerDelay`). Returns the days moved.
 */
async function lateDecisionDelay(
  tx: Prisma.TransactionClient,
  d: { id: string; projectId: string; dueOn: Date; quoteLineId: string | null; project: { introduction: { studio: { workingDays: number[]; holidays: { day: Date }[] } } } },
  now: Date,
  actor: ProjectActor,
): Promise<number> {
  const cal = calendarOf({ workingDays: d.project.introduction.studio.workingDays, holidays: d.project.introduction.studio.holidays });
  const days = workingDaysBetween(istDay(d.dueOn), istDay(now), cal);
  if (days <= 0) return 0;
  const rows = await tx.homeProjectStage.findMany({
    where: { projectId: d.projectId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, kind: true, name: true, plannedStart: true, plannedEnd: true, actualEnd: true },
  });
  if (rows.length === 0) return 0;
  const stages: RuleStage[] = rows.map((s) => ({
    id: s.id,
    kind: s.kind as StageKind,
    name: s.name,
    plannedStart: istDay(s.plannedStart),
    plannedEnd: istDay(s.plannedEnd),
    actualEnd: s.actualEnd ? istDay(s.actualEnd) : null,
  }));
  const owning = d.quoteLineId
    ? await tx.homeChecklistItem.findFirst({ where: { quoteLineId: d.quoteLineId, stage: { projectId: d.projectId } }, select: { stageId: true } })
    : null;
  const open = stages.filter((s) => s.actualEnd === null);
  const target = open.find((s) => s.id === owning?.stageId) ?? open[0] ?? handoverStage(stages);
  if (!target || target.actualEnd !== null) return 0;
  const planned = planMove(stages, {
    stageId: target.id,
    field: 'PLANNED_END',
    to: addWorkingDays(target.plannedEnd, days, cal),
    reason: 'CUSTOMER_CHANGE',
    shiftLater: true,
  });
  if (!planned.ok) return 0;
  for (const s of planned.plan.stages) {
    await tx.homeProjectStage.update({ where: { id: s.stageId }, data: { plannedStart: dayToDb(s.plannedStart), plannedEnd: dayToDb(s.plannedEnd) } });
  }
  let leadId: string | null = null;
  for (const r of planned.plan.rows) {
    const row = await tx.homeProjectDateChange.create({
      data: {
        projectId: d.projectId,
        stageId: r.stageId,
        field: r.field,
        fromDate: dayToDb(r.from),
        toDate: dayToDb(r.to),
        reason: 'CUSTOMER_CHANGE',
        decisionId: d.id,
        byId: actor.type === 'SYSTEM' ? 'system' : actor.id,
        at: now,
      },
      select: { id: true },
    });
    leadId ??= row.id;
  }
  await recordEvent(tx, {
    projectId: d.projectId,
    type: 'date.moved',
    actor,
    refId: leadId,
    payload: { stageId: target.id, field: planned.plan.rows[0]!.field, days: planned.plan.days, rows: planned.plan.rows.length, reason: 'CUSTOMER_CHANGE', customer: true, decisionId: d.id },
    at: now,
  });
  return days;
}

/**
 * A family member's vote: advice to the owner, who decides. Written as the
 * option row and the older index, both, while older readers remain.
 */
export async function castVote(userId: string, decisionId: string, choice: { optionId?: unknown; index?: unknown }, note: unknown, now = new Date()): Promise<DecisionResult> {
  const d = await prisma.homeDecision.findFirst({
    where: { id: decisionId, project: { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } } },
    select: { id: true, projectId: true, dueOn: true, pickedOptionId: true, choices: { orderBy: { sortOrder: 'asc' }, select: { id: true, sortOrder: true } } },
  });
  if (!d) return { ok: false, error: 'Only family on this project can vote.' };
  if (d.pickedOptionId) return { ok: false, error: 'This one has been decided.' };
  if (d.dueOn.getTime() < now.getTime()) return { ok: false, error: 'The decide-by date has passed.' };
  const option = chosen(d.choices, choice);
  if (!option) return { ok: false, error: 'Pick one of the options.' };
  const text = typeof note === 'string' ? note.trim().replace(/\s+/g, ' ').slice(0, 120) || null : null;
  await prisma.$transaction(async (tx) => {
    await tx.decisionVote.upsert({
      where: { decisionId_userId: { decisionId: d.id, userId } },
      create: { decisionId: d.id, userId, optionIndex: option.sortOrder, optionId: option.id, note: text },
      update: { optionIndex: option.sortOrder, optionId: option.id, note: text },
    });
    await recordEvent(tx, { projectId: d.projectId, type: 'decision.voted', actor: { type: 'CUSTOMER', id: userId }, refId: d.id, payload: { optionId: option.id } });
  });
  return { ok: true, id: d.id };
}

// ── The daily job ─────────────────────────────────────────────

/**
 * Decisions past their date with no pick: one `decision.expired` event each
 * (once, by dedupe key), and the studio is told that any delay from here is
 * the customer's. Returns how many were newly expired.
 */
export async function expireDecisions(now = new Date()): Promise<number> {
  const overdue = await prisma.homeDecision.findMany({
    where: { pickedOptionId: null, chosenIndex: null, dueOn: { lt: now } },
    select: { id: true, projectId: true, title: true, project: { select: { introduction: { select: { studioId: true } } } } },
    take: 500,
  });
  let n = 0;
  for (const d of overdue) {
    const fresh = await recordEventOnce(prisma, {
      projectId: d.projectId,
      type: 'decision.expired',
      actor: { type: 'SYSTEM' },
      refId: d.id,
      dedupeKey: dedupeKey('decision-expired', d.id),
    });
    if (!fresh) continue;
    n += 1;
    void notifyStudio(d.project.introduction.studioId, { kind: 'decision-expired', decisionId: d.id, title: d.title, projectId: d.projectId });
  }
  return n;
}

// ── What the studio reads ─────────────────────────────────────

export interface StudioDecisionOption {
  id: string;
  label: string;
  detail: string | null;
  photo: string | null;
  swatch: string | null;
  deltaPaise: number;
  /** Only your team; null for a member who may not create decisions, or when not given. */
  studioCostDeltaPaise: number | null;
  votes: number;
}

export interface StudioDecision {
  id: string;
  title: string;
  why: string;
  dueOn: string;
  state: 'open' | 'late' | 'picked';
  pickedOptionId: string | null;
  pickedAt: string | null;
  options: StudioDecisionOption[];
}

export interface StudioDecisions {
  projectId: string;
  decisions: StudioDecision[];
  canCreate: boolean;
}

/** A project's decisions for the studio's workspace (`project.read`); studio costs only for those who may create decisions. */
export async function studioDecisions(projectId: string, now = new Date()): Promise<StudioDecisions | null> {
  const staff = await staffOn(projectId, 'project.read');
  if (!staff.ok) return null;
  const costs = staff.may('decision.create');
  const rows = await prisma.homeDecision.findMany({
    where: { projectId },
    orderBy: { dueOn: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      why: true,
      dueOn: true,
      chosenAt: true,
      pickedOptionId: true,
      votes: { select: { optionId: true } },
      choices: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, detail: true, photoPath: true, swatch: true, deltaPaise: true, studioCostDeltaPaise: true },
      },
    },
  });
  const decisions: StudioDecision[] = [];
  for (const d of rows) {
    const withPhoto = d.choices.filter((c) => c.photoPath);
    const urls = withPhoto.length ? await signedSitePhotoUrls(withPhoto.map((c) => c.photoPath!)) : [];
    const photoOf = new Map(urls.length === withPhoto.length ? withPhoto.map((c, i) => [c.id, urls[i]!]) : []);
    decisions.push({
      id: d.id,
      title: d.title,
      why: d.why,
      dueOn: d.dueOn.toISOString(),
      state: d.pickedOptionId ? 'picked' : d.dueOn.getTime() < now.getTime() ? 'late' : 'open',
      pickedOptionId: d.pickedOptionId,
      pickedAt: d.chosenAt?.toISOString() ?? null,
      options: d.choices.map((c) => ({
        id: c.id,
        label: c.label,
        detail: c.detail,
        photo: photoOf.get(c.id) ?? null,
        swatch: c.swatch,
        deltaPaise: fromDb(c.deltaPaise),
        studioCostDeltaPaise: costs && c.studioCostDeltaPaise !== null ? fromDb(c.studioCostDeltaPaise) : null,
        votes: d.votes.filter((v) => v.optionId === c.id).length,
      })),
    });
  }
  return { projectId, decisions, canCreate: costs };
}

export interface NewDecisionContext {
  projectId: string;
  home: string;
  customerFirst: string;
  /** Family who joined: they can vote. */
  family: string[];
  /** The quote lines a decision can change: each material from the signed quote. */
  lines: { quoteLineId: string; room: string; item: string; spec: string | null }[];
  /** A sensible decide-by date: a week from today. */
  suggestedDue: string;
  today: string;
}

/** What the New decision screen needs, for a member who may create one. */
export async function newDecisionContext(projectId: string, now = new Date()): Promise<({ ok: true } & NewDecisionContext) | { ok: false; error: string }> {
  const staff = await staffOn(projectId, 'decision.create');
  if (!staff.ok) return staff;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      introduction: { select: { brief: { select: { society: true, locality: true, contactName: true, user: { select: { name: true } } } } } },
      family: { where: { joinedAt: { not: null }, removedAt: null }, select: { name: true } },
      materials: { where: { quoteLineId: { not: null } }, orderBy: { sortOrder: 'asc' }, take: 200, select: { quoteLineId: true, room: true, item: true, spec: true } },
    },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const b = p.introduction.brief;
  const name = b.contactName?.trim() || b.user?.name?.trim() || 'Your customer';
  const today = istDay(now);
  return {
    ok: true,
    projectId,
    home: [b.society, b.locality].filter(Boolean).join(', ') || 'The project',
    customerFirst: name.split(/\s+/)[0] ?? name,
    family: p.family.map((f) => f.name.split(/\s+/)[0] ?? f.name),
    lines: p.materials.map((m) => ({ quoteLineId: m.quoteLineId!, room: m.room, item: m.item, spec: m.spec })),
    suggestedDue: istDay(new Date(now.getTime() + 7 * 86_400_000)),
    today,
  };
}
