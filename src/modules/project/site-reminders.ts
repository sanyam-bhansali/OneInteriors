import 'server-only';

/**
 * The daily-update reminders, run by the cron (`/api/cron/site-reminders`,
 * 18:00 and 21:00 IST). Which reminder is due is decided by the pure
 * reminder-rules.ts; this file reads the projects, sends, and records each
 * reminder once with `recordEventOnce` (dedupe key per project, day and
 * kind), so a cron that runs twice or late never sends twice.
 *
 * - supervisor (18:00): WhatsApp/SMS through the studio MessageSender to the
 *   supervisors on the project (or its PMs, or the owner, when no
 *   supervisor is assigned). WhatsApp is fine for studio staff.
 * - flag (21:00): a `reminder.flagged` event, and an in-app notice to the
 *   office people on the project. The office's "Needs attention today" and
 *   the customer's "No update from the studio today" are computed from the
 *   site log itself, so they need nothing else.
 * - owner (21:00, second missed working day in a row): MessageSender to the
 *   studio's owners.
 * - ops (21:00, Assured projects): One Interiors ops, who call the studio.
 */

import { prisma } from '@/lib/prisma';
import { send } from '@/modules/messaging/sender';
import { notify, notifyOps } from '@/modules/notify/service';
import { siteUrlFor } from '@/lib/site';
import { homeLabel } from '@/modules/studio/workspace-view';
import { dedupeKey, recordEventOnce } from './events';
import { activeSinceOf, needsDailyPost, reminderParts, remindersDue, updateScore, type DueReminder } from './reminder-rules';
import { addDays, calendarOf, dayFromDb, dayToDb, istDay } from './working-days';

export interface ReminderRun {
  projects: number;
  sent: Record<DueReminder['kind'], number>;
}

const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || 'Hello';

export async function runSiteReminders(now = new Date()): Promise<ReminderRun> {
  const today = istDay(now);
  const since = addDays(today, -14);
  const projects = await prisma.homeProject.findMany({
    where: { startOn: { lte: now } },
    select: {
      id: true,
      plan: true,
      startOn: true,
      doneStages: true,
      stages: { orderBy: { sortOrder: 'asc' }, select: { kind: true, actualEnd: true } },
      siteLogs: { where: { date: { gte: dayToDb(since) }, kind: { in: ['UPDATE', 'NOBODY'] } }, select: { date: true } },
      team: { select: { member: { select: { role: true, status: true, user: { select: { id: true, name: true, phone: true } } } } } },
      introduction: {
        select: {
          brief: { select: { society: true, locality: true, propertyType: true } },
          studio: {
            select: {
              id: true,
              tradeName: true,
              workingDays: true,
              holidays: { where: { day: { gte: dayToDb(since) } }, select: { day: true } },
              members: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { user: { select: { id: true, name: true, phone: true } } } },
            },
          },
        },
      },
    },
    take: 2000,
  });

  const sent: ReminderRun['sent'] = { supervisor: 0, flag: 0, owner: 0, ops: 0 };
  const link = `${siteUrlFor('studio')}/studio/site`;

  for (const p of projects) {
    if (!needsDailyPost({ startOn: p.startOn, now, stages: p.stages, doneStages: p.doneStages })) continue;
    const studio = p.introduction.studio;
    const calendar = calendarOf(studio);
    const postedDays = new Set(p.siteLogs.map((l) => dayFromDb(l.date)));
    const firstPostDay = [...postedDays].sort()[0] ?? null;
    const input = {
      now,
      calendar,
      postedDays,
      activeSince: activeSinceOf({ startOn: p.startOn, stages: p.stages, firstPostDay }),
      active: true,
      plan: p.plan === 'ASSURED' ? ('ASSURED' as const) : ('BASIC' as const),
    };
    const due = remindersDue(input);
    if (due.length === 0) continue;
    const home = homeLabel(p.introduction.brief);
    const active = p.team.map((t) => t.member).filter((m) => m.status === 'ACTIVE');
    const supervisors = active.filter((m) => m.role === 'SUPERVISOR');
    const pms = active.filter((m) => m.role === 'PM');
    const owners = studio.members.map((m) => ({ role: 'OWNER' as const, status: 'ACTIVE' as const, user: m.user }));
    const missedInRow = updateScore(input, 14).streakMissed;

    for (const r of due) {
      const written = await recordEventOnce(prisma, {
        projectId: p.id,
        type: r.kind === 'flag' ? 'reminder.flagged' : 'reminder.sent',
        actor: { type: 'SYSTEM' },
        payload: { day: r.day, to: r.kind },
        dedupeKey: dedupeKey(...reminderParts(p.id, r)),
      });
      if (!written) continue;
      sent[r.kind] += 1;
      if (r.kind === 'supervisor') {
        const to = supervisors.length ? supervisors : pms.length ? pms : owners;
        await Promise.all(
          to.filter((m) => m.user.phone).map((m) => send(m.user.phone!, { kind: 'site-reminder', name: first(m.user.name), home, link })),
        );
      } else if (r.kind === 'flag') {
        const office = [...pms, ...owners];
        const ids = [...new Set(office.map((m) => m.user.id))];
        await Promise.all(
          ids.map((id) => notify(id, { kind: 'site-missed', projectId: p.id, home, studio: studio.tradeName, days: missedInRow, toOps: false }, { email: false })),
        );
      } else if (r.kind === 'owner') {
        await Promise.all(
          owners
            .filter((m) => m.user.phone)
            .map((m) => send(m.user.phone!, { kind: 'site-missed', name: first(m.user.name), home, days: Math.max(2, missedInRow), link })),
        );
      } else {
        await notifyOps({ kind: 'site-missed', projectId: p.id, home, studio: studio.tradeName, days: missedInRow, toOps: true });
      }
    }
  }
  return { projects: projects.length, sent };
}
