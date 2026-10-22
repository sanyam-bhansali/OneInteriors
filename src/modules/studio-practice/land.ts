import 'server-only';

/**
 * Putting a lead nobody typed onto a studio's board: the enquiry form
 * (`capture.ts`) and lead intake (`studio-intake/intake.ts` — Meta lead ads,
 * Google lead forms, the studio's website, portals) land the SAME way, here.
 *
 * ## Like capture.ts, there is no session
 *
 * The caller is a stranger's form or a provider's webhook, and the studio id
 * comes from what they hit (a public slug, a door's id), never from them. So
 * what this can do is deliberately narrow: create one row of a known shape
 * in that studio's intake column, or add one line to the timeline of a lead
 * already there with the same phone. It reads nothing back to the caller.
 *
 * ## One person, one lead (Studio OS Phase 1)
 *
 * Somebody already on the board who comes in again — fills the form twice,
 * answers a second ad — gets a line on their own timeline, not a second
 * card (`formLanding`); whoever has the lead, or the owner and PMs for a pool
 * lead, is told. A lead in the bin does not count: the new one starts fresh.
 *
 * ## The pool, and work attached
 *
 * A new lead has nobody (`assignedToId` null) unless the studio has said
 * otherwise: handing a stranger's enquiry to a named person who is not
 * expecting it is worse than leaving it visible to everybody. And it arrives
 * with "Call them back" due today, because a card with no next action never
 * appears on "waiting on you", and somebody who has just answered an ad is
 * thinking about their kitchen right now.
 *
 * ## New leads go to (owner, 22 Oct 2026)
 *
 * A studio may say who gets them instead (Settings → Lead sources): one
 * person, or its salespeople in turn, and a door may override that ("Meta
 * leads always to Asha"). The rule is `studio-sales/lead-routing.ts`; here it
 * is applied inside one transaction with the insert, the TURNS counter bumped
 * atomically in it, so two leads arriving together never go to the same
 * person by accident. Somebody suspended, gone or on a role that does not
 * work leads is skipped; with nobody left the lead stays in the pool and the
 * timeline says why. The person given it gets the usual ASSIGNED line and is
 * told in their inbox. Only here: a hand-added lead and an import keep their
 * own choice. A duplicate keeps whoever already has it.
 *
 * ## Which ad (owner, 22 Oct 2026)
 *
 * The ad columns (`adPlatform`, `leadgenId`, campaign, ad set, ad, form,
 * `gclid`, `utm`) are written with the lead. A duplicate's card gets them
 * only when it has none at all, so the first ad that found a person stays
 * the one it is counted under.
 *
 * ## No WhatsApp to the customer
 *
 * Nothing here messages the person who enquired. The studio's own people are
 * told (inbox and email, `notify`); One Interiors never writes to a studio's
 * customer.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { record } from './events';
import { DEFAULT_STAGES } from './vocabulary';
import type { ClientSourceName } from './vocabulary';
import { formLanding } from '@/modules/studio-sales/intake-rules';
import { notify, notifyStudio } from '@/modules/notify/service';
import { effectiveRule, needsTurn, readConnectionRouting, readRouting, routeLead, routedLine, type RouteDecision, type RoutingMember } from '@/modules/studio-sales/lead-routing';
import { hasAds, type AdColumns } from '@/modules/studio-intake/payloads';
import { opensFullSoftware, planOf } from '@/modules/studio/software-plan';
import { OFFICE_ROLES } from '@/modules/studio/surfaces';
import { displayName } from './team';

export interface LandInput {
  studioId: string;
  lead: {
    name: string;
    /** Ten digits, as `capture-fields.normalisePhone` makes it, or null. */
    phone: string | null;
    email: string | null;
    locality: string | null;
    society?: string | null;
    city?: string | null;
    config: string | null;
    budgetPaise?: bigint | null;
    notes: string | null;
  };
  source: ClientSourceName;
  /** One of the studio's own source names (StudioLeadSource id), with source OTHER. */
  leadSourceId?: string | null;
  sourceNote: string;
  /** "your enquiry form", "your Meta lead ad": for the alert. */
  how: string;
  /** The CREATED line: "Came in through your enquiry form". */
  createdSummary: string;
  /** The NOTE line when the phone is already on the board. */
  againSummary: string;
  /** The door it came through, for its "new leads go to" override. Null: the enquiry form. */
  connectionId?: string | null;
  /** Which ad, as columns (`payloads.adColumns`). */
  ads?: AdColumns | null;
}

export type LandResult =
  /** `alerted` settles when the studio has been told; a webhook's `after()` awaits it. */
  | { kind: 'created'; clientId: string; alerted: Promise<void> }
  | { kind: 'attached'; clientId: string; alerted: Promise<void> }
  /** The studio has no columns and they could not be made. */
  | { kind: 'no-stage' };

/** Land one lead. Throws only on a database failure; the caller says what that means to its sender. */
export async function landLead(input: LandInput): Promise<LandResult> {
  const { studioId, lead } = input;

  const matches = lead.phone
    ? await prisma.studioClient.findMany({
        where: { studioId, phone: lead.phone },
        orderBy: { createdAt: 'asc' },
        select: { id: true, deletedAt: true, isDemo: true, name: true, assignedTo: { select: { userId: true, status: true } } },
        take: 10,
      })
    : [];
  const landing = formLanding(matches);
  const ads = input.ads && hasAds(input.ads) ? adData(input.ads) : null;

  if (landing.kind === 'attach') {
    await record({ studioId, clientId: landing.id, kind: 'NOTE', summary: input.againSummary, by: null });
    if (ads) {
      /* First touch kept: only a card that has no ad at all is given this one. */
      await prisma.studioClient.updateMany({
        where: { id: landing.id, studioId, adPlatform: null, leadgenId: null, campaignId: null, gclid: null },
        data: ads,
      }).catch((error: unknown) => console.error('[land] ad columns not filled', error instanceof Error ? error.message : 'unknown'));
    }
    const match = matches.find((m) => m.id === landing.id)!;
    const event = { kind: 'lead-new' as const, clientId: landing.id, name: match.name, source: input.how, again: true };
    const alerted = match.assignedTo && match.assignedTo.status === 'ACTIVE' ? notify(match.assignedTo.userId, event) : notifyStudio(studioId, event);
    return { kind: 'attached', clientId: landing.id, alerted: quietly(alerted) };
  }

  const stageId = await intakeStageFor(studioId);
  if (!stageId) return { kind: 'no-stage' };

  const routing = await routingFor(studioId, input.connectionId ?? null);

  const { client, decision } = await prisma.$transaction(async (tx) => {
    /* The turn is taken in the same transaction as the insert: bumped and
       read in one statement, so concurrent leads get different turns, and a
       failed insert gives the turn back. */
    let turn: number | null = null;
    if (needsTurn(routing.rule, routing.members, routing.fullSoftware)) {
      const bumped = await tx.studio.update({ where: { id: studioId }, data: { leadRouteTurn: { increment: 1 } }, select: { leadRouteTurn: true } });
      turn = bumped.leadRouteTurn;
    }
    const decision: RouteDecision = routeLead(routing.rule, routing.members, routing.fullSoftware, turn);
    const client = await tx.studioClient.create({
      data: {
        studioId,
        stageId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        locality: lead.locality,
        ...(lead.society ? { society: lead.society } : {}),
        ...(lead.city ? { city: lead.city } : {}),
        config: lead.config,
        ...(lead.budgetPaise ? { budgetPaise: lead.budgetPaise } : {}),
        notes: lead.notes,
        source: input.leadSourceId ? 'OTHER' : input.source,
        leadSourceId: input.leadSourceId ?? null,
        sourceNote: input.sourceNote,
        assignedToId: decision.kind === 'person' ? decision.memberId : null,
        nextAction: 'Call them back',
        nextActionOn: new Date(),
        ...(ads ?? {}),
      },
      select: { id: true },
    });
    return { client, decision };
  });

  await record({ studioId, clientId: client.id, kind: 'CREATED', summary: input.createdSummary, by: null });

  const line = routedLine(decision, routing.wanted);
  if (line) {
    await record({
      studioId,
      clientId: client.id,
      kind: line.kind,
      summary: line.summary,
      by: null,
      meta: { toMemberId: decision.kind === 'person' ? decision.memberId : null, routed: { mode: decision.kind === 'person' ? decision.mode : routing.rule.mode, from: decision.from } },
    });
  }

  /* The owner and PMs hear about every new lead, in the inbox and by email;
     the person it was given to is told it is theirs (an owner or PM already
     hears through the first, so once is enough). */
  const givenTo = decision.kind === 'person' ? decision.name : null;
  const alerts: Promise<unknown>[] = [notifyStudio(studioId, { kind: 'lead-new', clientId: client.id, name: lead.name, source: input.how, again: false, givenTo })];
  if (decision.kind === 'person') {
    const to = routing.userIds.get(decision.memberId);
    if (to && !OFFICE_ROLES.includes(to.role)) alerts.push(notify(to.userId, { kind: 'lead-assigned', clientId: client.id, count: 1, name: lead.name, by: null }));
  }

  return { kind: 'created', clientId: client.id, alerted: quietly(Promise.all(alerts)) };
}

/** The ad columns as Prisma data, `utm` as JSON. Only what was given. */
type AdData = Partial<Record<Exclude<keyof AdColumns, 'utm'>, string>> & { utm?: Prisma.InputJsonValue };

function adData(a: AdColumns): AdData {
  const { utm, ...rest } = a;
  const out: AdData = {};
  for (const [k, v] of Object.entries(rest) as [Exclude<keyof AdColumns, 'utm'>, string | null][]) if (v !== null) out[k] = v;
  if (utm) out.utm = utm;
  return out;
}

interface Routing {
  rule: ReturnType<typeof effectiveRule>;
  members: RoutingMember[];
  fullSoftware: boolean;
  /** For the alert: each member's account and role. */
  userIds: Map<string, { userId: string; role: RoutingMember['role'] }>;
  /** The names the rule asked for, for the "left in the pool" line. */
  wanted: string | null;
}

/**
 * The studio's rule and the door's override, and the team when the rule
 * names anybody. Read before the transaction; anything unreadable is the pool.
 */
async function routingFor(studioId: string, connectionId: string | null): Promise<Routing> {
  const pool: Routing = { rule: effectiveRule(readRouting(null), null), members: [], fullSoftware: false, userIds: new Map(), wanted: null };
  try {
    const [studio, door] = await Promise.all([
      prisma.studio.findUnique({
        where: { id: studioId },
        select: { leadRouteMode: true, leadRouteMemberId: true, leadRouteTurnIds: true, softwarePlan: true, fullSoftware: true },
      }),
      connectionId ? prisma.studioLeadConnection.findFirst({ where: { id: connectionId, studioId }, select: { routeMode: true, routeMemberId: true, label: true } }) : null,
    ]);
    if (!studio) return pool;
    const rule = effectiveRule(readRouting(studio), readConnectionRouting(door));
    if (rule.mode === 'POOL') return { ...pool, rule };
    const rows = await prisma.studioMember.findMany({
      where: { studioId },
      select: { id: true, userId: true, role: true, status: true, user: { select: { name: true, email: true } } },
    });
    const members: RoutingMember[] = rows.map((m) => ({ id: m.id, role: m.role, status: m.status, name: displayName(m.user?.name ?? null, m.user?.email ?? null) }));
    const ids = rule.mode === 'PERSON' ? (rule.personId ? [rule.personId] : []) : rule.turnIds;
    const names = ids.map((id) => members.find((m) => m.id === id)?.name).filter((n): n is string => !!n);
    return {
      rule,
      members,
      fullSoftware: opensFullSoftware(planOf(studio)),
      userIds: new Map(rows.map((m) => [m.id, { userId: m.userId, role: m.role }])),
      wanted: names.length > 0 ? names.join(', ') : null,
    };
  } catch (error) {
    /* A webhook path: a lead in the pool is recoverable, a lead that failed is not. */
    console.error('[land] routing unreadable, using the pool', error instanceof Error ? error.message : 'unknown');
    return pool;
  }
}

/** An alert that fails is logged by the notifier; it never fails the lead. */
function quietly(p: Promise<unknown>): Promise<void> {
  return p.then(
    () => undefined,
    () => undefined,
  );
}

/** Thirty of the studio's own source names is the most (`studio-sales/settings.ts`). */
const MAX_OWN_SOURCES = 30;

/**
 * One of the studio's own source names, found or made ("99acres", "Google
 * lead form"), or null when the studio already has thirty. Compared without
 * case, so "99Acres" from one portal post and "99acres" from the next are one.
 */
export async function leadSourceIdFor(studioId: string, name: string | null): Promise<string | null> {
  if (!name) return null;
  const existing = await prisma.studioLeadSource.findFirst({
    where: { studioId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const count = await prisma.studioLeadSource.count({ where: { studioId } });
  if (count >= MAX_OWN_SOURCES) return null;
  try {
    const made = await prisma.studioLeadSource.create({ data: { studioId, name }, select: { id: true } });
    return made.id;
  } catch {
    /* Two leads from one portal in the same instant: the other made it. */
    const again = await prisma.studioLeadSource.findFirst({ where: { studioId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    return again?.id ?? null;
  }
}

/**
 * Where a lead nobody typed lands, for a studio that is not the caller.
 *
 * Same decision and same seeding as `bridge.ts` — `isIntake`, else the first
 * column, seeding the six defaults if the studio has never opened its board.
 * Duplicated rather than shared because importing the bridge here would give
 * an unauthenticated path a reference to the one module that writes
 * `ONE_INTERIORS`, and that module's safety rests on nothing reachable
 * importing it.
 */
async function intakeStageFor(studioId: string): Promise<string | null> {
  const pick = (rows: { id: string; isIntake: boolean }[]) => rows.find((s) => s.isIntake)?.id ?? rows[0]?.id ?? null;

  const existing = await prisma.studioStage.findMany({
    where: { studioId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, isIntake: true },
  });
  if (existing.length > 0) return pick(existing);

  await prisma.studioStage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({
      studioId,
      name: s.name,
      kind: s.kind,
      colour: s.colour,
      isIntake: s.isIntake,
      sortOrder: (i + 1) * 10,
    })),
    skipDuplicates: true,
  });

  const seeded = await prisma.studioStage.findMany({
    where: { studioId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, isIntake: true },
  });
  return pick(seeded);
}
