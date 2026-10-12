'use server';

import { revalidatePath } from 'next/cache';
import { countExistingPhones, importClients } from '@/modules/studio-practice/clients';
import { parseCsv, planImport, type ColumnKey } from '@/modules/studio-practice/csv';
import { setFormActive } from '@/modules/studio-practice/capture';
import { isCustomColumn } from '@/modules/studio-sales/intake-rules';
import { SOURCE_LABELS, type ClientSourceName } from '@/modules/studio-practice/vocabulary';

const isSource = (v: unknown): v is ClientSourceName => typeof v === 'string' && v in SOURCE_LABELS;

/**
 * Writing an import.
 *
 * ## Why this takes the file text, not the rows
 *
 * The obvious design is for the browser to run `planImport`, show the plan,
 * and post the agreed rows. It would work and it would be wrong: a server
 * action is a public endpoint, so "the rows the browser sent" means anybody
 * can write whatever they like into this studio's client list — names, notes,
 * five thousand of them — without ever seeing the mapping screen.
 *
 * So the browser sends what the person actually chose: the file, and which
 * column is which. The server parses and plans it again, with the same pure
 * functions, and writes only what those produce. The preview the person
 * agreed to and the rows that get written come from one piece of code, which
 * also means the preview cannot drift from the result.
 *
 * The cost is parsing twice. On a few thousand rows that is a few
 * milliseconds, and it buys the guarantee that nothing reaches the database
 * that the normalising did not produce.
 */

export type ImportState =
  | { idle: true }
  | { ok: true; written: number; alreadyHere: number; skippedNoName: number; duplicatesInFile: number }
  | { ok: false; error: string };

/**
 * Only the action itself is exported as a value from here.
 *
 * A `'use server'` file is meant to export async functions and nothing else —
 * every other export becomes a remote endpoint. The idle state is an object,
 * so it lives with the component that needs it. (The older `actions.ts` files
 * in this folder still export an `IDLE` constant; worth tidying, but not in
 * this change.)
 */

/** Above this the server action body limit rejects the request anyway. */
const MAX_CHARS = 900_000;

const KEYS: ColumnKey[] = [
  'name', 'phone', 'email', 'society', 'locality', 'config', 'notes', 'skip',
];

/**
 * `source` is where the list came from, chosen on the screen (it used to be
 * asked and never passed); `leadSourceId` one of the studio's own names.
 * A column may also be mapped to one of the studio's own fields
 * (`custom:<key>`); values are checked against the field on write.
 */
export async function importCsvAction(text: string, mapping: string[], source = 'OTHER', leadSourceId: string | null = null): Promise<ImportState> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'No file.' };
  }
  if (text.length > MAX_CHARS) {
    return { ok: false, error: 'That file is too large to send in one go. Split it in half.' };
  }
  if (!Array.isArray(mapping)) {
    return { ok: false, error: 'Something went wrong reading the columns. Start again.' };
  }

  // Anything unrecognised becomes `skip` rather than an error: a column key
  // this build does not know is a column that should not be written.
  const clean: string[] = mapping.map((m) =>
    KEYS.includes(m as ColumnKey) || (typeof m === 'string' && isCustomColumn(m) && m.length <= 60) ? m : 'skip',
  );

  if (!clean.includes('name')) {
    return { ok: false, error: 'Nothing is mapped to Name, so there is nobody to import.' };
  }

  const plan = planImport(parseCsv(text), clean);
  if (plan.rows.length === 0) {
    return { ok: false, error: 'No rows have a usable name.' };
  }

  const picked = isSource(source) && source !== 'ONE_INTERIORS' ? source : 'OTHER';
  const result = await importClients(plan.rows, picked, typeof leadSourceId === 'string' ? leadSourceId.slice(0, 64) : null);
  if (!result.ok) return result;

  revalidatePath('/studio/clients');
  revalidatePath('/studio');

  return {
    ok: true,
    written: result.written,
    alreadyHere: result.alreadyHere,
    skippedNoName: plan.skippedNoName,
    duplicatesInFile: plan.duplicatesInFile,
  };
}

/**
 * Turn the public enquiry form on or off.
 *
 * Lives beside the import action because the control lives on the import
 * page — both are "how a lead gets in" — and a studio that pauses the form
 * has done so deliberately, so there is nothing to confirm.
 */
export async function setFormActiveAction(active: boolean): Promise<{ ok: boolean }> {
  const result = await setFormActive(active);
  if (result.ok) revalidatePath('/studio/clients/import');
  return result;
}

/**
 * The dry run (leads at scale): how many of the file's numbers are already
 * on your list. Read only; owner and PM (the module finds no studio for
 * anyone else). Sent in pieces of up to 5,000 numbers.
 */
export async function importCheckAction(phones: string[]): Promise<{ already: number }> {
  if (!Array.isArray(phones)) return { already: 0 };
  return { already: await countExistingPhones(phones.slice(0, 5000).filter((p) => typeof p === 'string')) };
}
