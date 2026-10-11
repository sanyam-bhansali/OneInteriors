/**
 * The customer's site feed from the daily site log (studio workspace
 * Phase 2): the select and the mapping, pure, called from
 * customer-project-view.ts in one line each. Brief §5, left column only:
 *
 * - photos, each with the sentence under it in the customer's language, the
 *   time it was taken, and "from gallery" when it was not taken in the app;
 * - crew: first name, role and arrival time — never the phone, never the
 *   crew member's id;
 * - nobody-on-site days with the reason (as a slug the apps translate, and
 *   plain English for the website), and whether it counts against the studio;
 * - corrections beside the day's original, never instead of it;
 * - the checklist items ticked off that day (room and label), and, on a
 *   photo that ticked a step (the step tracker), the step's name — "Done:
 *   {step}" under it, with the time it was taken;
 * - working days with no post by 21:00 IST ("No update from the studio
 *   today").
 *
 * Never selected: `note`, `voicePath`, `transcript`, `transcriptLang`,
 * `lat`/`lng`, `postedById`, `clientRef`, `crewMember` (and so its phone),
 * `doneById`, the step's `donePhotoId` or weight. tests/customer-projection.test.ts
 * checks the select and the output.
 */

import type { Prisma } from '@prisma/client';
import { activeSinceOf, missedDays, needsDailyPost } from '@/modules/project/reminder-rules';
import { REASON_WORDS, countsAgainstStudio, crewFirstName, isNobodyReason, reasonSlug } from '@/modules/project/site-log-rules';
import { addDays, calendarOf, dayFromDb, istDay } from '@/modules/project/working-days';

/** About two months of daily posts and their corrections. */
export const SITE_LOGS_SHOWN = 60;
/** How far back the feed lists working days with no post. */
export const MISSED_WINDOW_DAYS = 14;

export const SITE_LOG_SELECT = {
  orderBy: [{ date: 'desc' }, { postedAt: 'asc' }],
  take: SITE_LOGS_SHOWN,
  select: {
    id: true,
    date: true,
    kind: true,
    reason: true,
    postedAt: true,
    correctsId: true,
    /* The "Say something else" sentence. Its recording and transcript are not read. */
    customerText: true,
    customerLang: true,
    photos: {
      orderBy: { sortOrder: 'asc' },
      select: {
        storagePath: true,
        takenAt: true,
        fromGallery: true,
        customerText: true,
        customerLang: true,
        /* The step this photo ticked: its name only. */
        doneStep: { select: { label: true } },
      },
    },
    crew: { orderBy: { createdAt: 'asc' }, select: { crewName: true, crewRole: true, arrivedAt: true } },
    ticked: { orderBy: { sortOrder: 'asc' }, select: { room: true, label: true } },
  },
} satisfies Prisma.HomeProject$siteLogsArgs;

export type SiteLogRow = Prisma.HomeSiteLogGetPayload<{ select: typeof SITE_LOG_SELECT.select }>;

export interface CustomerSitePhoto {
  /** A signed link that lasts minutes; "" when it could not be made (the sentence still shows). */
  url: string;
  /** The sentence under the photo, in the customer's language; null when none was said. */
  text: string | null;
  takenAt: string;
  fromGallery: boolean;
  /** The step this photo ticked ("Done: {step}"), or null. The apps add "Done:" in the customer's language. */
  doneStep: string | null;
}

export interface CustomerSiteEntry {
  id: string;
  kind: 'update' | 'nobody' | 'correction';
  postedAt: string;
  /** Nobody on site: 'waiting-material', 'waiting-customer-decision', 'crew-elsewhere', 'holiday', 'customer-asked', 'other'. */
  reason: string | null;
  /** The same in plain English, for the website. */
  reasonText: string | null;
  /** Nobody on site only: false for waiting on the customer's decision, or the customer asking. */
  countsAgainstStudio: boolean | null;
  /** The sentence not about any one photo. */
  text: string | null;
  photos: CustomerSitePhoto[];
  crew: { name: string; role: string; arrivedAt: string | null }[];
  /** Checklist items ticked off in this post. */
  done: { room: string; label: string }[];
}

export interface CustomerSiteDay extends CustomerSiteEntry {
  /** The IST day, 'YYYY-MM-DD'. */
  day: string;
  /** Later posts that day, shown beside this one. */
  corrections: CustomerSiteEntry[];
}

function entry(l: SiteLogRow, urls: readonly string[]): CustomerSiteEntry {
  const reason = l.reason && isNobodyReason(l.reason) ? l.reason : null;
  return {
    id: l.id,
    kind: l.kind === 'NOBODY' ? 'nobody' : l.kind === 'CORRECTION' ? 'correction' : 'update',
    postedAt: l.postedAt.toISOString(),
    reason: reason ? reasonSlug(reason) : null,
    reasonText: reason ? REASON_WORDS[reason] : null,
    countsAgainstStudio: reason ? countsAgainstStudio(reason) : null,
    text: l.customerText,
    photos: l.photos.map((p, i) => ({
      url: urls[i] ?? '',
      text: p.customerText,
      takenAt: p.takenAt.toISOString(),
      fromGallery: p.fromGallery,
      doneStep: p.doneStep?.label ?? null,
    })),

    crew: l.crew.map((c) => ({ name: crewFirstName(c.crewName), role: c.crewRole, arrivedAt: c.arrivedAt?.toISOString() ?? null })),
    done: l.ticked.map((t) => ({ room: t.room, label: t.label })),
  };
}

/** The site log as days, newest first, each original with its corrections beside it. `urls[i][j]` is log i's photo j. */
export function siteDays(rows: readonly SiteLogRow[], urls: readonly (readonly string[])[] = []): CustomerSiteDay[] {
  const days: CustomerSiteDay[] = [];
  const byId = new Map<string, CustomerSiteDay>();
  const orphans: { row: SiteLogRow; i: number }[] = [];
  rows.forEach((l, i) => {
    if (l.kind === 'CORRECTION') {
      orphans.push({ row: l, i });
      return;
    }
    const d: CustomerSiteDay = { ...entry(l, urls[i] ?? []), day: dayFromDb(l.date), corrections: [] };
    days.push(d);
    byId.set(l.id, d);
  });
  for (const { row, i } of orphans) {
    const parent = row.correctsId ? byId.get(row.correctsId) : undefined;
    if (parent) parent.corrections.push(entry(row, urls[i] ?? []));
    // Its original is older than the feed goes back: show it on its own day.
    else days.push({ ...entry(row, urls[i] ?? []), day: dayFromDb(row.date), corrections: [] });
  }
  for (const d of days) d.corrections.sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));
  return days.sort((a, b) => (a.day === b.day ? Date.parse(b.postedAt) - Date.parse(a.postedAt) : a.day < b.day ? 1 : -1));
}

/**
 * Working days of the last two weeks with nothing posted by 21:00 IST —
 * neither a site-log post nor an update from ops. Counted from the day
 * site work started (reminder-rules.ts `activeSinceOf`), and only while it
 * is under way.
 */
export function siteMissedDays(
  p: {
    startOn: Date;
    stages: readonly { kind: string; actualEnd: Date | null }[];
    doneStages?: readonly string[];
    studio: { workingDays?: unknown; holidays?: readonly { day: Date }[] } | null;
    siteLogs: readonly { date: Date; kind: string }[];
    updates?: readonly { createdAt: Date }[];
  },
  now: Date,
): string[] {
  const stages = p.stages ?? [];
  if (!needsDailyPost({ startOn: p.startOn, now, stages, doneStages: p.doneStages })) return [];
  const posted = new Set<string>([...p.siteLogs.map((l) => dayFromDb(l.date)), ...(p.updates ?? []).map((u) => istDay(u.createdAt))]);
  const firstPostDay = [...posted].sort()[0] ?? null;
  const today = istDay(now);
  return missedDays(addDays(today, -(MISSED_WINDOW_DAYS - 1)), today, {
    now,
    calendar: calendarOf({ workingDays: p.studio?.workingDays, holidays: p.studio?.holidays ?? [] }),
    postedDays: posted,
    activeSince: activeSinceOf({ startOn: p.startOn, stages, firstPostDay }),
  });
}
