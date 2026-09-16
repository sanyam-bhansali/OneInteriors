import 'server-only';

/**
 * The extra things a studio captures on every client.
 *
 * Carpet area, society, possession month, BHK, which tower, whose referral —
 * every studio wants a slightly different handful and not one of them is worth
 * a schema migration. So the definitions live in a table the studio edits and
 * the values live in a jsonb column on the client, keyed by `key`.
 *
 * ## label vs key
 *
 * `label` is what a studio reads and may change whenever they like. `key` is
 * derived from the label ONCE, at creation, and then frozen — because the key
 * is what every captured value is filed under. If renaming "Society" to
 * "Project / Society" moved the key, every value already recorded would still
 * be in the row and invisible in the interface, which is the worst of both.
 *
 * The pure half — validation, grouping — is in `field-values.ts` so the tests
 * and the client components can reach it. CONTRIBUTING §9.5.
 */

import { prisma } from '@/lib/prisma';
import { myStudioId } from '@/modules/studio-quote/store';
import { fieldKeyFrom, GROUPABLE_TYPES, type FieldTypeName } from './vocabulary';
import { nextSortOrder } from './pipeline-rules';

export { FIELD_TYPE_LABELS, GROUPABLE_TYPES, fieldKeyFrom } from './vocabulary';
export type { FieldTypeName } from './vocabulary';
export type { FieldShape, FieldValues } from './field-values';

export interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: FieldTypeName;
  options: string[];
  groupBy: boolean;
  sortOrder: number;
}

export type Result = { ok: true } | { ok: false; error: string };

/**
 * The studio's fields. Empty is the correct starting point.
 *
 * No defaults, on purpose. A field we invented is a question we decided a
 * studio should ask its clients, and the ones that matter differ by how a
 * studio sells — somebody working one tower at a time needs Society, somebody
 * living on architect referrals needs the architect's name and will never once
 * type a society.
 */
export async function myFields(): Promise<FieldRow[]> {
  const studioId = await myStudioId();
  if (!studioId) return [];

  try {
    const rows = await prisma.studioField.findMany({
      where: { studioId },
      orderBy: { sortOrder: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      type: r.type as FieldTypeName,
      options: r.options,
      groupBy: r.groupBy,
      sortOrder: r.sortOrder,
    }));
  } catch (error) {
    console.error('[studio-practice] myFields failed', error);
    return [];
  }
}

export async function addField(input: {
  label: string;
  type: FieldTypeName;
  options?: string;
}): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const label = input.label.trim();
  if (label.length < 2) return { ok: false, error: 'What is the field called?' };
  if (label.length > 60) return { ok: false, error: 'Shorter — this is a form label.' };

  const key = fieldKeyFrom(label);
  if (key.length < 2) {
    return { ok: false, error: 'That name has no letters or numbers in it.' };
  }

  const options =
    input.type === 'SELECT'
      ? (input.options ?? '')
          .split(',')
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
          .slice(0, 40)
      : [];

  if (input.type === 'SELECT' && options.length < 2) {
    return { ok: false, error: 'A list needs at least two choices, separated by commas.' };
  }

  try {
    const existing = await prisma.studioField.findMany({
      where: { studioId },
      select: { sortOrder: true },
    });

    await prisma.studioField.create({
      data: { studioId, key, label, type: input.type, options, sortOrder: nextSortOrder(existing) },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { ok: false, error: 'You already have a field with that name.' };
    }
    console.error('[studio-practice] addField failed', error);
    return { ok: false, error: 'That did not save.' };
  }
}

/** Rename the label. The key does not move — see the note at the top. */
export async function renameField(id: string, label: string): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const next = label.trim();
  if (next.length < 2) return { ok: false, error: 'What is the field called?' };
  if (next.length > 60) return { ok: false, error: 'Shorter — this is a form label.' };

  const { count } = await prisma.studioField.updateMany({
    where: { id, studioId },
    data: { label: next },
  });
  return count === 0 ? { ok: false, error: 'That field is not yours.' } : { ok: true };
}

export async function setFieldGrouping(id: string, groupBy: boolean): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const field = await prisma.studioField.findFirst({
    where: { id, studioId },
    select: { type: true },
  });
  if (!field) return { ok: false, error: 'That field is not yours.' };

  // A number groups into one bucket per client, which is a list with headings
  // rather than a grouping.
  if (groupBy && !GROUPABLE_TYPES.includes(field.type as FieldTypeName)) {
    return { ok: false, error: 'A number field cannot group the list usefully.' };
  }

  await prisma.studioField.updateMany({ where: { id, studioId }, data: { groupBy } });
  return { ok: true };
}

/**
 * Delete a field.
 *
 * The values stay in the clients' jsonb until they are next saved, which is
 * deliberate: a field deleted by mistake at 11pm can be recreated with the
 * same name the next morning and everything is still there, because the key
 * is derived from the label and is therefore the same key.
 */
export async function removeField(id: string): Promise<Result> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false, error: 'No studio on this account.' };

  const { count } = await prisma.studioField.deleteMany({ where: { id, studioId } });
  return count === 0 ? { ok: false, error: 'That field is not yours.' } : { ok: true };
}
