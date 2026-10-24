import 'server-only';

/**
 * Moving running projects to the new design steps (owner and Hauspire's
 * design team, 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md Decision
 * 12). Once, on the day the studio starts: for each project in design, the
 * team picks the step it is at now. Its design stage gets the studio's
 * steps (Hauspire's 26 by default), every step before the one picked
 * ticked as done before the switch (no photo, no file, marked so), the
 * picked step planned for today and the rest linked after it by their days.
 * The old steps are replaced; how many there were, and how many were done,
 * stay in the project's history (`design.steps_switched`).
 *
 * Owner or the PM on the project (`plan.edit`). A project already on the
 * new steps is shown as done, not offered again.
 */

import { prisma } from '@/lib/prisma';
import { currentMember, memberOnProject } from '@/modules/studio/access';
import { can, projectsVisibleTo } from '@/modules/studio/roles';
import { recordEvent, type ProjectActor } from '@/modules/project/events';
import { settleStageAfterTicks } from '@/modules/project/stage-settle';
import { addDays, dayFromDb, dayToDb, daysBetween, istDay } from '@/modules/project/working-days';
import { readSignedStages } from '@/modules/portal/payments';
import { designStepsFor } from '@/modules/portal/quote-to-plan';
import { homeLabel } from '@/modules/studio/workspace-view';
import { designItemData } from './design-flow';
import { settleDesignPhase } from './step-settle';
import { bhkOf, PRE_EXECUTION_GROUP, readDesignTemplate } from './template';

export interface SwitchRow {
  projectId: string;
  home: string;
  client: string;
  designer: string | null;
  phase: string;
  /** Already on the new steps (any step carries an effort). */
  switched: boolean;
  /** The step the old plan is at: its first open step, for a hint. */
  oldAt: string | null;
  oldDone: number;
  oldTotal: number;
}

export interface SwitchView {
  rows: SwitchRow[];
  /** The step names a project can be placed at, in order. */
  steps: { label: string; group: string }[];
  /** The studio saved its own steps without a pre-execution part: probably the old ones. */
  oldTemplate: boolean;
  isOwner: boolean;
}

export async function switchView(): Promise<SwitchView | null> {
  const member = await currentMember();
  if (!member || !can(member, 'plan.edit', { assigned: true })) return null;
  const studio = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { designTemplate: true } });
  const template = readDesignTemplate(studio?.designTemplate ?? null);
  const projects = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member), cancelledAt: null, phase: { in: ['DESIGN', 'PRE_EXECUTION'] } },
    orderBy: { startOn: 'desc' },
    take: 300,
    select: {
      id: true,
      phase: true,
      designer: { select: { user: { select: { name: true } } } },
      introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } },
      stages: { where: { kind: 'DESIGN' }, take: 1, select: { items: { orderBy: { sortOrder: 'asc' }, select: { label: true, doneAt: true, inScope: true, effortMin: true } } } },
    },
  });
  const rows: SwitchRow[] = projects.map((p) => {
    const items = p.stages[0]?.items ?? [];
    const b = p.introduction.brief;
    return {
      projectId: p.id,
      home: homeLabel(b),
      client: b.contactName?.trim() || b.user?.name?.trim() || 'Client',
      designer: p.designer?.user.name?.trim() || null,
      phase: p.phase,
      switched: items.some((i) => i.effortMin !== null),
      oldAt: items.find((i) => i.inScope && !i.doneAt)?.label ?? null,
      oldDone: items.filter((i) => i.doneAt).length,
      oldTotal: items.length,
    };
  });
  return {
    rows,
    steps: template.map((t) => ({ label: t.label, group: t.group })),
    oldTemplate: Boolean(studio?.designTemplate) && !template.some((t) => t.group === PRE_EXECUTION_GROUP),
    isOwner: can(member, 'design.template'),
  };
}

export type SwitchResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * One project onto the studio's steps, placed at step `at` (0 = the first
 * step; the number of steps = every step done). Today is the picked step's
 * day.
 */
export async function switchProjectSteps(projectId: string, rawAt: unknown, now = new Date()): Promise<SwitchResult> {
  const check = await memberOnProject(projectId, 'plan.edit');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: {
      phase: true,
      cancelledAt: true,
      paymentPhases: true,
      introduction: { select: { studio: { select: { designTemplate: true } }, brief: { select: { propertyType: true } } } },
      stages: { where: { kind: 'DESIGN' }, take: 1, select: { id: true, items: { select: { id: true, doneAt: true, effortMin: true } } } },
    },
  });
  const stage = p?.stages[0];
  if (!p || p.cancelledAt || !stage) return { ok: false, error: 'This project has no design stage.' };
  if (p.phase !== 'DESIGN' && p.phase !== 'PRE_EXECUTION') return { ok: false, error: 'This project is past design already.' };
  if (stage.items.some((i) => i.effortMin !== null)) return { ok: false, error: 'This project is on the new steps already.' };
  const template = readDesignTemplate(p.introduction.studio.designTemplate);
  const at = Number(rawAt);
  if (!Number.isInteger(at) || at < 0 || at > template.length) return { ok: false, error: 'Pick the step this project is at now.' };

  // The picked step falls on today: the plan starts as many days earlier as the steps before it take.
  const today = istDay(now);
  const probe = designStepsFor(dayToDb(today), template, readSignedStages(p.paymentPhases) ?? [], bhkOf(p.introduction.brief.propertyType));
  const anchor = at < probe.length ? probe[at]! : probe.at(-1)!;
  const start = addDays(today, -Math.max(0, daysBetween(today, dayFromDb(anchor.plannedOn!))));
  const steps = designStepsFor(dayToDb(start), template, readSignedStages(p.paymentPhases) ?? [], bhkOf(p.introduction.brief.propertyType));
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  const oldDone = stage.items.filter((i) => i.doneAt).length;

  await prisma.$transaction(
    async (tx) => {
      await tx.homeChecklistItem.deleteMany({ where: { stageId: stage.id } });
      for (const [k, st] of steps.entries()) {
        const made = await tx.homeChecklistItem.create({ data: designItemData(stage.id, st), select: { id: true } });
        if (k < at) {
          await tx.homeChecklistItem.update({
            where: { id: made.id },
            data: { doneAt: now, doneById: check.member.userId, doneSource: 'BEFORE_JOINING', doneNote: 'Done before the switch to the new design steps.' },
          });
        }
      }
      const end = steps.at(-1)?.plannedOn ?? dayToDb(today);
      await tx.homeProjectStage.update({ where: { id: stage.id }, data: { plannedStart: dayToDb(start), plannedEnd: end } });
      await recordEvent(tx, { projectId, type: 'design.steps_switched', actor, refId: stage.id, at: now, payload: { oldSteps: stage.items.length, oldDone, at, steps: steps.length } });
      await settleStageAfterTicks(tx, projectId, stage.id, actor, now);
      await settleDesignPhase(tx, projectId, actor, now);
    },
    { timeout: 30_000 },
  );
  const where = at >= steps.length ? 'with every step done' : `at “${steps[at]!.label}”, planned for today`;
  return { ok: true, message: `On the new steps, ${where}.` };
}
