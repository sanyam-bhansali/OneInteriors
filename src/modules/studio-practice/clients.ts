import 'server-only';

/**
 * A studio's own clients.
 *
 * Same rule as everywhere in this folder: **every query is scoped by the studio
 * id from the session, and nothing here takes one as an argument.** These rows
 * are named people with phone numbers, for projects that in most cases have
 * nothing to do with us. We hold them as a processor.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, type Paise } from '@/lib/money';
import { myStudioId } from '@/modules/studio-quote/store';
import { myStages, intakeStageId } from './stages';
import { myFields } from './fields';
import { cleanValues, problemSentence, readValues, type FieldValues } from './field-values';

// The vocabulary is pure and lives next door so client components can import
// it without dragging Prisma into the browser bundle — CONTRIBUTING §9.5.
export { SOURCE_LABELS, LOST_LABELS, BOARD_KINDS, CLOSED_KINDS } from './vocabulary';
export type { ClientSourceName, LostReasonName, StageKindName } from './vocabulary';

import { BOARD_KINDS } from './vocabulary';
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
  /** Whatever the studio defined in Settings → Fields, keyed by the field key. */
  fields: FieldValues;
  updatedAt: Date;
}

export async function myClients(): Promise<ClientRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioClient.findMany({
      where: { studioId },
      orderBy: [{ nextActionOn: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      include: {
        stage: { select: { id: true, name: true, kind: true, colour: true } },
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
        fields: readValues(row.fields),
        updatedAt: row.updatedAt,
      };
    });
  } catch (error) {
    console.error('[studio-practice] myClients failed', error);
    return [];
  }
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
      where: { id: input.id, studioId },
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
