import 'server-only';

/**
 * Today — the reads (Studio OS Phase 1). The list itself is built by the
 * pure `today-rules.ts`; this file fetches what it needs for one member,
 * scoped to the leads they may see (studio/lead-scope.ts), and sends the
 * morning email (the cron in app/api/cron/today-email).
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { resolveSiteUrl } from '@/lib/site';
import { sendNotice } from '@/modules/auth/email';
import { leadsVisibleTo, quotesVisibleTo, type MemberRole } from '@/modules/studio/roles';
import { myLeadScope } from '@/modules/studio/lead-scope';
import { buildToday, todayEmail, type TodayBooking, type TodayLead, type TodayQuote, type TodaySection } from './today-rules';

interface Who extends MemberRole {
  id: string;
  studioId: string;
}

/** Everything `buildToday` needs for one member. */
async function todayInput(who: Who, now: Date): Promise<{ leads: TodayLead[]; quotes: TodayQuote[]; bookings: TodayBooking[] }> {
  const studioId = who.studioId;
  const [leadRows, quoteRows] = await Promise.all([
    prisma.studioClient.findMany({
      where: { ...leadsVisibleTo(who), studioId, deletedAt: null, isDemo: false, stage: { kind: { in: ['OPEN', 'WON'] } } },
      orderBy: { updatedAt: 'desc' },
      take: 600,
      select: {
        id: true,
        name: true,
        phone: true,
        assignedToId: true,
        assignedTo: { select: { user: { select: { name: true, email: true } } } },
        stage: { select: { kind: true } },
        nextAction: true,
        nextActionOn: true,
        lastContactedAt: true,
        meetingAt: true,
        meetingNote: true,
        bookedAt: true,
        bookedIntroductionId: true,
        _count: { select: { quotes: true, files: { where: { kind: 'FLOOR_PLAN' } } } },
      },
    }),
    prisma.studioQuote.findMany({
      where: { ...quotesVisibleTo(who), studioId, status: 'ISSUED', revisions: { some: {} } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        number: true,
        status: true,
        clientId: true,
        clientName: true,
        salesFinalRevisionId: true,
        client: { select: { bookedIntroductionId: true, isDemo: true } },
        revisions: { orderBy: { n: 'desc' }, take: 1, select: { n: true, sentAt: true } },
      },
    }),
  ]);
  const weekAgo = new Date(now.getTime() - 8 * 86_400_000);
  const booked = leadRows.filter((l) => l.bookedAt && l.bookedAt >= weekAgo && l.bookedIntroductionId);
  const advances = booked.length
    ? await prisma.homeProject.findMany({
        where: { introductionId: { in: booked.map((b) => b.bookedIntroductionId!) }, introduction: { studioId } },
        select: { introductionId: true, payments: { where: { stageIndex: 0, corrections: { none: {} } }, select: { amountPaise: true } } },
      })
    : [];
  const advanceBy = new Map(advances.map((a) => [a.introductionId, a.payments.reduce((n, p) => n + fromDb(p.amountPaise), 0)]));

  return {
    leads: leadRows.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      assignedToId: l.assignedToId,
      assignedToName: l.assignedTo ? l.assignedTo.user.name?.trim() || l.assignedTo.user.email?.split('@')[0] || 'Someone' : null,
      stageKind: l.stage.kind,
      nextAction: l.nextAction,
      nextActionOn: l.nextActionOn,
      lastContactedAt: l.lastContactedAt,
      meetingAt: l.meetingAt,
      meetingNote: l.meetingNote,
      hasFloorPlan: l._count.files > 0,
      quoteCount: l._count.quotes,
      isDemo: false,
      booked: l.bookedIntroductionId !== null,
    })),
    quotes: quoteRows
      .filter((q) => !q.client?.isDemo)
      .map((q) => ({
        id: q.id,
        number: q.number,
        clientId: q.clientId,
        clientName: q.clientName,
        status: q.status,
        latestRevision: q.revisions[0]?.n ?? null,
        lastSentAt: q.revisions[0]?.sentAt ?? null,
        hasSalesFinal: q.salesFinalRevisionId !== null,
        booked: q.client?.bookedIntroductionId != null,
      })),
    bookings: booked.map((b) => ({ clientId: b.id, name: b.name, bookedAt: b.bookedAt!, amountPaise: advanceBy.get(b.bookedIntroductionId!) ?? null })),
  };
}

export interface TodayView {
  sections: TodaySection[];
  seesAll: boolean;
  /** People a pool lead can be given to (owner and PM see this). */
  members: { id: string; name: string }[];
  meId: string;
}

/** The signed-in member's Today, or null when they may not see leads. */
export async function myToday(now = new Date()): Promise<TodayView | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  try {
    const input = await todayInput(scope.member, now);
    const members = scope.seesAll
      ? await prisma.studioMember.findMany({
          where: { studioId: scope.studioId, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, user: { select: { name: true, email: true, phone: true } } },
        })
      : [];
    return {
      sections: buildToday({ ...input, now, seesAll: scope.seesAll }),
      seesAll: scope.seesAll,
      members: members.map((m) => ({ id: m.id, name: m.user.name?.trim() || m.user.email?.split('@')[0] || m.user.phone || 'Someone' })),
      meId: scope.member.id,
    };
  } catch (error) {
    console.error('[today] read failed', error instanceof Error ? error.name : 'unknown');
    return { sections: [], seesAll: scope.seesAll, members: [], meId: scope.member.id };
  }
}

export interface TodayEmailRun {
  people: number;
  sent: number;
  skipped: number;
}

/**
 * The morning email: each active owner, PM and salesperson with an email
 * address gets their own Today list, when there is anything on it. To the
 * studio's own people only — never to a customer or a lead.
 */
export async function sendTodayEmails(now = new Date()): Promise<TodayEmailRun> {
  const people = await prisma.studioMember.findMany({
    where: { status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] }, user: { email: { not: null } }, studio: { status: { in: ['ACTIVE', 'ONBOARDING', 'PAUSED'] } } },
    select: { id: true, studioId: true, role: true, status: true, user: { select: { email: true, name: true } }, studio: { select: { tradeName: true } } },
    take: 2000,
  });
  const url = `${resolveSiteUrl()}/studio/today`;
  let sent = 0;
  let skipped = 0;
  for (const p of people) {
    try {
      const input = await todayInput(p, now);
      const sections = buildToday({ ...input, now, seesAll: p.role !== 'SALES' });
      const first = p.user.name?.trim().split(/\s+/)[0] || 'there';
      const mail = todayEmail(sections, first, p.studio.tradeName);
      if (!mail || !p.user.email) {
        skipped += 1;
        continue;
      }
      const r = await sendNotice(p.user.email, { title: mail.title, body: mail.body, url });
      if (r.delivered) sent += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      console.error('[today] email failed', error instanceof Error ? error.name : 'unknown');
    }
  }
  return { people: people.length, sent, skipped };
}
