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
 * A new lead has nobody (`assignedToId` null): handing a stranger's enquiry
 * to a named person who is not expecting it is worse than leaving it visible
 * to everybody. And it arrives with "Call them back" due today, because a
 * card with no next action never appears on "waiting on you", and somebody
 * who has just answered an ad is thinking about their kitchen right now.
 *
 * ## No WhatsApp to the customer
 *
 * Nothing here messages the person who enquired. The studio's own people are
 * told (inbox and email, `notify`); One Interiors never writes to a studio's
 * customer.
 */

import { prisma } from '@/lib/prisma';
import { record } from './events';
import { DEFAULT_STAGES } from './vocabulary';
import type { ClientSourceName } from './vocabulary';
import { formLanding } from '@/modules/studio-sales/intake-rules';
import { notify, notifyStudio } from '@/modules/notify/service';

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
  if (landing.kind === 'attach') {
    await record({ studioId, clientId: landing.id, kind: 'NOTE', summary: input.againSummary, by: null });
    const match = matches.find((m) => m.id === landing.id)!;
    const event = { kind: 'lead-new' as const, clientId: landing.id, name: match.name, source: input.how, again: true };
    const alerted = match.assignedTo && match.assignedTo.status === 'ACTIVE' ? notify(match.assignedTo.userId, event) : notifyStudio(studioId, event);
    return { kind: 'attached', clientId: landing.id, alerted: quietly(alerted) };
  }

  const stageId = await intakeStageFor(studioId);
  if (!stageId) return { kind: 'no-stage' };

  const client = await prisma.studioClient.create({
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
      assignedToId: null,
      nextAction: 'Call them back',
      nextActionOn: new Date(),
    },
    select: { id: true },
  });

  await record({ studioId, clientId: client.id, kind: 'CREATED', summary: input.createdSummary, by: null });

  // In the pool: the owner and PMs hear about it, in the inbox and by email.
  const alerted = notifyStudio(studioId, { kind: 'lead-new', clientId: client.id, name: lead.name, source: input.how, again: false });

  return { kind: 'created', clientId: client.id, alerted: quietly(alerted) };
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
