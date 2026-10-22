import 'server-only';

/**
 * A studio's pipeline.
 *
 * ## The trade
 *
 * The studio owns the names, the order, the colours and the length of the
 * list. We own the four meanings in `StageKind`, because Projects, the
 * dashboard and the ledger all have to keep working after somebody renames
 * "Booked" to "Advance received" on a Tuesday afternoon.
 *
 * ## The rules this file enforces
 *
 * Three, and each one exists because breaking it strands data rather than
 * merely looking wrong:
 *
 *   1. **Exactly one intake stage.** It is where a new client lands. Two of
 *      them is ambiguous; none of them means `addClient` has nowhere to put
 *      the row.
 *   2. **At least one stage of each kind.** Delete the last WON stage and no
 *      project can ever be started again — the software would be broken by a
 *      settings change with no error anywhere near it.
 *   3. **A stage holding clients cannot be deleted.** The foreign key is
 *      `RESTRICT`, so Postgres would refuse anyway; this refuses first, with
 *      a sentence that says how many and what to do.
 *
 * Every query is scoped by the studio id from the session and nothing here
 * takes one as an argument — the rule for this whole folder.
 */

import { writePresetPlan } from './preset-apply';
import { prisma } from '@/lib/prisma';
import { planPreset } from './pipeline-preset';
/* Sales roles (owner, 22 Oct 2026): changing the board's columns and fields is `lead.settings` (owner, PM, a sales role with lead settings). */
import { leadSettingsStudioId, leadStudioId } from '@/modules/studio/lead-scope';
import {
  DEFAULT_STAGES,
  BOARD_KINDS,
  type ColourToken,
  type StageKindName,
} from './vocabulary';
// The rules worth testing live next door, pure. CONTRIBUTING §9.5.
import { wouldStrand, nextSortOrder } from './pipeline-rules';

export {
  STAGE_KIND_LABELS,
  STAGE_KIND_NOTES,
  STAGE_COLOURS,
  COLOUR_TOKENS,
  BOARD_KINDS,
  CLOSED_KINDS,
  colourOf,
} from './vocabulary';
export type { StageKindName, ColourToken } from './vocabulary';

export interface StageRow {
  id: string;
  name: string;
  kind: StageKindName;
  colour: ColourToken;
  sortOrder: number;
  isIntake: boolean;
  /** One of the cold-calling steps (owner, 21 Oct 2026; call-step-rules.ts). */
  isCallStep: boolean;
  /** How many clients sit here. Drives the column count and blocks deletion. */
  clientCount: number;
}

export type Result = { ok: true } | { ok: false; error: string };

/**
 * The studio's stages, seeding the six defaults on first read.
 *
 * Seeding here rather than at approval time, for the same reason the product
 * master does it: a studio approved last month would otherwise have an empty
 * pipeline and a client list it could not add to. Idempotent — the insert is
 * skipped entirely once any stage exists, so a studio that deleted a column
 * does not find it handed back on the next page load.
 */
export async function myStages(): Promise<StageRow[]> {
  const studioId = await leadStudioId();
  if (!studioId) return [];

  try {
    let rows = await prisma.studioStage.findMany({
      where: { studioId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { clients: true } } },
    });

    /* Same migration path as the catalogue: `provisionWorkspace()` writes
       these at approval now, and this branch only catches studios created
       before it existed. See modules/studio/provision.ts. */
    if (rows.length === 0) {
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

      rows = await prisma.studioStage.findMany({
        where: { studioId },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { clients: true } } },
      });
    }

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind as StageKindName,
      colour: r.colour as ColourToken,
      sortOrder: r.sortOrder,
      isIntake: r.isIntake,
      isCallStep: r.isCallStep,
      clientCount: r._count.clients,
    }));
  } catch (error) {
    console.error('[studio-practice] myStages failed', error);
    return [];
  }
}

/** Where a new client lands. Falls back to the first stage rather than failing. */
export async function intakeStageId(): Promise<string | null> {
  const stages = await myStages();
  return stages.find((s) => s.isIntake)?.id ?? stages[0]?.id ?? null;
}

/** The ids drawn as columns. Used by the board and by "waiting on you". */
export async function boardStageIds(): Promise<string[]> {
  const stages = await myStages();
  return stages.filter((s) => BOARD_KINDS.includes(s.kind)).map((s) => s.id);
}

export async function addStage(input: {
  name: string;
  kind: StageKindName;
  colour: ColourToken;
}): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Give the column a name.' };
  if (name.length > 40) return { ok: false, error: 'Shorter — it has to fit a column heading.' };

  try {
    const existing = await prisma.studioStage.findMany({
      where: { studioId },
      select: { sortOrder: true },
    });

    await prisma.studioStage.create({
      data: {
        studioId,
        name,
        kind: input.kind,
        colour: input.colour,
        sortOrder: nextSortOrder(existing),
      },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, error: 'You already have a column with that name.' };
    }
    console.error('[studio-practice] addStage failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

export async function renameStage(id: string, name: string): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const next = name.trim();
  if (next.length < 2) return { ok: false, error: 'Give the column a name.' };
  if (next.length > 40) return { ok: false, error: 'Shorter — it has to fit a column heading.' };

  try {
    const { count } = await prisma.studioStage.updateMany({
      where: { id, studioId },
      data: { name: next },
    });
    if (count === 0) return { ok: false, error: 'That column is not yours.' };
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, error: 'You already have a column with that name.' };
    }
    return { ok: false, error: 'That did not save.' };
  }
}

export async function recolourStage(id: string, colour: ColourToken): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const { count } = await prisma.studioStage.updateMany({
    where: { id, studioId },
    data: { colour },
  });
  return count === 0 ? { ok: false, error: 'That column is not yours.' } : { ok: true };
}

/**
 * Change what a column MEANS.
 *
 * Allowed, because a studio that added "Advance received" as OPEN and then
 * realised it is the moment a job is won should be able to say so. Refused
 * when it would empty a kind — see rule 2 at the top of this file.
 */
export async function setStageKind(id: string, kind: StageKindName): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const stages = await myStages();
  const stage = stages.find((s) => s.id === id);
  if (!stage) return { ok: false, error: 'That column is not yours.' };
  if (stage.kind === kind) return { ok: true };

  const stranded = wouldStrand(stages, id, kind);
  if (stranded) return { ok: false, error: stranded };

  try {
    /* A calling step is an open column; one that stops being open stops being a step. */
    await prisma.studioStage.updateMany({ where: { id, studioId }, data: { kind, ...(kind !== 'OPEN' ? { isCallStep: false } : {}) } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * Mark a column as one of the cold-calling steps, or not (owner, 21 Oct
 * 2026). A call nobody picked up then suggests the next step, pre-ticked
 * (call-step-rules.ts). Only an open column can be one: a lead in a won or
 * lost column is not being cold-called.
 */
export async function setCallStep(id: string, on: boolean): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const stage = (await myStages()).find((s) => s.id === id);
  if (!stage) return { ok: false, error: 'That column is not yours.' };
  if (on && stage.kind !== 'OPEN') return { ok: false, error: 'Only a column still in play can be a calling step.' };

  try {
    await prisma.studioStage.updateMany({ where: { id, studioId }, data: { isCallStep: on === true } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/** Move a column one place. Swaps sort orders rather than renumbering the list. */
export async function moveStage(id: string, direction: 'up' | 'down'): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const stages = await myStages();
  const index = stages.findIndex((s) => s.id === id);
  if (index < 0) return { ok: false, error: 'That column is not yours.' };

  const swapWith = direction === 'up' ? stages[index - 1] : stages[index + 1];
  if (!swapWith) return { ok: true };

  const here = stages[index]!;

  try {
    await prisma.$transaction([
      prisma.studioStage.update({ where: { id: here.id }, data: { sortOrder: swapWith.sortOrder } }),
      prisma.studioStage.update({ where: { id: swapWith.id }, data: { sortOrder: here.sortOrder } }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/** Which column a new client lands in. Exactly one, so this clears the others. */
export async function setIntakeStage(id: string): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const stages = await myStages();
  const stage = stages.find((s) => s.id === id);
  if (!stage) return { ok: false, error: 'That column is not yours.' };
  if (stage.kind !== 'OPEN') {
    return {
      ok: false,
      error: 'New clients have to land somewhere that is still in play.',
    };
  }

  try {
    await prisma.$transaction([
      prisma.studioStage.updateMany({ where: { studioId }, data: { isIntake: false } }),
      prisma.studioStage.update({ where: { id }, data: { isIntake: true } }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

export async function removeStage(id: string): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const stages = await myStages();
  const stage = stages.find((s) => s.id === id);
  if (!stage) return { ok: false, error: 'That column is not yours.' };

  if (stage.isIntake) {
    return {
      ok: false,
      error: 'This is where new clients land. Make another column the intake first.',
    };
  }

  if (stage.clientCount > 0) {
    return {
      ok: false,
      error: `${stage.clientCount} ${stage.clientCount === 1 ? 'client is' : 'clients are'} sitting in this column. Move them before you delete it.`,
    };
  }

  const stranded = wouldStrand(stages, id, null);
  if (stranded) return { ok: false, error: stranded };

  try {
    await prisma.studioStage.deleteMany({ where: { id, studioId } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'That did not save.' };
  }
}

/**
 * "Use the Hauspire pipeline" (owner, 12 Oct 2026): rename and add columns to
 * match Hauspire's, in its order (`pipeline-preset.ts planPreset`). One
 * transaction; never deletes a column. Owner and PM (Settings).
 */
export async function applyHauspirePipeline(): Promise<Result> {
  const studioId = await leadSettingsStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };
  const stages = await myStages();
  const plan = planPreset(stages);
  try {
    await prisma.$transaction((tx) => writePresetPlan(tx, studioId, plan));
    return { ok: true };
  } catch (error) {
    console.error('[studio-practice] hauspire pipeline failed', error);
    return { ok: false, error: 'That did not save. Nothing was changed.' };
  }
}
