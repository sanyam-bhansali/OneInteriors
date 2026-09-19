import 'server-only';

/**
 * A studio's own clients.
 *
 * Same rule as everywhere in this folder: **every query is scoped by the studio
 * id from the session, and nothing here takes one as an argument.** These rows
 * are named people with phone numbers, for projects that in most cases have
 * nothing to do with us. We hold them as a processor.
 */

import { LIVE } from './demo-lead';
import { prisma } from '@/lib/prisma';
import { fromDb, type Paise } from '@/lib/money';
import { myStudioId } from '@/modules/studio-quote/store';
import { myStages, intakeStageId } from './stages';
import { myFields } from './fields';
import { cleanValues, problemSentence, readValues, type FieldValues } from './field-values';
import { IMPORT_SOURCE, IMPORT_NOTE, type ImportRow } from './csv';

export type { ImportRow, ColumnKey, ImportPlan } from './csv';
export { parseCsv, guessMapping, planImport, COLUMN_LABELS } from './csv';

// The vocabulary is pure and lives next door so client components can import
// it without dragging Prisma into the browser bundle — CONTRIBUTING §9.5.
export { SOURCE_LABELS, LOST_LABELS, BOARD_KINDS, CLOSED_KINDS, BIN_DAYS } from './vocabulary';
export type { ClientSourceName, LostReasonName, StageKindName } from './vocabulary';

import { BOARD_KINDS, BIN_DAYS } from './vocabulary';
import type { ClientSourceName, LostReasonName, StageKindName } from './vocabulary';

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
}

export async function myClients(): Promise<ClientRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioClient.findMany({
      // `deletedAt: null` on every read of this table, without exception.
      // A deleted client reappearing on the board is worse than one that
      // never deleted — see the note on the column in schema.prisma.
      where: { studioId, deletedAt: null },
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
}

export async function addClient(input: NewClientInput): Promise<CreateResult> {
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
        phone: input.phone?.trim() || null,
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
    const { count } = await prisma.studioClient.updateMany({
      where: { id: { in: ids }, studioId, deletedAt: null },
      data: { assignedToId: memberId },
    });
    if (count === 0) return { ok: false, error: 'None of those are yours.' };
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
export async function logContact(id: string): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  try {
    const { count } = await prisma.studioClient.updateMany({
      where: { id, studioId, deletedAt: null },
      data: { lastContactedAt: new Date() },
    });
    if (count === 0) return { ok: false, error: 'That client is not yours.' };
    return { ok: true };
  } catch (error) {
    return saveFailed('logContact', error);
  }
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

    const { count } = await prisma.studioClient.updateMany({
      where: { id: { in: ids }, studioId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) return { ok: false, error: 'None of those are yours.' };
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
    const { count } = await prisma.studioClient.updateMany({
      where: { id: { in: ids }, studioId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) return { ok: false, error: 'Nothing to restore.' };
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
export async function importClients(rows: ImportRow[]): Promise<ImportResult | { ok: false; error: string }> {
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
        source: IMPORT_SOURCE,
        sourceNote: IMPORT_NOTE,
        // Unassigned on purpose. See the note above.
        assignedToId: null,
      })),
      skipDuplicates: true,
    });

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
