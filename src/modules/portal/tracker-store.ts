import 'server-only';

/**
 * The project tracker in the database — started, advanced and annotated by
 * ops, read by the customer. Rules in tracker.ts.
 */

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { readProfile } from '@/modules/studio/matching-profile';
import { durationFor, plannedStages, STAGE_KEYS, trackerView, UPDATE_MAX, type StageView } from './tracker';

export type TrackerResult = { ok: true } | { ok: false; error: string };

/**
 * Start the tracker for an introduction that became a signed project.
 *
 * Also records the win (QuoteDecision.wonByStudioId), because a started
 * project IS the customer signing with that studio — the benefits pass and
 * the matching record both read it from there.
 */
export async function startTracker(introductionId: string, startOn: string): Promise<TrackerResult> {
  await requireRole('OPS');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn)) return { ok: false, error: 'A start date, please.' };
  const intro = await prisma.introduction.findUnique({
    where: { id: introductionId },
    select: {
      briefId: true,
      studioId: true,
      brief: { select: { scope: true } },
      studio: { select: { matchingProfile: true } },
      homeProject: { select: { id: true } },
    },
  });
  if (!intro) return { ok: false, error: 'That introduction is gone.' };
  if (intro.homeProject) return { ok: true };
  const days = durationFor(intro.brief.scope, readProfile(intro.studio.matchingProfile).durationDays);
  await prisma.$transaction([
    prisma.homeProject.create({ data: { introductionId, startOn: new Date(`${startOn}T00:00:00Z`), totalDays: days } }),
    prisma.quoteDecision.upsert({
      where: { briefId: intro.briefId },
      create: { briefId: intro.briefId, wonByStudioId: intro.studioId, outcomeSource: 'OPS_RECORDED', decidedAt: new Date() },
      update: { wonByStudioId: intro.studioId, outcomeSource: 'OPS_RECORDED', decidedAt: new Date() },
    }),
  ]);
  return { ok: true };
}

export async function setStageDone(projectId: string, stage: string, done: boolean): Promise<TrackerResult> {
  await requireRole('OPS');
  if (!(STAGE_KEYS as readonly string[]).includes(stage)) return { ok: false, error: 'Unknown stage.' };
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { doneStages: true } });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const next = done ? [...new Set([...project.doneStages, stage])] : project.doneStages.filter((s) => s !== stage);
  await prisma.homeProject.update({ where: { id: projectId }, data: { doneStages: next } });
  return { ok: true };
}

export async function postUpdate(projectId: string, note: string, stage: string | null): Promise<TrackerResult> {
  const actor = await requireRole('OPS');
  const text = note.trim();
  if (text.length < 3) return { ok: false, error: 'Say what happened.' };
  if (text.length > UPDATE_MAX) return { ok: false, error: `At most ${UPDATE_MAX} characters.` };
  await prisma.homeProjectUpdate.create({
    data: {
      projectId,
      note: text,
      stage: stage && (STAGE_KEYS as readonly string[]).includes(stage) ? stage : null,
      postedById: actor.id,
    },
  });
  return { ok: true };
}

export interface TrackerForCustomer {
  studioName: string;
  stages: StageView[];
  updates: { note: string; stage: string | null; at: Date }[];
}

/** The customer's view of every project on their brief. Never throws into the page. */
export async function trackersForBrief(briefId: string, now = new Date()): Promise<TrackerForCustomer[]> {
  try {
    const projects = await prisma.homeProject.findMany({
      where: { introduction: { briefId } },
      include: {
        introduction: { select: { studio: { select: { tradeName: true } } } },
        updates: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    return projects.map((p) => ({
      studioName: p.introduction.studio.tradeName,
      stages: trackerView(plannedStages(p.startOn, p.totalDays), p.doneStages, now),
      updates: p.updates.map((u) => ({ note: u.note, stage: u.stage, at: u.createdAt })),
    }));
  } catch {
    return [];
  }
}
