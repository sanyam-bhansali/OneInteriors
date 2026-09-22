import 'server-only';

/**
 * A studio's own clients.
 *
 * Same rule as everywhere in this folder: **every query is scoped by the studio
 * id from the session, and nothing here takes one as an argument.** These rows
 * are named people with phone numbers, for projects that in most cases have
 * nothing to do with us. We hold them as a processor.
 */

import { DEMO_LEAD, LISTED, LIVE } from './demo-lead';
import { prisma } from '@/lib/prisma';
import { fromDb, type Paise } from '@/lib/money';
import { myStudioId } from '@/modules/studio-quote/store';
import { myStages, intakeStageId } from './stages';
import { myFields } from './fields';
import { cleanValues, problemSentence, readValues, type FieldValues } from './field-values';
import { IMPORT_SOURCE, IMPORT_NOTE, normalisePhone, type ImportRow } from './csv';

export type { ImportRow, ColumnKey, ImportPlan } from './csv';
export { parseCsv, guessMapping, planImport, COLUMN_LABELS } from './csv';

// The vocabulary is pure and lives next door so client components can import
// it without dragging Prisma into the browser bundle — CONTRIBUTING §9.5.
export { SOURCE_LABELS, LOST_LABELS, BOARD_KINDS, CLOSED_KINDS, BIN_DAYS } from './vocabulary';
export type { ClientSourceName, LostReasonName, StageKindName } from './vocabulary';

import { BOARD_KINDS, BIN_DAYS } from './vocabulary';
import type { ClientSourceName, LostReasonName, StageKindName } from './vocabulary';
import { record, recordMany } from './events';
import { displayName } from './team';
import {
  assignedSummary,
  contactSummary,
  createdSummary,
  followupDue,
  OUTCOME_FOLLOWUP,
  lostSummary,
  stageSummary,
  type CallOutcomeId,
} from './event-copy';

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  society: string | null;
  locality: string | null;
  config: string | null;
  carpetSqft: number | null;
  source: ClientSourceName;
  sourceNote: string | null;
  /** The studio's own column. Never one of ours — see `stages.ts`. */
  stageId: string;
  stageName: string;
  stageKind: StageKindName;
  stageColour: string;
  lostReason: LostReasonName | null;
  nextAction: string | null;
  nextActionOn: Date | null;
  fromMarketplace: boolean;
  notes: string | null;
  quoteCount: number;
  quotedPaise: Paise | null;
  /** Null means the pool — nobody has taken this one. */
  assignedToId: string | null;
  assignedToName: string | null;
  lastContactedAt: Date | null;
  /** Whatever the studio defined in Settings → Fields, keyed by the field key. */
  fields: FieldValues;
  updatedAt: Date;
  /** The sample we put on an empty board. Listed, never counted — demo-lead.ts. */
  isDemo: boolean;
}

export async function myClients(): Promise<ClientRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    /* An empty board gets a sample, once.
       Same shape as `starterRowsFor` on the catalogue: create-on-first-read,
       keyed on a zero count, so there is no migration step and no moment
       where a studio has an account but not the thing the screen is about.
       `seedDemoLead` is a no-op for any studio that has ever had a client,
       including one who added a real lead and then binned it — a board that
       re-seeds itself after somebody clears it is a board arguing with its
       owner. */
    await seedDemoLead(studioId);

    const rows = await prisma.studioClient.findMany({
      // `LISTED`, not `LIVE`: the board shows the sample, the counts do not.
      // `deletedAt: null` on every read of this table, without exception.
      // A deleted client reappearing on the board is worse than one that
      // never deleted — see the note on the column in schema.prisma.
      where: { studioId, ...LISTED },
      orderBy: [{ nextActionOn: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      include: {
        stage: { select: { id: true, name: true, kind: true, colour: true } },
        assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
        quotes: { select: { id: true, lines: { select: { amountPaise: true } } } },
      },
      take: 400,
    });

    return rows.map((row) => {
      // The value shown against a client is what has been QUOTED, summed from
      // the lines rather than stored — the same rule as everywhere else, and it
      // means a quotation edited today shows through immediately.
      const quoted = row.quotes.reduce(
        (sum, q) => sum + q.lines.reduce((s, l) => s + fromDb(l.amountPaise), 0),
        0,
      );

      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        society: row.society,
        locality: row.locality,
        config: row.config,
        carpetSqft: row.carpetSqft,
        source: row.source as ClientSourceName,
        sourceNote: row.sourceNote,
        stageId: row.stage.id,
        stageName: row.stage.name,
        stageKind: row.stage.kind as StageKindName,
        stageColour: row.stage.colour,
        lostReason: row.lostReason as LostReasonName | null,
        nextAction: row.nextAction,
        nextActionOn: row.nextActionOn,
        fromMarketplace: row.briefId !== null || row.introductionId !== null,
        notes: row.notes,
        quoteCount: row.quotes.length,
        quotedPaise: row.quotes.length > 0 ? quoted : null,
        isDemo: row.isDemo,
        assignedToId: row.assignedToId,
        assignedToName: row.assignedTo ? personName(row.assignedTo.user) : null,
        lastContactedAt: row.lastContactedAt,
        fields: readValues(row.fields),
        updatedAt: row.updatedAt,
      };
    });
  } catch (error) {
    console.error('[studio-practice] myClients failed', error);
    return [];
  }
}

/**
 * The same display-name rule as `team.ts`.
 *
 * Duplicated rather than imported because importing `team.ts` here would make
 * two modules that both read clients import each other. Four lines is cheaper
 * than a circular dependency.
 */
function personName(user: { name: string | null; email: string | null }): string {
  if (user.name && user.name.trim().length > 0) return user.name.trim();
  if (user.email) return user.email.split('@')[0] ?? user.email;
  return 'Someone';
}

export type Result = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * What a failed write says.
 *
 * "That did not save." is the right thing for a studio owner to read — the
 * cause is never anything they can act on. It is the wrong thing for whoever
 * has to fix it, and for a while it was the only thing anyone got: a client
 * that would not save, a log line nobody was watching, and no way to tell a
 * missing column from a dropped connection from a constraint.
 *
 * So in development the reason comes back with it. In production it does not,
 * because a Postgres error string can carry column names and values.
 */
function saveFailed(where: string, error: unknown): { ok: false; error: string } {
  console.error(`[studio-practice] ${where} failed`, error);
  const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
  return {
    ok: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'That did not save.'
        : `That did not save — ${detail}`,
  };
}

export interface NewClientInput {
  name: string;
  phone?: string;
  society?: string;
  config?: string;
  source: ClientSourceName;
  sourceNote?: string;
  nextAction?: string;
  nextActionOn?: string;
  /** Whatever the studio defined in Settings → Fields, keyed by field key. */
  custom?: Record<string, string>;
  /**
   * Add it anyway, despite a matching phone number.
   *
   * The three-state convention again: absent means "check", true means "the
   * person has seen the match and says they are different people". Never
   * defaulted to true — a duplicate check nobody can fail is decoration.
   */
  force?: boolean;
}

/** A client who already has this phone number. */
export interface DuplicateOf {
  id: string;
  name: string;
  stageName: string;
  /** Null when nobody has taken them. */
  assignedToName: string | null;
  /** True when they are sitting in the bin, which changes the advice. */
  deleted: boolean;
}

export type AddResult =
  | { ok: true; id: string }
  | { ok: false; error: string }
  /**
   * Not an error. A question.
   *
   * Two people in one family really do share a number, and a builder's office
   * number reaches four flats. So this hands back WHO it matched and lets the
   * person decide, rather than refusing — AxLeads answers the same case with
   * a 409 carrying `duplicateOfId` and a `?force=true` escape.
   */
  | { ok: false; duplicate: DuplicateOf };

/**
 * Put the sample on an empty board. Once, ever.
 *
 * ## Why create-on-read and not a migration
 *
 * Same reasoning as `starterRowsFor` on the catalogue: a studio approved
 * before this shipped would otherwise never get one, and a migration that
 * writes a row into every existing studio's CRM is a migration writing into
 * somebody's live data. Creating it the first time the board is opened means
 * there is no moment where a studio has an account but not the thing the
 * screen is about.
 *
 * ## Why the guard counts ALL clients, including binned ones
 *
 * `LISTED` would let a studio who added a real lead, binned it, and came back
 * find a sample waiting. `deletedAt` is deliberately not in this count: a
 * board that re-seeds itself after somebody has cleared it is a board arguing
 * with its owner, and the second sample would arrive with no explanation for
 * why it had returned.
 *
 * Every failure is swallowed. A studio whose sample could not be created gets
 * the empty state that existed before this feature, which is a good screen —
 * losing the board because we could not write a demo row would be absurd.
 */
async function seedDemoLead(studioId: string): Promise<void> {
  try {
    const existing = await prisma.studioClient.count({
      // COUNTS-EVERYTHING: the one count in the tree that must not use LIVE.
      // It asks "has this studio ever had a client", so it deliberately sees
      // binned rows and the sample itself. With LIVE, a studio who added a
      // real lead and binned it would come back to a second sample arriving
      // with no explanation for why it had returned.
      where: { studioId },
    });
    if (existing > 0) return;

    const stageId = await intakeStageId();
    // No columns yet means the stage seeder has not run. It will on the next
    // read; the sample can wait a beat rather than inventing a stage.
    if (!stageId) return;

    const followUp = new Date();
    followUp.setDate(followUp.getDate() + DEMO_LEAD.followUpInDays);
    followUp.setHours(12, 0, 0, 0);

    await prisma.studioClient.create({
      data: {
        studioId,
        stageId,
        isDemo: true,
        name: DEMO_LEAD.name,
        society: DEMO_LEAD.society,
        locality: DEMO_LEAD.locality,
        city: DEMO_LEAD.city,
        config: DEMO_LEAD.config,
        carpetSqft: DEMO_LEAD.carpetSqft,
        nextAction: DEMO_LEAD.nextAction,
        nextActionOn: followUp,
        notes: DEMO_LEAD.notes,
        // OTHER, not a marketplace source. `fromMarketplace` draws a badge
        // saying we sent them this lead, and we did not send them anybody.
        source: 'OTHER',
      },
    });
  } catch {
    /* The board is complete without it. */
  }
}

/**
 * Remove the sample.
 *
 * A hard delete, not the soft one every other client gets. The bin exists so a
 * studio can recover work they binned by accident; a row we invented is not
 * work, and leaving it in the bin for thirty days would put our example in
 * the one screen whose entire job is to hold *their* lost clients.
 *
 * Scoped to `isDemo: true` so this can never reach a real row, whatever it is
 * handed.
 */
export async function removeDemoLead(): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  try {
    await prisma.studioClient.deleteMany({ where: { studioId, isDemo: true } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not remove the sample. Try again.' };
  }
}

export async function addClient(input: NewClientInput): Promise<AddResult> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Who is it?' };

  // A follow-up date with no action is a reminder to do nothing; an action with
  // no date never surfaces on the list. Both or neither.
  const action = input.nextAction?.trim() || null;
  const on = input.nextActionOn?.trim() || null;
  if (action && !on) return { ok: false, error: 'When will you do that?' };
  if (on && !action) return { ok: false, error: 'What will you do on that day?' };

  /**
   * Has this number been added before?
   *
   * The import path has skipped duplicate phones since the day it shipped and
   * the Add form has never checked at all — so the reliable way to get two
   * cards for one person was to type the second one by hand, which is also the
   * likeliest way. Two people ringing the same lead from two cards is how a
   * studio looks disorganised to the one customer they were trying to win.
   *
   * Matched on the normalised ten digits, which is the whole reason
   * `normalisePhone` strips prefixes: a list where half carry +91 has no
   * duplicates in it as far as any `WHERE phone =` is concerned.
   *
   * Includes BINNED clients deliberately. Somebody re-adding a person they
   * deleted last week wants to restore that card and its history, not start
   * a second one — and the answer says which it is.
   */
  const typedPhone = input.phone?.trim() ?? '';
  if (typedPhone.length > 0 && input.force !== true) {
    const digits = normalisePhone(typedPhone);
    if (digits) {
      const match = await prisma.studioClient.findFirst({
        where: { studioId, phone: digits, isDemo: false },
        orderBy: { deletedAt: 'asc' },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          stage: { select: { name: true } },
          assignedTo: { select: { user: { select: { name: true, email: true } } } },
        },
      });

      if (match) {
        return {
          ok: false,
          duplicate: {
            id: match.id,
            name: match.name,
            stageName: match.stage.name,
            assignedToName: match.assignedTo ? personName(match.assignedTo.user) : null,
            deleted: match.deletedAt !== null,
          },
        };
      }
    }
  }

  // Where a new client lands is the studio's choice, not ours. `myStages()`
  // seeds the six defaults on first read, so this is never null for a studio
  // that has a session — but it can be for one whose database read failed,
  // and landing a client nowhere is worse than not landing it.
  const stageId = await intakeStageId();
  if (!stageId) {
    return { ok: false, error: 'Your pipeline has no intake column. Settings → Pipeline.' };
  }

  const { values, problems } = cleanValues(await myFields(), input.custom ?? {});
  if (problems.length > 0) return { ok: false, error: problemSentence(problems) };

  try {
    const row = await prisma.studioClient.create({
      data: {
        studioId,
        stageId,
        name,
        /* The normalised ten digits, not what they typed. A card saved as
           "+91 98765 43210" is invisible to the duplicate check that looks
           for "9876543210", so the next person to type it gets a second
           card — the exact bug this block was added to prevent. */
        phone: typedPhone.length > 0 ? (normalisePhone(typedPhone) ?? typedPhone) : null,
        society: input.society?.trim() || null,
        config: input.config?.trim() || null,
        // A studio cannot mark its own walk-in as one of ours. That flag is set
        // by the introduction path and nowhere else, or the one report that
        // says whether the roster is worth paying for stops meaning anything.
        source: input.source === 'ONE_INTERIORS' ? 'OTHER' : input.source,
        sourceNote: input.sourceNote?.trim() || null,
        nextAction: action,
        nextActionOn: on ? new Date(on) : null,
        fields: values,
      },
      select: { id: true },
    });

    await record({
      studioId,
      clientId: row.id,
      kind: 'CREATED',
      summary: createdSummary('typed', input.source === 'ONE_INTERIORS' ? 'OTHER' : input.source),
      meta: { source: input.source },
    });

    return { ok: true, id: row.id };
  } catch (error) {
    return saveFailed('addClient', error);
  }
}

export interface UpdateClientInput {
  id: string;
  stageId?: string;
  lostReason?: LostReasonName | null;
  nextAction?: string | null;
  nextActionOn?: string | null;
  notes?: string | null;
  custom?: Record<string, string>;
}

export async function updateClient(input: UpdateClientInput): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  // The MEANING of the column decides the behaviour, never its name — a
  // studio that renamed "Lost" to "Went cold" still has to say why.
  let kind: StageKindName | null = null;
  if (input.stageId) {
    const stage = (await myStages()).find((s) => s.id === input.stageId);
    if (!stage) return { ok: false, error: 'That column is not yours.' };
    kind = stage.kind;

    if (kind === 'LOST' && !input.lostReason) {
      return {
        ok: false,
        error:
          'Why did it go? One word is enough, and in a month it is the only thing worth having.',
      };
    }
  }

  const closing = kind === 'LOST' || kind === 'DONE';

  let values: FieldValues | null = null;
  if (input.custom) {
    const cleaned = cleanValues(await myFields(), input.custom);
    if (cleaned.problems.length > 0) return { ok: false, error: problemSentence(cleaned.problems) };
    values = cleaned.values;
  }

  try {
    /* Where it was, read before we move it. The timeline says "Moved from
       Enquiry to Quoted", and after the update there is nothing left to ask.
       Only fetched when a stage move is actually happening. */
    const before = input.stageId
      ? await prisma.studioClient.findFirst({
          where: { id: input.id, studioId, deletedAt: null },
          select: { stageId: true, stage: { select: { name: true } } },
        })
      : null;

    // `updateMany` scoped by studioId: an id from a form is not proof of
    // ownership, and this simply matches nothing when it is not theirs.
    const { count } = await prisma.studioClient.updateMany({
      where: { id: input.id, studioId, deletedAt: null },
      data: {
        ...(input.stageId ? { stageId: input.stageId } : {}),
        ...(values ? { fields: values } : {}),
        ...(kind
          ? {
              lostReason: kind === 'LOST' ? (input.lostReason ?? null) : null,
              // A closed client carries no follow-up. Leaving one behind keeps
              // it on the list for ever, which is how people learn to ignore
              // the list.
              ...(closing ? { nextAction: null, nextActionOn: null } : {}),
            }
          : {}),
        ...(!closing && input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
        ...(!closing && input.nextActionOn !== undefined
          ? { nextActionOn: input.nextActionOn ? new Date(input.nextActionOn) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (count === 0) return { ok: false, error: 'That client is not yours.' };

    /* Only the stage move and the loss are worth a line. An edited follow-up
       date or a retyped notes box is housekeeping, and a timeline padded with
       housekeeping is one nobody reads — which costs us the entries that do
       matter. AxLeads logs every field edit and its detail pages are mostly
       noise as a result. */
    if (input.stageId && kind) {
      const to = (await myStages()).find((s) => s.id === input.stageId);
      if (to) {
        await record({
          studioId,
          clientId: input.id,
          kind: kind === 'LOST' ? 'LOST' : 'STAGE_CHANGED',
          summary:
            kind === 'LOST'
              ? lostSummary(input.lostReason ?? null, input.notes)
              : stageSummary(before?.stage.name ?? null, to.name),
          meta: { fromStageId: before?.stageId ?? null, toStageId: to.id, kind },
        });
      }
    }

    return { ok: true };
  } catch (error) {
    return saveFailed('updateClient', error);
  }
}

/** Who is waiting on this studio today. For the dashboard. */
export async function clientsDueCount(): Promise<number> {
  const studioId = await myStudioId();
  if (!studioId) return 0;

  try {
    return await prisma.studioClient.count({
      where: {
        studioId,
        // `LIVE`, not `deletedAt: null` — the sample lead ships with a
        // follow-up date, and counting it would have the morning screen
        // report somebody waiting on a call who does not exist.
        ...LIVE,
        // The kind, not the name. A studio that renamed every column still
        // gets a truthful count.
        stage: { kind: { in: BOARD_KINDS } },
        nextActionOn: { lte: endOfToday() },
      },
    });
  } catch {
    return 0;
  }
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// ── Assignment, contact and the bin ────────────────────────────

/**
 * Hand clients to somebody, or return them to the pool.
 *
 * Takes a list rather than one id because the case that matters is two hundred
 * imported rows being split between three people. `null` returns them to the
 * pool, which is how you undo a bad bulk assignment without knowing who had
 * them before.
 *
 * The member is checked against this studio first: a membership id arriving
 * from a form proves nothing, and without the check one studio could assign
 * its clients to another studio's staff.
 */
export async function assignClients(ids: string[], memberId: string | null): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  if (memberId) {
    const member = await prisma.studioMember.findFirst({
      where: { id: memberId, studioId },
      select: { id: true },
    });
    if (!member) return { ok: false, error: 'That person is not in this studio.' };
  }

  try {
    /* Read the ids back before the write. `updateMany` returns a count and a
       count cannot say WHICH rows it touched — the same problem AxLeads hits
       on its bulk claim — and a timeline row against a lead that was not
       actually updated is a lie in a permanent record. */
    const targets = await prisma.studioClient.findMany({
      where: { id: { in: ids }, studioId, deletedAt: null },
      select: { id: true },
    });
    if (targets.length === 0) return { ok: false, error: 'None of those are yours.' };

    const { count } = await prisma.studioClient.updateMany({
      where: { id: { in: targets.map((t) => t.id) }, studioId, deletedAt: null },
      data: { assignedToId: memberId },
    });
    if (count === 0) return { ok: false, error: 'None of those are yours.' };

    /* One row per lead, not one per action. Each lead's own history has to
       show what happened to IT; the record of the bulk action itself is a
       different thing. */
    const toName = memberId
      ? ((await prisma.studioMember.findUnique({
          where: { id: memberId },
          select: { user: { select: { name: true, email: true } } },
        })) ?? null)
      : null;

    await recordMany(
      targets.map((t) => ({
        studioId,
        clientId: t.id,
        kind: 'ASSIGNED' as const,
        summary: assignedSummary(
          toName ? displayName(toName.user?.name ?? null, toName.user?.email ?? null) : null,
        ),
        meta: { toMemberId: memberId },
      })),
    );

    return { ok: true };
  } catch (error) {
    return saveFailed('assignClients', error);
  }
}

/**
 * Record that somebody actually spoke to this client.
 *
 * One button, and it is the only thing that writes `lastContactedAt`. Every
 * other edit leaves it alone on purpose — if changing a follow-up date counted
 * as contact, the quiet list would empty itself every time somebody tidied up
 * the board, and it would stop meaning anything within a week.
 */
export async function logContact(
  id: string,
  /**
   * What the contact produced. Optional, so the one-tap "I rang them" on the
   * board keeps working exactly as it did.
   *
   * When it IS given, the timeline gets a line worth reading — "Called — no
   * answer" rather than a bare timestamp. That distinction is the whole
   * difference between a log and a record: a stack of "contacted" entries
   * tells a studio how busy they were, not what is happening.
   */
  outcome?: CallOutcomeId,
  note?: string | null,
): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  try {
    const now = new Date();

    /**
     * The outcome decides the next move, and writes it.
     *
     * "Log a call" that only stamps a date is a diary. The reason to ask what
     * happened is that the answer says what to do next — somebody who asked
     * for a quotation needs a quotation, and a studio should not have to
     * remember that separately from recording the call.
     *
     * Only when an outcome was actually given. The board's one-tap button
     * passes none, and inventing work from "somebody pressed a button" is how
     * a follow-up list fills with things nobody intends to do.
     *
     * `not_interested` maps to null on purpose — see OUTCOME_FOLLOWUP.
     */
    const implied = outcome ? OUTCOME_FOLLOWUP[outcome] : null;
    const followup = implied && implied !== 'clear' ? implied : null;
    const due = outcome ? followupDue(outcome, now) : null;

    const { count } = await prisma.studioClient.updateMany({
      where: { id, studioId, deletedAt: null },
      data: {
        lastContactedAt: now,
        /* Both or neither, which is the rule addClient already enforces: an
           action with no date never surfaces on "waiting on you", and a date
           with no action is a reminder to do nothing. */
        ...(followup && due
          ? { nextAction: followup.action, nextActionOn: due }
          : implied === 'clear'
            ? /* They have said no. A task saying otherwise is a promise to
                 annoy them, so it goes — both columns, because one without
                 the other is the state addClient refuses. */
              { nextAction: null, nextActionOn: null }
            : {}),
      },
    });
    if (count === 0) return { ok: false, error: 'That client is not yours.' };

    await record({
      studioId,
      clientId: id,
      kind: 'CONTACTED',
      /* The task is named in the same line as the call, so the timeline reads
         as cause and effect rather than two entries a second apart. */
      summary:
        contactSummary(outcome ?? 'spoke', note) +
        (followup && due
          ? ` · ${followup.action} by ${dueWord(due, now)}`
          : implied === 'clear'
            ? ' · follow-up cleared'
            : ''),
      meta: outcome ? { outcome, nextAction: followup?.action ?? null } : undefined,
    });

    return { ok: true };
  } catch (error) {
    return saveFailed('logContact', error);
  }
}

/**
 * "tomorrow", "Friday", "3 Oct".
 *
 * A date on a task nobody has to decode. Within the week the weekday is what
 * people actually plan by; beyond it, the date is.
 */
function dueWord(due: Date, now: Date): string {
  const days = Math.round((due.getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return due.toLocaleDateString('en-IN', { weekday: 'long' });
  return due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Delete, reversibly.
 *
 * A lead list is somebody's work, and an instant permanent delete is a button
 * that gets pressed once and regretted for a year. Thirty days, with the erase
 * date shown on the row.
 *
 * Refused outright for a client carrying quotations or projects. Those rows
 * reference this one, and a soft delete would leave a quotation pointing at
 * somebody who is invisible everywhere in the interface — which is how a
 * studio ends up unable to explain a document it sent.
 */
export async function binClients(ids: string[]): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  try {
    const attached = await prisma.studioClient.findMany({
      where: {
        id: { in: ids },
        studioId,
        OR: [{ quotes: { some: {} } }, { projects: { some: {} } }],
      },
      select: { name: true },
      take: 3,
    });

    if (attached.length > 0) {
      const names = attached.map((a) => a.name).join(', ');
      return {
        ok: false,
        error: `${names} ${attached.length === 1 ? 'has' : 'have'} quotations or projects. Those cannot be deleted.`,
      };
    }

    const targets = await prisma.studioClient.findMany({
      where: { id: { in: ids }, studioId, deletedAt: null },
      select: { id: true },
    });

    const { count } = await prisma.studioClient.updateMany({
      where: { id: { in: ids }, studioId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) return { ok: false, error: 'None of those are yours.' };

    /* Recorded even though the row is now invisible. The bin is reversible,
       so a restored client has to be able to show that it was deleted on the
       14th and brought back on the 16th — which is exactly the sequence
       somebody will later want to explain. */
    await recordMany(
      targets.map((t) => ({
        studioId,
        clientId: t.id,
        kind: 'BINNED' as const,
        summary: `Deleted — erased automatically after ${BIN_DAYS} days`,
      })),
    );

    return { ok: true };
  } catch (error) {
    return saveFailed('binClients', error);
  }
}

export async function restoreClients(ids: string[]): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  try {
    const targets = await prisma.studioClient.findMany({
      where: { id: { in: ids }, studioId, deletedAt: { not: null } },
      select: { id: true },
    });

    const { count } = await prisma.studioClient.updateMany({
      where: { id: { in: ids }, studioId, deletedAt: { not: null } },
      data: {
        deletedAt: null,
        /* Cleared, or a restored card comes back still pointing at the one it
           was merged into — two live rows, one of them claiming to be a
           redirect to the other.
           
           Worth being plain about what this does and does not undo: the card
           and its own history come back, but the quotations and projects that
           moved during the merge do NOT return, because they now belong to
           the surviving card and pulling them back would break whatever has
           been done with them since. `merge.ts` records both sides, so the
           account of what went where survives either way. */
        mergedIntoId: null,
      },
    });
    if (count === 0) return { ok: false, error: 'Nothing to restore.' };

    await recordMany(
      targets.map((t) => ({
        studioId,
        clientId: t.id,
        kind: 'RESTORED' as const,
        summary: 'Brought back out of the bin',
      })),
    );

    return { ok: true };
  } catch (error) {
    return saveFailed('restoreClients', error);
  }
}

/** Gone for good, now rather than in thirty days. */
export async function eraseClients(ids: string[]): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  try {
    // Only ever from the bin. Erasing straight off the board would make the
    // thirty days meaningless — somebody would wire a delete button to this
    // one afternoon and the safety net would quietly be gone.
    const { count } = await prisma.studioClient.deleteMany({
      where: { id: { in: ids }, studioId, deletedAt: { not: null } },
    });
    if (count === 0) return { ok: false, error: 'Nothing to erase.' };
    return { ok: true };
  } catch (error) {
    return saveFailed('eraseClients', error);
  }
}

export interface BinnedRow {
  id: string;
  name: string;
  phone: string | null;
  deletedAt: Date;
  /** When it goes for good. */
  erasesOn: Date;
  daysLeft: number;
}

export async function myBin(): Promise<BinnedRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioClient.findMany({
      where: { studioId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: { id: true, name: true, phone: true, deletedAt: true },
      take: 400,
    });

    const now = Date.now();

    return rows.map((row) => {
      const deletedAt = row.deletedAt!;
      const erasesOn = new Date(deletedAt);
      erasesOn.setDate(erasesOn.getDate() + BIN_DAYS);

      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        deletedAt,
        erasesOn,
        // Rounded up, so a row erasing tonight reads "1 day left" rather than
        // "0 days left" while it is still restorable.
        daysLeft: Math.max(0, Math.ceil((erasesOn.getTime() - now) / 86_400_000)),
      };
    });
  } catch (error) {
    console.error('[studio-practice] myBin failed', error);
    return [];
  }
}

// ── Import, and search ─────────────────────────────────────────

export interface ImportResult {
  ok: true;
  written: number;
  /** Already in the database with the same phone. Left alone. */
  alreadyHere: number;
}

/**
 * Write an agreed import plan.
 *
 * Everything arrives **unassigned**, which is the point of the pool: two
 * hundred rows land in one place and get shared out deliberately, rather than
 * all silently becoming the importer's problem.
 *
 * Duplicates are skipped, never merged. A merge needs a rule about which
 * version of a name or a note wins, and getting that rule wrong quietly
 * overwrites somebody's work — so the safe thing is to leave the existing row
 * exactly as it is and say how many were left.
 */
export async function importClients(
  rows: ImportRow[],
  /**
   * Where this batch came from, chosen on the import screen.
   *
   * Defaults to OTHER so the old call shape still works, but the screen now
   * asks — a studio importing two years of Instagram enquiries as OTHER
   * loses the only fact the analytics page needs from them.
   *
   * ONE_INTERIORS is refused the same way `addClient` refuses it: a studio
   * cannot mark its own spreadsheet as leads we sent.
   */
  source: ClientSourceName = IMPORT_SOURCE,
): Promise<ImportResult | { ok: false; error: string }> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  if (rows.length === 0) return { ok: false, error: 'Nothing to import.' };
  if (rows.length > 5000) {
    return { ok: false, error: 'That is more than five thousand rows. Split the file.' };
  }

  const stageId = await intakeStageId();
  if (!stageId) {
    return { ok: false, error: 'Your pipeline has no intake column. Settings → Pipeline.' };
  }

  try {
    // Deleted rows count as present. Importing a list that re-creates somebody
    // the studio deleted last week would undo that decision without saying so.
    const phones = rows.map((r) => r.phone).filter((p): p is string => p !== null);
    const existing =
      phones.length > 0
        ? await prisma.studioClient.findMany({
            where: { studioId, phone: { in: phones } },
            select: { phone: true },
          })
        : [];

    const here = new Set(existing.map((e) => e.phone));
    const fresh = rows.filter((r) => !r.phone || !here.has(r.phone));

    if (fresh.length === 0) {
      return { ok: true, written: 0, alreadyHere: rows.length };
    }

    /* Stamped before the write, so the read-back that gives each imported
       row its first timeline line can find exactly this batch. A second
       earlier than the createMany, which is the safe direction: catching a
       row from an overlapping import would give it a duplicate CREATED line,
       and missing one would give it none. */
    const startedAt = new Date();

    const result = await prisma.studioClient.createMany({
      data: fresh.map((r) => ({
        studioId,
        stageId,
        name: r.name,
        phone: r.phone,
        email: r.email,
        society: r.society,
        locality: r.locality,
        config: r.config,
        notes: r.notes,
        source: source === 'ONE_INTERIORS' ? 'OTHER' : source,
        sourceNote: IMPORT_NOTE,
        // Unassigned on purpose. See the note above.
        assignedToId: null,
      })),
      skipDuplicates: true,
    });

    /* `createMany` does not return ids, so the rows have to be read back to
       give each one its own first line. Bounded by the same batch that was
       just written, and worth the query: an imported lead with a blank
       history looks like a lead nobody ever did anything about. */
    if (result.count > 0) {
      const written = await prisma.studioClient.findMany({
        where: { studioId, sourceNote: IMPORT_NOTE, createdAt: { gte: startedAt } },
        select: { id: true },
      });
      await recordMany(
        written.map((w) => ({
          studioId,
          clientId: w.id,
          kind: 'CREATED' as const,
          summary: createdSummary('imported', IMPORT_SOURCE),
        })),
      );
    }

    return { ok: true, written: result.count, alreadyHere: rows.length - result.count };
  } catch (error) {
    return saveFailed('importClients', error);
  }
}

export interface FoundClient {
  id: string;
  name: string;
  phone: string | null;
  society: string | null;
  stageName: string;
  assignedToName: string | null;
}

/**
 * Find somebody by name, phone or society.
 *
 * The phone search strips non-digits from the query, because a studio owner
 * looking somebody up types the number the way it is written on a card —
 * `98765 43210` — and the column holds `9876543210`.
 *
 * Deleted clients are excluded. Somebody searching for a name they deleted
 * should find nothing here and go to the bin, rather than find a row that
 * behaves oddly everywhere else.
 */
/**
 * One client, for the detail page.
 *
 * Scoped by `studioId` from the session, so an id guessed or pasted from
 * somewhere else simply returns null rather than 403ing — a 403 would confirm
 * the row exists, which is the enumeration leak AxLeads' scope module refuses
 * for the same reason.
 *
 * `LISTED` rather than `LIVE`: the sample lead has a detail page like anything
 * else, because a studio poking at the sample to see how the product works is
 * the sample doing its job.
 */
export async function clientById(id: string): Promise<ClientRow | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    const row = await prisma.studioClient.findFirst({
      where: { id, studioId, ...LISTED },
      include: {
        stage: { select: { id: true, name: true, kind: true, colour: true } },
        assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
        quotes: { select: { id: true, lines: { select: { amountPaise: true } } } },
      },
    });
    if (!row) return null;

    const quoted = row.quotes.reduce(
      (sum, q) => sum + q.lines.reduce((s, l) => s + fromDb(l.amountPaise), 0),
      0,
    );

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      society: row.society,
      locality: row.locality,
      config: row.config,
      carpetSqft: row.carpetSqft,
      source: row.source as ClientSourceName,
      sourceNote: row.sourceNote,
      stageId: row.stage.id,
      stageName: row.stage.name,
      stageKind: row.stage.kind as StageKindName,
      stageColour: row.stage.colour,
      lostReason: row.lostReason as LostReasonName | null,
      nextAction: row.nextAction,
      nextActionOn: row.nextActionOn,
      fromMarketplace: row.briefId !== null || row.introductionId !== null,
      notes: row.notes,
      quoteCount: row.quotes.length,
      quotedPaise: row.quotes.length > 0 ? quoted : null,
      isDemo: row.isDemo,
      assignedToId: row.assignedToId,
      assignedToName: row.assignedTo ? personName(row.assignedTo.user) : null,
      lastContactedAt: row.lastContactedAt,
      fields: readValues(row.fields),
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    console.error('[studio-practice] clientById failed', error);
    return null;
  }
}

export async function findClients(query: string): Promise<FoundClient[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const digits = q.replace(/\D/g, '');

  try {
    const rows = await prisma.studioClient.findMany({
      where: {
        studioId,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { society: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        phone: true,
        society: true,
        stage: { select: { name: true } },
        assignedTo: { select: { user: { select: { name: true, email: true } } } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      society: r.society,
      stageName: r.stage.name,
      assignedToName: r.assignedTo ? personName(r.assignedTo.user) : null,
    }));
  } catch (error) {
    console.error('[studio-practice] findClients failed', error);
    return [];
  }
}
