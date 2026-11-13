import 'server-only';

/**
 * Expected closing and the on-site carcass flag (owner, 13 Nov 2026), the
 * reads and the one write. Rules in ./expected-closing.ts.
 *
 * Who: `maySeeClosing` (owner, design head, a PM on their projects). The list
 * is `projectsVisibleTo(member)`, never a cancelled project; the flag is set
 * on a project the member is on (`memberOnProject`, `plan.edit` for a PM).
 */

import { prisma } from '@/lib/prisma';
import { recordEvent } from '@/modules/project/events';
import { istDay } from '@/modules/project/working-days';
import { currentMember, memberOnProject, projectsVisibleTo } from './access';
import { siteLabel } from './team-rules';
import { closingList, closingRow, isRunningPhase, mayFlagCarcass, maySeeClosing, RUNNING_PHASES, targetDay, type ClosingList } from './expected-closing';

const CATEGORY_WORD: Record<string, string> = { ESSENTIAL: 'Essential', PREMIUM: 'Premium', LUXURY: 'Luxe' };

export interface ClosingPage extends ClosingList {
  canFlag: boolean;
}

/** The Expected closing list for the signed-in member; null when they may not see it. */
export async function expectedClosing(rawBy: string | undefined, now = new Date()): Promise<ClosingPage | null> {
  const member = await currentMember();
  if (!member || !maySeeClosing(member)) return null;
  const projects = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member), cancelledAt: null, phase: { in: [...RUNNING_PHASES] } },
    take: 500,
    select: {
      id: true,
      phase: true,
      category: true,
      onSiteCarcass: true,
      designer: { select: { user: { select: { name: true } } } },
      holds: { where: { status: 'ON' }, take: 1, select: { id: true } },
      stages: { orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, name: true, plannedStart: true, plannedEnd: true, actualEnd: true } },
      dateChanges: { orderBy: [{ at: 'asc' }, { id: 'asc' }], select: { stageId: true, field: true, fromDate: true, toDate: true, reason: true, decisionId: true, at: true } },
      introduction: {
        select: {
          studio: { select: { workingDays: true, holidays: { select: { day: true } } } },
          brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } },
        },
      },
    },
  });
  const rows = projects.flatMap((p) => {
    if (!isRunningPhase(p.phase)) return [];
    const b = p.introduction.brief;
    const row = closingRow(
      {
        id: p.id,
        client: b.contactName?.trim() || b.user?.name?.trim() || 'Client',
        home: siteLabel(b),
        phase: p.phase,
        designer: p.designer?.user.name ?? null,
        category: p.category ? (CATEGORY_WORD[p.category] ?? null) : null,
        onHold: p.holds.length > 0,
        onSiteCarcass: p.onSiteCarcass,
        planStages: p.stages,
        dateChanges: p.dateChanges,
        calendar: p.introduction.studio,
      },
      now,
    );
    return row ? [row] : [];
  });
  return { ...closingList(rows, targetDay(rawBy, istDay(now))), canFlag: mayFlagCarcass(member) };
}

export type CarcassResult = { ok: true; message: string } | { ok: false; error: string };

/** The project page's flag: whether it shows, and whether this member may change it. */
export async function carcassFor(projectId: string): Promise<{ on: boolean; canFlag: boolean } | null> {
  const check = await memberOnProject(projectId, 'project.read');
  if (!check.ok) return null;
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { onSiteCarcass: true } });
  if (!p) return null;
  const canFlag = mayFlagCarcass(check.member) && (check.member.role !== 'PM' || check.access.may('plan.edit'));
  return { on: p.onSiteCarcass, canFlag };
}

/** Sets or clears "On-site carcass (shutters from factory)", with a project event in the same transaction. */
export async function setOnSiteCarcass(projectId: string, on: boolean, now = new Date()): Promise<CarcassResult> {
  const check = await memberOnProject(projectId, 'project.read');
  if (!check.ok) return check;
  const { member } = check;
  if (!mayFlagCarcass(member) || (member.role === 'PM' && !check.access.may('plan.edit'))) {
    return { ok: false, error: 'Only the owner, the design head or the project manager sets this.' };
  }
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeProject.updateMany({ where: { id: projectId, onSiteCarcass: !on }, data: { onSiteCarcass: on } });
    if (count !== 1) return false;
    await recordEvent(tx, { projectId, type: 'project.carcass_set', actor: { type: 'STUDIO', id: member.userId }, payload: { onSiteCarcass: on }, at: now });
    return true;
  });
  if (!changed) return { ok: true, message: 'Already set.' };
  return { ok: true, message: on ? 'Marked: carcass on site, shutters from the factory.' : 'Cleared: everything from the factory.' };
}
