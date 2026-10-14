/**
 * The project event log (`HomeProjectEvent`): one append-only row per thing
 * that mattered on a customer's project, written in the SAME transaction as
 * the write itself (brief §4: "every write that matters also writes one
 * ProjectEvent in the same transaction"). It feeds the customer's feed,
 * notifications, the reminders and the studio's update score.
 *
 * ```ts
 * await prisma.$transaction(async (tx) => {
 *   const log = await tx.homeSiteLog.create({ data: … });
 *   await recordEvent(tx, {
 *     projectId, type: 'site.posted', refId: log.id,
 *     actor: { type: 'STUDIO', id: member.userId },
 *     payload: { day: '2026-10-12', photos: 3 },
 *   });
 * });
 * ```
 *
 * No `server-only`: it takes the transaction client as an argument and
 * imports nothing that touches the database, so tests can hand it a fake.
 *
 * ## Rules
 *
 * - `type` is one of `PROJECT_EVENT_TYPES`. Adding a type is adding a line
 *   there, with the phase that writes it.
 * - The payload is INTERNAL bookkeeping (counts, ids, days). Anything the
 *   customer sees is read from the row `refId` names, through the customer
 *   projection — never from a payload. So the payload refuses the keys that
 *   must never cross (`FORBIDDEN_PAYLOAD_KEYS`), as a second lock.
 * - Never updated or deleted (tests/append-only.test.ts).
 * - Things that must happen once (a reminder for a day) pass a `dedupeKey`
 *   to `recordEventOnce`, which skips a second insert instead of failing the
 *   transaction.
 */

import type { Prisma } from '@prisma/client';

/** Every event type, grouped by the phase that writes it. */
export const PROJECT_EVENT_TYPES = [
  // Phase 1 — the plan
  'plan.created',
  // Phase 2 — the daily site log
  'site.posted',
  'site.nobody',
  'site.corrected',
  'checklist.ticked',
  'checklist.unticked',
  'reminder.sent',
  'reminder.flagged',
  // Phase 3 — tracker and delays
  'stage.done',
  'stage.reopened',
  'date.moved',
  'stage.renamed',
  // The step tracker (docs/studio-workspace/STEP-TRACKER.md): the studio editing its steps
  'step.added',
  'step.removed',
  'step.renamed',
  'step.reweighted',
  'step.scoped',
  // Customer milestones (docs/studio-os/CUSTOMER-MILESTONES.md): a step starred or unstarred
  'step.starred',
  // Phase 4 — snags (one per HomeSnagEvent kind)
  'snag.raised',
  'snag.accepted',
  'snag.disputed',
  'snag.fixed',
  'snag.confirmed',
  'snag.reopened',
  'snag.auto_closed',
  // Phase 5 — decisions, payments, locker
  'decision.posted',
  'decision.voted',
  'decision.picked',
  'decision.expired',
  'quote.changed',
  'payment.due_set',
  'payment.recorded',
  'payment.corrected',
  'payment.confirmed',
  'payment.disputed',
  'document.filed',
  'document.shared',
  'document.superseded',
  'material.ordered',
  // A studio's own client (docs/studio-workspace/OWN-CLIENTS.md)
  'customer.invited',
  'customer.joined',
  // Studio OS Phase 1 (docs/studio-os/PHASE-1-SALES.md): the booking advance refunded
  'project.cancelled',
  // Studio OS Phase 2 (docs/studio-os/PHASE-2-DESIGN.md): design
  'designer.assigned',
  'design.ticked',
  'design.step_moved',
  'design.step_edited',
  'design.steps_applied',
  'design.shared',
  'design.answered',
  'design.closed',
  'moodboard.shared',
  'moodboard.edited',
  'visit.booked',
  'visit.updated',
  'measurements.saved',
  // Studio OS Phase 3: site crews' work orders and payments (internal; never read for a customer).
  'crew.ordered',
  'crew.order_changed',
  'crew.status',
  'crew.paid',
  'crew.corrected',
  // The project lifecycle (docs/studio-os/PROJECT-LIFECYCLE.md): the phase moved, the closure saved and fixed, the client's handover sign-off.
  'phase.changed',
  'closure.saved',
  'closure.fixed',
  'handover.signed',
  // Change orders (owner, 15 Oct 2026): extra work after design sign-off, approved and paid by the client before it is released.
  'extra.created',
  'extra.edited',
  'extra.sent',
  'extra.approved',
  'extra.declined',
  'extra.paid',
  'extra.released',
  'extra.cancelled',
  // Client digital sign-off of a quotation (owner, 15 Oct 2026).
  'signoff.requested',
  'signoff.signed',
  'signoff.withdrawn',
] as const;

export type ProjectEventType = (typeof PROJECT_EVENT_TYPES)[number];

const EVENT_TYPES: ReadonlySet<string> = new Set(PROJECT_EVENT_TYPES);

export const isProjectEventType = (v: unknown): v is ProjectEventType => typeof v === 'string' && EVENT_TYPES.has(v);

export type SnagEventKindName = 'RAISED' | 'ACCEPTED' | 'DISPUTED' | 'FIXED' | 'CONFIRMED' | 'REOPENED' | 'AUTO_CLOSED';

/** The project event written beside each `HomeSnagEvent`. */
export const SNAG_EVENT_TYPE: Record<SnagEventKindName, ProjectEventType> = {
  RAISED: 'snag.raised',
  ACCEPTED: 'snag.accepted',
  DISPUTED: 'snag.disputed',
  FIXED: 'snag.fixed',
  CONFIRMED: 'snag.confirmed',
  REOPENED: 'snag.reopened',
  AUTO_CLOSED: 'snag.auto_closed',
};

export type ProjectActorTypeName = 'CUSTOMER' | 'STUDIO' | 'OPS' | 'SYSTEM';

/** Who did it. A person (customer, studio member, ops) always has an id; SYSTEM (a cron job) never does. */
export type ProjectActor = { type: 'CUSTOMER' | 'STUDIO' | 'OPS'; id: string } | { type: 'SYSTEM'; id?: null };

export type EventPayload = { [key: string]: Prisma.InputJsonValue | null };

export interface ProjectEventInput {
  projectId: string;
  type: ProjectEventType;
  actor: ProjectActor;
  /** The row it is about: a site log, snag, payment, decision… */
  refId?: string | null;
  payload?: EventPayload;
  /** Defaults to now (the database's). Pass the phone's time for an offline post. */
  at?: Date;
  /** For things that must happen once; use `recordEventOnce`. */
  dedupeKey?: string | null;
}

/**
 * Keys a payload may never carry, at any depth: the right-hand column of the
 * brief's §5 and the internal notes. The payload is internal, but it is read
 * by notification and feed code; keeping these out of it means a careless
 * reader cannot pass them on.
 */
export const FORBIDDEN_PAYLOAD_KEYS: readonly string[] = [
  'transcript',
  'voicePath',
  'phone',
  'crewPhone',
  'studioCostDeltaPaise',
  'internalNote',
  'teamNotes',
  'disputeNote',
  'note',
  'lat',
  'lng',
];

/** Payloads are small bookkeeping, not documents. */
export const MAX_PAYLOAD_BYTES = 4_096;

const FORBIDDEN = new Set(FORBIDDEN_PAYLOAD_KEYS);

function checkPayload(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Event payload ${path} is not a finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkPayload(v, `${path}[${i}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN.has(k)) throw new Error(`Event payload may not carry "${k}" (${path})`);
      if (v === undefined) continue;
      checkPayload(v, `${path}.${k}`);
    }
    return;
  }
  // bigint (write money as a number of paise), Date (write an ISO string or a day), functions, class instances.
  throw new Error(`Event payload ${path} is not plain JSON (${typeof value})`);
}

/** The row to insert, checked. Pure; throws on a programming error (unknown type, bad actor, unsafe payload). */
export function eventRow(input: ProjectEventInput): Prisma.HomeProjectEventCreateManyInput {
  if (!input.projectId) throw new Error('Event needs a projectId');
  if (!isProjectEventType(input.type)) throw new Error(`Unknown project event type: ${String(input.type)}`);
  const { actor } = input;
  if (actor.type === 'SYSTEM') {
    if (actor.id) throw new Error('A SYSTEM event has no actor id');
  } else if (!actor.id) {
    throw new Error(`A ${actor.type} event needs the actor's id`);
  }
  const payload = input.payload ?? {};
  checkPayload(payload, 'payload');
  const json = JSON.stringify(payload);
  if (json.length > MAX_PAYLOAD_BYTES) throw new Error(`Event payload is ${json.length} bytes; keep it under ${MAX_PAYLOAD_BYTES}`);
  return {
    projectId: input.projectId,
    type: input.type,
    actorType: actor.type,
    actorId: actor.type === 'SYSTEM' ? null : actor.id,
    refId: input.refId ?? null,
    payload: JSON.parse(json) as Prisma.InputJsonValue,
    ...(input.at ? { at: input.at } : {}),
    dedupeKey: input.dedupeKey ?? null,
  };
}

/** What `recordEvent` needs: a transaction client (or `prisma`). */
export type EventWriter = Pick<Prisma.TransactionClient, 'homeProjectEvent'>;

/** Append one event, inside the caller's transaction. Returns the new row's id. */
export async function recordEvent(tx: EventWriter, input: ProjectEventInput): Promise<string> {
  const row = await tx.homeProjectEvent.create({ data: eventRow(input), select: { id: true } });
  return row.id;
}

/**
 * Append one event unless one with this `dedupeKey` exists. True when it was
 * written — e.g. send the 18:00 reminder only when this returns true. Uses
 * ON CONFLICT DO NOTHING, so a duplicate does not abort the transaction.
 */
export async function recordEventOnce(tx: EventWriter, input: ProjectEventInput & { dedupeKey: string }): Promise<boolean> {
  if (!input.dedupeKey) throw new Error('recordEventOnce needs a dedupeKey');
  const { count } = await tx.homeProjectEvent.createMany({ data: [eventRow(input)], skipDuplicates: true });
  return count === 1;
}

/** A dedupe key from its parts: `dedupeKey('reminder', projectId, '2026-10-12', '18:00')`. */
export function dedupeKey(...parts: (string | number)[]): string {
  if (parts.length === 0 || parts.some((p) => String(p) === '' || String(p).includes('|'))) throw new Error('Bad dedupe key parts');
  return parts.join('|');
}
